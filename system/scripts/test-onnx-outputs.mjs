/**
 * Диагностика: что реально выдаёт ONNX модель Jina v3
 * Запуск: node system/scripts/test-onnx-outputs.mjs
 */
import { pipeline, env, Tensor } from '@huggingface/transformers';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_CACHE = path.join(__dirname, '..', 'models-cache');

env.allowRemoteModels = false;
env.cacheDir = MODELS_CACHE;
env.localModelPath = MODELS_CACHE;

const extractor = await pipeline('feature-extraction', 'jinaai/jina-embeddings-v3', {
  revision: '815152ccf78fb243a0d9b4db0b80ec6ef87e2213',
  dtype: 'fp16',
});
console.log('[OK] Модель загружена\n');

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embedManual(text, taskId) {
  const inputs = extractor.tokenizer(text, { padding: true, truncation: true });
  inputs.task_id = new Tensor('int64', BigInt64Array.from([BigInt(taskId)]), [1]);
  const outputs = await extractor.model(inputs);

  // Показываем все доступные ключи
  return { outputs, inputs };
}

const { outputs: qOut, inputs: qInputs } = await embedManual(
  'query: регистрация типов EventBus', 0
);

console.log('=== Доступные ключи outputs ===');
for (const key of Object.keys(qOut)) {
  const tensor = qOut[key];
  console.log(`  '${key}': dims=${JSON.stringify(tensor.dims)}, type=${tensor.type}`);
}

// Тест разных подходов извлечения
const { outputs: qOut2 } = await embedManual('query: регистрация типов EventBus', 0);
const { outputs: pOut2 } = await embedManual('passage: EventBus provides type-safe pub/sub. Register types with EventBus<T>.', 1);

// Инструкционные префиксы из config.json
const { outputs: qOut3 } = await embedManual('Represent the query for retrieving evidence documents: регистрация типов EventBus', 0);
const { outputs: pOut3 } = await embedManual('Represent the document for retrieval: EventBus provides type-safe pub/sub. Register types with EventBus<T>.', 1);

// Без префиксов (чистый текст) с task_id
const { outputs: qOut4 } = await embedManual('регистрация типов EventBus', 0);
const { outputs: pOut4 } = await embedManual('EventBus provides type-safe pub/sub. Register types with EventBus<T>.', 1);

function extractVec(outputs, inputs, method) {
  if (method === '13049' && outputs['13049']) {
    return Array.from(outputs['13049'].data);
  }
  if (method === 'sentence_embedding' && outputs['sentence_embedding']) {
    return Array.from(outputs['sentence_embedding'].data);
  }
  // Mean pooling
  const lhs = outputs['last_hidden_state'] || outputs['text_embeds'];
  if (!lhs) return null;
  const attn = inputs.attention_mask;
  const [, seqLen, embedDim] = lhs.dims;
  const pooled = new Float32Array(embedDim);
  let count = 0;
  for (let j = 0; j < seqLen; j++) {
    const a = Number(attn.data[j]);
    count += a;
    for (let k = 0; k < embedDim; k++) pooled[k] += lhs.data[j * embedDim + k] * a;
  }
  for (let k = 0; k < embedDim; k++) pooled[k] /= count || 1;
  // normalize
  let norm = 0;
  for (const v of pooled) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return Array.from(pooled).map(v => v / norm);
}

const methods = ['13049', 'sentence_embedding', 'mean_pool'];

console.log('\n=== Сравнение методов извлечения (query: / passage: префиксы) ===');
for (const m of methods) {
  const qv = extractVec(qOut2, qInputs, m);
  const pv = extractVec(pOut2, qInputs, m);
  if (qv && pv) console.log(`  ${m}: score = ${cosine(qv, pv).toFixed(4)}`);
}

console.log('\n=== Сравнение методов извлечения (полные инструкции из config) ===');
for (const m of methods) {
  const qv = extractVec(qOut3, qInputs, m);
  const pv = extractVec(pOut3, qInputs, m);
  if (qv && pv) console.log(`  ${m}: score = ${cosine(qv, pv).toFixed(4)}`);
}

console.log('\n=== Сравнение методов извлечения (чистый текст без префиксов) ===');
for (const m of methods) {
  const qv = extractVec(qOut4, qInputs, m);
  const pv = extractVec(pOut4, qInputs, m);
  if (qv && pv) console.log(`  ${m}: score = ${cosine(qv, pv).toFixed(4)}`);
}

console.log('\n[OK] Диагностика завершена');
