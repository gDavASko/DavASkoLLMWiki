// Юнит-тесты ядра поиска (без модели). Запуск: node --test system/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { cosineSimilarity, selectProbeClusters, applyThreshold, scoreSymbolMatches } from '../lib/retrieval.js';

const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('cosineSimilarity: тождественные/ортогональные/противоположные/нулевые', () => {
  assert.ok(approx(cosineSimilarity([1, 0], [1, 0]), 1));
  assert.ok(approx(cosineSimilarity([1, 0], [0, 1]), 0));
  assert.ok(approx(cosineSimilarity([1, 0], [-1, 0]), -1));
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);        // защита от деления на 0
  assert.ok(approx(cosineSimilarity([2, 0], [3, 0]), 1));   // инвариант к масштабу
});

test('cosineSimilarity: разная длина → по min', () => {
  assert.ok(approx(cosineSimilarity([1, 0, 9], [1, 0]), 1)); // лишняя размерность игнорируется
});

test('selectProbeClusters: nprobe>=N или <=0 → исчерпывающий', () => {
  const c = { A: [1, 0], B: [0, 1], C: [1, 1] };
  assert.deepEqual(selectProbeClusters([1, 0], c, 3).exhaustive, true);
  assert.deepEqual(selectProbeClusters([1, 0], c, 99).clusters.sort(), ['A', 'B', 'C']);
  assert.deepEqual(selectProbeClusters([1, 0], c, 0).exhaustive, true);
  assert.deepEqual(selectProbeClusters([1, 0], c, -5).exhaustive, true);
});

test('selectProbeClusters: nprobe<N → ближайшие по центроиду', () => {
  const c = { A: [1, 0], B: [0, 1], C: [1, 1], D: [-1, 0] };
  const { clusters, exhaustive } = selectProbeClusters([0.9, 0.1], c, 2);
  assert.equal(exhaustive, false);
  assert.equal(clusters.length, 2);
  assert.deepEqual(clusters, ['A', 'C']); // ближайшие к [0.9,0.1]
});

test('applyThreshold: absolute фильтрует по порогу', () => {
  const scores = [['a', 0.82], ['b', 0.74], ['c', 0.40]];
  const { best, tau, mode } = applyThreshold(scores, { threshold_mode: 'absolute', similarity_threshold: 0.70 });
  assert.equal(mode, 'absolute');
  assert.equal(tau, 0.70);
  assert.deepEqual([...best.keys()].sort(), ['a', 'b']);
});

test('applyThreshold: absolute fallback при пустом результате', () => {
  const scores = [['a', 0.66], ['b', 0.60]];
  const { best, usedFallback } = applyThreshold(scores, {
    threshold_mode: 'absolute', similarity_threshold: 0.70, similarity_fallback: 0.65,
  });
  assert.equal(usedFallback, true);
  assert.deepEqual([...best.keys()], ['a']); // 0.66 >= 0.65, 0.60 нет
});

test('applyThreshold: relative tau = max(floor, alpha*top)', () => {
  const scores = [['a', 0.82], ['b', 0.74], ['c', 0.40]];
  const { best, tau } = applyThreshold(scores, { threshold_mode: 'relative', relative_alpha: 0.85, junk_floor: 0.35 });
  assert.ok(approx(tau, 0.85 * 0.82, 1e-9)); // 0.697
  assert.deepEqual([...best.keys()].sort(), ['a', 'b']); // c (0.40) ниже 0.697
});

test('applyThreshold: relative junk_floor отсекает при низкой уверенности', () => {
  const scores = [['x', 0.40], ['y', 0.20]];
  const { best, tau } = applyThreshold(scores, { threshold_mode: 'relative', relative_alpha: 0.85, junk_floor: 0.35 });
  assert.ok(approx(tau, 0.35)); // max(0.35, 0.85*0.40=0.34) = 0.35
  assert.deepEqual([...best.keys()], ['x']); // y (0.20) < 0.35
});

test('applyThreshold: дедуп — лучший score на id; принимает {fileId,score}', () => {
  const scores = [{ fileId: 'a', score: 0.71 }, { fileId: 'a', score: 0.90 }];
  const { best } = applyThreshold(scores, { threshold_mode: 'absolute', similarity_threshold: 0.70 });
  assert.equal(best.get('a'), 0.90);
});

test('scoreSymbolMatches: вес по типу совпадения (id > symbols > tags)', () => {
  const docs = {
    EventBus: { symbols: [], tags: [] },                 // совпадение по id → 1.0
    Handler:  { symbols: ['EventBus'], tags: [] },        // по symbols → 0.9
    Notes:    { symbols: [], tags: ['EventBus'] },        // по tags → 0.7
  };
  const m = scoreSymbolMatches(['EventBus'], docs);
  // df одинаков для всех трёх (=3), поэтому решает ВЕС по типу совпадения:
  // id (1.0) > symbols (0.9) > tags (0.7).
  assert.ok(m.get('EventBus') > m.get('Handler'));
  assert.ok(m.get('Handler') > m.get('Notes'));
});

test('scoreSymbolMatches: mini-IDF понижает частый символ', () => {
  // 'Common' встречается в 4 доках, 'Rare' — в 1. Rare должен котироваться выше.
  const docs = {
    A: { symbols: ['Common'] }, B: { symbols: ['Common'] },
    C: { symbols: ['Common'] }, D: { symbols: ['Common'] },
    R: { symbols: ['Rare'] },
  };
  const m = scoreSymbolMatches(['Common', 'Rare'], docs);
  assert.ok(m.get('R') > m.get('A'), 'редкий символ выше частого');
});

test('scoreSymbolMatches: лимит капит число результатов', () => {
  const docs = {};
  for (let i = 0; i < 20; i++) docs['T' + i] = { tags: ['Widget'] };
  const m = scoreSymbolMatches(['Widget'], docs, { limit: 5 });
  assert.equal(m.size, 5);
});

test('scoreSymbolMatches: пустые символы → пустой результат', () => {
  assert.equal(scoreSymbolMatches([], { A: { symbols: ['X'] } }).size, 0);
});
