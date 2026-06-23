// ═══════════════════════════════════════════════════════════════════════
//  retrieval.js — переиспользуемое ядро векторного поиска
// ───────────────────────────────────────────────────────────────────────
//  Единый источник истины для эмбеддинга и скоринга: используется и боевым
//  query-wiki.js, и измерительной установкой eval-retrieval.js, чтобы метрики
//  оценивали РЕАЛЬНЫЙ движок, а не его копию (нет расхождения логики).
// ═══════════════════════════════════════════════════════════════════════

/** Косинусное сходство двух векторов. */
export function cosineSimilarity(a, b) {
  const len = Math.min(a.length, b.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < len; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * IVF multi-probe: выбрать кластеры для скана.
 * nprobe >= числа кластеров или <= 0 => исчерпывающий поиск (все шарды).
 * @returns {{ clusters: string[], exhaustive: boolean }}
 */
export function selectProbeClusters(queryVec, centroids, nprobe) {
  const names = Object.keys(centroids || {});
  if (!(nprobe > 0) || nprobe >= names.length) {
    return { clusters: names, exhaustive: true };
  }
  const clusters = names
    .map(name => ({ name, c: cosineSimilarity(queryVec, centroids[name] || []) }))
    .sort((a, b) => b.c - a.c)
    .slice(0, nprobe)
    .map(x => x.name);
  return { clusters, exhaustive: false };
}

/**
 * Применяет порог отсечения к набору score, поддерживая два режима:
 *
 *   "absolute" — фиксированный cosine-порог `similarity_threshold`
 *                (+ fallback до `similarity_fallback`, если ничего не прошло).
 *   "relative" — адаптивный порог на запрос: tau = max(junk_floor, alpha * top),
 *                где top — лучший score для ДАННОГО запроса. Устойчив к сдвигу
 *                распределения (модель/язык/длина), убирает «магическое 0.X».
 *
 * Абсолютный cosine используется для отсечения; ранжирование/boost — выше по стеку.
 *
 * @param {Array<{fileId:string,score:number}>|Array<[string,number]>} allScores
 * @returns {{ best: Map<string,number>, tau: number, top: number, mode: string, usedFallback: boolean }}
 */
export function applyThreshold(allScores, cfg = {}) {
  const entries = allScores.map(s => (Array.isArray(s) ? s : [s.fileId, s.score]));
  const top = entries.reduce((m, e) => Math.max(m, e[1]), 0);
  const mode = cfg.threshold_mode || 'absolute';

  let tau;
  if (mode === 'relative') {
    const alpha = cfg.relative_alpha ?? 0.85;
    const floor = cfg.junk_floor ?? 0.35;
    tau = Math.max(floor, alpha * top);
  } else {
    tau = cfg.similarity_threshold ?? 0.70;
  }

  const best = new Map();
  for (const [id, s] of entries) {
    if (s >= tau && s > (best.get(id) || 0)) best.set(id, s);
  }

  // Fallback только для абсолютного режима (в relative порог уже адаптивен).
  let usedFallback = false;
  if (best.size === 0 && mode !== 'relative') {
    const fb = cfg.similarity_fallback ?? 0.65;
    for (const [id, s] of entries) {
      if (s >= fb && s > (best.get(id) || 0)) best.set(id, s);
    }
    usedFallback = best.size > 0;
  }
  return { best, tau, top, mode, usedFallback };
}

/**
 * Символьный поиск (Stream A) с ранжированием по типу совпадения и mini-IDF.
 * Раньше любое совпадение давало score 1.0 — частый символ (Update, Manager)
 * затоплял выдачу. Теперь:
 *   - вес по типу: id > symbols > tags > wikilinks > подстрока-в-id;
 *   - mini-IDF: символ, совпавший во многих документах, весит меньше (1/sqrt(df));
 *   - результат капится top-`limit` по score, чтобы не затоплять контекст.
 * Чистая функция (без модели) → покрыта юнит-тестами.
 * @returns {Map<string, number>} docId → score (по убыванию)
 */
export function scoreSymbolMatches(symbols, documents, { weights, limit } = {}) {
  const out = new Map();
  if (!symbols || symbols.length === 0) return out;
  const W = weights || { id: 1.0, symbols: 0.9, tags: 0.7, wikilinks: 0.6, idsub: 0.5 };
  const syms = symbols.map(s => String(s).toLowerCase());
  const lower = (arr) => (Array.isArray(arr) ? arr.map(x => String(x).toLowerCase()) : []);

  const matches = new Map(); // docId -> { base, matchedSyms:Set }
  const df = new Map();      // symbol -> число документов, где он совпал
  for (const [docId, doc] of Object.entries(documents || {})) {
    const idLower = docId.toLowerCase();
    const symL = lower(doc.symbols);
    const tagL = lower(doc.tags);
    const wlL  = lower(doc.wikilinks);

    let base = 0;
    const matchedSyms = new Set();
    for (const s of syms) {
      let w = 0;
      if (idLower === s) w = W.id;
      else if (symL.includes(s)) w = W.symbols;
      else if (tagL.includes(s)) w = W.tags;
      else if (wlL.includes(s)) w = W.wikilinks;
      else if (s.length >= 4 && idLower.includes(s)) w = W.idsub;
      if (w > 0) { matchedSyms.add(s); if (w > base) base = w; }
    }
    if (matchedSyms.size > 0) {
      matches.set(docId, { base, matchedSyms });
      for (const s of matchedSyms) df.set(s, (df.get(s) || 0) + 1);
    }
  }

  const scored = [];
  for (const [docId, { base, matchedSyms }] of matches) {
    let bestIdf = 0;
    for (const s of matchedSyms) {
      const idf = 1 / Math.sqrt(df.get(s) || 1); // df=1→1, df=4→0.5, df=9→0.33
      if (idf > bestIdf) bestIdf = idf;
    }
    scored.push([docId, base * bestIdf]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  const capped = (limit && limit > 0) ? scored.slice(0, limit) : scored;
  for (const [docId, score] of capped) out.set(docId, score);
  return out;
}

/**
 * Загрузка feature-extraction пайплайна Jina v3 (строго оффлайн).
 * Логирование намеренно отсутствует — оборачивайте на стороне вызова.
 */
export async function initModel({ modelsCache, modelId, revision, dtype = 'fp16' }) {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowRemoteModels = false;
  env.cacheDir = modelsCache;
  env.localModelPath = modelsCache;
  return pipeline('feature-extraction', modelId, { revision, dtype });
}

/**
 * Эмбеддинг текста. Асимметричные префиксы Jina v3:
 *   "query: ..."   → task_id 0
 *   "passage: ..." → task_id 1
 * Возвращает нормализованный вектор длины vectorDim.
 */
export async function embed(extractor, text, vectorDim = 1024) {
  let cleanText = text;
  let taskId = 0;
  if (text.startsWith('passage: ')) { taskId = 1; cleanText = text.slice(9); }
  else if (text.startsWith('query: ')) { taskId = 0; cleanText = text.slice(7); }

  const { Tensor } = await import('@huggingface/transformers');
  const inputs = extractor.tokenizer(cleanText, { padding: true, truncation: true });
  inputs.task_id = new Tensor('int64', BigInt64Array.from([BigInt(taskId)]), [1]);
  const outputs = await extractor.model(inputs);

  // Выбор выходного тензора эмбеддинга ПО ФОРМЕ, а не по магическому имени узла
  // ('13049' — автоген-номер из конкретного ONNX-экспорта, ломается при переэкспорте).
  // Имя оставляем как быструю первую попытку, форма — надёжный фолбэк.
  const tensors = Object.values(outputs).filter(t => t && t.dims && t.data);
  const pooled2d = tensors.find(t => t.dims.length === 2 && t.dims[t.dims.length - 1] === vectorDim);
  const hidden3d = tensors.find(t => t.dims.length === 3 && t.dims[t.dims.length - 1] === vectorDim);

  let raw;
  const named = outputs['13049'];
  if (named && named.dims && named.dims[named.dims.length - 1] === vectorDim) {
    raw = Array.from(named.data);            // быстрый путь: ожидаемый именованный выход
  } else if (pooled2d) {
    raw = Array.from(pooled2d.data);         // уже пулленный эмбеддинг [batch, vectorDim]
  } else if (hidden3d) {
    // Резервный mean pooling по 3D [batch, seq, vectorDim] с учётом attention_mask
    const lastHiddenState = hidden3d;
    const attentionMask = inputs.attention_mask;
    const [batchSize, seqLength, embedDim] = lastHiddenState.dims;
    const pooled = new Float32Array(batchSize * embedDim);
    for (let i = 0; i < batchSize; ++i) {
      for (let k = 0; k < embedDim; ++k) {
        let sum = 0, count = 0;
        for (let j = 0; j < seqLength; ++j) {
          const attn = Number(attentionMask.data[i * seqLength + j]);
          count += attn;
          sum += lastHiddenState.data[i * embedDim * seqLength + j * embedDim + k] * attn;
        }
        pooled[i * embedDim + k] = sum / (count || 1);
      }
    }
    raw = Array.from(pooled);
  } else {
    const shapes = tensors.map(t => `[${t.dims.join(',')}]`).join(' ');
    throw new Error(`No embedding tensor of expected shape (last dim ${vectorDim}) found. Outputs: ${shapes}`);
  }

  let norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0)) || 1;
  const normalized = raw.map(v => v / norm);
  if (normalized.length >= vectorDim) return normalized.slice(0, vectorDim);
  return [...normalized, ...new Array(vectorDim - normalized.length).fill(0)];
}

export default { cosineSimilarity, selectProbeClusters, applyThreshold, scoreSymbolMatches, initModel, embed };
