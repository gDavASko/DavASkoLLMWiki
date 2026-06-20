#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 * DavASkoLLMWiki v3.x — Скрипт-Индексатор (build-index.js)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Инкрементальная индексация базы знаний с векторным шардированием.
 *
 * Алгоритм:
 *   1. Сканирование слоёв (wiki.json) и папок-кластеров
 *   2. Расчёт и кэширование центроидов папок (passage: prefix)
 *   3. MD5-контроль изменений файлов (по тексту выжимки)
 *   4. Мультиязычный чанкинг (1200 слов, 200 слов перекрытие)
 *   5. Векторизация чанков через jinaai/jina-embeddings-v3 (FP16, 1024d)
 *   6. Динамическая кластеризация по ближайшему центроиду
 *   7. Внутришардовая сортировка по косинусной близости
 *
 * Использование:
 *   node system/build-index.js
 *   node system/build-index.js --force   (полная пересборка без MD5-кэша)
 *
 * Модель: jinaai/jina-embeddings-v3
 * Ревизия: 815152ccf78fb243a0d9b4db0b80ec6ef87e2213
 * Режим: строго оффлайн (allowRemoteModels = false)
 * ═══════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// ─── ESM __dirname Shim ──────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Paths ───────────────────────────────────────────────────────────
const SYSTEM_DIR   = __dirname;
const ROOT_DIR     = path.resolve(SYSTEM_DIR, '..');
const MODELS_CACHE = path.join(SYSTEM_DIR, 'models-cache');
const INDEX_FILE   = path.join(SYSTEM_DIR, 'wiki-index.json');
const SHARDS_DIR   = path.join(SYSTEM_DIR, 'index-shards');

// ─── Model Configuration ────────────────────────────────────────────
const MODEL_ID       = 'jinaai/jina-embeddings-v3';
const MODEL_REVISION = '815152ccf78fb243a0d9b4db0b80ec6ef87e2213';
const VECTOR_DIM     = 1024;
const DTYPE          = 'fp16';

// ─── Chunking Configuration ─────────────────────────────────────────
const CHUNK_SIZE_WORDS    = 1200;
const CHUNK_OVERLAP_WORDS = 200;

// ─── Folder Blacklist (не индексируются) ─────────────────────────────
const FOLDER_BLACKLIST = new Set([
  '.git', '.github', '.obsidian', '.vscode',
  'system', 'node_modules', 'plans', 'NewData',
  'raw', 'ai-skills~', 'skills',
  '.agents', '.cursor', '.claude', '.gemini',
  '.cline', '.codex', '.roo', '.windsurf',
]);

// ─── ANSI Colors ─────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  red:     '\x1b[31m',
  dim:     '\x1b[2m',
};

// ═══════════════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/** Чтение файла UTF-8 с удалением BOM */
function readText(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  return content;
}

/** Запись файла UTF-8 с BOM */
function writeTextBom(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  fs.writeFileSync(filePath, Buffer.concat([bom, Buffer.from(content, 'utf8')]));
}

/** MD5-хэш строки */
function md5(text) {
  return crypto.createHash('md5').update(text, 'utf8').digest('hex');
}

/** Косинусное сходство двух векторов */
function cosineSimilarity(a, b) {
  const len = Math.min(a.length, b.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < len; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Парсинг YAML-фронтматтера из маркдауна.
 * Возвращает { meta: {...}, body: "..." }
 */
function parseFrontmatter(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!fmMatch) {
    return { meta: {}, body: content };
  }

  const yamlBlock = fmMatch[1];
  const body = content.slice(fmMatch[0].length);
  const meta = {};

  for (const line of yamlBlock.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key   = line.slice(0, colonIdx).trim();
    let   value = line.slice(colonIdx + 1).trim();

    if (!key || key.startsWith('#') || key.startsWith('-')) continue;

    // Inline YAML array: [item1, item2]
    const arrMatch = value.match(/^\[(.+)\]$/);
    if (arrMatch) {
      meta[key] = arrMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    // WikiLink: [[target]]
    const wlMatch = value.match(/^\[\[(.+?)\]\]$/);
    if (wlMatch) {
      meta[key] = wlMatch[1];
      continue;
    }

    // Quoted string
    value = value.replace(/^["']|["']$/g, '');
    meta[key] = value;
  }

  return { meta, body };
}

/**
 * Извлечение всех [[WikiLinks]] из тела маркдауна.
 */
function extractWikiLinks(body) {
  const links = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    links.push(m[1]);
  }
  return [...new Set(links)];
}

/**
 * Мультиязычный чанкинг текста.
 * Нарезает текст на куски по CHUNK_SIZE_WORDS слов
 * с перекрытием CHUNK_OVERLAP_WORDS.
 */
function chunkText(text) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + CHUNK_SIZE_WORDS, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end >= words.length) break;
    start += CHUNK_SIZE_WORDS - CHUNK_OVERLAP_WORDS;
  }

  return chunks;
}

/**
 * Рекурсивный обход директории с фильтрацией расширений.
 */
function getFilesRecursively(dir, extensions) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith('.') || entry.endsWith('.meta')) continue;
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!FOLDER_BLACKLIST.has(entry)) {
        results.push(...getFilesRecursively(fullPath, extensions));
      }
    } else {
      const ext = path.extname(entry).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════
//  INDEX DATA STRUCTURES
// ═══════════════════════════════════════════════════════════════════════

function createEmptyIndex() {
  return {
    version: '3.0',
    model: MODEL_ID,
    revision: MODEL_REVISION,
    vectorDim: VECTOR_DIM,
    chunkWords: CHUNK_SIZE_WORDS,
    overlapWords: CHUNK_OVERLAP_WORDS,
    updatedAt: new Date().toISOString(),
    clusters_centroids: {},
    documents: {},
  };
}

function loadIndex() {
  if (fs.existsSync(INDEX_FILE)) {
    try {
      const raw = readText(INDEX_FILE);
      return JSON.parse(raw);
    } catch {
      console.log(`${C.yellow}[WARN]${C.reset} wiki-index.json повреждён, создаём новый.`);
    }
  }
  return createEmptyIndex();
}

function loadShard(clusterName) {
  const shardPath = path.join(SHARDS_DIR, `embeddings-${clusterName}.json`);
  if (fs.existsSync(shardPath)) {
    try {
      return JSON.parse(readText(shardPath));
    } catch {
      return [];
    }
  }
  return [];
}

function saveShard(clusterName, data) {
  if (!fs.existsSync(SHARDS_DIR)) fs.mkdirSync(SHARDS_DIR, { recursive: true });
  const shardPath = path.join(SHARDS_DIR, `embeddings-${clusterName}.json`);
  fs.writeFileSync(shardPath, JSON.stringify(data));
}

// ═══════════════════════════════════════════════════════════════════════
//  MODEL INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════

async function initModel() {
  console.log(`${C.cyan}[*]${C.reset} Initializing WebGPU Shaders (First run may take 2 seconds)...`);
  const startMs = Date.now();

  // Динамический импорт библиотеки трансформеров
  const { pipeline, env } = await import('@huggingface/transformers');

  // Оффлайн-режим: запрет на скачивание моделей из сети
  env.allowRemoteModels = false;
  env.cacheDir = MODELS_CACHE;
  env.localModelPath = MODELS_CACHE;

  let extractor;
  try {
    extractor = await pipeline('feature-extraction', MODEL_ID, {
      revision: MODEL_REVISION,
      dtype: DTYPE,
    });
  } catch (err) {
    console.error(`\n${C.red}[FATAL]${C.reset} Не удалось загрузить модель из ${MODELS_CACHE}`);
    console.error(`  Убедитесь, что модель скачана: node system/scripts/setup-model.js`);
    console.error(`  Ошибка: ${err.message}\n`);
    process.exit(1);
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`${C.green}[OK]${C.reset} Модель загружена за ${elapsed}s (${DTYPE}, ${VECTOR_DIM}d)\n`);

  return extractor;
}

/**
 * Генерация вектора для текста с нормализацией и обрезкой до VECTOR_DIM.
 * @param {Object} extractor — pipeline feature-extraction
 * @param {string} text — текст с уже подставленным prefix (passage:/query:)
 * @param {number} taskId — ID задачи для Jina v3 (по умолчанию 1 = passage)
 * @returns {number[]} — вектор длиной VECTOR_DIM
 */
async function embed(extractor, text, taskId = 1) {
  let cleanText = text;
  let resolvedTaskId = taskId;
  if (text.startsWith('passage: ')) {
    resolvedTaskId = 1;
    cleanText = text.slice(9);
  } else if (text.startsWith('query: ')) {
    resolvedTaskId = 0;
    cleanText = text.slice(7);
  }

  const { Tensor } = await import('@huggingface/transformers');
  const inputs = extractor.tokenizer(cleanText, {
    padding: true,
    truncation: true,
  });
  inputs.task_id = new Tensor('int64', BigInt64Array.from([BigInt(resolvedTaskId)]), [1]);
  const outputs = await extractor.model(inputs);

  let raw;
  if (outputs['13049']) {
    raw = Array.from(outputs['13049'].data);
  } else if (outputs['text_embeds']) {
    // Резервный mean pooling
    const lastHiddenState = outputs.text_embeds;
    const attentionMask = inputs.attention_mask;
    const [batchSize, seqLength, embedDim] = lastHiddenState.dims;
    const pooled = new Float32Array(batchSize * embedDim);
    for (let i = 0; i < batchSize; ++i) {
      for (let k = 0; k < embedDim; ++k) {
        let sum = 0;
        let count = 0;
        for (let j = 0; j < seqLength; ++j) {
          const attn = Number(attentionMask.data[i * seqLength + j]);
          count += attn;
          sum += lastHiddenState.data[i * embedDim * seqLength + j * embedDim + k] * attn;
        }
        pooled[i * embedDim + k] = sum / (count || 1);
      }
    }
    raw = Array.from(pooled);
  } else {
    throw new Error('Model outputs did not contain expected keys (13049 or text_embeds)');
  }

  let norm = Math.sqrt(raw.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) norm = 1;
  const normalized = raw.map(v => v / norm);

  if (normalized.length >= VECTOR_DIM) {
    return normalized.slice(0, VECTOR_DIM);
  }
  return [...normalized, ...new Array(VECTOR_DIM - normalized.length).fill(0)];
}

// ═══════════════════════════════════════════════════════════════════════
//  LAYER AND CLUSTER DISCOVERY
// ═══════════════════════════════════════════════════════════════════════

/**
 * Обнаруживает все слои (директории с wiki.json) в корне репозитория.
 * Возвращает массив: [{ name, dir, wikiDir }]
 */
function discoverLayers() {
  const layers = [];
  if (!fs.existsSync(ROOT_DIR)) return layers;

  for (const entry of fs.readdirSync(ROOT_DIR)) {
    if (FOLDER_BLACKLIST.has(entry)) continue;
    const fullPath = path.join(ROOT_DIR, entry);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    const manifestPath = path.join(fullPath, 'wiki.json');
    const wikiDir = path.join(fullPath, 'wiki');

    if (fs.existsSync(manifestPath) && fs.existsSync(wikiDir)) {
      layers.push({ name: entry, dir: fullPath, wikiDir });
    }
  }

  return layers;
}

// ═══════════════════════════════════════════════════════════════════════
//  CENTROID COMPUTATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Вычисляет или обновляет центроиды для каждого слоя-кластера.
 * Центроид = embedding("passage: <layer-name>").
 * Кэшируется в clusters_centroids.
 */
async function computeCentroids(extractor, layers, index) {
  const centroids = index.clusters_centroids || {};
  let computed = 0;

  for (const layer of layers) {
    if (centroids[layer.name] && Array.isArray(centroids[layer.name]) && centroids[layer.name].length === VECTOR_DIM) {
      continue; // Центроид уже закэширован
    }
    const vec = await embed(extractor, `passage: ${layer.name}`);
    centroids[layer.name] = vec;
    computed++;
  }

  if (computed > 0) {
    console.log(`${C.cyan}[*]${C.reset} Вычислено ${computed} новых центроидов кластеров.`);
  } else {
    console.log(`${C.dim}[*] Все центроиды загружены из кэша.${C.reset}`);
  }

  return centroids;
}

/**
 * Находит ближайший кластер для данного вектора.
 */
function findNearestCluster(vector, centroids) {
  let bestCluster = null;
  let bestScore   = -Infinity;

  for (const [clusterName, centroid] of Object.entries(centroids)) {
    const score = cosineSimilarity(vector, centroid);
    if (score > bestScore) {
      bestScore   = score;
      bestCluster = clusterName;
    }
  }

  return { cluster: bestCluster, score: bestScore };
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();
  const forceRebuild = process.argv.includes('--force');

  console.log(`\n${C.bold}═══ DavASkoLLMWiki v3.x — Индексатор ═══${C.reset}\n`);
  console.log(`${C.dim}Корень:       ${ROOT_DIR}`);
  console.log(`Модель:       ${MODEL_ID}`);
  console.log(`Чанки:        ${CHUNK_SIZE_WORDS} слов, перекрытие ${CHUNK_OVERLAP_WORDS}`);
  console.log(`Размерность:  ${VECTOR_DIM}d (${DTYPE})${C.reset}\n`);

  if (forceRebuild) {
    console.log(`${C.yellow}[!] Режим --force: полная пересборка индекса.${C.reset}\n`);
  }

  // 1. Обнаружение слоёв
  const layers = discoverLayers();
  if (layers.length === 0) {
    console.log(`${C.yellow}[WARN]${C.reset} Слои базы знаний не найдены (папки с wiki.json и wiki/).`);
    console.log(`       Создайте хотя бы один слой, например: llm-wiki/wiki.json`);
    process.exit(0);
  }
  console.log(`${C.cyan}[*]${C.reset} Найдено слоёв: ${layers.map(l => l.name).join(', ')}`);

  // 2. Загрузка существующего индекса
  const index = forceRebuild ? createEmptyIndex() : loadIndex();

  // 3. Инициализация модели
  const extractor = await initModel();

  // 4. Расчёт/загрузка центроидов
  index.clusters_centroids = await computeCentroids(extractor, layers, index);

  // 5. Сбор всех .md файлов из wiki/ каждого слоя
  const allFiles = [];
  for (const layer of layers) {
    const mdFiles = getFilesRecursively(layer.wikiDir, ['.md']);
    for (const f of mdFiles) {
      const basename = path.basename(f, '.md');
      // Пропускаем служебные файлы MOC
      if (['index', 'stubs', 'contradictions'].includes(basename)) continue;
      allFiles.push({ filePath: f, layer: layer.name });
    }
  }

  console.log(`${C.cyan}[*]${C.reset} Обнаружено ${allFiles.length} документов для индексации.\n`);

  // 6. Загрузка шардов в память для быстрого обновления
  const shards = {};
  for (const layer of layers) {
    shards[layer.name] = loadShard(layer.name);
  }

  // 7. Счётчики для статистики
  let countSkipped   = 0;
  let countNew       = 0;
  let countUpdated   = 0;
  let countChunks    = 0;

  // Трекинг обработанных файлов (для очистки устаревших записей)
  const processedIds = new Set();

  // 8. Обработка каждого файла
  for (let i = 0; i < allFiles.length; i++) {
    const { filePath, layer } = allFiles[i];
    const relPath  = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
    const basename = path.basename(filePath, '.md');

    // Чтение и парсинг
    const rawContent = readText(filePath);
    const { meta, body } = parseFrontmatter(rawContent);

    const fileId     = meta.id || basename;
    const symbols    = Array.isArray(meta.symbols) ? meta.symbols : [];
    const tags       = Array.isArray(meta.tags) ? meta.tags : [];
    const extendsRef = meta.extends || '';
    const wikiLinks  = extractWikiLinks(body);

    processedIds.add(fileId);

    // MD5-контроль по тексту выжимки (body без фронтматтера)
    const currentMd5 = md5(body);
    const existing   = index.documents[fileId];

    if (!forceRebuild && existing && existing.md5 === currentMd5) {
      countSkipped++;
      continue;
    }

    const isNew = !existing;
    if (isNew) countNew++; else countUpdated++;

    // Прогресс
    process.stdout.write(
      `  ${isNew ? C.green + '[NEW]' : C.yellow + '[UPD]'}${C.reset} ` +
      `${fileId}${C.dim} (${relPath})${C.reset}`
    );

    // 8a. Очистка старых чанков из шардов
    if (existing && existing.cluster && shards[existing.cluster]) {
      shards[existing.cluster] = shards[existing.cluster].filter(
        entry => entry.fileId !== fileId
      );
    }
    // Также чистим из всех других шардов (на случай миграции кластера)
    for (const clName of Object.keys(shards)) {
      shards[clName] = shards[clName].filter(entry => entry.fileId !== fileId);
    }

    // 8b. Чанкинг
    const chunks = chunkText(body);
    if (chunks.length === 0) {
      process.stdout.write(` — пустой, пропуск\n`);
      continue;
    }

    // 8c. Векторизация чанков (с префиксом passage:)
    let assignedCluster = layer; // По умолчанию — физический слой
    let bestCentroidScore = -Infinity;

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunkVec = await embed(extractor, `passage: ${chunks[ci]}`);

      // Определяем ближайший кластер для ПЕРВОГО чанка (определяет кластер документа)
      if (ci === 0) {
        const nearest = findNearestCluster(chunkVec, index.clusters_centroids);
        assignedCluster   = nearest.cluster || layer;
        bestCentroidScore = nearest.score;
      }

      // Вычисляем centroidScore относительно назначенного кластера
      const centroidVec = index.clusters_centroids[assignedCluster];
      const centroidScore = centroidVec ? cosineSimilarity(chunkVec, centroidVec) : 0;

      // Инициализация шарда, если его нет
      if (!shards[assignedCluster]) {
        shards[assignedCluster] = [];
      }

      shards[assignedCluster].push({
        fileId,
        chunkIndex: ci,
        centroidScore,
        embedding: chunkVec,
      });

      countChunks++;
    }

    // 8d. Обновление записи в мета-индексе
    index.documents[fileId] = {
      id: fileId,
      path: relPath,
      layer,
      symbols,
      tags,
      extends: extendsRef,
      wikilinks: wikiLinks,
      md5: currentMd5,
      chunksCount: chunks.length,
      cluster: assignedCluster,
    };

    process.stdout.write(
      ` → ${chunks.length} чанков → ${C.cyan}${assignedCluster}${C.reset}` +
      ` (score: ${bestCentroidScore.toFixed(3)})\n`
    );
  }

  // 9. Очистка устаревших документов из индекса
  let countRemoved = 0;
  for (const docId of Object.keys(index.documents)) {
    if (!processedIds.has(docId)) {
      const doc = index.documents[docId];
      // Удаление чанков из шарда
      if (doc.cluster && shards[doc.cluster]) {
        shards[doc.cluster] = shards[doc.cluster].filter(e => e.fileId !== docId);
      }
      delete index.documents[docId];
      countRemoved++;
    }
  }

  // 10. Внутришардовая сортировка по убыванию centroidScore
  for (const clName of Object.keys(shards)) {
    shards[clName].sort((a, b) => b.centroidScore - a.centroidScore);
  }

  // 11. Сохранение шардов на диск
  console.log('');
  for (const [clName, data] of Object.entries(shards)) {
    saveShard(clName, data);
    console.log(
      `${C.cyan}[*]${C.reset} Шард ${C.bold}embeddings-${clName}.json${C.reset}` +
      ` — ${data.length} векторов`
    );
  }

  // 12. Сохранение мета-индекса
  index.updatedAt = new Date().toISOString();
  writeTextBom(INDEX_FILE, JSON.stringify(index, null, 2));

  const totalDocs = Object.keys(index.documents).length;
  const totalClusters = Object.keys(index.clusters_centroids).length;

  console.log(
    `\n${C.cyan}[*]${C.reset} Мета-индекс ${C.bold}wiki-index.json${C.reset}` +
    ` — ${totalDocs} документов, ${totalClusters} кластеров`
  );

  // 13. Итоговая статистика
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${C.bold}═══ Итоги индексации ═══${C.reset}`);
  console.log(`  Новых:      ${C.green}${countNew}${C.reset}`);
  console.log(`  Обновлено:  ${C.yellow}${countUpdated}${C.reset}`);
  console.log(`  Без изменений: ${C.dim}${countSkipped}${C.reset}`);
  console.log(`  Удалено:    ${C.red}${countRemoved}${C.reset}`);
  console.log(`  Всего чанков: ${countChunks}`);
  console.log(`\n${C.green}[OK]${C.reset} Индекс собран за ${elapsed}s.\n`);
}

// ─── Entry Point ─────────────────────────────────────────────────────
main().catch(err => {
  console.error(`\n${C.red}[FATAL] ${err.message}${C.reset}`);
  console.error(err.stack);
  process.exit(1);
});
