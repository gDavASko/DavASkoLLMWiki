// Generate ~100 labeled self-retrieval queries for the kbpro corpus.
// Query = a document's topic/title; relevant = that document's path.
// Reproducible (seeded), stratified across layers and wiki/raw.
import fs from 'fs';
import path from 'path';

const ROOT = process.argv[2] || '.';
const N = parseInt(process.argv[3] || '100', 10);
const SKIP_NAMES = new Set(['index', 'stubs', 'contradictions']);

function readText(p){ let c = fs.readFileSync(p,'utf8'); if(c.charCodeAt(0)===0xFEFF) c=c.slice(1); return c; }
function walk(dir, out){ if(!fs.existsSync(dir)) return; for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  if(e.name.endsWith('~')||e.name==='node_modules') continue;
  const fp=path.join(dir,e.name);
  if(e.isDirectory()) walk(fp,out); else if(e.name.endsWith('.md')) out.push(fp);
}}
function title(txt, base){
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if(m){ const t=m[1].match(/^title:\s*["']?(.+?)["']?\s*$/m); if(t&&t[1].trim()) return t[1].trim(); }
  const h = txt.match(/^#\s+(.+)$/m); if(h && h[1].trim().length>3) return h[1].replace(/^summary of\s+/i,'').trim();
  return base.replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim();
}

// discover layers (dirs with wiki.json)
const layers = fs.readdirSync(ROOT,{withFileTypes:true})
  .filter(e=>e.isDirectory() && fs.existsSync(path.join(ROOT,e.name,'wiki.json')))
  .map(e=>e.name);

const items=[]; // {q, path, layer, kind}
for(const layer of layers){
  for(const sub of ['wiki','raw']){
    const files=[]; walk(path.join(ROOT,layer,sub), files);
    for(const fp of files){
      const base=path.basename(fp,'.md');
      if(SKIP_NAMES.has(base)) continue;
      const rel=path.relative(ROOT,fp).replace(/\\/g,'/');
      let q; try{ q=title(readText(fp), base); }catch{ continue; }
      if(!q || q.length<8 || /^(readme|index|todo)$/i.test(q)) continue;
      items.push({ q, path: rel, layer, kind: sub });
    }
  }
}

// seeded shuffle (mulberry32)
let seed=1337; const rnd=()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const shuffle=a=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

// stratify: round-robin across layers, keep wiki/raw balance, dedup by query
const byLayer={}; for(const it of items){ (byLayer[it.layer]??=[]).push(it); }
for(const l in byLayer) shuffle(byLayer[l]);
const lnames=shuffle(Object.keys(byLayer));
const picked=[]; const seenQ=new Set(); let idx=0;
while(picked.length<N){
  let progressed=false;
  for(const l of lnames){
    const arr=byLayer[l]; if(idx<arr.length){
      const it=arr[idx]; const key=it.q.toLowerCase();
      if(!seenQ.has(key)){ seenQ.add(key); picked.push(it); progressed=true; if(picked.length>=N) break; }
    }
  }
  idx++; if(!progressed && idx>Math.max(...lnames.map(l=>byLayer[l].length))) break;
}

const out = picked.map(it=>({ query: it.q, relevant: [it.path], _layer: it.layer, _kind: it.kind }));
const dist={}; for(const o of out){ const k=o._layer+'/'+o._kind; dist[k]=(dist[k]||0)+1; }
console.log('total candidates:', items.length, '| picked:', out.length);
console.log('distribution:', JSON.stringify(dist,null,0));
fs.writeFileSync(path.join(ROOT,'system','evals','retrieval-queries.json'), JSON.stringify(out.map(({query,relevant})=>({query,relevant})),null,2),'utf8');
console.log('wrote', out.length, 'queries ->', path.join(ROOT,'system','evals','retrieval-queries.json'));
