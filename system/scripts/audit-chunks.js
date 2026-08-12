#!/usr/bin/env node
/**
 * Read-only audit of the effective Markdown chunking profile.
 * Usage: node system/scripts/audit-chunks.js [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chunkMarkdownDetailed } from '../lib/chunker.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const configPath = path.join(rootDir, 'system', 'index-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
const excludedNames = new Set(['index', 'stubs', 'contradictions', 'stale-documents', 'readme', 'changelog']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(fullPath);
  }
  return out;
}

function withoutFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

const layers = fs.readdirSync(rootDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(rootDir, entry.name, 'wiki.json')))
  .map((entry) => entry.name);
const files = [];
for (const layer of layers) {
  for (const sourceType of ['wiki', 'raw']) {
    const directory = path.join(rootDir, layer, sourceType);
    if (!fs.existsSync(directory)) continue;
    for (const filePath of walk(directory)) {
      if (excludedNames.has(path.basename(filePath, '.md').toLowerCase())) continue;
      if (sourceType === 'raw' && config.max_raw_file_bytes > 0 && fs.statSync(filePath).size > config.max_raw_file_bytes) continue;
      files.push({ filePath, layer, sourceType });
    }
  }
}

const bySource = { wiki: { documents: 0, chunks: 0 }, raw: { documents: 0, chunks: 0 } };
let totalChunks = 0;
let oneChunkDocuments = 0;
let forcedChunks = 0;
let overlappedChunks = 0;
let oversizedAtomicChunks = 0;
const largest = [];
for (const file of files) {
  const text = withoutFrontmatter(fs.readFileSync(file.filePath, 'utf8'));
  const chunks = chunkMarkdownDetailed(text, {
    targetWords: config.chunk_size_words,
    minWords: config.chunk_min_words,
    maxWords: config.chunk_max_words,
    overlapWords: config.chunk_overlap_words,
    keepCodeAtomic: config.keep_code_atomic,
    headingBreadcrumbs: config.heading_breadcrumbs,
  });
  const words = text.split(/\s+/).filter(Boolean).length;
  bySource[file.sourceType].documents += 1;
  bySource[file.sourceType].chunks += chunks.length;
  totalChunks += chunks.length;
  if (chunks.length === 1) oneChunkDocuments += 1;
  forcedChunks += chunks.filter((chunk) => chunk.boundary === 'forced').length;
  overlappedChunks += chunks.filter((chunk) => chunk.overlapWords > 0).length;
  oversizedAtomicChunks += chunks.filter((chunk) => chunk.contentWords > config.chunk_max_words && chunk.boundary === 'semantic').length;
  largest.push({ words, chunks: chunks.length, path: path.relative(rootDir, file.filePath).replaceAll('\\', '/') });
}
largest.sort((a, b) => b.words - a.words);
const report = {
  profile: {
    strategy: config.chunk_strategy,
    targetWords: config.chunk_size_words,
    minWords: config.chunk_min_words,
    maxWords: config.chunk_max_words,
    overlapWords: config.chunk_overlap_words,
  },
  documents: files.length,
  chunks: totalChunks,
  averageChunksPerDocument: Number((totalChunks / Math.max(files.length, 1)).toFixed(2)),
  oneChunkDocuments,
  oneChunkDocumentPercent: Number((oneChunkDocuments / Math.max(files.length, 1) * 100).toFixed(1)),
  forcedChunks,
  overlappedChunks,
  oversizedAtomicChunks,
  bySource,
  largestDocuments: largest.slice(0, 10),
};

if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Документов: ${report.documents}; чанков: ${report.chunks}; среднее: ${report.averageChunksPerDocument}`);
  console.log(`Один чанк: ${report.oneChunkDocuments} (${report.oneChunkDocumentPercent}%); overlap: ${report.overlappedChunks}; forced: ${report.forcedChunks}`);
  console.log(`Wiki: ${bySource.wiki.documents} док. / ${bySource.wiki.chunks} чанков; raw: ${bySource.raw.documents} док. / ${bySource.raw.chunks} чанков`);
  console.log(`Атомарных чанков > max: ${oversizedAtomicChunks}`);
}
