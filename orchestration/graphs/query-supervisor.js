import { StateGraph, START, END } from '@langchain/langgraph';
import { executeRagAdapter, executeGraphifyAdapter, executeGrepAdapter } from '../tools/index.js';
import { validateWikiRequest } from '../contracts.js';
import { createResearchGraph } from './research.js';
import { createSqliteWalCheckpointer } from '../checkpointer.js';

const SupervisorState = {
  request: { value: (a, b) => b ?? a, default: () => null },
  route: { value: (a, b) => b ?? a, default: () => null },
  trace: { value: (a, b) => (a || []).concat(b || []), default: () => [] },
  
  initial_result: { value: (a, b) => b ?? a, default: () => null },
  fallback_result: { value: (a, b) => b ?? a, default: () => null },
  best_intermediate_result: { value: (a, b) => b ?? a, default: () => null },
  grep_result: { value: (a, b) => b ?? a, default: () => null },
  
  response: { value: (a, b) => b ?? a, default: () => null },
};

export function createQuerySupervisorGraph(dependencies = {}) {
  const { provider, checkpointer = createSqliteWalCheckpointer() } = dependencies;

  const getCorrelationId = (state) => state.request?.threadId || state.request?.correlationId || 'corr_' + Date.now();

  const validateRequest = (state) => {
    const validReq = validateWikiRequest(state.request);
    return { request: validReq };
  };

  const selectRoute = async (state) => {
    const correlationId = getCorrelationId(state);
    let route = 'RAG';
    if (state.request.mode === 'rlm') route = 'RLM';
    if (state.request.mode === 'graphify') route = 'GRAPHIFY';
    if (state.request.mode === 'auto') {
      if (provider?.selectRoute) {
        const res = await provider.selectRoute(state.request);
        if (['RAG', 'RLM', 'GRAPHIFY'].includes(res?.route)) {
          route = res.route;
        }
      }
    }
    return { route, trace: [{ correlationId, node: 'select_route', status: 'ok', code: route }] };
  };

  // ================= GRAPHIFY (Isolated) =================
  const executeGraphify = async (state) => {
    const correlationId = getCorrelationId(state);
    const heartbeatTimer = setInterval(() => {
      console.error(`[HEARTBEAT] Supervisor executing Graphify search for correlationId: ${correlationId}`);
    }, 5000);
    try {
      const res = await executeGraphifyAdapter(state.request.query);
      return { response: res, trace: [{ correlationId, node: 'execute_graphify', status: 'ok' }] };
    } finally {
      clearInterval(heartbeatTimer);
    }
  };

  // ================= HELPERS FOR RAG & RLM =================
  const runRag = async (state, correlationId) => {
    const heartbeatTimer = setInterval(() => {
      console.error(`[HEARTBEAT] Supervisor executing RAG search for correlationId: ${correlationId}`);
    }, 5000);
    try {
      return await executeRagAdapter(state.request.query, state.request.limits, correlationId, state.request.locations);
    } finally {
      clearInterval(heartbeatTimer);
    }
  };

  const runRlm = async (state, correlationId) => {
    const heartbeatTimer = setInterval(() => {
      console.error(`[HEARTBEAT] Supervisor executing Research graph for correlationId: ${correlationId}`);
    }, 5000);
    try {
      const researchGraph = createResearchGraph(dependencies);
      const researchState = await researchGraph.invoke({
        topic: state.request.query,
        config: { limits: state.request.limits, correlationId },
        retryCount: 0
      }, { configurable: { thread_id: correlationId } });

      const content = researchState.finalSummary || (typeof researchState.response === 'string' ? researchState.response : '# RLM Research Report\n\nNo summary generated.');
      const status = (researchState.status === 'completed' || researchState.status === 'aggregated') ? 'ok' : 'failed';
      const sources = (researchState.collectedData || []).flatMap(d => d.sources || d.findings?.flatMap(f => f.sources || []) || []);

      return { status, content, sources };
    } finally {
      clearInterval(heartbeatTimer);
    }
  };

  // ================= STEP 1: INITIAL =================
  const executeRagInitial = async (state) => {
    const res = await runRag(state, getCorrelationId(state));
    return { initial_result: res, trace: [{ correlationId: getCorrelationId(state), node: 'execute_rag_initial', status: res?.status || 'ok' }] };
  };

  const startResearchInitial = async (state) => {
    const res = await runRlm(state, getCorrelationId(state));
    return { initial_result: res, trace: [{ correlationId: getCorrelationId(state), node: 'start_research_initial', status: res?.status || 'ok' }] };
  };

  const judgeInitial = async (state) => {
    const correlationId = getCorrelationId(state);
    let score = 1;
    if (provider?.judgeResponse) {
       const j = await provider.judgeResponse({ query: state.request.query, response: state.initial_result });
       score = j.score || 1;
    }
    const trace = [{ correlationId, node: 'judge_initial', status: 'ok', code: `SCORE_${score}` }];
    if (score >= 7) {
       return { response: state.initial_result, trace };
    }
    return { trace };
  };

  // ================= STEP 2: FALLBACK =================
  const executeRagFallback = async (state) => {
    const res = await runRag(state, getCorrelationId(state));
    return { fallback_result: res, trace: [{ correlationId: getCorrelationId(state), node: 'execute_rag_fallback', status: res?.status || 'ok' }] };
  };

  const startResearchFallback = async (state) => {
    const res = await runRlm(state, getCorrelationId(state));
    return { fallback_result: res, trace: [{ correlationId: getCorrelationId(state), node: 'start_research_fallback', status: res?.status || 'ok' }] };
  };

  const judgeFallback = async (state) => {
    const correlationId = getCorrelationId(state);
    let score = 1;
    if (provider?.judgeResponse) {
       const j = await provider.judgeResponse({ query: state.request.query, response: state.fallback_result });
       score = j.score || 1;
    }
    const trace = [{ correlationId, node: 'judge_fallback', status: 'ok', code: `SCORE_${score}` }];
    if (score >= 7) {
       return { response: state.fallback_result, trace };
    }
    return { trace };
  };

  // ================= STEP 3: COMPARE 1 =================
  const compareAnswers = async (state) => {
    const correlationId = getCorrelationId(state);
    let best = 'A';
    if (provider?.compareAnswers) {
       const c = await provider.compareAnswers({ query: state.request.query, answerA: state.initial_result, answerB: state.fallback_result });
       best = c.best || 'A';
    }
    const bestRes = best === 'B' ? state.fallback_result : state.initial_result;
    return { best_intermediate_result: bestRes, trace: [{ correlationId, node: 'compare_answers', status: 'ok', code: `CHOSE_${best}` }] };
  };

  // ================= STEP 4: GREP =================
  const executeGrepSearch = async (state) => {
    const correlationId = getCorrelationId(state);
    const res = await executeGrepAdapter(state.request.query, state.request.limits, correlationId, state.request.locations);
    return { grep_result: res, trace: [{ correlationId, node: 'execute_grep_search', status: res?.status || 'ok' }] };
  };

  const judgeGrep = async (state) => {
    const correlationId = getCorrelationId(state);
    let score = 1;
    if (provider?.judgeResponse) {
       const j = await provider.judgeResponse({ query: state.request.query, response: state.grep_result });
       score = j.score || 1;
    }
    const trace = [{ correlationId, node: 'judge_grep', status: 'ok', code: `SCORE_${score}` }];
    if (score >= 7) {
       return { response: state.grep_result, trace };
    }
    return { trace };
  };

  // ================= STEP 5: FINAL COMPARE =================
  const compareFinal = async (state) => {
    const correlationId = getCorrelationId(state);
    let best = 'A';
    if (provider?.compareAnswers) {
       const c = await provider.compareAnswers({ query: state.request.query, answerA: state.best_intermediate_result, answerB: state.grep_result });
       best = c.best || 'A';
    }
    const bestRes = best === 'B' ? state.grep_result : state.best_intermediate_result;
    return { response: bestRes, trace: [{ correlationId, node: 'compare_final', status: 'ok', code: `CHOSE_${best}` }] };
  };

  // ================= NORMALIZE =================
  const normalizeResponse = async (state) => {
    const correlationId = getCorrelationId(state);
    let rawResponse = state.response;
    if (!rawResponse) {
      rawResponse = { status: 'failed', content: 'No response generated.', sources: [] };
    }

    let normalizedContent = typeof rawResponse === 'string'
      ? rawResponse
      : (rawResponse.content || JSON.stringify(rawResponse));

    if (provider?.normalizeResponse) {
      try {
        const editResult = await provider.normalizeResponse({
          query: state.request?.query,
          content: normalizedContent,
          route: state.route
        });
        if (editResult?.content) {
          normalizedContent = editResult.content;
        }
      } catch (e) {}
    } else {
      normalizedContent = normalizedContent
        .replace(/(\r?\n){3,}/g, '\n\n')
        .trim();
    }

    const rawSources = Array.isArray(rawResponse.sources) ? rawResponse.sources : [];
    const uniqueSources = Array.from(new Set(rawSources.filter(Boolean)));

    const normalizedResponse = {
      status: rawResponse.status || 'ok',
      content: normalizedContent,
      sources: uniqueSources,
      route: state.route || 'RAG',
      correlationId,
      ...(rawResponse.code ? { code: rawResponse.code } : {})
    };

    return {
      response: normalizedResponse,
      trace: [{ correlationId, node: 'normalize_response', status: 'ok' }]
    };
  };

  // ================= GRAPH DEFINITION =================
  const builder = new StateGraph({ channels: SupervisorState })
    .addNode('validate_request', validateRequest)
    .addNode('select_route', selectRoute)
    
    // GRAPHIFY
    .addNode('execute_graphify', executeGraphify)
    
    // INITIAL
    .addNode('execute_rag_initial', executeRagInitial)
    .addNode('start_research_initial', startResearchInitial)
    .addNode('judge_initial', judgeInitial)
    
    // FALLBACK
    .addNode('execute_rag_fallback', executeRagFallback)
    .addNode('start_research_fallback', startResearchFallback)
    .addNode('judge_fallback', judgeFallback)
    
    // COMPARE 1
    .addNode('compare_answers', compareAnswers)
    
    // GREP
    .addNode('execute_grep_search', executeGrepSearch)
    .addNode('judge_grep', judgeGrep)
    
    // FINAL COMPARE
    .addNode('compare_final', compareFinal)
    
    // OUTPUT
    .addNode('normalize_response', normalizeResponse)

    // ROUTING
    .addEdge(START, 'validate_request')
    .addEdge('validate_request', 'select_route')
    
    .addConditionalEdges('select_route', (s) => s.route, {
      'GRAPHIFY': 'execute_graphify',
      'RAG': 'execute_rag_initial',
      'RLM': 'start_research_initial'
    })
    
    .addEdge('execute_graphify', 'normalize_response')
    
    .addEdge('execute_rag_initial', 'judge_initial')
    .addEdge('start_research_initial', 'judge_initial')
    
    .addConditionalEdges('judge_initial', (s) => s.response ? 'normalize' : (s.route === 'RAG' ? 'RLM_FALLBACK' : 'RAG_FALLBACK'), {
      'normalize': 'normalize_response',
      'RLM_FALLBACK': 'start_research_fallback',
      'RAG_FALLBACK': 'execute_rag_fallback'
    })
    
    .addEdge('start_research_fallback', 'judge_fallback')
    .addEdge('execute_rag_fallback', 'judge_fallback')
    
    .addConditionalEdges('judge_fallback', (s) => s.response ? 'normalize' : 'compare', {
      'normalize': 'normalize_response',
      'compare': 'compare_answers'
    })
    
    .addEdge('compare_answers', 'execute_grep_search')
    .addEdge('execute_grep_search', 'judge_grep')
    
    .addConditionalEdges('judge_grep', (s) => s.response ? 'normalize' : 'compare_final', {
      'normalize': 'normalize_response',
      'compare_final': 'compare_final'
    })
    
    .addEdge('compare_final', 'normalize_response')
    .addEdge('normalize_response', END);

  return builder.compile({ checkpointer });
}