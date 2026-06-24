// Generate ~N "best case for grep" queries: query = a token UNIQUE to one document
// (document frequency == 1, case-insensitive), preferring PascalCase code identifiers.
// relevant = that document. Tests whether our hybrid engine keeps up with grep on
// grep's home turf (exact distinctive terms).
import fs from 'fs';
import path from 'path';

const ROOT = process.argv[2];
const N = parseInt(process.argv[3] || '100', 10);
const SKIP = new Set(['index', 'stubs', 'contradictions']);
const rt = p => { let c = fs.readFileSync(p, 'utf8'); if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1); return c; };
function walk(d, o) { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name.endsWith('~') || e.name === 'node_modules') continue; const fp = path.join(d, e.name); e.isDirectory() ? walk(fp, o) : e.name.endsWith('.md') && o.push(fp); } }

const layers = fs.readdirSync(ROOT, { withFileTypes: true }).filter(e => e.isDirectory() && fs.existsSync(path.join(ROOT, e.name, 'wiki.json'))).map(e => e.name);

// collect docs + their tokens
const docs = []; // {path, layer, text}
for (const layer of layers) {
  for (const sub of ['wiki', 'raw']) {
    const f = []; walk(path.join(ROOT, layer, sub), f);
    for (const fp of f) {
      if (SKIP.has(path.basename(fp, '.md'))) continue;
      let t; try { t = rt(fp); } catch { continue; }
      docs.push({ path: path.relative(ROOT, fp).split(path.sep).join('/'), layer, text: t });
    }
  }
}

// document frequency (case-insensitive) over tokens len>=5
const PASCAL = /\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+\b/g;       // PascalCase >=2 humps
const WORD = /\b[A-Za-z][A-Za-z0-9_]{4,}\b/g;
const df = new Map();
const docTokens = docs.map(d => {
  const pas = new Set((d.text.match(PASCAL) || []));
  const wrd = new Set((d.text.match(WORD) || []).filter(w => /[a-z]/.test(w)));
  const all = new Set([...pas, ...wrd]);
  for (const tk of all) { const k = tk.toLowerCase(); df.set(k, (df.get(k) || 0) + 1); }
  return { pas: [...pas], wrd: [...wrd] };
});

let seed = 4242; const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const out = [];
const order = shuffle(docs.map((_, i) => i));
const usedTok = new Set();
for (const i of order) {
  const d = docs[i], tk = docTokens[i];
  // prefer unique PascalCase identifiers (longest), then unique words
  const uniqPas = tk.pas.filter(t => df.get(t.toLowerCase()) === 1).sort((a, b) => b.length - a.length);
  const uniqWrd = tk.wrd.filter(t => df.get(t.toLowerCase()) === 1 && t.length >= 6).sort((a, b) => b.length - a.length);
  let q = uniqPas[0] || uniqWrd[0];
  if (!q) continue;
  if (usedTok.has(q.toLowerCase())) continue;
  usedTok.add(q.toLowerCase());
  out.push({ query: q, relevant: [d.path], _kind: uniqPas[0] ? 'pascal' : 'word', _layer: d.layer });
  if (out.length >= N) break;
}

const dist = {}; for (const o of out) dist[o._kind] = (dist[o._kind] || 0) + 1;
console.log('docs:', docs.length, '| grep-favorable queries:', out.length, '| kinds:', JSON.stringify(dist));
console.log('samples:', out.slice(0, 8).map(o => o.query).join(', '));
fs.writeFileSync(path.join(ROOT, 'system', 'evals', 'retrieval-queries.json'),
  JSON.stringify(out.map(({ query, relevant }) => ({ query, relevant })), null, 2), 'utf8');
console.log('wrote', out.length, 'queries');
