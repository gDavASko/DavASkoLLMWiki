// Юнит-тесты парсера/сборщика frontmatter (js-yaml). Запуск: node --test system/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, stringifyFrontmatter, updateFrontmatter } from '../lib/frontmatter.js';

test('parseFrontmatter: нет frontmatter → hasFrontmatter=false', () => {
  const r = parseFrontmatter('# Title\n\nbody');
  assert.equal(r.hasFrontmatter, false);
  assert.deepEqual(r.meta, {});
  assert.equal(r.body, '# Title\n\nbody');
});

test('parseFrontmatter: вложенность (списки, инлайн-массив, карта, двоеточие в строке)', () => {
  const md = [
    '---',
    'title: "Event: Bus"',          // двоеточие внутри строки — ручной парсер ломался
    'symbols:',
    '  - EventBus',
    '  - INetworkMessage',
    'tags: [core, messaging]',       // инлайн-массив
    'source_hashes:',
    '  raw/a.md: abc123',            // вложенная карта
    '---',
    '# Body',
  ].join('\n');
  const { meta, body } = parseFrontmatter(md);
  assert.equal(meta.title, 'Event: Bus');
  assert.deepEqual(meta.symbols, ['EventBus', 'INetworkMessage']);
  assert.deepEqual(meta.tags, ['core', 'messaging']);
  assert.deepEqual(meta.source_hashes, { 'raw/a.md': 'abc123' });
  assert.equal(body.trim(), '# Body');
});

test('parseFrontmatter: снимает BOM перед разбором', () => {
  const md = '﻿---\ntitle: X\n---\nbody';
  const { meta } = parseFrontmatter(md);
  assert.equal(meta.title, 'X');
});

test('parseFrontmatter: битый YAML → error, meta пустой (не throw)', () => {
  const md = '---\ntitle: "unterminated\nother: [a, b\n---\nbody';
  const r = parseFrontmatter(md);
  assert.ok(r.error, 'должен быть текст ошибки');
  assert.deepEqual(r.meta, {});
});

test('stringify→parse: round-trip сохраняет данные и порядок ключей', () => {
  const meta = { title: 'T', type: 'concept', symbols: ['A', 'B'], source_hashes: { 'x.md': 'h1' } };
  const doc = stringifyFrontmatter(meta, '# Body\n');
  const back = parseFrontmatter(doc);
  assert.deepEqual(back.meta, meta);
  assert.equal(back.body.trim(), '# Body');
  assert.deepEqual(Object.keys(back.meta), ['title', 'type', 'symbols', 'source_hashes']);
});

test('updateFrontmatter: мутирует meta, сохраняет BOM и тело', () => {
  const md = '﻿---\ntitle: T\nlast_updated: 2026-01-01\n---\n# Body\n';
  const { content, changed, error } = updateFrontmatter(md, (m) => {
    m.last_updated = '2026-06-23';
    m.source_hashes = { 'a.md': 'deadbeef' };
  });
  assert.equal(error, null);
  assert.equal(changed, true);
  assert.equal(content.charCodeAt(0), 0xFEFF, 'BOM сохранён');
  const { meta, body } = parseFrontmatter(content);
  assert.equal(meta.last_updated, '2026-06-23');
  assert.deepEqual(meta.source_hashes, { 'a.md': 'deadbeef' });
  assert.equal(body.trim(), '# Body');
});

test('updateFrontmatter: нет frontmatter → changed=false', () => {
  const r = updateFrontmatter('plain body', () => {});
  assert.equal(r.changed, false);
});
