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
import { chunkMarkdownDetailed } from './lib/chunker.js';
import { initModel as libInitModel, embedBatch as libEmbedBatch, embedLateChunking as libEmbedLateChunking } from './lib/retrieval.js';
import { resolveModelsCache } from './lib/model-locator.js';
import * as lancedb from 'vectordb';

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
const LANCEDB_DIR  = path.join(SYSTEM_DIR, '.lancedb');
const CHUNKING_MANIFEST_FILE = path.join(LANCEDB_DIR, 'chunking-profile.json');

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
  chunk_size_words:    200,         // целевой размер retrieval-чанка
  chunk_min_words:     45,          // короткая секция остаётся атомарной
  chunk_max_words:     300,         // крупнее — рекурсивный split по предложениям
  chunk_overlap_words: 32,          // только на вынужденной границе внутри абзаца
  keep_code_atomic:    true,        // не рвать блоки ```...```
  heading_breadcrumbs: true,        // приписывать к чанку путь заголовков
  max_raw_file_bytes:  0,            // 0 = не пропускать raw-источники по размеру
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
const CHUNKING_PROFILE = Object.freeze({
  version: 3,
  strategy: CHUNK_STRATEGY,
  targetWords: CHUNK_SIZE_WORDS,
  minWords: CHUNK_MIN_WORDS,
  maxWords: CHUNK_MAX_WORDS,
  overlapWords: CHUNK_OVERLAP_WORDS,
  keepCodeAtomic: KEEP_CODE_ATOMIC,
  headingBreadcrumbs: HEADING_BREADCRUMBS,
  maxRawFileBytes: MAX_RAW_FILE_BYTES,
});
function sameChunkingProfile(previous, current) {
  return JSON.stringify(previous || null) === JSON.stringify(current);
}

// ─── Folder Blacklist (не индексируются) ─────────────────────────────
// ВАЖНО: 'raw' намеренно исключён — raw/-папки индексируются отдельным проходом.
// 'ai-skills~' и 'skills' остаются исключены: скилы не являются базой знаний.
const FOLDER_BLACKLIST = new Set([
  '.git', '.github', '.obsidian', '.vscode',
  'system', 'node_modules', 'plans', 'NewData',
  'ai-skills~', 'skills', 'rlm_mode',
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
//  MD5 CACHE FROM LANCEDB
// ═══════════════════════════════════════════════════════════════════════

async function loadMd5Cache(forceRebuild) {
  const cache = {}; // fileId -> md5
  if (forceRebuild) return cache;
  try {
    const db = await lancedb.connect(LANCEDB_DIR);
    const tableNames = await db.tableNames();
    if (tableNames.includes('wiki_chunks')) {
      const tbl = await db.openTable('wiki_chunks');
      const rows = await tbl.search().select(['fileId', 'md5']).limit(100000).execute();
      for (const row of rows) {
        if (row.md5) cache[row.fileId] = row.md5;
      }
    }
  } catch (err) {
    // ВАЖНО: не глушить молча. Пустой кэш => ВСЕ документы считаются новыми =>
    // полная переэмбеддинг-сборка (~минуты). Чаще всего это ПОРЧА .lancedb
    // (манифест ссылается на отсутствующий data-фрагмент, напр. после git
    // pull/checkout, если .lancedb трекается в git). Делаем причину видимой.
    console.warn(
      `${C.yellow}[WARN]${C.reset} Не удалось прочитать MD5-кэш из LanceDB — ` +
      `инкрементальность отключена, будет ПОЛНАЯ пересборка.\n` +
      `${C.dim}  Причина: ${err.message}\n` +
      `  Если это \"Not found: ...data/*.lance\" — .lancedb рассогласована; ` +
      `почините \`--force\` и НЕ коммитьте .lancedb в git.${C.reset}`
    );
  }
  return cache;
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
//  LANCEDB HELPER
// ═══════════════════════════════════════════════════════════════════════
async function getLanceTable(forceRebuild) {
  const db = await lancedb.connect(LANCEDB_DIR);
  let tbl;
  try {
    const tableNames = await db.tableNames();
    if (forceRebuild && tableNames.includes('wiki_chunks')) {
      await db.dropTable('wiki_chunks');
    }
    if (!tableNames.includes('wiki_chunks') || forceRebuild) {
      // Create empty table with dummy schema to define columns, LanceDB will infer the rest
      tbl = await db.createTable('wiki_chunks', [{
        fileId: "dummy", parentId: "dummy", chunkIndex: 0, previousChunkIndex: -1, nextChunkIndex: -1,
        sectionIndex: 0, sectionPath: "", chunkWords: 0, overlapWords: 0, boundary: "semantic", layer: "dummy", sourceType: "dummy",
        path: "dummy", symbols: "[]", tags: "[]", wikilinks: "[]", extendsRef: "dummy", md5: "dummy",
        text: "dummy", vector: Array(VECTOR_DIM).fill(0)
      }]);
      await tbl.delete("`fileId` = 'dummy'");
    } else {
      tbl = await db.openTable('wiki_chunks');
    }
  } catch (err) {
    console.error("LanceDB init error:", err);
    throw err;
  }
  return tbl;
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();
  const forceRebuild = process.argv.includes('--force');
  let previousChunkingProfile = null;
  try { previousChunkingProfile = JSON.parse(fs.readFileSync(CHUNKING_MANIFEST_FILE, 'utf8')); } catch { /* legacy index */ }
  if (previousChunkingProfile && !sameChunkingProfile(previousChunkingProfile, CHUNKING_PROFILE) && !forceRebuild) {
    throw new Error('Chunking profile changed. Rebuild the whole index explicitly with --force before searching.');
  }
  if (!previousChunkingProfile && fs.existsSync(LANCEDB_DIR) && !forceRebuild) {
    throw new Error('Legacy index has no chunking profile. Rebuild explicitly with --force before incremental indexing.');
  }

  console.log(`\n${C.bold}═══ DavASkoLLMWiki v3.x — Индексатор ═══${C.reset}\n`);
  console.log(`${C.dim}Корень:       ${ROOT_DIR}`);
  console.log(`Модель:       ${MODEL_ID}`);
  console.log(`Чанки:        структурные, цель ${CHUNK_SIZE_WORDS} слов, максимум ${CHUNK_MAX_WORDS}, overlap ${CHUNK_OVERLAP_WORDS} только внутри абзаца`);
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

  // 2. Загрузка кэша MD5 из LanceDB
  const existingDocs = await loadMd5Cache(forceRebuild);

  // 3. Инициализация модели
  const extractor = await initModel();

  // 4. Подключение к LanceDB
  const table = await getLanceTable(forceRebuild);

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
        if (MAX_RAW_FILE_BYTES > 0 && fileSize > MAX_RAW_FILE_BYTES) {
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

  // Подсчёт коллизий basename среди wiki-файлов. Одноимённые модульные страницы
  // (Logic.md/Art.md/… в разных модулях) иначе схлопываются в один fileId=basename:
  // перетирают друг друга в таблице (теряются в поиске) и вечно идут [UPD] каждый
  // прогон. Уникальные basename СОХРАНЯЮТ id=basename — чтобы [[wikilinks]]
  // (резолвятся по fileId==basename в graph-lift) продолжали работать; коллизии
  // дизамбигуируются полным относительным путём.
  const wikiBasenameCounts = new Map();
  for (const f of allFiles) {
    if (f.sourceType !== 'wiki') continue;
    const bn = path.basename(f.filePath, '.md');
    wikiBasenameCounts.set(bn, (wikiBasenameCounts.get(bn) || 0) + 1);
  }
  const collisionCount = [...wikiBasenameCounts.values()].filter(n => n > 1).length;
  if (collisionCount > 0) {
    console.log(`${C.dim}  [i] wiki basename-коллизий: ${collisionCount} → дизамбигуация по пути.${C.reset}\n`);
  }

  // 6. Подготовка батча для LanceDB
  let batchData = [];
  const BATCH_INSERT_SIZE = 500;

  // 7. Счётчики для статистики
  let countSkipped   = 0;
  let countNew       = 0;
  let countUpdated   = 0;
  let countChunks    = 0;
  let countSingleChunkDocs = 0;
  let countForcedBoundaries = 0;
  let countOverlappedChunks = 0;

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
    // fileId: raw → 'raw-<layer>-<basename>'. wiki → basename, если он уникален
    // во всём корпусе (сохраняет резолвинг [[wikilinks]]); при коллизии basename
    // (несколько одноимённых страниц) — полный относительный путь без .md.
    const fileId     = meta.id || (
      sourceType === 'raw'
        ? `raw-${layer}-${basename}`
        : (wikiBasenameCounts.get(basename) > 1 ? relPath.replace(/\.md$/i, '') : basename)
    );
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
    const existingMd5 = existingDocs[fileId];

    processedIds.add(fileId);

    if (!forceRebuild && existingMd5 === currentMd5) {
      countSkipped++;
      continue;
    }

    const isNew = !existingMd5;
    if (isNew) countNew++; else countUpdated++;

    // Прогресс
    process.stdout.write(
      `${C.dim}[${i + 1}/${allFiles.length}]${C.reset} ` +
      `  ${isNew ? C.green + '[NEW]' : C.yellow + '[UPD]'}${C.reset} ` +
      `${fileId}${C.dim} (${relPath})${C.reset}`
    );

    // 8a. Очистка старых чанков в LanceDB (если обновляем существующий документ)
    if (existingMd5) {
      await table.delete(`\`fileId\` = '${fileId}'`);
    }

    // 8b. Чанкинг. structural: режем сырой Markdown по структуре (видя заголовки
    //     и ```-фенсы), затем чистим каждый чанк (код — по index_code). fixed:
    //     старое окно слов по уже очищенному тексту.
    let chunkDetails;
    if (CHUNK_STRATEGY === 'structural') {
      chunkDetails = chunkMarkdownDetailed(body, {
        targetWords: CHUNK_SIZE_WORDS,
        minWords: CHUNK_MIN_WORDS,
        maxWords: CHUNK_MAX_WORDS,
        overlapWords: CHUNK_OVERLAP_WORDS,
        keepCodeAtomic: KEEP_CODE_ATOMIC,
        headingBreadcrumbs: HEADING_BREADCRUMBS,
      });
    } else {
      chunkDetails = chunkText(textToEmbed).map((text, sectionIndex) => ({
        text, sectionIndex, sectionPath: '', contentWords: text.split(/\s+/).filter(Boolean).length,
        overlapWords: sectionIndex === 0 ? 0 : CHUNK_OVERLAP_WORDS, boundary: 'forced',
      }));
    }
    const chunks = chunkDetails
      .map((chunk) => ({ ...chunk, text: prepareTextForEmbedding(chunk.text).trim() }))
      .filter((chunk) => chunk.text);
    if (chunks.length === 0) {
      process.stdout.write(` — пустой, пропуск\n`);
      continue;
    }
    if (chunks.length === 1) countSingleChunkDocs++;
    countForcedBoundaries += chunks.filter((chunk) => chunk.boundary === 'forced').length;
    countOverlappedChunks += chunks.filter((chunk) => chunk.overlapWords > 0).length;

    // 8c. Векторизация чанков
    const assignedCluster = layer;
    let vecs;
    const wordCount = textToEmbed.split(/\s+/).length;
    
    // Если документ не огромный, используем Late Chunking (попытка вложить весь контекст)
    if (CHUNK_STRATEGY === 'structural' && wordCount < 6000) {
      vecs = await libEmbedLateChunking(extractor, textToEmbed, chunks.map(c => `passage: ${c.text}`), VECTOR_DIM);
    } else {
      vecs = await libEmbedBatch(extractor, chunks.map(c => `passage: ${c.text}`), VECTOR_DIM, EMBED_BATCH_SIZE);
    }
    
    for (let ci = 0; ci < chunks.length; ci++) {
      batchData.push({
        fileId,
        parentId: `${fileId}::section-${chunks[ci].sectionIndex}`,
        chunkIndex: ci,
        previousChunkIndex: ci - 1,
        nextChunkIndex: ci + 1 < chunks.length ? ci + 1 : -1,
        sectionIndex: chunks[ci].sectionIndex,
        sectionPath: chunks[ci].sectionPath,
        chunkWords: chunks[ci].contentWords,
        overlapWords: chunks[ci].overlapWords,
        boundary: chunks[ci].boundary,
        layer: assignedCluster,
        sourceType: sourceType || 'wiki',
        path: relPath,
        symbols: JSON.stringify(symbols),
        tags: JSON.stringify(tags),
        wikilinks: JSON.stringify(wikiLinks),
        extendsRef: extendsRef,
        md5: currentMd5,
        text: chunks[ci].text,
        vector: vecs[ci],
      });
      countChunks++;
    }

    // Если накопили достаточно — сохраняем в LanceDB
    if (batchData.length >= BATCH_INSERT_SIZE) {
      await table.add(batchData);
      batchData = [];
    }

    process.stdout.write(
      ` → ${chunks.length} чанков → ${C.cyan}${assignedCluster}${C.reset}\n`
    );
  }

  // Довставляем остатки
  if (batchData.length > 0) {
    await table.add(batchData);
  }

  // 9. Очистка устаревших документов из LanceDB
  let countRemoved = 0;
  for (const docId of Object.keys(existingDocs)) {
    if (!processedIds.has(docId)) {
      await table.delete(`\`fileId\` = '${docId}'`);
      countRemoved++;
    }
  }

  const totalDocs = processedIds.size;
  const totalChunks = await table.countRows();
  fs.writeFileSync(CHUNKING_MANIFEST_FILE, JSON.stringify(CHUNKING_PROFILE, null, 2) + '\n', 'utf8');

  console.log(
    `\n${C.cyan}[*]${C.reset} Векторная база ${C.bold}LanceDB${C.reset}` +
    ` — ${totalDocs} документов (${totalChunks} чанков)`
  );

  // 13. Итоговая статистика
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${C.bold}═══ Итоги индексации ═══${C.reset}`);
  console.log(`  Новых:      ${C.green}${countNew}${C.reset}`);
  console.log(`  Обновлено:  ${C.yellow}${countUpdated}${C.reset}`);
  console.log(`  Без изменений: ${C.dim}${countSkipped}${C.reset}`);
  console.log(`  Удалено:    ${C.red}${countRemoved}${C.reset}`);
  console.log(`  Всего чанков: ${countChunks}`);
  console.log(`  Документов с одним чанком: ${countSingleChunkDocs}`);
  console.log(`  Вынужденных границ: ${countForcedBoundaries}; чанков с overlap: ${countOverlappedChunks}`);
  console.log(`\n${C.green}[OK]${C.reset} Индекс собран за ${elapsed}s.\n`);
}

// ─── Entry Point ─────────────────────────────────────────────────────
main().catch(err => {
  console.error(`\n${C.red}[FATAL] ${err.message}${C.reset}`);
  console.error(err.stack);
  process.exit(1);
});
