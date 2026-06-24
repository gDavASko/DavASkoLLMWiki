#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  eval-retrieval.js — измерительная установка качества поиска
// ───────────────────────────────────────────────────────────────────────
//  Отвечает на вопрос, который раньше был верой: "лучше ли наш RAG, чем
//  просто грепнуть код?" Прогоняет РАЗМЕЧЕННЫЙ набор запросов через
//  несколько ретриверов и считает recall@k / MRR / nDCG@k.
//
//  Ретриверы (A/B):
//    hybrid  — боевой движок: Stream A (символы) + Stream B (multi-probe),
//              использует ОБЩЕЕ ядро ./lib/retrieval.js (нет расхождения).
//    flat    — плоский косинус по всем чанкам (исчерпывающе, без кластеров).
//              Если hybrid не бьёт flat по recall — кластеризация бесполезна.
//    lexical — базлайн "агент грепает код": лексический подсчёт совпадений
//              терминов запроса по файлам корпуса (proxy для ripgrep).
//
//  Размеченный набор: system/evals/retrieval-queries.json
//    [ { "query": "...", "relevant": ["docId" | "layer/wiki/.../page.md", ...] }, ... ]
//
//  Использование:
//    node system/scripts/eval-retrieval.js            # прогон на наборе
//    node system/scripts/eval-retrieval.js --k 5      # top-k (по умолчанию из конфига)
//    node system/scripts/eval-retrieval.js --sweep    # калибровка порога (threshold sweep)
//    node system/scripts/eval-retrieval.js --self-test # синтетический smoke-test без реальных данных
//
//  Метрики (что значат):
//    recall@k — доля релевантных, попавших в top-k (что НЕ потеряли).
//    MRR      — 1/ранг первого релевантного (насколько высоко верное).
//    nDCG@k   — качество ранжирования с дисконтом по позиции.
// ═══════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { initModel, embed, cosineSimilarity, selectProbeClusters, applyThreshold, scoreSymbolMatches } from '../lib/retrieval.js';
import { resolveModelsCache } from '../lib/model-locator.js';
import { recallAtK, mrr, ndcgAtK } from '../lib/metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const submoduleRoot = path.resolve(__dirname, '../..');
const SYSTEM_DIR   = path.join(submoduleRoot, 'system');
const INDEX_FILE   = path.join(SYSTEM_DIR, 'wiki-index.json');
const SHARDS_DIR   = path.join(SYSTEM_DIR, 'index-shards');
const CONFIG_FILE  = path.join(SYSTEM_DIR, 'search-config.json');
const QUERIES_FILE = path.join(SYSTEM_DIR, 'evals', 'retrieval-queries.json');
const REPORT_FILE  = path.join(SYSTEM_DIR, 'evals', 'retrieval-report.json');

const MODELS_CACHE = (() => {
  const r = resolveModelsCache({ localFallback: path.join(SYSTEM_DIR, 'models-cache') });
  return r.dir || r.hint;
})();
const MODEL_ID     = 'jinaai/jina-embeddings-v3';
const MODEL_REV    = '815152ccf78fb243a0d9b4db0b80ec6ef87e2213';
const VECTOR_DIM   = 1024;

const args = process.argv.slice(2);
const SELF_TEST = args.includes('--self-test');
const DO_SWEEP  = args.includes('--sweep');
const kArgIdx   = args.indexOf('--k');
const K_OVERRIDE = kArgIdx >= 0 ? parseInt(args[kArgIdx + 1], 10) : null;

// ─── helpers ───────────────────────────────────────────────────────────
function readText(p) {
  let c = fs.readFileSync(p, 'utf8');
  if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1);
  return c;
}
function loadConfig() {
  const def = {
    threshold_mode: 'relative', relative_alpha: 0.85, junk_floor: 0.35,
    similarity_threshold: 0.70, similarity_fallback: 0.65,
    top_k_documents: 5, nprobe: 8, ground_truth_boost: 0.05,
  };
  try { return { ...def, ...JSON.parse(readText(CONFIG_FILE)) }; } catch { return def; }
}
function loadShard(clName) {
  const p = path.join(SHARDS_DIR, `embeddings-${clName}.json`);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(readText(p)); } catch { return []; }
}

// ─── метрики ─────────────────────────────────────────────────────────────
// Метрики recall@k / MRR / nDCG@k вынесены в ../lib/metrics.js (тестируются отдельно).

// ─── разрешение меток релевантности (id | path | basename) → fileId ──────
function buildResolver(index) {
  const byId = new Set(Object.keys(index.documents || {}));
  const byPath = new Map();
  const byBase = new Map();
  for (const [id, doc] of Object.entries(index.documents || {})) {
    if (doc.path) byPath.set(doc.path.replace(/\\/g, '/').toLowerCase(), id);
    const base = path.basename(doc.path || id).replace(/\.md$/i, '').toLowerCase();
    if (!byBase.has(base)) byBase.set(base, id);
  }
  return (label) => {
    if (byId.has(label)) return label;
    const norm = String(label).replace(/\\/g, '/').toLowerCase();
    if (byPath.has(norm)) return byPath.get(norm);
    const base = path.basename(norm).replace(/\.md$/i, '');
    if (byBase.has(base)) return byBase.get(base);
    return null;
  };
}

// ─── символьный поиск: извлечение PascalCase + общий scoreSymbolMatches движка ─
function extractSymbols(query) {
  const out = new Set();
  for (const w of query.split(/[^A-Za-z0-9_]+/)) {
    // PascalCase (≥2 горба), I-интерфейсы, m_-поля. Голый ALL-CAPS НЕ берём:
    // дженерик-аббревиатуры (JSON/API/URL) — не код-идентификаторы, дают шум.
    if (/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+$/.test(w) || /^I[A-Z]/.test(w) || /^m_/.test(w)) {
      out.add(w);
    }
  }
  return [...out];
}

// ─── семантический multi-probe (mirror Stream B) ─────────────────────────
function semanticRank(queryVec, index, cfg, { exhaustive = false } = {}) {
  const centroids = index.clusters_centroids || {};
  const nprobe = exhaustive ? Infinity : cfg.nprobe;
  const { clusters } = selectProbeClusters(queryVec, centroids, nprobe);
  const docs = index.documents || {};
  const all = [];
  for (const cl of clusters) {
    for (const e of loadShard(cl)) all.push([e.fileId, cosineSimilarity(queryVec, e.embedding)]);
  }
  // Единое ядро порога (relative/absolute) — то же, что в боевом query-wiki.
  const { best: fileScores } = applyThreshold(all, cfg);
  const boost = (id) => (docs[id] && docs[id].sourceType === 'raw' ? cfg.ground_truth_boost : 0);
  // Возвращаем пары [id, score], отсортированные по эффективному score.
  return [...fileScores.entries()]
    .sort((a, b) => (b[1] + boost(b[0])) - (a[1] + boost(a[0])));
}

// ─── лексический базлайн ("агент грепает код") ───────────────────────────
function buildCorpus(index) {
  // fileId → нижний регистр содержимого (для лексического подсчёта)
  const corpus = [];
  for (const [id, doc] of Object.entries(index.documents || {})) {
    const fp = path.join(submoduleRoot, doc.path || '');
    if (!fs.existsSync(fp)) continue;
    try { corpus.push({ id, text: readText(fp).toLowerCase() }); } catch {}
  }
  return corpus;
}
function lexicalRank(query, corpus) {
  const terms = [...new Set(query.toLowerCase().split(/[^a-zа-я0-9_]+/i).filter(t => t.length > 2))];
  if (terms.length === 0) return [];
  const scored = [];
  for (const { id, text } of corpus) {
    let score = 0;
    for (const t of terms) if (text.includes(t)) score++;
    if (score > 0) scored.push([id, score]);
  }
  return scored.sort((a, b) => b[1] - a[1]).map(x => x[0]);
}

// ─── один прогон набора → агрегаты по ретриверам ─────────────────────────
async function runEval(index, queries, cfg, K) {
  const resolve = buildResolver(index);
  const corpus = buildCorpus(index);
  const extractor = await initModel({ modelsCache: MODELS_CACHE, modelId: MODEL_ID, revision: MODEL_REV, dtype: 'fp16', device: cfg.device || 'auto' });

  const retrievers = ['hybrid', 'semantic', 'flat', 'lexical'];
  const agg = {};
  for (const r of retrievers) agg[r] = { recall: 0, mrr: 0, ndcg: 0, n: 0 };
  const perQuery = [];

  for (const q of queries) {
    const relevant = new Set();
    const unresolved = [];
    for (const label of (q.relevant || [])) {
      const id = resolve(label);
      if (id) relevant.add(id); else unresolved.push(label);
    }
    if (relevant.size === 0) { perQuery.push({ query: q.query, skipped: 'no resolvable relevant docs', unresolved }); continue; }

    const queryVec = await embed(extractor, `query: ${q.query}`, VECTOR_DIM);

    const docsMap = index.documents || {};
    const gtb = (id) => (docsMap[id] && docsMap[id].sourceType === 'raw' ? (cfg.ground_truth_boost || 0) : 0);

    const semanticScored = semanticRank(queryVec, index, cfg, { exhaustive: false }); // [[id,score]]
    const symScored = scoreSymbolMatches(extractSymbols(q.query), docsMap, { limit: cfg.stream_a_limit || 10 }); // Map id->score

    // hybrid: ЕДИНОЕ ранжирование по score (символы и семантика сравнимы:
    // exact-id≈1.0, cosine 0..1), а не «символы всегда первыми».
    const combined = new Map();
    for (const [id, s] of semanticScored) combined.set(id, Math.max(combined.get(id) || 0, s));
    for (const [id, s] of symScored) combined.set(id, Math.max(combined.get(id) || 0, s));
    const hybrid = [...combined.entries()].sort((a, b) => (b[1] + gtb(b[0])) - (a[1] + gtb(a[0]))).map(x => x[0]);

    const semantic = semanticScored.map(x => x[0]);                               // только семантика (multi-probe)
    const flat = semanticRank(queryVec, index, cfg, { exhaustive: true }).map(x => x[0]); // семантика exhaustive
    const lexical = lexicalRank(q.query, corpus);

    const ranks = { hybrid, semantic, flat, lexical };
    const row = { query: q.query, relevant: relevant.size };
    for (const r of retrievers) {
      const rec = recallAtK(ranks[r], relevant, K);
      const mr = mrr(ranks[r], relevant);
      const nd = ndcgAtK(ranks[r], relevant, K);
      agg[r].recall += rec; agg[r].mrr += mr; agg[r].ndcg += nd; agg[r].n++;
      row[r] = { [`recall@${K}`]: +rec.toFixed(3), mrr: +mr.toFixed(3), [`ndcg@${K}`]: +nd.toFixed(3) };
    }
    perQuery.push(row);
  }

  for (const r of retrievers) {
    const a = agg[r];
    a.recall = a.n ? a.recall / a.n : 0;
    a.mrr = a.n ? a.mrr / a.n : 0;
    a.ndcg = a.n ? a.ndcg / a.n : 0;
  }
  return { agg, perQuery, extractor };
}

// ─── калибровка порога ───────────────────────────────────────────────────
// В relative-режиме перебираем relative_alpha; в absolute — similarity_threshold.
// Кэшируем эмбеддинги запросов, чтобы не гонять модель на каждом шаге.
async function sweepThreshold(index, queries, cfg, K, extractor) {
  const resolve = buildResolver(index);
  const relative = (cfg.threshold_mode || 'absolute') === 'relative';
  const knob = relative ? 'relative_alpha' : 'similarity_threshold';
  const grid = relative
    ? [0.70, 0.75, 0.80, 0.85, 0.88, 0.90, 0.92, 0.95]
    : [0.50, 0.55, 0.60, 0.65, 0.70, 0.74, 0.78, 0.82, 0.86];

  // Предрасчёт: эмбеддинг + relevant-множество на запрос
  const prepared = [];
  for (const q of queries) {
    const relevant = new Set();
    for (const label of (q.relevant || [])) { const id = resolve(label); if (id) relevant.add(id); }
    if (relevant.size === 0) continue;
    prepared.push({ vec: await embed(extractor, `query: ${q.query}`, VECTOR_DIM), relevant });
  }

  const rows = [];
  for (const val of grid) {
    const c = { ...cfg, [knob]: val };
    if (!relative) c.similarity_fallback = val;
    let recall = 0;
    for (const p of prepared) {
      const ranked = semanticRank(p.vec, index, c, { exhaustive: true }).map(x => x[0]);
      recall += recallAtK(ranked, p.relevant, K);
    }
    rows.push({ [knob]: val, [`mean_recall@${K}`]: +(prepared.length ? recall / prepared.length : 0).toFixed(3) });
  }
  const best = rows.reduce((b, r) => (r[`mean_recall@${K}`] > b[`mean_recall@${K}`] ? r : b), rows[0]);
  return { rows, best, knob };
}

// ─── синтетический self-test (без реальных данных) ───────────────────────
function buildSelfTestFixture() {
  const layer = path.join(submoduleRoot, '_eval_selftest');
  fs.rmSync(layer, { recursive: true, force: true });
  fs.mkdirSync(path.join(layer, 'wiki', 'concepts'), { recursive: true });
  fs.writeFileSync(path.join(layer, 'wiki.json'), '{"name":"_eval_selftest","dependencies":[]}');
  const pages = {
    'event-bus.md': 'Event Bus\n\n**Summary**: publish subscribe message bus for decoupled module communication and typed channels.',
    'physics.md': 'Physics Tuning\n\n**Summary**: rigidbody collision tuning, fixed timestep, and continuous collision detection for fast objects.',
    'animation.md': 'Animation Blend Trees\n\n**Summary**: blend tree setup for character locomotion, state transitions and shadow rendering optimization.',
  };
  for (const [name, body] of Object.entries(pages)) {
    const fm = `﻿---\ntitle: ${name}\ntype: concept\nstatus: stable\nsymbols: []\ntags: []\nsources: []\nlast_updated: 2026-01-01\nrelated: []\n---\n# ${body}\n`;
    fs.writeFileSync(path.join(layer, 'wiki', 'concepts', name), Buffer.from(fm, 'utf8'));
  }
  const queries = [
    { query: 'publish subscribe messaging between modules', relevant: ['_eval_selftest/wiki/concepts/event-bus.md'] },
    { query: 'rigidbody collision detection timestep', relevant: ['_eval_selftest/wiki/concepts/physics.md'] },
    { query: 'character locomotion blend tree transitions', relevant: ['_eval_selftest/wiki/concepts/animation.md'] },
  ];
  const qfile = path.join(os.tmpdir(), `eval-selftest-queries-${Date.now()}.json`);
  fs.writeFileSync(qfile, JSON.stringify(queries, null, 2));
  // build index for the fixture
  execSync(`node "${path.join(SYSTEM_DIR, 'build-index.js')}" --force`, { cwd: submoduleRoot, stdio: 'ignore' });
  return { layer, qfile };
}

// ─── main ────────────────────────────────────────────────────────────────
async function main() {
  const cfg = loadConfig();
  const K = K_OVERRIDE || cfg.top_k_documents;

  let queriesPath = QUERIES_FILE;
  let cleanup = null;

  if (SELF_TEST) {
    console.error('[self-test] building synthetic fixture + index...');
    // Сохранить существующий реальный индекс, чтобы self-test его не затёр.
    const bakDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-idxbak-'));
    const idxBak = path.join(bakDir, 'wiki-index.json');
    const shardsBak = path.join(bakDir, 'index-shards');
    if (fs.existsSync(INDEX_FILE)) fs.renameSync(INDEX_FILE, idxBak);
    if (fs.existsSync(SHARDS_DIR)) fs.renameSync(SHARDS_DIR, shardsBak);

    const { layer, qfile } = buildSelfTestFixture();
    queriesPath = qfile;
    cleanup = () => {
      fs.rmSync(layer, { recursive: true, force: true });
      fs.rmSync(qfile, { force: true });
      fs.rmSync(INDEX_FILE, { force: true });
      fs.rmSync(SHARDS_DIR, { recursive: true, force: true });
      // Восстановить реальный индекс.
      if (fs.existsSync(idxBak)) fs.renameSync(idxBak, INDEX_FILE);
      if (fs.existsSync(shardsBak)) fs.renameSync(shardsBak, SHARDS_DIR);
      fs.rmSync(bakDir, { recursive: true, force: true });
    };
  }

  if (!fs.existsSync(INDEX_FILE)) {
    console.error('[eval] Индекс не найден. Сначала: node system/build-index.js');
    process.exit(2);
  }
  if (!fs.existsSync(queriesPath)) {
    console.log('=== DavASko Retrieval Eval ===');
    console.log(`Размеченный набор не найден: ${path.relative(submoduleRoot, QUERIES_FILE)}`);
    console.log('Создайте его в формате:');
    console.log('  [ { "query": "...", "relevant": ["layer/wiki/.../page.md", "docId", ...] } ]');
    console.log('и запустите снова. (Прогон на реальных данных — позже.)');
    process.exit(0);
  }

  const index = JSON.parse(readText(INDEX_FILE));
  const queries = JSON.parse(readText(queriesPath));

  try {
    const { agg, perQuery, extractor } = await runEval(index, queries, cfg, K);

    const thr = cfg.threshold_mode === 'relative'
      ? `relative (α=${cfg.relative_alpha}, floor=${cfg.junk_floor})`
      : `absolute (τ=${cfg.similarity_threshold})`;
    console.log('\n=== DavASko Retrieval Eval ===');
    console.log(`Queries: ${queries.length} | top-k: ${K} | nprobe: ${cfg.nprobe} | threshold: ${thr}`);
    console.log(`\n${'Retriever'.padEnd(10)} ${('recall@' + K).padEnd(10)} ${'MRR'.padEnd(8)} ${('nDCG@' + K).padEnd(8)}`);
    console.log('-'.repeat(40));
    for (const r of ['hybrid', 'semantic', 'flat', 'lexical']) {
      const a = agg[r];
      console.log(`${r.padEnd(10)} ${a.recall.toFixed(3).padEnd(10)} ${a.mrr.toFixed(3).padEnd(8)} ${a.ndcg.toFixed(3).padEnd(8)}`);
    }
    console.log('\nЧитать так: если hybrid не выше flat по recall — кластеризация/multi-probe не помогает.');
    console.log('Если lexical (grep-базлайн) не ниже hybrid — RAG-слой не оправдывает себя на этом корпусе.');

    const report = { generatedAt: new Date().toISOString(), k: K, config: cfg, aggregate: agg, perQuery };

    if (DO_SWEEP) {
      console.log(`\n=== Sweep (калибровка, режим: ${cfg.threshold_mode}) ===`);
      const sweep = await sweepThreshold(index, queries, cfg, K, extractor);
      for (const row of sweep.rows) console.log(`  ${sweep.knob}=${row[sweep.knob]}  mean_recall@${K}=${row[`mean_recall@${K}`]}`);
      console.log(`\nРекомендуемый ${sweep.knob}: ${sweep.best[sweep.knob]} (mean_recall@${K}=${sweep.best[`mean_recall@${K}`]})`);
      console.log('Запишите его в system/search-config.json при подтверждении на полном наборе.');
      report.sweep = sweep;
    }

    fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    fs.writeFileSync(REPORT_FILE, Buffer.from(JSON.stringify(report, null, 2), 'utf8'));
    console.log(`\nОтчёт: ${path.relative(submoduleRoot, REPORT_FILE)}`);

    if (SELF_TEST) {
      const ok = agg.hybrid.recall > 0 && agg.flat.recall > 0;
      console.log(`\n[self-test] ${ok ? 'PASS' : 'FAIL'} — harness прогоняет метрики на синтетике (hybrid recall=${agg.hybrid.recall.toFixed(3)}).`);
      if (cleanup) cleanup();
      process.exit(ok ? 0 : 1);
    }
  } catch (err) {
    if (cleanup) cleanup();
    throw err;
  }
}

main().catch(err => { console.error(`[FATAL] ${err.message}`); process.exit(1); });
