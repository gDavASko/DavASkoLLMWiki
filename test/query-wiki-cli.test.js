import test from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { parseArgs, runGraphifyAdapter } from '../system/query-wiki.js';

test('CLI: parseArgs correctly extracts parameters', () => {
    const args1 = parseArgs(['--query', 'test_query']);
    assert.strictEqual(args1.query, 'test_query');
    assert.strictEqual(args1.toStdout, false);
    assert.strictEqual(args1.rlm, false);
    assert.strictEqual(args1.auto, false);

    const args2 = parseArgs(['--query', 'complex test', '--stdout', '--rlm', '--auto', '--out', 'out.md']);
    assert.strictEqual(args2.query, 'complex test');
    assert.strictEqual(args2.toStdout, true);
    assert.strictEqual(args2.rlm, true);
    assert.strictEqual(args2.auto, true);
    assert.strictEqual(args2.outPath, 'out.md');
});

test('CLI: Graphify fallback when CLI is missing', () => {
    // Attempting to run a query that invokes graphify adapter
    const success = runGraphifyAdapter('some test query', 'dummy.md', false, 'dummy.md');
    // We expect it to fail gracefully and return false because graphify binary is not in PATH or we just let it catch error
    assert.strictEqual(success, false);
});

import { createQuerySupervisorGraph } from '../orchestration/graphs/query-supervisor.js';
import { FakeLanguageModelPort } from '../orchestration/provider.js';

test('Supervisor Graph: Route Allowlist and Auto mode', async () => {
    const provider = new FakeLanguageModelPort();
    const graph = createQuerySupervisorGraph({ provider });
    
    const request = {
        query: 'test',
        mode: 'auto',
        output: 'stdout',
        limits: { maxWorkers: 5, maxConcurrency: 2, maxIterations: 3, maxToolOutputBytes: 120000 }
    };
    
    const state = await graph.invoke({ request }, { configurable: { thread_id: 'test-auto' } });
    assert.strictEqual(state.route, 'RAG');
    assert.strictEqual(state.trace.some(t => t.node === 'select_route'), true);
});

test('Supervisor Graph: RLM mode skips router', async () => {
    const provider = new FakeLanguageModelPort();
    const graph = createQuerySupervisorGraph({ provider });
    
    const request = {
        query: 'test',
        mode: 'rlm',
        output: 'stdout',
        limits: { maxWorkers: 5, maxConcurrency: 2, maxIterations: 3, maxToolOutputBytes: 120000 }
    };
    
    const state = await graph.invoke({ request }, { configurable: { thread_id: 'test-rlm' } });
    assert.strictEqual(state.route, 'RLM');
});

test('Supervisor Graph: Graphify fallback to RAG on failure', async () => {
    const provider = new FakeLanguageModelPort();
    provider.selectRoute = async () => ({ route: 'GRAPHIFY' });
    const graph = createQuerySupervisorGraph({ provider });
    
    const request = {
        query: 'test',
        mode: 'auto',
        output: 'stdout',
        limits: { maxWorkers: 5, maxConcurrency: 2, maxIterations: 3, maxToolOutputBytes: 120000 }
    };
    
    const state = await graph.invoke({ request }, { configurable: { thread_id: 'test-fallback' } });
    assert.strictEqual(state.trace.some(t => t.node === 'execute_graphify' && t.status === 'failed'), true);
    assert.strictEqual(state.trace.some(t => t.node === 'execute_rag'), true);
    assert.strictEqual(state.route, 'RAG_FALLBACK');
});
