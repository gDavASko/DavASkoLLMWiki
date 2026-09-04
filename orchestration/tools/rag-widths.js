/** Число документов, которые дорогой cross-encoder действительно оценивает. */
export const RERANK_CANDIDATES = 12;

/**
 * Разводит две разные величины, которые раньше ошибочно назывались одним topK:
 * широкий пул кандидатов для реранкера и финальный контекст для LLM.
 */
export function resolveRetrievalWidths(limits = {}) {
  const topK = Number.isInteger(limits?.topK) && limits.topK > 0 ? limits.topK : undefined;
  const candidateTopK = topK === undefined ? undefined : Math.max(topK, RERANK_CANDIDATES);
  const finalTopK = Number.isInteger(limits?.finalTopK) && limits.finalTopK > 0
    ? limits.finalTopK
    : (topK === 5 ? 5 : undefined);
  return { candidateTopK, finalTopK };
}

/** Оставляет финальный top-K уже по итоговым (включая reranker) оценкам. */
export function capFinalResults(results, finalTopK, rankedIds) {
  if (!Number.isInteger(finalTopK) || finalTopK <= 0) return results;
  const entries = rankedIds instanceof Set
    ? Array.from(results.entries()).filter(([id]) => rankedIds.has(id))
    : Array.from(results.entries());
  return new Map(entries
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, finalTopK));
}
