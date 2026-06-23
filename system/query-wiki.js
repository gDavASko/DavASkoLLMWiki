#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 * DavASkoLLMWiki v3.x — Поисковый Оркестратор (query-wiki.js)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Параллельный гибридный поиск (Символьный + Семантический).
 *
 * Алгоритм:
 *   Stream A — Символьный (мгновенный): прямой поиск по symbols, tags, id
 *              в мета-индексе wiki-index.json
 *   Stream B — Семантический (1–2s): векторизация запроса с "query: " prefix,
 *              подбор ближайшего центроида, линейный проход по шарду,
 *              фильтр по cosine >= 0.70, Top-3 документа
 *
 *   Графовый лифт: для точных совпадений (Stream A) подгружает extends +1
 *   и [[WikiLinks]] +1 step
 *
 *   Выход: контекст записывается в .cursor-context-dump.md,
 *          в stdout — только короткая строка-статус
 *
 * Использование:
 *   node system/query-wiki.js --query "CowController, оптимизация физики"
 *   node system/query-wiki.js --query "blend tree animation"
 *   node system/query-wiki.js --query "NetworkManager"
 *
 * Модель: jinaai/jina-embeddings-v3 (оффлайн)
 * ═══════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cosineSimilarity, selectProbeClusters, applyThreshold, scoreSymbolMatches, initModel as libInitModel, embed as libEmbed } from './lib/retrieval.js';

// ─── ESM __dirname Shim ──────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Paths ───────────────────────────────────────────────────────────
const SYSTEM_DIR   = __dirname;
const ROOT_DIR     = path.resolve(SYSTEM_DIR, '..');
const MODELS_CACHE = path.join(SYSTEM_DIR, 'models-cache');
const INDEX_FILE   = path.join(SYSTEM_DIR, 'wiki-index.json');
const SHARDS_DIR   = path.join(SYSTEM_DIR, 'index-shards');
const DUMP_FILE    = path.join(ROOT_DIR, '.cursor-context-dump.md');
const CONFIG_FILE  = path.join(SYSTEM_DIR, 'search-config.json');

// ─── Search Configuration (externalized → system/search-config.json) ──
// Магические константы вынесены в конфиг, чтобы калибровать их на данных
// (eval-retrieval.js), а не править код. Файл может отсутствовать — тогда
// действуют значения по умолчанию ниже.
const SEARCH_DEFAULTS = {
  threshold_mode:       'relative',
  relative_alpha:       0.85,
  junk_floor:           0.35,
  similarity_threshold: 0.70,
  similarity_fallback:  0.65,
  top_k_documents:      5,
  nprobe:               8,
  ground_truth_boost:   0.05,
  stream_a_limit:       10,   // кап символьных совпадений (чтобы частый символ не затоплял)
  graph_lift_semantic:  2,    // граф-lift от топ-N семантических результатов
  device:               'auto', // 'auto'(GPU→CPU) | 'dml' | 'cuda' | 'cpu'
};
function loadSearchConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8').replace(/^﻿/, '');
    const cfg = JSON.parse(raw);
    return { ...SEARCH_DEFAULTS, ...cfg };
  } catch {
    return { ...SEARCH_DEFAULTS };
  }
}
const CFG = loadSearchConfig();
const TOP_K_DOCUMENTS      = CFG.top_k_documents;
const NPROBE               = CFG.nprobe;
const GROUND_TRUTH_BOOST   = CFG.ground_truth_boost;
const STREAM_A_LIMIT       = CFG.stream_a_limit;
const GRAPH_LIFT_SEMANTIC  = CFG.graph_lift_semantic;
const MAX_CONTEXT_BYTES    = 120_000; // ~120KB safety limit
const MODEL_ID             = 'jinaai/jina-embeddings-v3';
const MODEL_REVISION       = '815152ccf78fb243a0d9b4db0b80ec6ef87e2213';
const VECTOR_DIM           = 1024;
const DTYPE                = 'fp16';

// ─── ANSI Colors ─────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  dim:    '\x1b[2m',
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
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  fs.writeFileSync(filePath, Buffer.concat([bom, Buffer.from(content, 'utf8')]));
}

// cosineSimilarity импортируется из ./lib/retrieval.js (единое ядро поиска).

/**
 * Парсинг --query из CLI-аргументов.
 * Поддерживает: --query "text" и --query text
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
  };
  return {
    query: get('--query'),       // обязательный
    outPath: get('--out'),       // --out <path>: писать дамп сюда (вместо дефолта)
    toStdout: args.includes('--stdout'), // --stdout: печатать дамп в stdout, файл не трогать
  };
}

/**
 * Разбор запроса на символы (C#/PascalCase) и семантическую фразу.
 *
 * Эвристика:
 *   - PascalCase (MyClass, INetworkHandler, m_field) → символ
 *   - Все остальное (в т.ч. русский текст) → семантика
 *
 * Вход:  "CowController, blend tree animation, оптимизация"
 * Выход: { symbols: ["CowController"], semantic: "blend tree animation оптимизация" }
 */
function parseQuery(rawQuery) {
  const parts = rawQuery.split(',').map(p => p.trim()).filter(Boolean);
  const symbols = [];
  const semanticParts = [];

  // Строгий код-идентификатор: PascalCase (≥2 горба), I-интерфейс, m_-поле.
  // Дженерик-слова с заглавной (How, Plombir, JSON) символами НЕ считаем —
  // иначе они дают шумные точные совпадения и портят ранжирование (подтверждено
  // замером на реальном корпусе: MRR падал из-за 'JSON' как «символа»).
  const isSymbol = (w) =>
    /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+$/.test(w) || /^I[A-Z][A-Za-z0-9]*$/.test(w) || /^m_[A-Za-z0-9]+$/.test(w);

  for (const part of parts) {
    if (/\s/.test(part)) {
      // Фраза → семантика + встроенные строгие символы
      semanticParts.push(part);
      for (const w of part.split(/[^A-Za-z0-9_]+/)) {
        if (isSymbol(w) && !symbols.includes(w)) symbols.push(w);
      }
    } else if (isSymbol(part)) {
      symbols.push(part);
    } else {
      semanticParts.push(part);
    }
  }

  return {
    symbols,
    semantic: semanticParts.join(' '),
  };
}

/**
 * Очистка маркдауна от фронтматтера и мусорных блоков для контекстного дампа.
 * Оставляет основной текст, но убирает пустые строки подряд.
 */
function cleanMarkdownForDump(content) {
  // Удаление фронтматтера
  let body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  // Схлопываем множественные пустые строки
  body = body.replace(/(\r?\n){3,}/g, '\n\n');
  return body.trim();
}

// ═══════════════════════════════════════════════════════════════════════
//  INDEX AND MODEL LOADING
// ═══════════════════════════════════════════════════════════════════════

function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) {
    console.error(`${C.red}[FATAL]${C.reset} wiki-index.json не найден.`);
    console.error(`  Сначала постройте индекс: node system/build-index.js`);
    process.exit(1);
  }
  try {
    return JSON.parse(readText(INDEX_FILE));
  } catch (err) {
    console.error(`${C.red}[FATAL]${C.reset} wiki-index.json повреждён: ${err.message}`);
    process.exit(1);
  }
}

// Тонкая обёртка над ядром ./lib/retrieval.js (логирование + общие константы).
async function initModel() {
  console.error(`${C.cyan}[*]${C.reset} Initializing model (First run may take a few seconds)...`);
  const startMs = Date.now();
  let extractor;
  try {
    extractor = await libInitModel({
      modelsCache: MODELS_CACHE, modelId: MODEL_ID, revision: MODEL_REVISION, dtype: DTYPE, device: CFG.device,
    });
  } catch (err) {
    console.error(`${C.red}[FATAL]${C.reset} Модель не загружена: ${err.message}`);
    console.error(`  Убедитесь: node system/scripts/setup-model.js`);
    process.exit(1);
  }
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const dev = extractor.__device || 'cpu';
  console.error(`${C.green}[OK]${C.reset} Модель: ${elapsed}s (${DTYPE}, ${VECTOR_DIM}d, device=${dev}${dev !== 'cpu' ? ' ⚡' : ''})`);
  return extractor;
}

function embed(extractor, text) {
  return libEmbed(extractor, text, VECTOR_DIM);
}

// ═══════════════════════════════════════════════════════════════════════
//  STREAM A — СИМВОЛЬНЫЙ ПОИСК
// ═══════════════════════════════════════════════════════════════════════

/**
 * Мгновенный символьный поиск (id/symbols/tags/wikilinks/подстрока-в-id).
 * Ранжирование и mini-IDF — в общем ядре scoreSymbolMatches (тестируется).
 * Возвращает Map<fileId, { source: 'streamA', score }>.
 */
function runStreamA(symbols, index) {
  const results = new Map();
  if (symbols.length === 0) return results;
  const scored = scoreSymbolMatches(symbols, index.documents, { limit: STREAM_A_LIMIT });
  for (const [docId, score] of scored) {
    results.set(docId, { source: 'streamA', score });
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════
//  STREAM B — СЕМАНТИЧЕСКИЙ ПОИСК
// ═══════════════════════════════════════════════════════════════════════

/**
 * Семантический поиск (IVF multi-probe):
 *   1. Векторизация запроса с "query: " prefix
 *   2. Ранжирование кластеров по близости к их центроиду; скан top-NPROBE
 *   3. Диагностика: печатает top-5 score (score, fileId)
 *   4. Порог через applyThreshold: relative (адаптивный) или absolute (фиксированный)
 *   5. Top-K_DOCUMENTS документов
 *
 * Про nprobe:
 *   nprobe — число ближайших кластеров для скана (как в IVF-индексах).
 *   nprobe >= число кластеров ИЛИ nprobe <= 0  =>  исчерпывающий поиск
 *   по всем шардам (нулевая потеря recall — корректно для малого корпуса).
 *   Меньший nprobe ускоряет поиск на большом корпусе ценой recall;
 *   оптимум подбирается на размеченных данных через eval-retrieval.js.
 */
async function runStreamB(semanticQuery, index, extractor) {
  /** @type {Map<string, {source: string, score: number}>} */
  const results = new Map();
  if (!semanticQuery || semanticQuery.trim().length === 0) return results;

  // 1. Векторизация запроса с prefix
  const queryVec = await embed(extractor, `query: ${semanticQuery}`);

  // 2. Multi-probe: ранжируем кластеры по центроиду, берём top-NPROBE
  const centroids = index.clusters_centroids || {};
  const clusterNames = Object.keys(centroids);
  const { clusters: probeClusters, exhaustive } = selectProbeClusters(queryVec, centroids, NPROBE);
  console.error(`${C.dim}  [B] Multi-probe: ${probeClusters.length}/${clusterNames.length} кластеров${exhaustive ? ' (исчерпывающий)' : ` (nprobe=${NPROBE})`}${C.reset}`);

  /** Все полученные score (для порога и диагностики) */
  const allScores = [];
  for (const clName of probeClusters) {
    const shardPath = path.join(SHARDS_DIR, `embeddings-${clName}.json`);
    if (!fs.existsSync(shardPath)) continue;
    const shard = JSON.parse(readText(shardPath));
    for (const entry of shard) {
      allScores.push([entry.fileId, cosineSimilarity(queryVec, entry.embedding)]);
    }
  }

  // 3. Диагностика: top-5 score независимо от порога
  const top5 = [...allScores].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, s]) => `${id.split('-').pop()}:${s.toFixed(3)}`)
    .join(', ');
  console.error(`${C.dim}  [B] Top-5 scores: ${top5}${C.reset}`);

  // 4. Порог: адаптивный (relative) или фиксированный (absolute) — единое ядро.
  const { best: fileScores, tau, mode, usedFallback } = applyThreshold(allScores, CFG);
  console.error(`${C.dim}  [B] Порог: ${mode} τ=${tau.toFixed(3)} → ${fileScores.size} документов${usedFallback ? ' (fallback)' : ''}${C.reset}`);

  // 5. Top-K по эффективному score (ground-truth boost: raw/код выше саммари).
  //    Порог фильтрации применяется к ИСТИННОМУ cosine (выше); boost влияет
  //    только на ранжирование/отбор top-K, отображается всегда истинный score.
  const docsMap = index.documents || {};
  const gtBoost = (id) => (docsMap[id] && docsMap[id].sourceType === 'raw' ? GROUND_TRUTH_BOOST : 0);
  const sorted = [...fileScores.entries()]
    .sort((a, b) => (b[1] + gtBoost(b[0])) - (a[1] + gtBoost(a[0])))
    .slice(0, TOP_K_DOCUMENTS);

  for (const [fileId, score] of sorted) {
    results.set(fileId, { source: 'streamB', score });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════
//  GRAPH LIFT — РАСШИРЕНИЕ ГРАФА НА +1 STEP
// ═══════════════════════════════════════════════════════════════════════

/**
 * Граф-lift (+1 шаг): подгружаем родителя (`extends`) и соседей (`[[WikiLinks]]`).
 * Применяется и к точным совпадениям (Stream A), и к топ-N семантических
 * результатов (Stream B) — раньше семантика граф не расширяла, и полезный
 * контекст терялся именно там, где он нужнее всего.
 */
function applyGraphLift(mergedResults, index, semanticLiftCount = 0) {
  const docs = index.documents || {};
  const additions = new Map();

  const liftFrom = (fileId, baseScore) => {
    const doc = docs[fileId];
    if (!doc) return;
    if (doc.extends && docs[doc.extends] && !mergedResults.has(doc.extends) && !additions.has(doc.extends)) {
      additions.set(doc.extends, { source: 'graphLift', score: baseScore });
    }
    if (Array.isArray(doc.wikilinks)) {
      for (const wl of doc.wikilinks) {
        if (docs[wl] && !mergedResults.has(wl) && !additions.has(wl)) {
          additions.set(wl, { source: 'graphLift', score: baseScore - 0.05 });
        }
      }
    }
  };

  // 1. От точных совпадений (Stream A)
  for (const [fileId, info] of mergedResults.entries()) {
    if (info.source === 'streamA') liftFrom(fileId, 0.9);
  }

  // 2. От топ-N семантических (Stream B) — симметрия графа, с меньшим весом
  if (semanticLiftCount > 0) {
    const semantic = [...mergedResults.entries()]
      .filter(([, i]) => i.source === 'streamB')
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, semanticLiftCount);
    for (const [fileId] of semantic) liftFrom(fileId, 0.7);
  }

  // Объединение
  for (const [id, info] of additions.entries()) {
    mergedResults.set(id, info);
  }

  return mergedResults;
}

// ═══════════════════════════════════════════════════════════════════════
//  CONTEXT ASSEMBLY & DUMP
// ═══════════════════════════════════════════════════════════════════════

/**
 * Загружает и форматирует найденные документы в контекстный блок.
 * Записывает результат в .cursor-context-dump.md.
 * Возвращает число успешно загруженных документов.
 */
function assembleAndDump(mergedResults, index, rawQuery) {
  const docs = index.documents || {};
  const sections = [];
  let totalBytes = 0;

  // Заголовок дампа
  const header = [
    `# Wiki Context Dump`,
    ``,
    `> Query: \`${rawQuery}\``,
    `> Generated: ${new Date().toISOString()}`,
    `> Documents: ${mergedResults.size}`,
    ``,
    `---`,
    ``,
  ].join('\n');

  totalBytes += Buffer.byteLength(header, 'utf8');

  // Ранжирование ЕДИНОЕ по эффективному score: символьные (Stream A) и
  // семантические (Stream B) совпадения сравнимы (exact-id≈1.0, cosine 0..1),
  // поэтому интерливим их по score, а не «Stream A всегда выше» — иначе
  // тангенциальное символьное совпадение выдавливает сильный семантический хит
  // (подтверждено замером: при строгих тирах MRR/nDCG ниже). Граф-lift —
  // трейлинг-контекст (вторичные, связанные документы) — идёт после основных.
  const tier = (src) => (src === 'graphLift' ? 1 : 0);
  const eff = (fileId, score) =>
    score + (docs[fileId] && docs[fileId].sourceType === 'raw' ? GROUND_TRUTH_BOOST : 0);
  const ordered = [...mergedResults.entries()].sort((a, b) => {
    const ta = tier(a[1].source), tb = tier(b[1].source);
    if (ta !== tb) return ta - tb;
    return eff(b[0], b[1].score) - eff(a[0], a[1].score);
  });

  for (const [fileId, info] of ordered) {
    const doc = docs[fileId];
    if (!doc) continue;

    const filePath = path.join(ROOT_DIR, doc.path);
    if (!fs.existsSync(filePath)) continue;

    const rawContent = readText(filePath);
    const cleaned = cleanMarkdownForDump(rawContent);

    // Проверка лимита размера
    const sectionBytes = Buffer.byteLength(cleaned, 'utf8') + 200; // +200 на заголовок секции
    if (totalBytes + sectionBytes > MAX_CONTEXT_BYTES) {
      sections.push(
        `## ⚠️ Truncated\n\n` +
        `Контекст обрезан по лимиту ${(MAX_CONTEXT_BYTES / 1024).toFixed(0)}KB. ` +
        `Пропущены оставшиеся документы.`
      );
      break;
    }

    const sourceTag = {
      streamA:   '🎯 Exact',
      streamB:   '🧠 Semantic',
      graphLift: '🔗 Graph+1',
    }[info.source] || info.source;

    // Метка происхождения: raw/код — первоисточник (истина), wiki — производное саммари.
    const kind = doc.sourceType === 'raw'
      ? '📄 SOURCE (ground truth)'
      : '📝 SUMMARY (derived — may lag the source)';

    sections.push([
      `## ${doc.id}`,
      ``,
      `> **Source**: ${sourceTag} | **Kind**: ${kind} | **Score**: ${info.score.toFixed(3)} | **Path**: \`${doc.path}\``,
      `> **Layer**: ${doc.layer} | **Cluster**: ${doc.cluster}`,
      Array.isArray(doc.symbols) && doc.symbols.length > 0
        ? `> **Symbols**: ${doc.symbols.join(', ')}`
        : null,
      ``,
      cleaned,
      ``,
      `---`,
      ``,
    ].filter(Boolean).join('\n'));

    totalBytes += sectionBytes;
  }

  // Сборка полного дампа (запись — на стороне main, чтобы выбрать адресата)
  const fullDump = header + sections.join('\n');
  return { count: sections.length, dump: fullDump };
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();

  // 1. Парсинг аргументов
  const { query: rawQuery, outPath, toStdout } = parseArgs();
  if (!rawQuery) {
    console.error(`${C.red}[ERROR]${C.reset} Укажите запрос: --query "ваш запрос"`);
    console.error(`  Пример: node system/query-wiki.js --query "CowController, оптимизация"`);
    console.error(`  Опции:  --out <path> (свой файл), --stdout (вывод в stdout)`);
    process.exit(1);
  }
  // Адресат дампа: --stdout > --out <path> > дефолтный .cursor-context-dump.md.
  // Дефолт сохранён для обратной совместимости с CCP; --out снимает гонку
  // при параллельных запросах (каждый пишет в свой файл).
  const destPath  = outPath ? path.resolve(outPath) : DUMP_FILE;
  const destLabel = toStdout ? 'stdout' : (outPath ? path.relative(ROOT_DIR, destPath).replace(/\\/g, '/') : '.cursor-context-dump.md');

  // 2. Загрузка мета-индекса
  const index = loadIndex();
  const docCount = Object.keys(index.documents || {}).length;
  const clusterCount = Object.keys(index.clusters_centroids || {}).length;

  console.error(`${C.dim}[*] Индекс: ${docCount} документов, ${clusterCount} кластеров${C.reset}`);

  // 3. Разбор запроса
  const queryParts = parseQuery(rawQuery);
  console.error(
    `${C.dim}[*] Символы: [${queryParts.symbols.join(', ')}] ` +
    `| Семантика: "${queryParts.semantic}"${C.reset}`
  );

  // 4. Stream A — символьный поиск (мгновенный)
  const streamAResults = runStreamA(queryParts.symbols, index);
  console.error(`${C.cyan}[A]${C.reset} Символьный: ${streamAResults.size} совпадений`);

  // 5. Stream B — семантический поиск (требует модель)
  let streamBResults = new Map();
  if (queryParts.semantic) {
    const extractor = await initModel();
    streamBResults = await runStreamB(queryParts.semantic, index, extractor);
    console.error(`${C.cyan}[B]${C.reset} Семантический: ${streamBResults.size} совпадений (порог: ${CFG.threshold_mode})`);
  } else {
    console.error(`${C.dim}[B] Семантический поиск пропущен (нет фразы).${C.reset}`);
  }

  // 6. Слияние результатов (Stream A имеет приоритет)
  const merged = new Map();
  for (const [id, info] of streamAResults.entries()) {
    merged.set(id, info);
  }
  for (const [id, info] of streamBResults.entries()) {
    if (!merged.has(id)) {
      merged.set(id, info);
    }
  }

  // 7. Графовый лифт (+1 step для точных совпадений)
  const liftedBefore = merged.size;
  applyGraphLift(merged, index, GRAPH_LIFT_SEMANTIC);
  const liftedCount = merged.size - liftedBefore;
  if (liftedCount > 0) {
    console.error(`${C.cyan}[G]${C.reset} Графовый лифт: +${liftedCount} документов`);
  }

  // 8. Проверка на пустой результат
  if (merged.size === 0) {
    console.error(`${C.yellow}[WARN]${C.reset} Ничего не найдено по запросу "${rawQuery}".`);
    const emptyDump = `# Wiki Context Dump\n\n> Query: \`${rawQuery}\`\n\n**Совпадений не найдено.**\n`;
    if (toStdout) {
      process.stdout.write(emptyDump);
    } else {
      writeTextBom(destPath, emptyDump);
      console.log(`WIKI_QUERY_RESULT: 0 documents found for "${rawQuery}"`);
    }
    process.exit(0);
  }

  // 9. Сборка контекста и вывод выбранному адресату
  const { count: loadedCount, dump } = assembleAndDump(merged, index, rawQuery);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (toStdout) {
    process.stdout.write(dump);
    console.error(`\n${C.green}[OK]${C.reset} ${loadedCount} документов → ${C.bold}stdout${C.reset} (${elapsed}s)`);
  } else {
    writeTextBom(destPath, dump);
    console.error(`\n${C.green}[OK]${C.reset} ${loadedCount} документов → ${C.bold}${destLabel}${C.reset} (${elapsed}s)`);
    // stdout — короткая строка для AI-агента (не превышает буфер IDE)
    console.log(`WIKI_QUERY_RESULT: ${loadedCount} documents loaded in ${elapsed}s. Context: ${destLabel}`);
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────
main().catch(err => {
  console.error(`${C.red}[FATAL] ${err.message}${C.reset}`);
  console.error(err.stack);
  process.exit(1);
});
