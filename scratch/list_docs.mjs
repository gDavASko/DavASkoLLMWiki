import fs from 'fs';
import path from 'path';
const ROOT = process.argv[2];
const PERBUCKET = parseInt(process.argv[3] || '5', 10);
const rt = p => { let c = fs.readFileSync(p, 'utf8'); if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1); return c; };
function walk(d, o) { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name.endsWith('~') || e.name === 'node_modules') continue; const fp = path.join(d, e.name); e.isDirectory() ? walk(fp, o) : e.name.endsWith('.md') && o.push(fp); } }
const SKIP = new Set(['index', 'stubs', 'contradictions']);
const layers = fs.readdirSync(ROOT, { withFileTypes: true }).filter(e => e.isDirectory() && fs.existsSync(path.join(ROOT, e.name, 'wiki.json'))).map(e => e.name);
const lang = s => /[А-Яа-яЁё]/.test(s) ? 'RU' : 'EN';
for (const layer of layers) {
  for (const sub of ['wiki', 'raw']) {
    const f = []; walk(path.join(ROOT, layer, sub), f);
    const cand = f.filter(fp => !SKIP.has(path.basename(fp, '.md')));
    for (const fp of cand.slice(0, PERBUCKET)) {
      const t = rt(fp); const base = path.basename(fp, '.md');
      const tm = t.match(/^title:\s*["']?(.+?)["']?\s*$/m);
      const title = tm ? tm[1] : base.replace(/[-_]+/g, ' ');
      const body = t.replace(/^---[\s\S]*?\n---\n/, '');
      const line = (body.split(/\n/).map(s => s.trim()).find(s => s.length > 40 && !s.startsWith('#') && !s.startsWith('**Sources') && !s.startsWith('**Last') && !s.startsWith('---')) || '').slice(0, 120);
      const rel = path.relative(ROOT, fp).split(path.sep).join('/');
      console.log('[' + lang(title + line) + '] ' + rel);
      console.log('   T: ' + title);
      console.log('   S: ' + line);
    }
  }
}
