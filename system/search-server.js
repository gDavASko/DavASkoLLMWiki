#!/usr/bin/env node
/**
 * search-server.js — резидентный сервер поиска по базе знаний.
 *
 * Зачем: раньше на КАЖДЫЙ запрос порождался новый Node-процесс, который заново
 * загружал vectordb, ONNX-рантайм, LangGraph, SQLite-checkpointer и две модели.
 * Замер показал, что полезной работы в этом было 0.3 с, а стартовых издержек —
 * около 8 с. Резидентный сервер платит эту цену один раз при старте.
 *
 * Изоляция сохраняется: это по-прежнему отдельный процесс, падение которого не
 * роняет основной контур бота (см. AGENTS.md). Клиент умеет его перезапускать и
 * при необходимости откатываться на разовый запуск воркера.
 *
 * Протокол — NDJSON (одна JSON-строка на сообщение) через stdin/stdout:
 *   → {"id":"1","query":"...","locations":["..."],"topK":25}
 *   ← {"id":"1","ok":true,"content":"...","sources":["..."],"retrieval":{...}}
 *   ← {"id":"1","ok":false,"error":"..."}
 * Служебные сообщения сервера: {"event":"ready"} / {"event":"warm"}.
 * Диагностика идёт в stderr и не мешает разбору протокола.
 */

import { createInterface } from 'node:readline';
import { createQuerySupervisorGraph } from '../orchestration/graphs/query-supervisor.js';
import { LanguageModelPort } from '../orchestration/provider.js';
import { loadLanceIndex, initModel } from './query-wiki.js';
import { initReranker } from './lib/retrieval.js';

// stdout — это канал протокола, и посторонний вывод его ломает. Движок поиска
// пишет отладку через console.log ("[Search Debug] ..."), поэтому весь
// консольный вывод перенаправляем в stderr; протокольные сообщения пишутся
// напрямую через process.stdout.write.
const forwardToStderr = (...args) => process.stderr.write(args.map(String).join(" ") + "\n");
console.log = forwardToStderr;
console.info = forwardToStderr;
console.debug = forwardToStderr;

const MAX_CONTEXT_BYTES = 120_000;

const provider = new LanguageModelPort();
const graph = createQuerySupervisorGraph({ provider });

function send(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

/**
 * Прогрев: загружаем индекс и обе модели заранее, чтобы первый пользовательский
 * запрос не платил стартовую цену. Ошибка прогрева не фатальна — модели будут
 * загружены лениво при первом запросе.
 */
async function warmUp() {
  const started = Date.now();
  try {
    await loadLanceIndex(false);
    await initModel();
    await initReranker({ device: 'cpu' });
    send({ event: 'warm', ms: Date.now() - started });
  } catch (error) {
    process.stderr.write(`[search-server] прогрев не удался: ${String(error).slice(0, 300)}\n`);
    send({ event: 'warm', ms: Date.now() - started, error: String(error).slice(0, 300) });
  }
}

/**
 * Запросы обслуживаются строго по одному: поиск упирается в CPU (эмбеддинги и
 * кросс-энкодер), и параллельный запуск только замедлил бы обоих клиентов.
 */
let queue = Promise.resolve();

function handle(message) {
  queue = queue.then(async () => {
    const { id, query, locations, topK } = message;
    if (!id) return;
    if (typeof query !== 'string' || !query.trim()) {
      send({ id, ok: false, error: 'Пустой запрос' });
      return;
    }
    const request = {
      query: query.trim().slice(0, 4_000),
      mode: 'rag',
      output: 'stdout',
      locations: Array.isArray(locations) ? locations : [],
      limits: {
        maxWorkers: 5,
        maxConcurrency: 2,
        maxIterations: 3,
        maxToolOutputBytes: MAX_CONTEXT_BYTES,
        ...(Number.isInteger(topK) && topK > 0 ? { topK } : {}),
      },
    };
    try {
      const finalState = await graph.invoke({ request }, { configurable: { thread_id: `corr_${id}_${Date.now()}` } });
      const response = finalState.response;
      // Провал поиска отличается от «ничего не нашлось» — ровно как в разовом
      // воркере, где это выражалось ненулевым кодом возврата.
      if (response?.status && response.status !== 'ok') {
        send({ id, ok: false, error: `статус "${response.status}": ${String(response.content).slice(0, 500)}` });
        return;
      }
      send({
        id,
        ok: true,
        content: String(response?.content ?? ''),
        sources: Array.isArray(response?.sources) ? response.sources : [],
        ...(response?.retrieval ? { retrieval: response.retrieval } : {}),
      });
    } catch (error) {
      send({ id, ok: false, error: String(error?.message ?? error).slice(0, 500) });
    }
  }).catch((error) => {
    process.stderr.write(`[search-server] сбой очереди: ${String(error).slice(0, 300)}\n`);
  });
}

const reader = createInterface({ input: process.stdin });
reader.on('line', (line) => {
  const text = line.trim();
  if (!text) return;
  let message;
  try { message = JSON.parse(text); }
  catch { process.stderr.write('[search-server] получена строка, не являющаяся JSON\n'); return; }
  if (message?.event === 'shutdown') { reader.close(); process.exit(0); }
  handle(message);
});
reader.on('close', () => process.exit(0));

send({ event: 'ready', pid: process.pid });
warmUp();
