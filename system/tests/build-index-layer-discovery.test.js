import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const systemDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('индексатор принимает raw-only слой: пустая wiki-папка не передаётся Git', () => {
  const source = fs.readFileSync(path.join(systemDir, 'build-index.js'), 'utf8');
  assert.match(source, /fs\.existsSync\(manifestPath\) && \(hasWiki \|\| hasRaw\)/);
  assert.match(source, /wikiDir: hasWiki \? wikiDir : null/);
  assert.match(source, /layer\.wikiDir \? getFilesRecursively\(layer\.wikiDir/);
});
