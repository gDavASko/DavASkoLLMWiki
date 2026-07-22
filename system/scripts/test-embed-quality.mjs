/**
 * Тест качества эмбеддингов: сравнение инструкционных префиксов Jina v3
 * Запуск: node system/scripts/test-embed-quality.mjs
 */
import { pipeline, env } from '@huggingface/transformers';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_CACHE = path.join(__dirname, '..', 'models-cache');

env.allowRemoteModels = false;
env.cacheDir = MODELS_CACHE;
env.localModelPath = MODELS_CACHE;

console.log('[*] Загрузка модели...');
const extractor = await pipeline('feature-extraction', 'jinaai/jina-embeddings-v3', {
  revision: '815152ccf78fb243a0d9b4db0b80ec6ef87e2213',
  dtype: 'fp16',
});
console.log('[OK] Модель загружена\n');

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i]*a[i]; nb += b[i]*b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embed(text) {
  const out = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data);
}

// Пары: (запрос, релевантный документ)
const QUERY_RU = 'регистрация типов EventBus';
const DOC_EN   = 'EventBus provides a generic type-safe pub/sub event bus. Register event types using EventBus<T>. Design Patterns: Observer, Event-Driven';

const QUERY_EN  = 'EventBus type registration pub sub observer pattern';

console.log('═══ Тест 1: Правильные инструкции Jina v3 ═══');
const q1 = await embed('Represent the query for retrieving evidence documents: ' + QUERY_RU);
const p1 = await embed('Represent the document for retrieval: ' + DOC_EN);
console.log('  Рус запрос → Англ документ:', cosine(q1, p1).toFixed(4));

const q1e = await embed('Represent the query for retrieving evidence documents: ' + QUERY_EN);
console.log('  Англ запрос → Англ документ:', cosine(q1e, p1).toFixed(4));

console.log('\n═══ Тест 2: Короткие префиксы query:/passage: ═══');
const q2 = await embed('query: ' + QUERY_RU);
const p2 = await embed('passage: ' + DOC_EN);
console.log('  Рус запрос → Англ документ:', cosine(q2, p2).toFixed(4));

const q2e = await embed('query: ' + QUERY_EN);
const p2e = await embed('passage: ' + DOC_EN);
console.log('  Англ запрос → Англ документ:', cosine(q2e, p2e).toFixed(4));

console.log('\n═══ Тест 3: Без префикса ═══');
const q3 = await embed(QUERY_RU);
const p3 = await embed(DOC_EN);
console.log('  Рус запрос → Англ документ:', cosine(q3, p3).toFixed(4));

const q3e = await embed(QUERY_EN);
console.log('  Англ запрос → Англ документ:', cosine(q3e, p3).toFixed(4));

console.log('\n═══ Тест 4: Рус документ (как в нашей wiki-странице) ═══');
const DOC_RU = 'EventBus — центральная шина событий в KBPro. Pub/Sub паттерн, регистрация типов через Generic-параметры. EventBus<T> позволяет подписаться на события без боксинга.';
const p4 = await embed('Represent the document for retrieval: ' + DOC_RU);
console.log('  Правильные инструкции, Рус→Рус:', cosine(q1, p4).toFixed(4));
const p4b = await embed('passage: ' + DOC_RU);
console.log('  query:/passage:, Рус→Рус:', cosine(q2, p4b).toFixed(4));

console.log('\n[OK] Тест завершён');
