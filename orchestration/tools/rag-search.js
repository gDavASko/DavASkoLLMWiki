import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadLanceIndex,
  initModel,
  runStreamA,
  runStreamB,
  applyGraphLift,
  applyDirectorySiblings,
  assembleAndDump,
  parseQuery,
  readText,
  cleanMarkdownForDump
} from '../../system/query-wiki.js';
import { initReranker, rerank } from '../../system/lib/retrieval.js';
import { resolveWikiPaths } from '../../system/lib/wiki-paths.js';
import { checkCapability, wrapDocumentXml } from '../policy.js';
import { RERANK_CANDIDATES, capFinalResults, resolveRetrievalWidths } from './rag-widths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Документы лежат в корне ДАННЫХ (внешний профиль), а не в checkout. Раньше здесь
// использовался путь до checkout: при активном профиле файлы не находились, тексты
// для реранкера оказывались пустыми и переранжирование молча деградировало.
const ROOT_DIR = resolveWikiPaths(process.env, path.resolve(__dirname, '../../system')).dataRoot;

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
  const { candidateTopK, finalTopK } = resolveRetrievalWidths(limits);
  let candidates = 0;
  let reranked = 0;
  const retrieval = (resultCount = 0) => ({
    ...(Number.isInteger(limits?.topK) ? { requestedTopK: limits.topK } : {}),
    ...(candidateTopK !== undefined ? { candidateTopK } : {}),
    ...(finalTopK !== undefined ? { finalTopK } : {}),
    candidates,
    reranked,
    resultCount,
  });
  try {
    // allowBuild=false: пересборка индекса внутри пользовательского запроса
    // заблокировала бы ответ на минуты и всё равно упёрлась бы в таймаут.
    // Лучше быстро и явно сообщить о недоступности — сборка выполняется деплоем.
    const index = await loadLanceIndex(false);
    const queryParts = parseQuery(rawQuery);

    const streamAResults = runStreamA(queryParts.symbols, index, locations);
    let streamBResults = new Map();

    if (queryParts.semantic) {
      const extractor = await initModel();
      streamBResults = await runStreamB(queryParts.semantic, index, extractor, locations, candidateTopK);
    }
    
    const merged = new Map();
    for (const [id, info] of streamAResults.entries()) merged.set(id, info);
    for (const [id, info] of streamBResults.entries()) {
      if (!merged.has(id)) merged.set(id, info);
    }
    candidates = merged.size;

    // Для короткого ответа связанные секции должны попасть в пул ДО cross-encoder,
    // иначе они могли войти в финальные пять по унаследованному score, хотя
    // реранкер их вообще не оценивал.
    if (finalTopK !== undefined) {
      applyGraphLift(merged, index, 2 /* GRAPH_LIFT_SEMANTIC */, locations);
      applyDirectorySiblings(merged, index, { locations });
    }

    // Переранжирование кросс-энкодером — самая дорогая фаза поиска (замер:
    // 2.0 с на 43 документа плюс 1.3 с на инициализацию модели). Смысл имеет
    // только верхушка списка: документы из хвоста практически никогда не
    // поднимаются в топ, а платим мы за них полную цену. Поэтому переранжируем
    // ограниченное число лучших кандидатов, а совсем короткие выдачи —
    // пропускаем целиком, экономя загрузку модели.
    const RERANK_MIN_CANDIDATES = 3;
    let rerankedIds;
    if (merged.size >= RERANK_MIN_CANDIDATES && queryParts.semantic) {
      try {
        const reranker = await initReranker({ device: 'cpu' });
        const docIds = Array.from(merged.entries())
          .sort((a, b) => b[1].score - a[1].score)
          .slice(0, RERANK_CANDIDATES)
          .map(([id]) => id);
        const docsTexts = docIds.map(id => {
          const doc = index.documents[id];
          if (!doc) return "";
          const filePath = path.join(ROOT_DIR, doc.path);
          if (!fs.existsSync(filePath)) return "";
          const rawContent = readText(filePath);
          return cleanMarkdownForDump(rawContent, doc.path).substring(0, 1500);
        });

        const rerankScores = await rerank(reranker, rawQuery, docsTexts);
        reranked = docIds.length;
        rerankedIds = new Set(docIds);

        for (let i = 0; i < docIds.length; i++) {
          const id = docIds[i];
          const info = merged.get(id);
          const rScore = rerankScores[i];
          const sigmoid = 1 / (1 + Math.exp(-rScore));

          if (info.source !== 'streamA') {
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
    if (finalTopK === undefined) {
      applyGraphLift(merged, index, 2 /* GRAPH_LIFT_SEMANTIC */, locations);
      // Добор соседних секций того же таба (по директории): чинит схлопывание выдачи
      // до одного «Overview», когда относительный порог выжигает остальные секции.
      applyDirectorySiblings(merged, index, { locations });
    }

    if (merged.size === 0) {
      const emptyDump = `# Wiki Context Dump\n\n> Query: \`${rawQuery}\`\n\n**Совпадений не найдено.**\n`;
      return {
        status: 'ok',
        content: emptyDump,
        sources: [],
        retrieval: retrieval(0),
        trace: [{ correlationId, node: 'rag-search', status: 'ok', code: 'EMPTY_RESULT' }]
      };
    }
    
    // Cap only after reranking and graph/directory expansion. Full enumeration,
    // inference and analysis tiers deliberately leave the context broad.
    const finalResults = capFinalResults(merged, finalTopK, rerankedIds);
    const { count, dump } = assembleAndDump(finalResults, index, rawQuery);
    
    return {
      status: 'ok',
      content: dump,
      sources: Array.from(finalResults.keys()),
      retrieval: retrieval(finalResults.size),
      trace: [{ correlationId, node: 'rag-search', status: 'ok', code: `FOUND_${count}` }]
    };
  } catch (err) {
    return {
      status: 'failed',
      content: `RAG Execution Failed: ${err.message}`,
      sources: [],
      retrieval: retrieval(0),
      trace: [{ correlationId, node: 'rag-search', status: 'failed', code: err.message }]
    };
  }
}
