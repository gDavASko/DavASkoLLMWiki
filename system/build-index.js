#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 * DavASkoLLMWiki v3.x — Скрипт-Индексатор (build-index.js)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Инкрементальная индексация базы знаний с векторным шардированием.
 *
 * Алгоритм:
 *   1. Сканирование слоёв (wiki.json); один шард на слой
 *   2. MD5-контроль изменений файлов (по тексту выжимки)
 *   3. Мультиязычный чанкинг (параметры из system/index-config.json)
 *   4. Векторизация чанков через jinaai/jina-embeddings-v3 (FP16, 1024d)
 *   5. Настоящие центроиды слоёв = среднее векторов их членов
 *   6. Внутришардовая сортировка по близости к центроиду
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
import { parseFrontmatter } from './lib/frontmatter.js';
import { chunkMarkdown } from './lib/chunker.js';
import { initModel as libInitModel, embedBatch as libEmbedBatch } from './lib/retrieval.js';
import { resolveModelsCache } from './lib/model-locator.js';

// ─── ESM __dirname Shim ──────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Paths ───────────────────────────────────────────────────────────
const SYSTEM_DIR   = __dirname;
const ROOT_DIR     = path.resolve(SYSTEM_DIR, '..');
// Путь к модели: общая системная копия (по системной метке) с фолбэком на
// репо-исходник <system>/models-cache. См. system/lib/model-locator.js.
const MODELS_CACHE = (() => {
  const r = resolveModelsCache({ localFallback: path.join(SYSTEM_DIR, 'models-cache') });
  return r.dir || r.hint;
})();
const INDEX_FILE   = path.join(SYSTEM_DIR, 'wiki-index.json');
const SHARDS_DIR   = path.join(SYSTEM_DIR, 'index-shards');

// ─── Model Configuration ────────────────────────────────────────────
const MODEL_ID       = 'jinaai/jina-embeddings-v3';
const MODEL_REVISION = '815152ccf78fb243a0d9b4db0b80ec6ef87e2213';
const VECTOR_DIM     = 1024;
const DTYPE          = 'fp16';

// ─── Indexing Configuration (externalized → system/index-config.json) ──
// Вынесено в конфиг, чтобы тюнить без правки кода. Файл может отсутствовать —
// тогда действуют дефолты ниже.
const INDEX_CONFIG_FILE = path.join(SYSTEM_DIR, 'index-config.json');
const INDEX_DEFAULTS = {
  index_code:          true,        // индексировать код (для базы ПРО КОД — по умолчанию да)
  chunk_strategy:      'structural',// 'structural' (по структуре Markdown) | 'fixed' (окно слов)
  chunk_size_words:    250,         // целевой размер чанка
  chunk_min_words:     80,          // мельче — сливается с соседом
  chunk_max_words:     400,         // крупнее — единственный случай хард-сплита
  chunk_overlap_words: 50,          // только для fixed-стратегии
  keep_code_atomic:    true,        // не рвать блоки ```...```
  heading_breadcrumbs: true,        // приписывать к чанку путь заголовков
  max_raw_file_bytes:  200 * 1024,  // raw/-файлы крупнее — пропускаются (ГДД/ТЗ → сотни чанков)
};
function loadIndexConfig() {
  try {
    const raw = fs.readFileSync(INDEX_CONFIG_FILE, 'utf8').replace(/^﻿/, '');
    return { ...INDEX_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...INDEX_DEFAULTS };
  }
}
const ICFG = loadIndexConfig();
const CHUNK_STRATEGY      = ICFG.chunk_strategy;
const CHUNK_SIZE_WORDS    = ICFG.chunk_size_words;
const CHUNK_MIN_WORDS     = ICFG.chunk_min_words;
const CHUNK_MAX_WORDS     = ICFG.chunk_max_words;
const CHUNK_OVERLAP_WORDS = ICFG.chunk_overlap_words;
const KEEP_CODE_ATOMIC    = ICFG.keep_code_atomic;
const HEADING_BREADCRUMBS = ICFG.heading_breadcrumbs;
const MAX_RAW_FILE_BYTES  = ICFG.max_raw_file_bytes;
const INDEX_CODE          = ICFG.index_code;
const EMBED_BATCH_SIZE    = ICFG.embed_batch_size || 16;
const DEVICE              = ICFG.device || 'auto';   // 'auto'(GPU→CPU) | 'dml' | 'cuda' | 'cpu'

// ─── Folder Blacklist (не индексируются) ─────────────────────────────
// ВАЖНО: 'raw' намеренно исключён — raw/-папки индексируются отдельным проходом.
// 'ai-skills~' и 'skills' остаются исключены: скилы не являются базой знаний.
const FOLDER_BLACKLIST = new Set([
  '.git', '.github', '.obsidian', '.vscode',
  'system', 'node_modules', 'plans', 'NewData',
  'ai-skills~', 'skills',
  '.agents', '.cursor', '.claude', '.gemini',
  '.cline', '.codex', '.roo', '.windsurf',
]);

// ─── Raw-folder internal blacklist (папки внутри raw/ которые не индексируются) ──
const RAW_FOLDER_BLACKLIST = new Set([
  'ai-skills~', 'skills', 'node_modules',
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

/** Запись файла UTF-8 с BOM (только для .md — см. Data Standards §1) */
function writeTextBom(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  fs.writeFileSync(filePath, Buffer.concat([bom, Buffer.from(content, 'utf8')]));
}

/** Запись файла UTF-8 без BOM (для .json и прочих не-md: BOM ломает JSON.parse) */
function writeTextNoBom(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(content, 'utf8'));
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
 * Авто-извлечение код-идентификаторов из текста для символьного потока (Stream A).
 * ВАЖНО: без этого symbols берутся только из frontmatter, и у raw/код-документов
 * symbols=[] → Stream A не находит классы по точному идентификатору (см. Data Standards §2).
 * Извлекаем те же классы, что и query-сторона: PascalCase (≥2 горба), интерфейсы I*,
 * поля m_*. Голые ALL-CAPS-аббревиатуры (JSON/API) не берём — это ранжирующий шум.
 * Капим до `limit` самых частых идентификаторов документа, чтобы не раздувать индекс.
 */
function extractCodeSymbols(text, limit = 60) {
  const freq = new Map();
  for (const tok of String(text).split(/[^A-Za-z0-9_]+/)) {
    if (!tok) continue;
    const ok = /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+$/.test(tok)  // PascalCase ≥2 humps
      || /^I[A-Z][A-Za-z0-9]+$/.test(tok)                        // I* interfaces
      || /^m_[A-Za-z][A-Za-z0-9_]*$/.test(tok);                  // m_ fields
    if (ok) freq.set(tok, (freq.get(tok) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(e => e[0]);
}

/**
 * Подготовка текста для эмбеддинга: вырезание блоков кода (```...```),
 * так как они не несут прямой семантической нагрузки для векторного поиска.
 */
function prepareTextForEmbedding(text, indexCode = INDEX_CODE) {
  let cleaned = text;
  if (indexCode) {
    // Индексируем код: убираем только маркеры ``` (и язык), текст кода сохраняем —
    // иначе примеры/сигнатуры/API нельзя найти семантически (это база ПРО КОД).
    cleaned = cleaned.replace(/```[\w+-]*\r?\n?/g, '');
  } else {
    // Не индексируем код: вырезаем блоки ```...``` целиком.
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  }
  // Инлайн-бэктики убираем всегда, текст внутри сохраняем.
  cleaned = cleaned.replace(/`/g, '');
  return cleaned;
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

// Тонкая обёртка над общим ядром ./lib/retrieval.js (логирование + константы).
// Эмбеддинг (включая shape-резолвер выходного тензора) и батчинг — там же,
// что и в query-wiki: единый источник, покрыт паритет-тестом.
async function initModel() {
  console.log(`${C.cyan}[*]${C.reset} Initializing model (first run may take a few seconds)...`);
  const startMs = Date.now();
  let extractor;
  try {
    extractor = await libInitModel({ modelsCache: MODELS_CACHE, modelId: MODEL_ID, revision: MODEL_REVISION, dtype: DTYPE, device: DEVICE });
  } catch (err) {
    console.error(`\n${C.red}[FATAL]${C.reset} Не удалось загрузить модель из ${MODELS_CACHE}`);
    console.error(`  Убедитесь, что модель скачана: node system/scripts/setup-model.js`);
    console.error(`  Ошибка: ${err.message}\n`);
    process.exit(1);
  }
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const dev = extractor.__device || 'cpu';
  console.log(`${C.green}[OK]${C.reset} Модель загружена за ${elapsed}s (${DTYPE}, ${VECTOR_DIM}d, device=${C.bold}${dev}${dev !== 'cpu' ? ' ⚡GPU' : ''}${C.reset})\n`);
  return extractor;
}

// ═══════════════════════════════════════════════════════════════════════
//  LAYER AND CLUSTER DISCOVERY
// ═══════════════════════════════════════════════════════════════════════

/**
 * Обнаруживает все слои (директории с wiki.json) в корне репозитория.
 * Возвращает массив: [{ name, dir, wikiDir }]
 */
// --layers a,b,c → индексировать только указанные слои (для частичной пересборки/тестов).
function layerFilter() {
  const i = process.argv.indexOf('--layers');
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return new Set(process.argv[i + 1].split(',').map(s => s.trim()).filter(Boolean));
}

function discoverLayers() {
  const layers = [];
  if (!fs.existsSync(ROOT_DIR)) return layers;
  const only = layerFilter();

  for (const entry of fs.readdirSync(ROOT_DIR)) {
    if (FOLDER_BLACKLIST.has(entry)) continue;
    if (only && !only.has(entry)) continue;
    const fullPath = path.join(ROOT_DIR, entry);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    const manifestPath = path.join(fullPath, 'wiki.json');
    const wikiDir = path.join(fullPath, 'wiki');
    const rawDir  = path.join(fullPath, 'raw');

    if (fs.existsSync(manifestPath) && fs.existsSync(wikiDir)) {
      layers.push({
        name: entry,
        dir: fullPath,
        wikiDir,
        rawDir: fs.existsSync(rawDir) ? rawDir : null,
      });
    }
  }

  return layers;
}

/**
 * Рекурсивный обход raw/-директории с отдельным блэклистом.
 * ai-skills~ и skills пропускаются — они не являются базой знаний.
 */
function getRawFilesRecursively(dir, extensions) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith('.') || entry.endsWith('.meta')) continue;
    if (RAW_FOLDER_BLACKLIST.has(entry)) continue;
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...getRawFilesRecursively(fullPath, extensions));
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
//  CENTROID COMPUTATION
// ═══════════════════════════════════════════════════════════════════════

// Центроиды теперь вычисляются как среднее векторов членов шарда в main()
// (шаг 9b), а не как эмбеддинг имени папки. Прежние computeCentroids /
// findNearestCluster (name-based routing) удалены как ошибочные.

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

  // 4. Центроиды считаются ПОСЛЕ эмбеддинга (шаг 9b) как среднее векторов
  //    членов каждого слоя-шарда — настоящий centroid, а не эмбеддинг имени папки.
  index.clusters_centroids = {};

  // 5. Сбор всех .md файлов из wiki/ и raw/ каждого слоя
  const allFiles = [];
  const WIKI_MOC_FILES = new Set(['index', 'stubs', 'contradictions', 'stale-documents']);
  const RAW_SKIP_FILES = new Set(['README', 'readme', 'index', 'stubs', 'stale-documents', 'CHANGELOG', 'changelog']);

  for (const layer of layers) {
    // Сбор wiki/-страниц
    const wikiFiles = getFilesRecursively(layer.wikiDir, ['.md']);
    for (const f of wikiFiles) {
      const basename = path.basename(f, '.md');
      if (WIKI_MOC_FILES.has(basename)) continue;
      allFiles.push({ filePath: f, layer: layer.name, sourceType: 'wiki' });
    }

    // Сбор raw/-документов (первичные источники)
    if (layer.rawDir) {
      const rawFiles = getRawFilesRecursively(layer.rawDir, ['.md']);
      for (const f of rawFiles) {
        const basename = path.basename(f, '.md');
        if (RAW_SKIP_FILES.has(basename)) continue;
        // Пропускаем очень большие файлы (ГДД, ТЗ) — они дают сотни чанков
        const fileSize = fs.statSync(f).size;
        if (fileSize > MAX_RAW_FILE_BYTES) {
          const sizekb = (fileSize / 1024).toFixed(0);
          console.log(`${C.dim}  [SKIP] ${path.relative(ROOT_DIR, f).replace(/\\/g, '/')} (${sizekb}KB > ${MAX_RAW_FILE_BYTES/1024}KB limit)${C.reset}`);
          continue;
        }
        allFiles.push({ filePath: f, layer: layer.name, sourceType: 'raw' });
      }
    }
  }

  const wikiCount = allFiles.filter(f => f.sourceType === 'wiki').length;
  const rawCount  = allFiles.filter(f => f.sourceType === 'raw').length;
  console.log(`${C.cyan}[*]${C.reset} Обнаружено документов: ${C.green}${wikiCount} wiki${C.reset} + ${C.cyan}${rawCount} raw${C.reset} = ${allFiles.length} всего.\n`);

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
    const { filePath, layer, sourceType } = allFiles[i];
    const relPath  = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
    const basename = path.basename(filePath, '.md');

    // Чтение и парсинг
    const rawContent = readText(filePath);
    const { meta, body } = parseFrontmatter(rawContent);

    // ID: для raw-файлов используем префикс 'raw-<layer>-<basename>' чтобы
    // избежать коллизий с wiki-страницами при одинаковых именах файлов.
    const fileId     = meta.id || (sourceType === 'raw' ? `raw-${layer}-${basename}` : basename);
    // symbols = объявленные во frontmatter + авто-извлечённые из тела (Data Standards §2).
    // Без авто-извлечения raw/код-документы получают symbols=[] и невидимы для Stream A.
    const fmSymbols  = Array.isArray(meta.symbols) ? meta.symbols.map(String) : [];
    const symbols    = [...new Set([...fmSymbols, ...extractCodeSymbols(body)])];
    const tags       = Array.isArray(meta.tags) ? meta.tags : [];
    const extendsRef = meta.extends || '';
    const wikiLinks  = extractWikiLinks(body);

    processedIds.add(fileId);

    // Подготовка текста для эмбеддинга (вырезание блоков кода)
    const textToEmbed = prepareTextForEmbedding(body);

    // MD5-контроль по подготовленному тексту
    const currentMd5 = md5(textToEmbed);
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

    // 8b. Чанкинг. structural: режем сырой Markdown по структуре (видя заголовки
    //     и ```-фенсы), затем чистим каждый чанк (код — по index_code). fixed:
    //     старое окно слов по уже очищенному тексту.
    let chunks;
    if (CHUNK_STRATEGY === 'structural') {
      chunks = chunkMarkdown(body, {
        targetWords: CHUNK_SIZE_WORDS,
        minWords: CHUNK_MIN_WORDS,
        maxWords: CHUNK_MAX_WORDS,
        keepCodeAtomic: KEEP_CODE_ATOMIC,
        headingBreadcrumbs: HEADING_BREADCRUMBS,
      }).map(c => prepareTextForEmbedding(c).trim()).filter(Boolean);
    } else {
      chunks = chunkText(textToEmbed);
    }
    if (chunks.length === 0) {
      process.stdout.write(` — пустой, пропуск\n`);
      continue;
    }

    // 8c. Векторизация чанков (с префиксом passage:). Один шард на слой;
    //     centroidScore проставим на шаге 9b, когда посчитаем настоящий центроид.
    const assignedCluster = layer;
    if (!shards[assignedCluster]) shards[assignedCluster] = [];

    // Батч-эмбеддинг чанков документа (паритет с одиночным — проверен).
    const vecs = await libEmbedBatch(extractor, chunks.map(c => `passage: ${c}`), VECTOR_DIM, EMBED_BATCH_SIZE);
    for (let ci = 0; ci < chunks.length; ci++) {
      shards[assignedCluster].push({
        fileId,
        chunkIndex: ci,
        centroidScore: 0,
        embedding: vecs[ci],
      });
      countChunks++;
    }

    // 8d. Обновление записи в мета-индексе
    index.documents[fileId] = {
      id: fileId,
      path: relPath,
      layer,
      sourceType: sourceType || 'wiki',
      symbols,
      tags,
      extends: extendsRef,
      wikilinks: wikiLinks,
      md5: currentMd5,
      chunksCount: chunks.length,
      cluster: assignedCluster,
    };

    process.stdout.write(
      ` → ${chunks.length} чанков → ${C.cyan}${assignedCluster}${C.reset}\n`
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

  // 9b. Настоящие центроиды: среднее нормализованных векторов членов шарда
  //     (а не эмбеддинг имени папки). Делает nprobe-маршрутизацию осмысленной.
  index.clusters_centroids = {};
  for (const [clName, data] of Object.entries(shards)) {
    if (!data.length) continue;
    const dim = data[0].embedding.length;
    const mean = new Array(dim).fill(0);
    for (const e of data) {
      for (let k = 0; k < dim; k++) mean[k] += e.embedding[k];
    }
    for (let k = 0; k < dim; k++) mean[k] /= data.length;
    const norm = Math.sqrt(mean.reduce((s, v) => s + v * v, 0)) || 1;
    const centroid = mean.map(v => v / norm);
    index.clusters_centroids[clName] = centroid;
    // centroidScore = близость чанка к центроиду слоя (для внутришардовой сортировки)
    for (const e of data) e.centroidScore = cosineSimilarity(e.embedding, centroid);
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

  // 12. Сохранение мета-индекса (JSON — без BOM, иначе ломается JSON.parse)
  index.updatedAt = new Date().toISOString();
  index.chunkStrategy = CHUNK_STRATEGY; // для воспроизводимости (смена стратегии → нужен --force)
  writeTextNoBom(INDEX_FILE, JSON.stringify(index, null, 2));

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
