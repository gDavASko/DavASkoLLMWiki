import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { documentId } from '../lib/document-identity.js';
import { loadEmptyDocumentCache, writeEmptyDocumentCache } from '../lib/empty-document-cache.js';

test('raw source never inherits a wiki frontmatter ID', () => {
  const raw = documentId({
    sourceType: 'raw',
    layer: 'llm-wiki',
    relPath: 'llm-wiki/raw/research/note.md',
    basename: 'note',
    metaId: 'note',
    wikiBasenameCount: 1,
    rawBasenameCount: 1,
  });
  const wiki = documentId({
    sourceType: 'wiki',
    layer: 'llm-wiki',
    relPath: 'llm-wiki/wiki/sources/note.md',
    basename: 'note',
    metaId: 'note',
    wikiBasenameCount: 1,
    rawBasenameCount: 0,
  });

  assert.equal(raw, 'raw-llm-wiki-research/note');
  assert.equal(wiki, 'note');
  assert.notEqual(raw, wiki);
});

test('legacy raw ID is retained when its basename is unambiguous', () => {
  assert.equal(documentId({
    sourceType: 'raw', layer: 'gdd', relPath: 'gdd/raw/overview.md', basename: 'overview',
    metaId: '', wikiBasenameCount: 0, rawBasenameCount: 1,
  }), 'raw-gdd-overview');
});

test('empty document MD5 cache survives an atomic write', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kbpro-empty-cache-'));
  const cacheFile = path.join(directory, 'empty-document-cache.json');
  try {
    writeEmptyDocumentCache(cacheFile, { 'raw-llm-wiki-empty': 'abc123' });
    assert.deepEqual(loadEmptyDocumentCache(cacheFile), { 'raw-llm-wiki-empty': 'abc123' });
    // A second run reads the same value and republishes it unchanged.
    writeEmptyDocumentCache(cacheFile, loadEmptyDocumentCache(cacheFile));
    assert.deepEqual(loadEmptyDocumentCache(cacheFile), { 'raw-llm-wiki-empty': 'abc123' });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
