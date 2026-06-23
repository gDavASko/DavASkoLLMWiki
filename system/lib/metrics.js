// ═══════════════════════════════════════════════════════════════════════
//  metrics.js — метрики качества ранжирования (детерминированные, без модели)
// ───────────────────────────────────────────────────────────────────────
//  Вынесены из eval-retrieval.js, чтобы их можно было покрыть юнит-тестами
//  и переиспользовать. `ranked` — массив id в порядке убывания релевантности;
//  `relevant` — Set релевантных id.
// ═══════════════════════════════════════════════════════════════════════

/** recall@k: доля релевантных, попавших в top-k. */
export function recallAtK(ranked, relevant, k) {
  if (relevant.size === 0) return 0;
  const top = ranked.slice(0, k);
  let hit = 0;
  for (const id of top) if (relevant.has(id)) hit++;
  return hit / relevant.size;
}

/** MRR: 1 / ранг первого релевантного (0, если ни одного). */
export function mrr(ranked, relevant) {
  for (let i = 0; i < ranked.length; i++) if (relevant.has(ranked[i])) return 1 / (i + 1);
  return 0;
}

/** nDCG@k: качество ранжирования с дисконтом по позиции (бинарная релевантность). */
export function ndcgAtK(ranked, relevant, k) {
  if (relevant.size === 0) return 0;
  let dcg = 0;
  for (let i = 0; i < Math.min(k, ranked.length); i++) {
    if (relevant.has(ranked[i])) dcg += 1 / Math.log2(i + 2);
  }
  let idcg = 0;
  const ideal = Math.min(relevant.size, k);
  for (let i = 0; i < ideal; i++) idcg += 1 / Math.log2(i + 2);
  return idcg === 0 ? 0 : dcg / idcg;
}

export default { recallAtK, mrr, ndcgAtK };
