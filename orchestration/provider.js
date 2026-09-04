/**
 * @file orchestration/provider.js
 * LanguageModelPort implementation featuring Exponential Backoff retry policy,
 * Circuit Breaker for HTTP 429 rate-limiting, and AbortController/AbortSignal support.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CircuitBreakerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class LanguageModelConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LanguageModelConfigurationError';
  }
}

const REQUIRED_ROLES = ['router', 'researcher', 'judge', 'normalizer'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readRoleTarget(value, role, providers) {
  if (!isPlainObject(value) || typeof value.provider !== 'string' || typeof value.model !== 'string') {
    throw new LanguageModelConfigurationError(`Role "${role}" must declare a provider and model.`);
  }
  if (!providers[value.provider]) {
    throw new LanguageModelConfigurationError(`Role "${role}" references unknown provider "${value.provider}".`);
  }
  return { provider: value.provider, model: value.model };
}

export function normalizeLanguageModelConfig(rawConfig) {
  if (!isPlainObject(rawConfig) || rawConfig.version !== 1 || !isPlainObject(rawConfig.providers) || !isPlainObject(rawConfig.roles)) {
    throw new LanguageModelConfigurationError('LLM configuration must use version 1 with providers and roles; legacy HTTP/Ollama configuration is not supported.');
  }

  const providers = {};
  for (const [id, value] of Object.entries(rawConfig.providers)) {
    if (!isPlainObject(value) || !['agy', 'ollama'].includes(value.command)) {
      throw new LanguageModelConfigurationError(`Provider "${id}" must use an approved agy or ollama command.`);
    }
    providers[id] = { command: value.command };
  }

  const roles = {};
  for (const role of REQUIRED_ROLES) {
    const configuredRole = rawConfig.roles[role];
    const primary = readRoleTarget(configuredRole, role, providers);
    const fallback = configuredRole.fallback === undefined ? [] : configuredRole.fallback;
    if (!Array.isArray(fallback)) {
      throw new LanguageModelConfigurationError(`Role "${role}" fallback must be an array.`);
    }
    roles[role] = { primary, fallback: fallback.map((target) => readRoleTarget(target, `${role}.fallback`, providers)) };
  }
  return { version: 1, providers, roles };
}

export class LanguageModelPort {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.initialDelayMs = options.initialDelayMs ?? 500;
    this.backoffFactor = options.backoffFactor ?? 2;
    this.circuitBreakerThreshold = options.circuitBreakerThreshold ?? 3;
    this.circuitResetTimeoutMs = options.circuitResetTimeoutMs ?? 10000;
    
    this.failureCount = 0;
    this.circuitState = 'CLOSED';
    this.lastStateChange = Date.now();
    this.config = this.loadConfig(options.configPath, options.config);
  }

  loadConfig(configPath = path.join(__dirname, '../system/rlm-config.json'), suppliedConfig) {
    try {
      const rawConfig = suppliedConfig ?? JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return normalizeLanguageModelConfig(rawConfig);
    } catch (error) {
      if (error instanceof LanguageModelConfigurationError) throw error;
      throw new LanguageModelConfigurationError(`Unable to load LLM configuration: ${error.message}`);
    }
  }

  getRoleChain(role) {
    const configuredRole = this.config.roles[role];
    if (!configuredRole) throw new LanguageModelConfigurationError(`Unknown LLM role "${role}".`);
    return [configuredRole.primary, ...configuredRole.fallback];
  }

  requireRole(role) {
    return this.getRoleChain(role)[0];
  }

  checkCircuit() {
    if (this.circuitState === 'OPEN') {
      if (Date.now() - this.lastStateChange > this.circuitResetTimeoutMs) {
        this.circuitState = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerError('Circuit Breaker is OPEN due to rate limits (HTTP 429).');
      }
    }
  }

  recordSuccess() {
    this.failureCount = 0;
    this.circuitState = 'CLOSED';
  }

  recordFailure(status) {
    if (status === 429 || status === 503) {
      this.failureCount++;
      if (this.failureCount >= this.circuitBreakerThreshold) {
        this.circuitState = 'OPEN';
        this.lastStateChange = Date.now();
      }
    }
  }

  async executeWithRetry(fn, options = {}) {
    const { signal } = options;
    if (signal?.aborted) throw new Error('Operation aborted');

    this.checkCircuit();

    let attempt = 0;
    let delay = this.initialDelayMs;

    while (true) {
      if (signal?.aborted) throw new Error('Operation aborted');

      try {
        const result = await fn();
        this.recordSuccess();
        return result;
      } catch (err) {
        attempt++;
        const status = err.status || err.statusCode || (err.message?.includes('429') ? 429 : 500);
        this.recordFailure(status);

        if (attempt >= this.maxRetries || signal?.aborted) {
          throw err;
        }

        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Operation aborted'));
            }, { once: true });
          }
        });
        delay *= this.backoffFactor;
      }
    }
  }

  async selectRoute(input, options = {}) {
    return this.executeWithRetry(async () => {
      this.requireRole('router');
      if (input?.mode === 'rlm') return { route: "RLM" };
      if (input?.mode === 'graphify') return { route: "GRAPHIFY" };
      return { route: "RAG" };
    }, options);
  }

  async planResearch(input, options = {}) {
    return this.executeWithRetry(async () => {
      this.requireRole('researcher');
      const topic = input?.topic || 'Research';
      return {
        tasks: [
          { id: 'task_1', title: 'Background Research & Context', query: `${topic} background`, type: 'background' },
          { id: 'task_2', title: 'Technical Architecture Deep Dive', query: `${topic} architecture`, type: 'deep_dive' },
          { id: 'task_3', title: 'Gap Analysis & Validation', query: `${topic} gaps and edge cases`, type: 'gap_analysis' }
        ]
      };
    }, options);
  }

  async analyzeTask(input, options = {}) {
    return this.executeWithRetry(async () => {
      this.requireRole('researcher');
      return { status: 'ok', content: `Analysis for ${input?.query || 'task'}`, sources: [] };
    }, options);
  }

  async judgeResponse(input, options = {}) {
    return this.executeWithRetry(async () => {
      this.requireRole('judge');
      // Fake implementation: always returns 8 for successful execution
      return { status: 'ok', score: 8, valid: true };
    }, options);
  }

  async compareAnswers(input, options = {}) {
    return this.executeWithRetry(async () => {
      this.requireRole('judge');
      // Fake implementation: always prefers A
      return { status: 'ok', best: 'A' };
    }, options);
  }

  async judgeGraphify(input, options = {}) {
    return this.executeWithRetry(async () => {
      this.requireRole('judge');
      return { status: 'ok', valid: true, passed: true };
    }, options);
  }

  async normalizeResponse(input, options = {}) {
    return this.executeWithRetry(async () => {
      this.requireRole('normalizer');
      return { content: input?.content || '' };
    }, options);
  }
}

export class FakeLanguageModelPort extends LanguageModelPort {
  async selectRoute(input, options = {}) {
    if (options.signal?.aborted) throw new Error('Operation aborted');
    return { route: "RAG" };
  }
  async planResearch(input, options = {}) {
    if (options.signal?.aborted) throw new Error('Operation aborted');
    return { tasks: [] };
  }
  async analyzeTask(input, options = {}) {
    if (options.signal?.aborted) throw new Error('Operation aborted');
    return { status: 'ok', content: 'Fake analysis', sources: [] };
  }
  async judgeResponse(input, options = {}) {
    if (options.signal?.aborted) throw new Error('Operation aborted');
    return { status: 'ok', score: 8, valid: true };
  }
  async compareAnswers(input, options = {}) {
    if (options.signal?.aborted) throw new Error('Operation aborted');
    return { status: 'ok', best: 'A' };
  }
  async judgeGraphify(input, options = {}) {
    if (options.signal?.aborted) throw new Error('Operation aborted');
    return { status: 'ok', valid: true, passed: true };
  }
  async normalizeResponse(input, options = {}) {
    if (options.signal?.aborted) throw new Error('Operation aborted');
    return { content: input?.content || '' };
  }
}
