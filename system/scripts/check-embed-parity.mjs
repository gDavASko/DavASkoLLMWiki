// ═══════════════════════════════════════════════════════════════════════
//  check-embed-parity.mjs — гейт точности для батч-эмбеддинга
// ───────────────────────────────────────────────────────────────────────
//  Доказывает, что embedBatch даёт ТЕ ЖЕ векторы, что и одиночный embed
//  (padding маскируется корректно). Батчинг включается только если паритет
//  держится. Запуск: node system/scripts/check-embed-parity.mjs
// ═══════════════════════════════════════════════════════════════════════
import path from 'path';
import { fileURLToPath } from 'url';
import { initModel, embed, embedBatch, cosineSimilarity } from '../lib/retrieval.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_CACHE = path.join(__dirname, '..', 'models-cache');
const MODEL_ID = 'jinaai/jina-embeddings-v3';
const MODEL_REV = '815152ccf78fb243a0d9b4db0b80ec6ef87e2213';
const EPS = 1e-4;

const samples = [
  'passage: The event bus implements a publish subscribe pattern for decoupled modules.',
  'passage: Rigidbody collision tuning and a fixed timestep for stable physics.',
  'passage: Short.',
  'passage: ' + 'word '.repeat(180),               // длинный — проверяем padding к коротким
  'passage: Blend tree locomotion with state transitions and shadow optimization.',
];

const extractor = await initModel({ modelsCache: MODELS_CACHE, modelId: MODEL_ID, revision: MODEL_REV, dtype: 'fp16' });

const single = [];
for (const s of samples) single.push(await embed(extractor, s, 1024));
const batched = await embedBatch(extractor, samples, 1024, samples.length); // один батч со смешанной длиной

let maxDiff = 0, minCos = 1;
for (let i = 0; i < samples.length; i++) {
  const cos = cosineSimilarity(single[i], batched[i]);
  let d = 0;
  for (let k = 0; k < single[i].length; k++) d = Math.max(d, Math.abs(single[i][k] - batched[i][k]));
  maxDiff = Math.max(maxDiff, d);
  minCos = Math.min(minCos, cos);
  console.log(`  #${i}: cos(single,batch)=${cos.toFixed(8)}  maxAbsDiff=${d.toExponential(2)}`);
}

console.log(`\nmin cosine=${minCos.toFixed(8)}  max abs diff=${maxDiff.toExponential(2)}  (eps=${EPS})`);
if (minCos > 1 - EPS && maxDiff < 1e-3) {
  console.log('PARITY: PASS — батчинг численно эквивалентен одиночному эмбеддингу.');
  process.exit(0);
} else {
  console.error('PARITY: FAIL — батчинг расходится с одиночным. НЕ включать батчинг.');
  process.exit(1);
}
