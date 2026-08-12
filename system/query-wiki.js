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
import { QueryRouter } from './lib/query-router.js';
import { execSync } from 'child_process';
import * as lancedb from 'vectordb';
import { createQuerySupervisorGraph } from '../orchestration/graphs/query-supervisor.js';
import { LanguageModelPort } from '../orchestration/provider.js';
import { wrapDocumentXml } from '../orchestration/policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_DIR   = __dirname;
const ROOT_DIR     = path.resolve(SYSTEM_DIR, '..');
const MODELS_CACHE = (() => {
  const r = resolveModelsCache({ localFallback: path.join(SYSTEM_DIR, 'models-cache') });
  return r.dir || r.hint;
})();
const INDEX_FILE   = path.join(SYSTEM_DIR, 'wiki-index.json');
const LANCEDB_DIR  = path.join(SYSTEM_DIR, '.lancedb');
const DUMP_FILE    = path.join(ROOT_DIR, '.cursor-context-dump.md');
const CONFIG_FILE  = path.join(SYSTEM_DIR, 'search-config.json');

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
const MODEL_ID             = 'jinaai/jina-embeddings-v3';
const MODEL_REVISION       = '815152ccf78fb243a0d9b4db0b80ec6ef87e2213';
const VECTOR_DIM           = 1024;
const DTYPE                = 'fp16';

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
    }
  }

  return { query, toStdout, rlm, auto, outPath, locations };
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

  return {
    symbols,
    semantic: semanticParts.join(', ') || rawQuery,
  };
}

export function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) {
    throw new Error(`Файл индекса не найден: ${INDEX_FILE}`);
  }
  const raw = fs.readFileSync(INDEX_FILE, 'utf8');
  return JSON.parse(raw);
}

export async function loadLanceIndex(allowBuild = false) {
  const indexData = loadIndex();

  if (!fs.existsSync(LANCEDB_DIR)) {
    if (allowBuild) {
      console.error(`${C.yellow}[!] LanceDB не найден. Запуск сборки индекса...${C.reset}`);
      execSync('node system/build-index.js', { stdio: 'inherit', cwd: ROOT_DIR });
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
      execSync('node system/build-index.js', { stdio: 'inherit', cwd: ROOT_DIR });
      table = await db.openTable('wiki_chunks');
    } else {
      throw err;
    }
  }

  return { ...indexData, lanceTable: table };
}

export async function initModel() {
  return await libInitModel({
    modelsCache: MODELS_CACHE,
    modelId: MODEL_ID,
    revision: MODEL_REVISION,
    dtype: DTYPE,
    device: CFG.device
  });
}

export function runStreamA(symbols, index) {
  const results = new Map();
  if (symbols.length === 0) return results;

  for (const [id, doc] of Object.entries(index.documents || {})) {
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

export async function runStreamB(semanticQuery, index, extractor) {
  const results = new Map();
  if (!semanticQuery || !index.lanceTable) return results;

  const queryEmbedding = await libEmbed(extractor, semanticQuery, { prefix: 'query: ' });
  const probeClusters = selectProbeClusters(queryEmbedding, index.clusters || []);
  
  const searchResults = await index.lanceTable
    .search(Array.from(queryEmbedding))
    .limit(TOP_K_DOCUMENTS * 3)
    .nprobe(NPROBE)
    .execute();

  const docScores = new Map();
  for (const row of searchResults) {
    const docId = row.doc_id || row.id;
    if (!docId) continue;
    
    const vector = row.vector ? Array.from(row.vector) : null;
    let sim = 0;
    if (vector) {
      sim = cosineSimilarity(queryEmbedding, vector);
    } else if (row._distance !== undefined) {
      sim = 1 - (row._distance / 2);
    }

    if (sim > (docScores.get(docId) || 0)) {
      docScores.get(docId);
      docScores.set(docId, sim);
    }
  }

  const filteredDocIds = applyThreshold(docScores, {
    mode: CFG.threshold_mode,
    relativeAlpha: CFG.relative_alpha,
    junkFloor: CFG.junk_floor,
    minThreshold: CFG.similarity_threshold,
    fallbackThreshold: CFG.similarity_fallback,
    topK: TOP_K_DOCUMENTS
  });

  for (const docId of filteredDocIds) {
    const doc = index.documents[docId];
    let score = docScores.get(docId) || 0.7;
    if (doc && doc.sourceType === 'raw') {
      score += GROUND_TRUTH_BOOST;
    }
    results.set(docId, { score, source: 'streamB' });
  }

  return results;
}

export function applyGraphLift(mergedResults, index, depth = GRAPH_LIFT_SEMANTIC) {
  const initialIds = Array.from(mergedResults.keys());

  for (const docId of initialIds) {
    const doc = index.documents[docId];
    if (!doc) continue;

    const baseScore = mergedResults.get(docId).score;
    const targets = [];
    if (doc.extends) targets.push(doc.extends);
    if (Array.isArray(doc.wikiLinks)) targets.push(...doc.wikiLinks);

    for (const targetId of targets) {
      if (!mergedResults.has(targetId) && index.documents[targetId]) {
        mergedResults.set(targetId, {
          score: baseScore * 0.80,
          source: 'graphLift',
          parent: docId,
        });
      }
    }
  }
}

export function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

export function cleanMarkdownForDump(raw, docPath) {
  let text = raw.replace(/^---[\s\S]*?---\n/, '');
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

export function assembleAndDump(mergedResults, index, rawQuery) {
  const sorted = Array.from(mergedResults.entries())
    .sort((a, b) => b[1].score - a[1].score);

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

  for (const [id, info] of sorted) {
    const doc = index.documents[id];
    if (!doc) continue;

    const filePath = path.join(ROOT_DIR, doc.path);
    if (!fs.existsSync(filePath)) continue;

    const rawContent = readText(filePath);
    const cleaned = cleanMarkdownForDump(rawContent, doc.path);
    const sourceUrl = doc.metadata && doc.metadata.sourceUrl ? doc.metadata.sourceUrl : null;

    const wrappedSection = wrapDocumentXml(doc.id, cleaned, {
      layer: doc.layer,
      cluster: doc.cluster,
      path: doc.path
    });

    const sectionBytes = Buffer.byteLength(wrappedSection, 'utf8');
    if (totalBytes + sectionBytes > MAX_CONTEXT_BYTES) {
      sections.push(`> **[Safety Limit Exceeded]**: Truncated additional documents.`);
      break;
    }

    const sourceTag = {
      streamA:   'Exact',
      streamB:   'Semantic',
      graphLift: 'Graph+1',
    }[info.source] || info.source;

    const kind = doc.sourceType === 'raw'
      ? 'SOURCE (ground truth)'
      : 'SUMMARY (derived)';

    sections.push([
      `## ${doc.id}`,
      ``,
      `> **Source**: ${sourceTag} | **Kind**: ${kind} | **Score**: ${info.score.toFixed(3)} | **Path**: \`${doc.path}\``,
      `> **Layer**: ${doc.layer} | **Cluster**: ${doc.cluster}`,
      sourceUrl ? `> **URL**: ${sourceUrl}` : null,
      Array.isArray(doc.symbols) && doc.symbols.length > 0
        ? `> **Symbols**: ${doc.symbols.join(', ')}`
        : null,
      ``,
      wrappedSection,
      ``,
      `---`,
      ``,
    ].filter(Boolean).join('\n'));

    totalBytes += sectionBytes;
  }

  const fullDump = header + sections.join('\n');
  return { count: sections.length, dump: fullDump };
}

export function runGraphifyAdapter(query, dumpPath, toStdout, outPath) {
  const adapterScript = path.join(ROOT_DIR, 'hyperresearch', 'graphify-adapter.js');
  if (!fs.existsSync(adapterScript)) {
    return false;
  }

  try {
    const cmd = `node "${adapterScript}" --query "${query.replace(/"/g, '\\"')}" --dump "${dumpPath}"`;
    const result = execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

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
      maxToolOutputBytes: MAX_CONTEXT_BYTES
    }
  };

  try {
    const finalState = await graph.invoke({ request }, { configurable: { thread_id: 'corr_' + Date.now() } });
    const response = finalState.response;
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