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

test('overlap добавляется на каждой границе чанков, включая семантическую', () => {
  const chunks = chunkMarkdownDetailed([W(120), W(120), W(120), W(120), W(120), W(120)].join('\n\n'), { targetWords: 200, minWords: 45, maxWords: 300, overlapWords: 32, headingBreadcrumbs: false });
  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0].overlapWords, 0);
  assert.ok(chunks.slice(1).every((chunk) => chunk.overlapWords === 32));
  assert.ok(chunks.slice(1).every((chunk) => chunk.text.startsWith('[Контекст предыдущего фрагмента]')));
});

test('forward-overlap приписывает голову следующего фрагмента (кроме последнего)', () => {
  const chunks = chunkMarkdownDetailed([W(120), W(120), W(120)].join('\n\n'), {
    targetWords: 100, minWords: 20, maxWords: 150, overlapWords: 0, forwardOverlapWords: 16, headingBreadcrumbs: false,
  });
  assert.ok(chunks.length >= 2, `ожидалось >=2 чанка, получено ${chunks.length}`);
  // Все, кроме последнего, содержат метку контекста следующего фрагмента.
  for (const c of chunks.slice(0, -1)) {
    assert.ok(c.text.includes('[Контекст следующего фрагмента]'), 'нет forward-метки');
    assert.ok(c.forwardWords > 0, 'forwardWords не проставлен');
  }
  // Последний чанк forward-контекста не имеет.
  assert.ok(!chunks.at(-1).text.includes('[Контекст следующего фрагмента]'));
  assert.equal(chunks.at(-1).forwardWords, 0);
  // Служебное поле _body наружу не отдаётся.
  assert.ok(!('_body' in chunks[0]));
});

test('forwardOverlapWords:0 отключает forward-контекст', () => {
  const chunks = chunkMarkdownDetailed([W(120), W(120)].join('\n\n'), {
    targetWords: 100, minWords: 20, maxWords: 150, overlapWords: 0, forwardOverlapWords: 0, headingBreadcrumbs: false,
  });
  assert.ok(chunks.every((c) => !c.text.includes('[Контекст следующего фрагмента]')));
});

test('крупные таблицы, списки и код остаются в пределах max', () => {
  const list = Array.from({ length: 30 }, (_, i) => `- rule ${i}: ${W(15)}`).join('\n');
  const table = ['| key | value |', '| --- | --- |', ...Array.from({ length: 25 }, (_, i) => `| key-${i} | ${W(12)} |`)].join('\n');
  const code = ['```ts', ...Array.from({ length: 50 }, (_, i) => `const value${i} = createValue(${i});`), '```'].join('\n');
  const chunks = chunkMarkdownDetailed([list, table, code].join('\n\n'), {
    targetWords: 80, minWords: 20, maxWords: 120, overlapWords: 16, headingBreadcrumbs: false,
  });
  assert.ok(chunks.length > 3);
  assert.ok(chunks.every((chunk) => chunk.contentWords <= 120), 'all source content must be bounded');
  assert.ok(chunks.filter((chunk) => chunk.text.includes('const value')).every((chunk) => chunk.text.includes('```ts') && chunk.text.includes('```')));
});

test('таблица и список остаются атомарными и получают секционный parent', () => {
  const md = ['# Характеристики', '| Поле | Значение |', '| --- | --- |', '| A | B |', '', '## Правила', '- Первое правило', '- Второе правило'].join('\n');
  const chunks = chunkMarkdownDetailed(md, { targetWords: 20, minWords: 1, maxWords: 50, overlapWords: 0 });
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].sectionPath, 'Характеристики');
  assert.match(chunks[0].text, /\| Поле \| Значение \|/);
  assert.equal(chunks[1].sectionPath, 'Характеристики > Правила');
  assert.match(chunks[1].text, /Первое правило[\s\S]*Второе правило/);
});
