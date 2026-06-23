#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  check-staleness.js — детектор устаревания вики-страниц
// ───────────────────────────────────────────────────────────────────────
//  Принцип: КОД (и его снимки в raw/) — источник истины. Каждая wiki-страница
//  фиксирует во frontmatter карту `source_hashes` — sha256 процитированных
//  источников на момент генерации. Скрипт пересчитывает хеши и сообщает, какие
//  страницы устарели, выдавая машиночитаемый worklist для AI-актуализации
//  (см. skill davasko-wiki-refresh).
//
//  Режимы:
//    node system/scripts/check-staleness.js            # проверка + отчёт
//    node system/scripts/check-staleness.js --strict   # ненулевой код и для unstamped
//    node system/scripts/check-staleness.js --stamp     # записать/обновить source_hashes во ВСЕ страницы
//    node system/scripts/check-staleness.js --stamp <layer/wiki/page.md>   # только одну страницу
//
//  Выход: system/staleness-report.json + код возврата (1 при наличии stale).
// ═══════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { parseFrontmatter, updateFrontmatter } from '../lib/frontmatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const submoduleRoot = path.resolve(__dirname, '../..'); // system/scripts → repo root
const REPORT_FILE = path.join(submoduleRoot, 'system', 'staleness-report.json');

const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const STAMP = args.includes('--stamp');
const stampTarget = STAMP ? args.find(a => !a.startsWith('--')) : null;

// ─── helpers ───────────────────────────────────────────────────────────
function readText(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  return content;
}
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}
function getFilesRecursively(dir, ext) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(getFilesRecursively(full, ext));
    else if (path.extname(entry.name).toLowerCase() === ext) out.push(full);
  }
  return out;
}

// Нормализация полей meta из js-yaml в форму, удобную детектору.
function metaSources(meta) {
  const s = meta.sources;
  if (Array.isArray(s)) return s.map(String);
  if (typeof s === 'string' && s.trim()) return [s.trim()];
  return [];
}
function metaHashes(meta) {
  const h = meta.source_hashes;
  return (h && typeof h === 'object' && !Array.isArray(h)) ? h : {};
}

// ─── обнаружение слоёв (каталоги с wiki.json) ───────────────────────────
function discoverLayers() {
  const layers = [];
  if (!fs.existsSync(submoduleRoot)) return layers;
  for (const entry of fs.readdirSync(submoduleRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'plans' || entry.name === 'system' || entry.name === 'node_modules') continue;
    if (fs.existsSync(path.join(submoduleRoot, entry.name, 'wiki.json'))) layers.push(entry.name);
  }
  return layers;
}

// ─── собрать процитированные источники страницы ─────────────────────────
function collectSources(meta, body, layer) {
  const set = new Set(metaSources(meta));
  // (source: path) и (source: a; source: b) из тела
  const re = /\(source:\s*([^)]+)\)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    m[1].split(/;\s*source:\s*/).forEach(s => {
      const clean = s.trim().split('#')[0].trim(); // отбросить #Lxx якоря
      if (clean && clean !== 'source-needed') set.add(clean);
    });
  }
  // резолвинг относительно submoduleRoot и слоя
  const resolved = [];
  for (const src of set) {
    const candidates = [
      path.join(submoduleRoot, src),
      path.join(submoduleRoot, layer, src),
    ];
    const hit = candidates.find(c => fs.existsSync(c) && fs.statSync(c).isFile());
    resolved.push({ source: src, file: hit || null });
  }
  return resolved;
}

// ─── запись source_hashes во frontmatter (для --stamp / refresh) ────────
function stampPage(file, resolved) {
  const today = new Date().toISOString().slice(0, 10);
  const hashes = {};
  for (const r of resolved) if (r.file) hashes[r.source] = sha256(readText(r.file));

  const { content, error } = updateFrontmatter(fs.readFileSync(file, 'utf8'), (meta) => {
    meta.last_updated = today;
    meta.source_hashes = hashes;
  });
  if (error) {
    console.error(`[stamp] ${path.relative(submoduleRoot, file)} skipped: ${error}`);
    return false;
  }
  fs.writeFileSync(file, Buffer.from(content, 'utf8'));
  return true;
}

// ─── основной проход ────────────────────────────────────────────────────
const layers = discoverLayers();
const report = {
  generatedAt: new Date().toISOString(),
  mode: STAMP ? 'stamp' : 'check',
  summary: { layers: layers.length, pagesChecked: 0, stalePages: 0, unstamped: 0 },
  stale: [],
};

for (const layer of layers) {
  const wikiDir = path.join(submoduleRoot, layer, 'wiki');
  const pages = getFilesRecursively(wikiDir, '.md');
  for (const file of pages) {
    const base = path.basename(file);
    if (['index.md', 'stubs.md', 'contradictions.md'].includes(base)) continue;

    const { meta, body, error } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    const rel = path.relative(submoduleRoot, file).replace(/\\/g, '/');
    if (error) { console.error(`[skip] ${rel}: invalid YAML frontmatter (${error})`); continue; }

    const resolved = collectSources(meta, body || '', layer);
    if (resolved.length === 0) continue; // нечего отслеживать
    report.summary.pagesChecked++;

    if (STAMP) {
      if (!stampTarget || path.resolve(file) === path.resolve(submoduleRoot, stampTarget)) {
        if (stampPage(file, resolved)) console.log(`[stamp] ${rel} — ${resolved.filter(r => r.file).length} source(s)`);
      }
      continue;
    }

    const recorded = metaHashes(meta);
    const hasBaseline = Object.keys(recorded).length > 0;
    const changes = [];
    for (const r of resolved) {
      if (!r.file) { changes.push({ source: r.source, recorded: recorded[r.source] || null, current: null, reason: 'source-missing' }); continue; }
      const current = sha256(readText(r.file));
      const rec = recorded[r.source] || null;
      if (rec === null && !hasBaseline) continue; // unstamped — обработаем отдельно
      if (rec !== current) changes.push({ source: r.source, recorded: rec, current, reason: rec ? 'source-changed' : 'source-unrecorded' });
    }

    if (!hasBaseline) {
      report.summary.unstamped++;
      report.stale.push({ page: rel, status: 'needs-stamp', sources: resolved.map(r => ({ source: r.source, present: !!r.file })) });
      continue;
    }
    if (changes.length > 0) {
      report.summary.stalePages++;
      report.stale.push({ page: rel, status: 'stale', sources: changes });
    }
  }
}

// ─── вывод ───────────────────────────────────────────────────────────────
fs.writeFileSync(REPORT_FILE, Buffer.from(JSON.stringify(report, null, 2), 'utf8')); // JSON без BOM

console.log('=== DavASko Wiki Staleness Check ===');
console.log(`Layers: ${layers.join(', ') || '(none)'}`);
console.log(`Pages checked: ${report.summary.pagesChecked}`);
console.log(`Stale: ${report.summary.stalePages} | Needs-stamp: ${report.summary.unstamped}`);
if (report.stale.length) {
  console.log('\nWorklist (see system/staleness-report.json):');
  for (const e of report.stale) {
    console.log(`  [${e.status}] ${e.page}`);
    if (e.status === 'stale') e.sources.forEach(s => console.log(`      - ${s.source} (${s.reason})`));
  }
}

if (STAMP) { console.log('\nStamp complete.'); process.exit(0); }

const failed = report.summary.stalePages > 0 || (STRICT && report.summary.unstamped > 0);
if (failed) {
  console.error(`\nStaleness gate: FAIL — ${report.summary.stalePages} stale${STRICT ? `, ${report.summary.unstamped} unstamped` : ''} page(s). Run the davasko-wiki-refresh skill to actualize.`);
  process.exit(1);
}
console.log('\nOK: no stale pages.');
process.exit(0);
