import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadLanceIndex,
  initModel,
  runStreamA,
  runStreamB,
  applyGraphLift,
  assembleAndDump,
  parseQuery,
  readText,
  cleanMarkdownForDump
} from '../../system/query-wiki.js';
import { initReranker, rerank } from '../../system/lib/retrieval.js';
import { checkCapability, wrapDocumentXml } from '../policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

/**
 * Execute RAG search as a Tool Adapter with Reranking and Prompt Injection Defense
 * @param {string} rawQuery 
 * @param {import('../contracts.js').WorkflowLimits} limits 
 * @param {string} [correlationId='none']
 * @param {string[]} [locations=[]]
 * @returns {Promise<import('../contracts.js').ToolResult>}
 */
export async function executeRagAdapter(rawQuery, limits = {}, correlationId = 'none', locations = []) {
  checkCapability('query', 'rag-search');
  const startTime = Date.now();
  try {
    const index = await loadLanceIndex(locations);
    const queryParts = parseQuery(rawQuery);
    
    const streamAResults = runStreamA(queryParts.symbols, index);
    let streamBResults = new Map();
    
    if (queryParts.semantic) {
      const extractor = await initModel();
      streamBResults = await runStreamB(queryParts.semantic, index, extractor);
    }
    
    const merged = new Map();
    for (const [id, info] of streamAResults.entries()) merged.set(id, info);
    for (const [id, info] of streamBResults.entries()) {
      if (!merged.has(id)) merged.set(id, info);
    }

    // Deterministic Cross-Encoder Reranking step
    if (merged.size > 0 && queryParts.semantic) {
      try {
        const reranker = await initReranker({ device: 'cpu' });
        const docIds = Array.from(merged.keys());
        const docsTexts = docIds.map(id => {
          const doc = index.documents[id];
          if (!doc) return "";
          const filePath = path.join(ROOT_DIR, doc.path);
          if (!fs.existsSync(filePath)) return "";
          const rawContent = readText(filePath);
          return cleanMarkdownForDump(rawContent, doc.path).substring(0, 1500);
        });

        const rerankScores = await rerank(reranker, rawQuery, docsTexts);

        for (let i = 0; i < docIds.length; i++) {
          const id = docIds[i];
          const info = merged.get(id);
          const rScore = rerankScores[i];
          const sigmoid = 1 / (1 + Math.exp(-rScore));

          if (info.source === 'streamB') {
            info.score = (info.score * 0.3) + (sigmoid * 0.7);
          }
          if (info.source === 'streamA') {
            info.score = (info.score * 0.8) + (sigmoid * 0.2);
          }
        }
      } catch (rerankErr) {
        // Fallback gracefully if reranker is uninitialized
      }
    }
    
    applyGraphLift(merged, index, 2 /* GRAPH_LIFT_SEMANTIC */);
    
    if (merged.size === 0) {
      const emptyDump = `# Wiki Context Dump\n\n> Query: \`${rawQuery}\`\n\n**Совпадений не найдено.**\n`;
      return {
        status: 'ok',
        content: emptyDump,
        sources: [],
        trace: [{ correlationId, node: 'rag-search', status: 'ok', code: 'EMPTY_RESULT' }]
      };
    }
    
    const { count, dump } = assembleAndDump(merged, index, rawQuery);
    
    return {
      status: 'ok',
      content: dump,
      sources: Array.from(merged.keys()),
      trace: [{ correlationId, node: 'rag-search', status: 'ok', code: `FOUND_${count}` }]
    };
  } catch (err) {
    return {
      status: 'failed',
      content: `RAG Execution Failed: ${err.message}`,
      sources: [],
      trace: [{ correlationId, node: 'rag-search', status: 'failed', code: err.message }]
    };
  }
}