import { initModel, embed, embedBatch, embedLateChunking } from './retrieval.js';

const DEFAULT_OLLAMA_MODEL = 'qwen3-embedding:8b';

export function getEmbeddingProfile(environment = process.env) {
  const provider = environment.KBPRO_WIKI_EMBEDDING_PROVIDER || 'transformers';
  if (provider === 'ollama') {
    return { provider, model: environment.KBPRO_WIKI_EMBEDDING_MODEL || DEFAULT_OLLAMA_MODEL, dimension: Number(environment.KBPRO_WIKI_EMBEDDING_DIMENSION || 4096), baseUrl: environment.KBPRO_WIKI_OLLAMA_URL || environment.KBPRO_AI_CHAT_OLLAMA_URL || 'http://127.0.0.1:11434' };
  }
  if (provider !== 'transformers') throw new Error(`Unsupported embedding provider: ${provider}`);
  return { provider, model: environment.KBPRO_WIKI_EMBEDDING_MODEL || 'jinaai/jina-embeddings-v3', revision: environment.KBPRO_WIKI_EMBEDDING_REVISION || '815152ccf78fb243a0d9b4db0b80ec6ef87e2213', dimension: Number(environment.KBPRO_WIKI_EMBEDDING_DIMENSION || 1024), dtype: environment.KBPRO_WIKI_EMBEDDING_DTYPE || 'fp16' };
}

function normalize(vector, dimension) {
  if (!Array.isArray(vector) || vector.length !== dimension || !vector.every(Number.isFinite)) throw new Error(`Embedding response must contain exactly ${dimension} finite values`);
  const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  if (!Number.isFinite(norm) || norm <= 0) throw new Error('Embedding response has zero or invalid norm');
  return vector.map((value) => value / norm);
}

async function ollamaEmbedBatch(profile, batch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);
  try {
    // keep_alive: держим модель эмбеддинга резидентно. Она нужна на КАЖДЫЙ поиск
    // (эмбеддинг запроса), поэтому выгружать её между запросами — постоянные
    // перезагрузки. Явно дублирует глобальный OLLAMA_KEEP_ALIVE, чтобы пин не зависел
    // от окружения сервиса Ollama.
    const response = await fetch(new URL('/api/embed', profile.baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model: profile.model, input: batch, truncate: true, keep_alive: '24h' })
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Ollama embedding request failed (${response.status}): ${text.slice(0, 500)}`);
    const payload = JSON.parse(text);
    if (!Array.isArray(payload.embeddings) || payload.embeddings.length !== batch.length) {
      throw new Error('Ollama returned an unexpected embedding batch');
    }
    return payload.embeddings.map((vector) => normalize(vector, profile.dimension));
  } finally {
    clearTimeout(timeout);
  }
}

async function ollamaEmbed(profile, inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) return [];
  // Батчинг по 8 чанков защищает Ollama от OOM и таймаутов на огромных документах
  const BATCH_SIZE = 8;
  const allResults = [];
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const slice = inputs.slice(i, i + BATCH_SIZE);
    const vectors = await ollamaEmbedBatch(profile, slice);
    allResults.push(...vectors);
  }
  return allResults;
}

export async function createEmbeddingClient(profile, options = {}) {
  if (!Number.isInteger(profile.dimension) || profile.dimension < 1) throw new Error('Embedding dimension must be a positive integer');
  if (profile.provider === 'ollama') return { profile, describe: `ollama:${profile.model}`, async embed(text) { return (await ollamaEmbed(profile, [text]))[0]; }, async embedBatch(texts) { return ollamaEmbed(profile, texts); }, async embedLateChunking(_fullText, chunks) { return ollamaEmbed(profile, chunks); } };
  const extractor = await initModel({ modelsCache: options.modelsCache, modelId: profile.model, revision: profile.revision, dtype: profile.dtype, device: options.device || 'auto' });
  return { profile, describe: `transformers:${profile.model}`, async embed(text) { return embed(extractor, text, profile.dimension); }, async embedBatch(texts) { return embedBatch(extractor, texts, profile.dimension, options.batchSize || 16); }, async embedLateChunking(fullText, chunks) { return embedLateChunking(extractor, fullText, chunks, profile.dimension); } };
}

export function sameEmbeddingProfile(a, b) {
  return Boolean(a && b) && a.provider === b.provider && a.model === b.model && a.dimension === b.dimension && (a.provider !== 'transformers' || a.revision === b.revision);
}
