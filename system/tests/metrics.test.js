// Юнит-тесты метрик ранжирования. Запуск: node --test system/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { recallAtK, mrr, ndcgAtK } from '../lib/metrics.js';

const approx = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const S = (...ids) => new Set(ids);

test('recallAtK: доля релевантных в top-k', () => {
  const rel = S('a', 'b');
  assert.ok(approx(recallAtK(['a', 'c', 'b', 'd'], rel, 2), 0.5)); // только a в top-2
  assert.ok(approx(recallAtK(['a', 'c', 'b', 'd'], rel, 4), 1.0)); // a и b в top-4
  assert.equal(recallAtK(['a', 'b'], S(), 5), 0);                  // пустой relevant
});

test('mrr: 1/ранг первого релевантного', () => {
  assert.ok(approx(mrr(['c', 'a', 'b'], S('a', 'b')), 0.5)); // первый релевантный на позиции 2
  assert.ok(approx(mrr(['a'], S('a')), 1.0));
  assert.equal(mrr(['c', 'd'], S('a')), 0); // ни одного
});

test('ndcgAtK: идеальное ранжирование = 1.0', () => {
  assert.ok(approx(ndcgAtK(['a', 'b', 'c'], S('a', 'b'), 2), 1.0));
});

test('ndcgAtK: релевантные ниже → меньше 1 (известное значение)', () => {
  // ranked=[c,a,b], rel={a,b}, k=3
  // dcg = 1/log2(3) + 1/log2(4) = 0.63093 + 0.5 = 1.13093
  // idcg = 1/log2(2) + 1/log2(3) = 1 + 0.63093 = 1.63093
  const v = ndcgAtK(['c', 'a', 'b'], S('a', 'b'), 3);
  assert.ok(approx(v, 1.13093 / 1.63093, 1e-4), `got ${v}`);
});

test('ndcgAtK: пустой relevant → 0', () => {
  assert.equal(ndcgAtK(['a'], S(), 5), 0);
});
