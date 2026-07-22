import { pipeline, env, Tensor } from '@huggingface/transformers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const MODELS_CACHE = 'e:/UnityProjects/IRI/dentistry-cow/Assets/KBPro/kbpro-ai-docs/system/models-cache';
const FILE_PATH = 'e:/UnityProjects/IRI/dentistry-cow/Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/Architecture/CoreFramework/Infrastructure/EventBus.md';

env.allowRemoteModels = false;
env.cacheDir = MODELS_CACHE;
env.localModelPath = MODELS_CACHE;

const extractor = await pipeline('feature-extraction', 'jinaai/jina-embeddings-v3', {
  revision: '815152ccf78fb243a0d9b4db0b80ec6ef87e2213',
  dtype: 'fp16',
});

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embed(text, taskId) {
  const inputs = extractor.tokenizer(text, { padding: true, truncation: true });
  inputs.task_id = new Tensor('int64', BigInt64Array.from([BigInt(taskId)]), [1]);
  const outputs = await extractor.model(inputs);
  const raw = Array.from(outputs['13049'].data);
  let norm = Math.sqrt(raw.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) norm = 1;
  return raw.map(v => v / norm);
}

// Читаем EventBus.md
let content = fs.readFileSync(FILE_PATH, 'utf8');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

// Убираем фронтматтер
content = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

// Вариант 1: С вырезанием инлайн-кода (как сейчас)
function prepOld(text) {
  let cleaned = text.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`[^`\r\n]+`/g, '');
  return cleaned;
}

// Вариант 2: С сохранением инлайн-кода
function prepNew(text) {
  let cleaned = text.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`/g, '');
  return cleaned;
}

const textOld = prepOld(content);
const textNew = prepNew(content);

// Берем первый чанк (первые 250 слов)
function getFirstChunk(text) {
  return text.split(/\s+/).filter(w => w.length > 0).slice(0, 250).join(' ');
}

const chunkOld = getFirstChunk(textOld);
const chunkNew = getFirstChunk(textNew);

const queries = [
  'регистрация типов EventBus',
  'EventBus.Register',
  'управление событиями через EventBus',
  'как использовать EventBinding в EventBus',
  'EventPlayerDeath',
  'отписка от событий EventBus'
];

for (const query of queries) {
  const qVec = await embed(query, 0);
  const vOld = await embed(chunkOld, 1);
  const vNew = await embed(chunkNew, 1);

  console.log(`Query: "${query}"`);
  console.log(`  Old (stripped):  ${cosine(qVec, vOld).toFixed(4)}`);
  console.log(`  New (preserved): ${cosine(qVec, vNew).toFixed(4)}`);
  console.log(`  Diff:            +${(cosine(qVec, vNew) - cosine(qVec, vOld)).toFixed(4)}`);
  console.log('');
}
