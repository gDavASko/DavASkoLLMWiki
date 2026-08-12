/**
 * @file orchestration/graphs/research.js
 * LangGraph Control Plane StateGraph implementation for Parallel RLM Research with
 * SQLite WAL checkpointer, periodic Heartbeat emission, Prompt Injection defense, and Worker Thread safety.
 */

import { StateGraph, Annotation, Send, END, START } from '@langchain/langgraph';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createSqliteWalCheckpointer } from '../checkpointer.js';
import { wrapDocumentXml, checkCapability } from '../policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ResearchAnnotation = Annotation.Root({
  topic: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => ''
  }),
  config: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => ({})
  }),
  plan: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null
  }),
  validation: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null
  }),
  workerTasks: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => []
  }),
  workerResults: Annotation({
    reducer: (existing, update) => {
      if (update && typeof update === 'object' && !Array.isArray(update) && update.__reset) {
        return update.value || [];
      }
      if (Array.isArray(update)) {
        return existing.concat(update);
      }
      return existing;
    },
    default: () => []
  }),
  collectedData: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => []
  }),
  judgeResult: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null
  }),
  finalSummary: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null
  }),
  retryCount: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => 0
  }),
  status: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => 'initialized'
  }),
  error: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null
  })
});

export function createResearchGraph(dependencies = {}) {
  checkCapability('research', 'rag-search');
  const limits = {
    maxWorkers: 5,
    maxPlanRetries: 3,
    maxJudgeRetries: 2,
    ...dependencies.limits
  };

  const logger = dependencies.logger || console;
  const workerScriptPath = dependencies.workerScriptPath || path.join(__dirname, 'research-worker.js');
  const checkpointer = dependencies.checkpointer || createSqliteWalCheckpointer();

  async function createPlanNode(state) {
    const isReplan = Boolean(state.plan || state.validation || state.judgeResult);
    const currentRetry = isReplan ? (state.retryCount || 0) + 1 : (state.retryCount || 0);

    logger.info?.(`[create_plan] Constructing research plan for topic: ${state.topic} (retryCount: ${currentRetry})`);
    
    let newPlan;
    if (dependencies.planner?.createPlan) {
      newPlan = await dependencies.planner.createPlan({
        topic: state.topic,
        config: state.config,
        retryCount: currentRetry
      });
    } else {
      newPlan = {
        id: `plan_${Date.now()}`,
        topic: state.topic,
        tasks: [
          { id: 'task_1', title: 'Background Research & Context', query: `${state.topic} background`, type: 'background' },
          { id: 'task_2', title: 'Technical Architecture Deep Dive', query: `${state.topic} architecture`, type: 'deep_dive' },
          { id: 'task_3', title: 'Gap Analysis & Validation', query: `${state.topic} gaps and edge cases`, type: 'gap_analysis' }
        ],
        createdAt: new Date().toISOString()
      };
    }

    return {
      plan: newPlan,
      retryCount: currentRetry,
      status: 'plan_created'
    };
  }

  async function validatePlanNode(state) {
    logger.info?.(`[validate_plan] Validating plan structure for ${state.plan?.id}`);
    
    if (dependencies.planner?.validatePlan) {
      const validation = await dependencies.planner.validatePlan(state.plan);
      return { validation };
    }

    const isValid = Boolean(
      state.plan &&
      Array.isArray(state.plan.tasks) &&
      state.plan.tasks.length > 0
    );

    return {
      validation: {
        valid: isValid,
        errors: isValid ? [] : ['Plan contains no valid research tasks']
      }
    };
  }

  function routeAfterValidation(state) {
    if (state.validation?.valid) {
      return 'dispatch_workers';
    }
    if ((state.retryCount || 0) < limits.maxPlanRetries) {
      logger.warn?.(`[validate_plan] Plan invalid. Re-attempting plan creation (${state.retryCount + 1}/${limits.maxPlanRetries})`);
      return 'create_plan';
    }
    logger.error?.('[validate_plan] Exceeded maximum plan retries. Terminating graph.');
    return 'finish';
  }

  async function dispatchWorkersNode(state) {
    const rawTasks = state.plan?.tasks || [];
    const cappedTasks = rawTasks.slice(0, limits.maxWorkers);
    
    logger.info?.(`[dispatch_workers] Prepared ${cappedTasks.length} tasks for parallel dispatch (maxWorkers: ${limits.maxWorkers})`);

    return {
      workerTasks: cappedTasks,
      workerResults: { __reset: true, value: [] },
      collectedData: [],
      status: 'dispatched'
    };
  }

  function dispatchWorkersFanOut(state) {
    const tasks = state.workerTasks || [];
    if (tasks.length === 0) {
      logger.warn?.('[dispatch_workers] No worker tasks found for fan-out.');
      return 'finish';
    }

    return tasks.map(task => new Send('worker', {
      task,
      config: state.config,
      topic: state.topic
    }));
  }

  async function workerNode(inputState) {
    const { task, config, topic } = inputState;
    const taskId = task.id || `worker_${Date.now()}`;
    const tempOutputFile = path.join(
      os.tmpdir(),
      `rlm-worker-${taskId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.json`
    );

    logger.info?.(`[worker] Spawning worker_thread for task: ${taskId}`);

    return new Promise((resolve) => {
      const heartbeatTimer = setInterval(() => {
        logger.info?.(`[HEARTBEAT] Worker thread active for taskId: ${taskId}`);
      }, 5000);

      const worker = new Worker(workerScriptPath, {
        workerData: {
          task,
          config,
          topic,
          outputFile: tempOutputFile
        }
      });

      let completed = false;

      const cleanupAndResolve = (result) => {
        if (completed) return;
        completed = true;
        clearInterval(heartbeatTimer);
        worker.terminate().catch(() => {});
        resolve(result);
      };

      worker.on('message', (message) => {
        cleanupAndResolve({
          workerResults: [{
            taskId,
            status: message.status || 'completed',
            outputFile: tempOutputFile,
            summary: message.summary || `Task ${taskId} finished`,
            error: message.error
          }]
        });
      });

      worker.on('error', (err) => {
        logger.error?.(`[worker] Worker thread error for task ${taskId}:`, err);
        cleanupAndResolve({
          workerResults: [{
            taskId,
            status: 'WORKER_CRASH',
            outputFile: tempOutputFile,
            error: err.message
          }]
        });
      });

      worker.on('exit', (code) => {
        if (!completed) {
          cleanupAndResolve({
            workerResults: [{
              taskId,
              status: code === 0 ? 'completed' : 'WORKER_CRASH',
              outputFile: tempOutputFile,
              error: code !== 0 ? `Worker thread exited with code ${code}` : undefined,
              summary: code === 0 ? `Task ${taskId} completed` : undefined
            }]
          });
        }
      });
    });
  }

  async function collectResultsNode(state) {
    logger.info?.(`[collect_results] Processing outputs from ${state.workerResults?.length || 0} worker files`);
    
    const aggregatedData = [];
    const tempFilesToCleanup = [];

    for (const result of state.workerResults || []) {
      if (result.status === 'WORKER_CRASH' || result.status === 'error') {
        aggregatedData.push({
          taskId: result.taskId,
          status: 'WORKER_CRASH',
          error: result.error || 'Worker thread crashed'
        });
        if (result.outputFile) tempFilesToCleanup.push(result.outputFile);
        continue;
      }

      if (result.outputFile) {
        tempFilesToCleanup.push(result.outputFile);
        try {
          const fileContent = await fs.readFile(result.outputFile, 'utf8');
          const parsed = JSON.parse(fileContent);
          if (parsed.status === 'WORKER_CRASH' || parsed.status === 'error') {
            aggregatedData.push({
              taskId: result.taskId,
              status: 'WORKER_CRASH',
              error: parsed.error || 'Worker execution failed'
            });
          } else {
            if (Array.isArray(parsed.findings)) {
              parsed.findings = parsed.findings.map(f => ({
                ...f,
                content: wrapDocumentXml(result.taskId, f.content)
              }));
            }
            aggregatedData.push(parsed);
          }
        } catch (err) {
          logger.error?.(`[collect_results] Failed to read output file ${result.outputFile}:`, err);
          aggregatedData.push({
            taskId: result.taskId,
            status: 'WORKER_CRASH',
            error: err.message
          });
        }
      } else {
        aggregatedData.push({
          taskId: result.taskId,
          status: 'WORKER_CRASH',
          error: 'No output file provided'
        });
      }
    }

    await Promise.all(
      tempFilesToCleanup.map(file => fs.unlink(file).catch(() => {}))
    );

    aggregatedData.sort((a, b) => String(a.taskId || '').localeCompare(String(b.taskId || '')));

    return {
      collectedData: aggregatedData,
      status: 'results_collected'
    };
  }

  async function judgeNode(state) {
    logger.info?.(`[judge] Judging quality and coverage of research results for ${state.topic}`);

    if (dependencies.judge?.evaluate) {
      const judgeResult = await dependencies.judge.evaluate({
        topic: state.topic,
        plan: state.plan,
        collectedData: state.collectedData
      });
      return { judgeResult };
    }

    const successfulTasks = (state.collectedData || []).filter(d => d.status === 'success' || d.status === 'completed');
    const coverageRatio = state.collectedData?.length > 0 
      ? successfulTasks.length / state.collectedData.length 
      : 0;

    const passed = coverageRatio >= 0.6;

    return {
      judgeResult: {
        passed,
        score: coverageRatio,
        feedback: passed ? 'Research coverage meets threshold' : 'Insufficient task coverage ratio',
        needsReplan: !passed
      }
    };
  }

  function routeAfterJudge(state) {
    if (state.judgeResult?.passed) {
      return 'aggregate';
    }
    if ((state.retryCount || 0) < limits.maxJudgeRetries) {
      logger.warn?.(`[judge] Quality check failed. Triggering replan (${(state.retryCount || 0) + 1}/${limits.maxJudgeRetries})`);
      return 'create_plan';
    }
    logger.warn?.('[judge] Max judge retries reached. Proceeding to aggregate step with partial results.');
    return 'aggregate';
  }

  async function aggregateNode(state) {
    logger.info?.(`[aggregate] Synthesizing output report for ${state.topic}`);

    const sortedCollectedData = [...(state.collectedData || [])].sort((a, b) =>
      String(a.taskId || '').localeCompare(String(b.taskId || ''))
    );

    if (dependencies.aggregator?.aggregate) {
      const summary = await dependencies.aggregator.aggregate({
        topic: state.topic,
        plan: state.plan,
        collectedData: sortedCollectedData,
        judgeResult: state.judgeResult
      });
      return { finalSummary: summary, status: 'aggregated', collectedData: sortedCollectedData };
    }

    const findingsList = sortedCollectedData
      .flatMap(d => d.findings || [])
      .map(f => `- **${f.heading || 'Finding'}**:\n${f.content || ''}`)
      .join('\n');

    const summaryReport = [
      `# Parallel RLM Research Report: ${state.topic}`,
      `**Generated At**: ${new Date().toISOString()}`,
      `**Tasks Executed**: ${sortedCollectedData.length}`,
      `**Judge Score**: ${state.judgeResult?.score ?? 'N/A'}`,
      `\n## Key Findings`,
      findingsList || '_No findings generated._',
      `\n## Execution Status`,
      `Research finished with judge status: ${state.judgeResult?.passed ? 'PASSED' : 'COMPLETED_WITH_WARNINGS'}.`
    ].join('\n');

    return {
      finalSummary: summaryReport,
      status: 'aggregated',
      collectedData: sortedCollectedData
    };
  }

  async function finishNode(state) {
    logger.info?.(`[finish] Completing Research Graph execution for ${state.topic}`);
    return {
      status: 'completed',
      completedAt: new Date().toISOString()
    };
  }

  const builder = new StateGraph(ResearchAnnotation)
    .addNode('create_plan', createPlanNode)
    .addNode('validate_plan', validatePlanNode)
    .addNode('dispatch_workers', dispatchWorkersNode)
    .addNode('worker', workerNode)
    .addNode('collect_results', collectResultsNode)
    .addNode('judge', judgeNode)
    .addNode('aggregate', aggregateNode)
    .addNode('finish', finishNode)
    .addEdge(START, 'create_plan')
    .addEdge('create_plan', 'validate_plan')
    .addConditionalEdges('validate_plan', routeAfterValidation, ['dispatch_workers', 'create_plan', 'finish'])
    .addConditionalEdges('dispatch_workers', dispatchWorkersFanOut, ['worker', 'finish'])
    .addEdge('worker', 'collect_results')
    .addEdge('collect_results', 'judge')
    .addConditionalEdges('judge', routeAfterJudge, ['aggregate', 'create_plan'])
    .addEdge('aggregate', 'finish')
    .addEdge('finish', END);

  return builder.compile({ checkpointer });
}