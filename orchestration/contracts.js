/**
 * @typedef {Object} WorkflowLimits
 * @property {number} maxWorkers
 * @property {number} maxConcurrency
 * @property {number} maxIterations
 * @property {number} maxToolOutputBytes
 * @property {number} [topK] Broad cognitive-tier candidate width.
 * @property {number} [finalTopK] Optional post-rerank context cap.
 */

/**
 * @typedef {Object} WikiRequest
 * @property {string} query
 * @property {"rag" | "rlm" | "auto"} mode
 * @property {"stdout" | "file"} output
 * @property {string} [threadId]
 * @property {string[]} [locations]
 * @property {WorkflowLimits} limits
 */

/**
 * @typedef {Object} TraceEvent
 * @property {string} correlationId
 * @property {string} node
 * @property {string} status
 * @property {string} [taskId]
 * @property {string} [code]
 */

/**
 * @typedef {Object} ToolResult
 * @property {"ok" | "degraded" | "failed"} status
 * @property {string} content
 * @property {string[]} sources
 * @property {string} [code]
 * @property {{requestedTopK?: number, candidateTopK?: number, finalTopK?: number, candidates?: number, reranked?: number, resultCount?: number}} [retrieval]
 * @property {TraceEvent[]} trace
 */

/**
 * @typedef {ToolResult & { route: "RAG" | "RLM" | "GRAPHIFY", correlationId: string }} WikiResponse
 */

/**
 * Валидация входных данных
 * @param {any} req 
 * @returns {WikiRequest}
 */
export function validateWikiRequest(req) {
  if (!req || typeof req.query !== 'string') throw new Error('Invalid WikiRequest: query must be string');
  return req;
}
