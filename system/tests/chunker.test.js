// Юнит-тесты структурного чанкинга. Запуск: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkMarkdown, chunkMarkdownDetailed } from '../lib/chunker.js';

const words = (s) => s.split(/\s+/).filter(Boolean).length;
const W = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

test('пустой вход → пустой список', () => {
  assert.deepEqual(chunkMarkdown(''), []);
  assert.deepEqual(chunkMarkdown('   \n  '), []);
});

test('пакует абзацы до целевого размера, не превышая max', () => {
  const md = [W(100), W(100), W(100), W(100)].join('\n\n'); // 4 абзаца по 100
  const chunks = chunkMarkdown(md, { targetWords: 150, minWords: 50, maxWords: 250, headingBreadcrumbs: false, overlapWords: 0 });
  assert.ok(chunks.length >= 2);
  for (const c of chunks) assert.ok(words(c) <= 250, `chunk ${words(c)} > max`);
});

test('блок кода остаётся атомарным (не рвётся)', () => {
  const md = [
    '# Title',
    'Intro paragraph here.',
    '```js',
    'function f(){',
    '  return SubscribeToChannel();',
    '}',
    '```',
    'After paragraph.',
  ].join('\n');
  const chunks = chunkMarkdown(md, { targetWords: 5, minWords: 1, maxWords: 100, keepCodeAtomic: true, overlapWords: 0 });
  // код целиком в одном чанке — ищем чанк, содержащий и открытие, и закрытие функции
  const codeChunk = chunks.find(c => c.includes('function f(){') && c.includes('SubscribeToChannel'));
  assert.ok(codeChunk, 'код должен остаться в одном чанке');
});

test('огромный абзац хард-сплитится по словам (соблюдает max)', () => {
  const md = W(1000); // один абзац 1000 слов
  const chunks = chunkMarkdown(md, { targetWords: 250, minWords: 50, maxWords: 300, headingBreadcrumbs: false, overlapWords: 0 });
  assert.ok(chunks.length >= 4);
  for (const c of chunks) assert.ok(words(c) <= 300);
});

test('короткие смысловые секции не склеиваются через заголовок', () => {
  const md = ['# A', W(30), '# B', W(30), '# C', W(30)].join('\n\n');
  const chunks = chunkMarkdown(md, { targetWords: 200, minWords: 50, maxWords: 300, headingBreadcrumbs: false, overlapWords: 0 });
  assert.equal(chunks.length, 3);
});

test('хлебные крошки заголовков добавляются', () => {
  const md = ['# Event Bus', '## Subscription', W(120)].join('\n\n');
  const chunks = chunkMarkdown(md, { targetWords: 80, minWords: 10, maxWords: 200, headingBreadcrumbs: true });
  assert.ok(chunks[0].startsWith('[Event Bus > Subscription]'), `got: ${chunks[0].slice(0, 40)}`);
});

test('крошки можно отключить', () => {
  const md = ['# H', W(50)].join('\n\n');
  const chunks = chunkMarkdown(md, { minWords: 1, headingBreadcrumbs: false });
  assert.ok(!chunks[0].startsWith('['));
});

test('overlap добавляется только на вынужденной границе внутри длинного абзаца', () => {
  const chunks = chunkMarkdownDetailed(W(700), { targetWords: 200, minWords: 45, maxWords: 300, overlapWords: 32, headingBreadcrumbs: false });
  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0].overlapWords, 0);
  assert.ok(chunks.slice(1).every((chunk) => chunk.overlapWords === 32 && chunk.boundary === 'forced'));
  assert.ok(chunks.slice(1).every((chunk) => chunk.text.startsWith('[Продолжение предыдущего фрагмента]')));
});

test('таблица и список остаются атомарными и получают секционный parent', () => {
  const md = ['# Характеристики', '| Поле | Значение |', '| --- | --- |', '| A | B |', '', '## Правила', '- Первое правило', '- Второе правило'].join('\n');
  const chunks = chunkMarkdownDetailed(md, { targetWords: 5, minWords: 1, maxWords: 8 });
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].sectionPath, 'Характеристики');
  assert.match(chunks[0].text, /\| Поле \| Значение \|/);
  assert.equal(chunks[1].sectionPath, 'Характеристики > Правила');
  assert.match(chunks[1].text, /Первое правило[\s\S]*Второе правило/);
});
