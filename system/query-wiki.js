#!/usr/bin/env node
/**
 * DavASkoLLMWiki v3.x — Search Orchestrator (query-wiki.js)
 * Implements RAG document dump assembly with strict <document> XML encapsulation for Prompt Injection Defense.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cosineSimilarity, selectProbeClusters, applyThreshold, scoreSymbolMatches, initModel as libInitModel, embed as libEmbed, initReranker as libInitReranker, rerank as libRerank } from './lib/retrieval.js';
import { resolveModelsCache } from './lib/model-locator.js';
import { resolveWikiPaths } from './lib/wiki-paths.js';
import { createEmbeddingClient, getEmbeddingProfile, sameEmbeddingProfile } from './lib/embedding-client.js';
import { parseFrontmatter } from './lib/frontmatter.js';
import { execSync } from 'child_process';
import * as lancedb from 'vectordb';
import { createQuerySupervisorGraph } from '../orchestration/graphs/query-supervisor.js';
import { LanguageModelPort } from '../orchestration/provider.js';
import { wrapDocumentXml } from '../orchestration/policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_DIR   = __dirname;
// Единый резолвинг путей: legacy (колокация в checkout) или внешний профиль.
// dataRoot — данные (слои/документы); checkoutRoot — код (hyperresearch, build-index).
const WIKI_PATHS   = resolveWikiPaths(process.env, SYSTEM_DIR);
const ROOT_DIR     = WIKI_PATHS.dataRoot;
const CHECKOUT_ROOT = WIKI_PATHS.checkoutRoot;
const BUILD_INDEX_CMD = `node ${JSON.stringify(path.join(SYSTEM_DIR, 'build-index.js'))}`;
const MODELS_CACHE = (() => {
  const r = resolveModelsCache({ localFallback: WIKI_PATHS.modelsCacheFallback });
  return r.dir || r.hint;
})();
const INDEX_FILE   = WIKI_PATHS.indexFile;
const LANCEDB_DIR  = WIKI_PATHS.lancedbDir;
const EMBEDDING_MANIFEST_FILE = WIKI_PATHS.embeddingManifestFile;
const DUMP_FILE    = WIKI_PATHS.dumpFile;
const CONFIG_FILE  = WIKI_PATHS.searchConfigFile;

const SEARCH_DEFAULTS = {
  threshold_mode:       'relative',
  relative_alpha:       0.85,
  junk_floor:           0.35,
  similarity_threshold: 0.70,
  similarity_fallback:  0.65,
  top_k_documents:      5,
  nprobe:               8,
  ground_truth_boost:   0.05,
  stream_a_limit:       10,
  graph_lift_semantic:  2,
  device:               'auto',
};
function loadSearchConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8').replace(/^∩╗┐/, '');
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
const MAX_CONTEXT_BYTES    = 120_000;
const EMBEDDING_PROFILE    = getEmbeddingProfile();
const MODEL_ID             = EMBEDDING_PROFILE.model;
const MODEL_REVISION       = EMBEDDING_PROFILE.revision;
const VECTOR_DIM           = EMBEDDING_PROFILE.dimension;
const DTYPE                = EMBEDDING_PROFILE.dtype || 'native';

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
};

export function parseArgs(argv = process.argv.slice(2)) {
  let query = '';
  let toStdout = false;
  let rlm = false;
  let auto = false;
  let outPath = null;
  let locations = [];
  let topK = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--query' && argv[i + 1]) {
      query = argv[++i];
    } else if (arg === '--stdout') {
      toStdout = true;
    } else if (arg === '--rlm') {
      rlm = true;
    } else if (arg === '--auto') {
      auto = true;
    } else if (arg === '--out' && argv[i + 1]) {
      outPath = argv[++i];
    } else if (arg === '--locations' && argv[i + 1]) {
      locations = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg === '--top-k' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[++i], 10);
      if (Number.isInteger(parsed) && parsed > 0) topK = Math.min(parsed, 200);
    }
  }

  return { query, toStdout, rlm, auto, outPath, locations, topK };
}

export function parseQuery(rawQuery) {
  const parts = rawQuery.split(',').map(s => s.trim()).filter(Boolean);
  const symbols = [];
  const semanticParts = [];

  for (const part of parts) {
    if (/^[A-Z][a-zA-Z0-9_]*$/.test(part) || part.includes('Controller') || part.includes('Manager')) {
      symbols.push(part);
    } else {
      semanticParts.push(part);
    }
  }
  
  const englishWords = (rawQuery.match(/[a-zA-Z]{3,}/g) || []).map(w => w.toLowerCase());
  for (const word of englishWords) {
    if (!symbols.includes(word)) symbols.push(word);
  }

  return {
    symbols,
    semantic: semanticParts.join(', ') || rawQuery,
  };
}

export function loadIndex() {
  if (fs.existsSync(INDEX_FILE)) {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  }
  return { documents: {}, clusters: [] };
}

export async function loadLanceIndex(allowBuild = false) {
  let indexData = loadIndex();

  try {
    const indexedProfile = JSON.parse(fs.readFileSync(EMBEDDING_MANIFEST_FILE, 'utf8'));
    if (!sameEmbeddingProfile(indexedProfile, EMBEDDING_PROFILE)) throw new Error('embedding profile mismatch');
  } catch (error) {
    if (!allowBuild) throw new Error(`Wiki index cannot be searched with the configured embedding profile: ${error instanceof Error ? error.message : String(error)}`);
    if (fs.existsSync(LANCEDB_DIR)) throw new Error('Wiki index must be rebuilt explicitly with `node system/build-index.js --force` after an embedding profile change.');
  }

  if (!fs.existsSync(LANCEDB_DIR)) {
    if (allowBuild) {
      console.error(`${C.yellow}[!] LanceDB не найден. Запуск сборки индекса...${C.reset}`);
      execSync(BUILD_INDEX_CMD, { stdio: 'inherit', cwd: CHECKOUT_ROOT });
    } else {
      throw new Error(`LanceDB directory missing at ${LANCEDB_DIR}`);
    }
  }

  const db = await lancedb.connect(LANCEDB_DIR);
  let table;
  try {
    table = await db.openTable('wiki_chunks');
  } catch (err) {
    if (allowBuild) {
      console.error(`${C.yellow}[!] Таблица wiki_chunks не найдена. Запуск сборки индекса...${C.reset}`);
      execSync(BUILD_INDEX_CMD, { stdio: 'inherit', cwd: CHECKOUT_ROOT });
      table = await db.openTable('wiki_chunks');
    } else {
      throw err;
    }
  }

  if (Object.keys(indexData.documents).length === 0) {
    try {
      const allRows = await table.search().limit(100000).execute();
      for (const row of allRows) {
        if (!indexData.documents[row.fileId]) {
          indexData.documents[row.fileId] = {
            id: row.fileId,
            path: row.path,
            layer: row.layer,
            cluster: row.layer,
            sourceType: row.sourceType,
            symbols: row.symbols ? JSON.parse(row.symbols) : [],
            tags: row.tags ? JSON.parse(row.tags) : [],
            wikiLinks: row.wikilinks ? JSON.parse(row.wikilinks) : [],
            extends: row.extendsRef
          };
        }
      }
    } catch (e) {
      console.error("Failed to build indexData from LanceDB", e);
    }
  }

  return { ...indexData, lanceTable: table };
}

export async function initModel() {
  return createEmbeddingClient(EMBEDDING_PROFILE, { modelsCache: MODELS_CACHE, device: CFG.device });
}

export function runStreamA(symbols, index, locations = []) {
  const results = new Map();
  if (symbols.length === 0) return results;

  const validLayers = locations && locations.length > 0 ? locations.map(l => l.replace(/^knowledge-base\//, '')) : null;

  for (const [id, doc] of Object.entries(index.documents || {})) {
    if (validLayers && !validLayers.includes(doc.layer)) continue;

    const matched = symbols.filter(sym => (doc.symbols || []).includes(sym));
    if (matched.length > 0) {
      const score = Math.min(1.0, 0.70 + matched.length * 0.15);
      results.set(id, { score, source: 'streamA', matchedSymbols: matched });
    }
  }

  const sorted = Array.from(results.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, STREAM_A_LIMIT);

  return new Map(sorted);
}

/**
 * Семантический поток поиска.
 * @param {number} [topK] Ширина выборки. Задаётся уровнем когнитивной сложности
 *   запроса (narrow/broad/full_scan): счётным и аналитическим вопросам нужна
 *   полнота, а не топ-5 по близости. По умолчанию — значение из search-config.
 */
export async function runStreamB(semanticQuery, index, extractor, locations = [], topK = TOP_K_DOCUMENTS) {
  const results = new Map();
  if (!semanticQuery || !index.lanceTable) return results;
  const effectiveTopK = Number.isInteger(topK) && topK > 0 ? topK : TOP_K_DOCUMENTS;

  const queryEmbedding = await extractor.embed('query: ' + semanticQuery);
  const probeClusters = selectProbeClusters(queryEmbedding, index.clusters || []);
  
  const searchTasks = [];
  const locsToSearch = locations && locations.length > 0 ? locations : [null];

  for (const loc of locsToSearch) {
    searchTasks.push((async () => {
      let queryBuilder = index.lanceTable
        .search(Array.from(queryEmbedding))
        .limit(effectiveTopK * 3);
        
      if (loc) {
        const layerName = loc.replace(/^knowledge-base\//, '');
        queryBuilder = queryBuilder.filter(`layer = '${layerName}'`);
      }
      
      const searchResults = await queryBuilder.execute();
      
      const docScores = new Map();
      for (const row of searchResults) {
        const docId = row.fileId || row.doc_id || row.id;
        if (!docId) continue;
        
        const vector = row.vector ? Array.from(row.vector) : null;
        let sim = 0;
        if (vector) {
          sim = cosineSimilarity(queryEmbedding, vector);
        } else if (row._distance !== undefined) {
          sim = 1 - (row._distance / 2);
        }

        if (sim > (docScores.get(docId) || 0)) {
          docScores.set(docId, sim);
        }
      }

      const thresholdResult = applyThreshold(Array.from(docScores.entries()), {
        threshold_mode: CFG.threshold_mode,
        relative_alpha: CFG.relative_alpha,
        junk_floor: CFG.junk_floor,
        similarity_threshold: CFG.similarity_threshold,
        similarity_fallback: CFG.similarity_fallback,
        topK: effectiveTopK
      });

      return { docScores, best: thresholdResult.best };
    })());
  }

  const taskResults = await Promise.all(searchTasks);

  for (const { docScores, best } of taskResults) {
    for (const docId of best.keys()) {
      const doc = index.documents[docId];
      let score = docScores.get(docId) || 0.7;
      if (doc && doc.sourceType === 'raw') {
        score += GROUND_TRUTH_BOOST;
      }
      if (!results.has(docId) || results.get(docId).score < score) {
        results.set(docId, { score, source: 'streamB' });
      }
    }
  }

  return results;
}

export function applyGraphLift(mergedResults, index, depth = GRAPH_LIFT_SEMANTIC, locations = []) {
  const initialIds = Array.from(mergedResults.keys());
  const validLayers = locations && locations.length > 0 ? locations.map(l => l.replace(/^knowledge-base\//, '')) : null;

  for (const docId of initialIds) {
    const doc = index.documents[docId];
    if (!doc) continue;

    const baseScore = mergedResults.get(docId).score;
    const targets = [];
    if (doc.extends) targets.push(doc.extends);
    if (Array.isArray(doc.wikiLinks)) targets.push(...doc.wikiLinks);

    for (const targetId of targets) {
      const targetDoc = index.documents[targetId];
      if (targetDoc && !mergedResults.has(targetId)) {
        if (validLayers && !validLayers.includes(targetDoc.layer)) continue;
        mergedResults.set(targetId, {
          score: baseScore * 0.80,
          source: 'graphLift',
          parent: docId,
        });
      }
    }
  }
}

/**
 * Добор СОСЕДНИХ секций того же документа-таба по общей директории.
 *
 * GDD-док нарезан на секции по заголовкам, и все они лежат в одной папке
 * (напр. `.../10_RobotGumanoid/`). Семантически это ОДИН документ. Беда
 * относительного порога: когда одна секция — точное попадание в запрос (Overview
 * «Робот — Гуманоид» на запрос «инфу про робота гуманоида», score 0.71), tau=0.85*top
 * поднимается так высоко, что остальные секции той же сущности (Концепция, Анимации,
 * Команды — они формулируются иначе и матчатся слабее) отсекаются, и выдача
 * схлопывается до одного огрызка. Реальный кейс: Mac отдавал 1 секцию вместо 11.
 *
 * Решение хирургическое: для каждой НАЙДЕННОЙ секции подтягиваем её соседей по
 * папке — только уже релевантной сущности, без случайного шума. Большие «плоские»
 * каталоги не разворачиваем (эвристика: маленькая папка = один док, разбитый на
 * секции). Индекс несёт `path`, так что пересборка не нужна.
 */
export function applyDirectorySiblings(mergedResults, index, { maxDirSize = 30, liftFactor = 0.75, locations = [] } = {}) {
  const validLayers = locations && locations.length > 0 ? locations.map(l => l.replace(/^knowledge-base\//, '')) : null;
  const dirOf = (p) => { const i = String(p || '').lastIndexOf('/'); return i < 0 ? null : p.slice(0, i); };

  // dir → [docId] по всему индексу (один проход на запрос).
  const byDir = new Map();
  for (const [id, doc] of Object.entries(index.documents)) {
    const dir = dirOf(doc.path);
    if (!dir) continue;
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(id);
  }

  for (const seedId of Array.from(mergedResults.keys())) {
    const seedDoc = index.documents[seedId];
    const dir = seedDoc && dirOf(seedDoc.path);
    if (!dir) continue;
    const siblings = byDir.get(dir) || [];
    if (siblings.length > maxDirSize) continue; // не разворачиваем крупные каталоги
    const baseScore = mergedResults.get(seedId).score;
    for (const sibId of siblings) {
      if (mergedResults.has(sibId)) continue;
      const sibDoc = index.documents[sibId];
      if (!sibDoc) continue;
      if (validLayers && !validLayers.includes(sibDoc.layer)) continue;
      mergedResults.set(sibId, { score: baseScore * liftFactor, source: 'dirSibling', parent: seedId });
    }
  }
}

export function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Извлекает из документа поля, нужные для цитирования и оценки актуальности.
 * Раньше ссылка на первоисточник доходила до модели только «случайно» — вместе
 * с неудалённым фронтматтером; теперь она выносится в заголовок секции явно.
 */
export function extractCitationMeta(raw) {
  let meta = {};
  try { meta = parseFrontmatter(raw).meta || {}; } catch { meta = {}; }
  const sourceUrl = typeof meta.source_url === 'string' && /^https?:\/\//.test(meta.source_url.trim())
    ? meta.source_url.trim()
    : null;
  return {
    sourceUrl,
    title: typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : null,
    modified: meta.doc_modified_time || meta.source_modified_time || null,
  };
}

export function cleanMarkdownForDump(raw, docPath) {
  // parseFrontmatter снимает BOM и понимает CRLF. Прежняя регулярка требовала,
  // чтобы файл начинался ровно с '---', поэтому на файлах с BOM фронтматтер
  // оставался в контексте и занимал место.
  let text = parseFrontmatter(raw).body;
  text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, label) => label || link);
  
  if (docPath) {
    text = text.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
      if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) return match;
      try {
        const docDir = path.posix.dirname(docPath.split(path.sep).join('/'));
        const resolved = path.posix.join(docDir, url.split(path.sep).join('/'));
        const normalized = path.posix.normalize(resolved);
        return `![${alt}](${normalized})`;
      } catch (e) {
        return match;
      }
    });
  }

  return text.trim();
}

/** Ужимает текст документа до байтового бюджета, не разрывая его посередине символа. */
export function truncateToBudget(text, budgetBytes) {
  if (!Number.isFinite(budgetBytes) || Buffer.byteLength(text, 'utf8') <= budgetBytes) return text;
  let cut = text.slice(0, budgetBytes);
  while (cut.length > 0 && Buffer.byteLength(cut, 'utf8') > budgetBytes) cut = cut.slice(0, -128);
  return `${cut.trimEnd()}\n\n> **[Фрагмент сокращён]** Полный текст доступен по ссылке на источник.`;
}

export function assembleAndDump(mergedResults, index, rawQuery, options = {}) {
  // При широкой выборке (счётные и аналитические запросы) важнее охват, чем
  // полнота каждой статьи: без бюджета на документ первые же длинные статьи
  // съедали лимит контекста, а остальные молча отбрасывались по Safety Limit.
  const candidateCount = mergedResults.size;
  const perDocBudget = Number.isFinite(options.docExcerptBytes)
    ? options.docExcerptBytes
    : (candidateCount > 8
        ? Math.max(2_500, Math.floor((MAX_CONTEXT_BYTES * 0.9) / Math.min(candidateCount, 40)))
        : Infinity);

  const sorted = Array.from(mergedResults.entries());

  const groups = new Map();
  for (const [id, info] of sorted) {
    const doc = index.documents[id];
    if (!doc) continue;
    const layer = doc.layer || 'unknown';
    if (!groups.has(layer)) groups.set(layer, { maxScore: 0, docs: [] });
    
    const group = groups.get(layer);
    group.docs.push([id, info, doc]);
    if (info.score > group.maxScore) group.maxScore = info.score;
  }

  const sortedGroups = Array.from(groups.entries())
    .sort((a, b) => b[1].maxScore - a[1].maxScore);

  const header = [
    `# Wiki Context Dump`,
    ``,
    `> **Query**: \`${rawQuery}\``,
    `> **Generated**: ${new Date().toISOString()}`,
    `> **Results Count**: ${sorted.length}`,
    ``,
    `---`,
    ``,
  ].join('\n');

  let totalBytes = Buffer.byteLength(header, 'utf8');
  const sections = [];
  let addedDocsCount = 0;
  let limitReached = false;

  for (const [layer, group] of sortedGroups) {
    if (limitReached) break;

    group.docs.sort((a, b) => b[1].score - a[1].score);

    const groupHeader = `\n# 📚 Источник: ${layer}\n---\n`;
    const groupHeaderBytes = Buffer.byteLength(groupHeader, 'utf8');
    if (totalBytes + groupHeaderBytes > MAX_CONTEXT_BYTES) {
        sections.push(`> **[Safety Limit Exceeded]**: Truncated additional groups.`);
        limitReached = true;
        break;
    }
    sections.push(groupHeader);
    totalBytes += groupHeaderBytes;

    for (const [id, info, doc] of group.docs) {
      const filePath = path.join(ROOT_DIR, doc.path);
      if (!fs.existsSync(filePath)) {
        console.log(`[Search Debug] File missing on disk: ${filePath}`);
        continue;
      }

      const rawContent = readText(filePath);
      const cleaned = truncateToBudget(cleanMarkdownForDump(rawContent, doc.path), perDocBudget);
      const citation = extractCitationMeta(rawContent);
      const sourceUrl = citation.sourceUrl || (doc.metadata && doc.metadata.sourceUrl) || null;

      const wrappedSection = wrapDocumentXml(doc.id, cleaned, {
        layer: doc.layer,
        cluster: doc.cluster,
        path: doc.path
      });

      const sourceTag = {
        streamA:   'Exact',
        streamB:   'Semantic',
        graphLift: 'Graph+1',
      }[info.source] || info.source;

      const kind = doc.sourceType === 'raw'
        ? 'SOURCE (ground truth)'
        : 'SUMMARY (derived)';

      const sectionText = [
        `## ${doc.id}`,
        ``,
        `> **Source**: ${sourceTag} | **Kind**: ${kind} | **Score**: ${info.score.toFixed(3)} | **Path**: \`${doc.path}\``,
        `> **Layer**: ${doc.layer} | **Cluster**: ${doc.cluster}`,
        citation.title ? `> **Заголовок**: ${citation.title}` : null,
        citation.modified ? `> **Обновлено**: ${citation.modified}` : null,
        // Маркер согласован с извлечением ссылок в боте (src/index.ts) и с
        // инструкцией в промпте ответа. Менять только синхронно во всех трёх местах.
        sourceUrl ? `> **URL ДЛЯ ССЫЛОК**: ${sourceUrl}` : null,
        Array.isArray(doc.symbols) && doc.symbols.length > 0
          ? `> **Symbols**: ${doc.symbols.join(', ')}`
          : null,
        ``,
        wrappedSection,
        ``,
        `---`,
        ``,
      ].filter(Boolean).join('\n');

      // Считаем ПОЛНЫЙ размер секции вместе с шапкой: раньше учитывалось только
      // тело документа, из-за чего дамп выходил за лимит и мог быть обрублен
      // адаптером на полуслове (что выглядело как авария поиска).
      const sectionBytes = Buffer.byteLength(sectionText, 'utf8') + 1;
      if (totalBytes + sectionBytes > MAX_CONTEXT_BYTES) {
        sections.push(`> **[Safety Limit Exceeded]**: Truncated additional documents.`);
        limitReached = true;
        break;
      }

      sections.push(sectionText);
      totalBytes += sectionBytes;
      addedDocsCount++;
    }
  }

  const fullDump = header + sections.join('\n');
  return { count: addedDocsCount, dump: fullDump };
}

export function runGraphifyAdapter(query, dumpPath, toStdout, outPath) {
  const adapterScript = path.join(CHECKOUT_ROOT, 'hyperresearch', 'graphify-adapter.js');
  if (!fs.existsSync(adapterScript)) {
    return false;
  }

  try {
    const cmd = `node "${adapterScript}" --query "${query.replace(/"/g, '\\"')}" --dump "${dumpPath}"`;
    const result = execSync(cmd, { cwd: CHECKOUT_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    const output = outPath || dumpPath;
    fs.writeFileSync(output, result, 'utf8');

    if (toStdout) {
      process.stdout.write(result);
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function main() {
  const args = parseArgs();

  if (!args.query) {
    console.error(`${C.red}Ошибка: укажите параметр --query "ваш запрос"${C.reset}`);
    process.exit(1);
  }

  // Проверка: настроена ли база знаний (внешний профиль или локальный индекс)
  const hasLocalIndex = fs.existsSync(INDEX_FILE) || fs.existsSync(LANCEDB_DIR);
  const wikiDirEnv = (process.env.KBPRO_AI_CHAT_WIKI_DIR || '').trim();
  const hasValidProfile = wikiDirEnv && fs.existsSync(path.join(wikiDirEnv, 'config', 'config-manifest.json'));

  if (!hasLocalIndex && !hasValidProfile) {
    console.error(`\n${C.yellow}═══════════════════════════════════════════════════════════════════════${C.reset}`);
    console.error(`${C.red}${C.bold}[KBPRO_AI_CHAT_WIKI] База знаний не обнаружена на этом компьютере!${C.reset}`);
    console.error(`Переменная среды KBPRO_AI_CHAT_WIKI_DIR не задана или профиль недоступен.`);
    console.error(`\nЧтобы автоматически настроить базу знаний (клонировать и прописать окружение),`);
    console.error(`запустите команду мастера:`);
    console.error(`  ${C.green}${C.bold}node system/scripts/setup-knowledge-base.js${C.reset}`);
    console.error(`${C.yellow}═══════════════════════════════════════════════════════════════════════${C.reset}\n`);

    if (process.stdin.isTTY && !args.toStdout) {
      try {
        const readline = await import('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise(resolve => rl.question('Хотите настроить базу знаний прямо сейчас? [Y/n]: ', resolve));
        rl.close();
        if (!answer || answer.toLowerCase().startsWith('y')) {
          const { spawnSync } = await import('child_process');
          const setupScript = path.join(SYSTEM_DIR, 'scripts', 'setup-knowledge-base.js');
          const setupRes = spawnSync(process.execPath, [setupScript], { stdio: 'inherit' });
          if (setupRes.status === 0) {
            console.log(`${C.green}База знаний успешно настроена. Перезапустите команду поиска.${C.reset}`);
            process.exit(0);
          }
        }
      } catch {
        // Fallback если TTY не доступен
      }
    }
    process.exit(1);
  }

  const provider = new LanguageModelPort();
  const graph = createQuerySupervisorGraph({ provider });

  const request = {
    query: args.query,
    mode: args.rlm ? 'rlm' : (args.auto ? 'auto' : 'rag'),
    output: args.toStdout ? 'stdout' : 'file',
    locations: args.locations,
    limits: {
      maxWorkers: 5,
      maxConcurrency: 2,
      maxIterations: 3,
      maxToolOutputBytes: MAX_CONTEXT_BYTES,
      ...(args.topK ? { topK: args.topK } : {})
    }
  };

  try {
    const finalState = await graph.invoke({ request }, { configurable: { thread_id: 'corr_' + Date.now() } });
    const response = finalState.response;

    // Провал поиска обязан отличаться от «ничего не нашлось»: без ненулевого кода
    // вызывающий счёл бы диагностическое сообщение валидным контекстом.
    if (response?.status && response.status !== 'ok') {
      console.error(`${C.red}[FAIL] Поиск завершился со статусом "${response.status}": ${String(response.content).slice(0, 500)}${C.reset}`);
      process.exit(1);
    }

    const targetFile = args.outPath || DUMP_FILE;
    fs.writeFileSync(targetFile, response.content, 'utf8');

    if (args.toStdout) {
      process.stdout.write(response.content);
    } else {
      console.log(`${C.green}Успешно! Результат сохранён в ${targetFile}${C.reset}`);
    }
  } catch (err) {
    console.error(`${C.red} Ошибка исполнения графа: ${err.message}${C.reset}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
