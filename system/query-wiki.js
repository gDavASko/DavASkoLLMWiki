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
 *              фильтр по cosine >= 0.78, Top-3 документа
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

// ─── Search Configuration ────────────────────────────────────────────
const SIMILARITY_THRESHOLD = 0.78;
const TOP_K_DOCUMENTS      = 3;
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
 * Парсинг --query из CLI-аргументов.
 * Поддерживает: --query "text" и --query text
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const queryIdx = args.indexOf('--query');
  if (queryIdx === -1 || queryIdx + 1 >= args.length) {
    return null;
  }
  return args[queryIdx + 1];
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

  for (const part of parts) {
    // Проверяем: одно слово, начинается с заглавной, PascalCase / m_prefix / I-interface
    if (/^[A-Z][a-zA-Z0-9_]*$/.test(part) || /^[mM]_[a-zA-Z0-9]+$/.test(part)) {
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

async function initModel() {
  console.error(`${C.cyan}[*]${C.reset} Initializing WebGPU Shaders (First run may take 2 seconds)...`);
  const startMs = Date.now();

  const { pipeline, env } = await import('@huggingface/transformers');
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
    console.error(`${C.red}[FATAL]${C.reset} Модель не загружена: ${err.message}`);
    console.error(`  Убедитесь: node system/scripts/setup-model.js`);
    process.exit(1);
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.error(`${C.green}[OK]${C.reset} Модель: ${elapsed}s (${DTYPE}, ${VECTOR_DIM}d)`);
  return extractor;
}

async function embed(extractor, text, taskId = 0) {
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
//  STREAM A — СИМВОЛЬНЫЙ ПОИСК
// ═══════════════════════════════════════════════════════════════════════

/**
 * Мгновенный поиск по symbols, tags, id, wikilinks.
 * Возвращает Map<fileId, { source: 'streamA', score: 1.0 }>
 */
function runStreamA(symbols, index) {
  /** @type {Map<string, {source: string, score: number}>} */
  const results = new Map();
  if (symbols.length === 0) return results;

  const docs = index.documents || {};
  const symbolsLower = symbols.map(s => s.toLowerCase());

  for (const [docId, doc] of Object.entries(docs)) {
    let matched = false;

    // Совпадение по id
    if (symbolsLower.includes(docId.toLowerCase())) {
      matched = true;
    }

    // Совпадение по symbols
    if (!matched && Array.isArray(doc.symbols)) {
      for (const sym of doc.symbols) {
        if (symbolsLower.includes(sym.toLowerCase())) {
          matched = true;
          break;
        }
      }
    }

    // Совпадение по tags
    if (!matched && Array.isArray(doc.tags)) {
      for (const tag of doc.tags) {
        if (symbolsLower.includes(tag.toLowerCase())) {
          matched = true;
          break;
        }
      }
    }

    // Совпадение по wikilinks (если документ ссылается на искомый символ)
    if (!matched && Array.isArray(doc.wikilinks)) {
      for (const wl of doc.wikilinks) {
        if (symbolsLower.includes(wl.toLowerCase())) {
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      results.set(docId, { source: 'streamA', score: 1.0 });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════
//  STREAM B — СЕМАНТИЧЕСКИЙ ПОИСК
// ═══════════════════════════════════════════════════════════════════════

/**
 * Семантический поиск:
 *   1. Векторизация запроса с "query: " prefix
 *   2. Определение ближайшего центроида-кластера
 *   3. Линейный проход по шарду, фильтр по cosine >= threshold
 *   4. Top-K документов по лучшему совпадению чанка
 */
async function runStreamB(semanticQuery, index, extractor) {
  /** @type {Map<string, {source: string, score: number}>} */
  const results = new Map();
  if (!semanticQuery || semanticQuery.trim().length === 0) return results;

  // 1. Векторизация запроса с prefix
  const queryVec = await embed(extractor, `query: ${semanticQuery}`);

  // 2. Определение ближайшего центроида-кластера
  const centroids = index.clusters_centroids || {};
  let bestCluster = null;
  let bestClusterScore = -Infinity;

  for (const [clName, centroid] of Object.entries(centroids)) {
    const score = cosineSimilarity(queryVec, centroid);
    if (score > bestClusterScore) {
      bestClusterScore = score;
      bestCluster = clName;
    }
  }

  if (!bestCluster) return results;

  console.error(`${C.dim}  Ближайший кластер: ${bestCluster} (score: ${bestClusterScore.toFixed(3)})${C.reset}`);

  // 3. Загрузка шарда для ближайшего кластера
  const shardPath = path.join(SHARDS_DIR, `embeddings-${bestCluster}.json`);
  if (!fs.existsSync(shardPath)) return results;

  const shard = JSON.parse(readText(shardPath));

  // 4. Линейный проход: вычисляем cosine(queryVec, chunkVec) для каждого чанка
  /** @type {Map<string, number>} fileId → лучший score */
  const fileScores = new Map();

  for (const entry of shard) {
    const score = cosineSimilarity(queryVec, entry.embedding);
    if (score >= SIMILARITY_THRESHOLD) {
      const existing = fileScores.get(entry.fileId) || 0;
      if (score > existing) {
        fileScores.set(entry.fileId, score);
      }
    }
  }

  // Если основной шард дал мало результатов, пробуем остальные шарды
  if (fileScores.size < TOP_K_DOCUMENTS) {
    for (const clName of Object.keys(centroids)) {
      if (clName === bestCluster) continue;
      const otherShardPath = path.join(SHARDS_DIR, `embeddings-${clName}.json`);
      if (!fs.existsSync(otherShardPath)) continue;

      const otherShard = JSON.parse(readText(otherShardPath));
      for (const entry of otherShard) {
        const score = cosineSimilarity(queryVec, entry.embedding);
        if (score >= SIMILARITY_THRESHOLD) {
          const existing = fileScores.get(entry.fileId) || 0;
          if (score > existing) {
            fileScores.set(entry.fileId, score);
          }
        }
      }
    }
  }

  // 5. Top-K по score
  const sorted = [...fileScores.entries()]
    .sort((a, b) => b[1] - a[1])
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
 * Для точных совпадений (Stream A) подгружаем:
 *   - extends → родительский документ (+1)
 *   - [[WikiLinks]] в теле → связанные документы (+1)
 * Для Stream B (semantic) граф не расширяется.
 */
function applyGraphLift(mergedResults, index) {
  const docs = index.documents || {};
  const additions = new Map();

  for (const [fileId, info] of mergedResults.entries()) {
    if (info.source !== 'streamA') continue;

    const doc = docs[fileId];
    if (!doc) continue;

    // extends → +1
    if (doc.extends && docs[doc.extends] && !mergedResults.has(doc.extends)) {
      additions.set(doc.extends, { source: 'graphLift', score: 0.9 });
    }

    // wikilinks → +1
    if (Array.isArray(doc.wikilinks)) {
      for (const wl of doc.wikilinks) {
        if (docs[wl] && !mergedResults.has(wl) && !additions.has(wl)) {
          additions.set(wl, { source: 'graphLift', score: 0.85 });
        }
      }
    }
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

  // Сортируем: streamA первым, затем streamB, затем graphLift
  const sourceOrder = { streamA: 0, streamB: 1, graphLift: 2 };
  const ordered = [...mergedResults.entries()].sort((a, b) => {
    const oa = sourceOrder[a[1].source] ?? 3;
    const ob = sourceOrder[b[1].source] ?? 3;
    if (oa !== ob) return oa - ob;
    return b[1].score - a[1].score;
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

    sections.push([
      `## ${doc.id}`,
      ``,
      `> **Source**: ${sourceTag} | **Score**: ${info.score.toFixed(3)} | **Path**: \`${doc.path}\``,
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

  // Сборка полного дампа
  const fullDump = header + sections.join('\n');
  writeTextBom(DUMP_FILE, fullDump);

  return sections.length;
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();

  // 1. Парсинг аргументов
  const rawQuery = parseArgs();
  if (!rawQuery) {
    console.error(`${C.red}[ERROR]${C.reset} Укажите запрос: --query "ваш запрос"`);
    console.error(`  Пример: node system/query-wiki.js --query "CowController, оптимизация"`);
    process.exit(1);
  }

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
    console.error(`${C.cyan}[B]${C.reset} Семантический: ${streamBResults.size} совпадений (>= ${SIMILARITY_THRESHOLD})`);
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
  applyGraphLift(merged, index);
  const liftedCount = merged.size - liftedBefore;
  if (liftedCount > 0) {
    console.error(`${C.cyan}[G]${C.reset} Графовый лифт: +${liftedCount} документов`);
  }

  // 8. Проверка на пустой результат
  if (merged.size === 0) {
    console.error(`${C.yellow}[WARN]${C.reset} Ничего не найдено по запросу "${rawQuery}".`);
    // Пишем пустой дамп, чтобы старый не вводил в заблуждение
    writeTextBom(DUMP_FILE, `# Wiki Context Dump\n\n> Query: \`${rawQuery}\`\n\n**Совпадений не найдено.**\n`);
    // stdout — короткая строка для AI-агента
    console.log(`WIKI_QUERY_RESULT: 0 documents found for "${rawQuery}"`);
    process.exit(0);
  }

  // 9. Сборка контекста и запись в файл
  const loadedCount = assembleAndDump(merged, index, rawQuery);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.error(
    `\n${C.green}[OK]${C.reset} ${loadedCount} документов → ${C.bold}.cursor-context-dump.md${C.reset} (${elapsed}s)`
  );

  // 10. stdout — единственный вывод для AI-агента
  //     Короткая строка, не превышает буфер IDE
  console.log(`WIKI_QUERY_RESULT: ${loadedCount} documents loaded in ${elapsed}s. Context: .cursor-context-dump.md`);
}

// ─── Entry Point ─────────────────────────────────────────────────────
main().catch(err => {
  console.error(`${C.red}[FATAL] ${err.message}${C.reset}`);
  console.error(err.stack);
  process.exit(1);
});
