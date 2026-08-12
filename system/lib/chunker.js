// Markdown-aware chunking for retrieval. Sections are the semantic parent;
// a word/sentence split is used only when one paragraph is too large.

function countWords(text) {
  return String(text).split(/\s+/).filter(Boolean).length;
}

function tailWords(text, count) {
  return String(text).split(/\s+/).filter(Boolean).slice(-count).join(' ');
}

function splitBySentences(text, maxWords) {
  const normalized = String(text).trim();
  if (countWords(normalized) <= maxWords) return [{ text: normalized, continuation: false, forced: false }];

  // Prefer sentence boundaries. A long sentence falls back to a word boundary,
  // which is the only intentionally non-semantic split in this module.
  const sentences = normalized.match(/[^.!?…]+[.!?…]+(?:\s+|$)|[^.!?…]+$/gu) || [normalized];
  const out = [];
  let current = [];
  let currentWords = 0;
  const flush = () => {
    if (!current.length) return;
    out.push({ text: current.join(' ').trim(), continuation: out.length > 0, forced: true });
    current = [];
    currentWords = 0;
  };

  for (const sentence of sentences) {
    const words = countWords(sentence);
    if (words > maxWords) {
      flush();
      const tokens = sentence.split(/\s+/).filter(Boolean);
      for (let start = 0; start < tokens.length; start += maxWords) {
        out.push({ text: tokens.slice(start, start + maxWords).join(' '), continuation: out.length > 0, forced: true });
      }
      continue;
    }
    if (currentWords > 0 && currentWords + words > maxWords) flush();
    current.push(sentence.trim());
    currentWords += words;
  }
  flush();
  return out;
}

function tokenizeMarkdown(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  const flushParagraph = () => {
    const value = paragraph.join('\n').trim();
    if (value) blocks.push({ type: 'text', text: value });
    paragraph = [];
  };

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const fence = line.match(/^\s*(```|~~~)/);
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const isTable = /^\s*\|.*\|\s*$/.test(line) || /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
    const isListItem = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line);

    if (fence) {
      flushParagraph();
      const marker = fence[1];
      const code = [line];
      index += 1;
      while (index < lines.length && !lines[index].trimStart().startsWith(marker)) code.push(lines[index++]);
      if (index < lines.length) code.push(lines[index++]);
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    if (heading) {
      flushParagraph();
      blocks.push({ type: 'heading', level: heading[1].length, title: heading[2].trim() });
      index += 1;
      continue;
    }
    if (isTable) {
      flushParagraph();
      const table = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) table.push(lines[index++]);
      blocks.push({ type: 'table', text: table.join('\n') });
      continue;
    }
    if (isListItem) {
      flushParagraph();
      const list = [];
      while (index < lines.length && lines[index].trim()) {
        const candidate = lines[index];
        if (!/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(candidate) && !/^\s+\S/.test(candidate)) break;
        list.push(candidate);
        index += 1;
      }
      blocks.push({ type: 'list', text: list.join('\n') });
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      index += 1;
      continue;
    }
    paragraph.push(line);
    index += 1;
  }
  flushParagraph();
  return blocks;
}

function toSections(blocks) {
  const sections = [];
  const stack = [];
  let current = { path: '', index: 0, blocks: [] };
  const close = () => {
    if (current.blocks.length) sections.push(current);
  };

  for (const block of blocks) {
    if (block.type !== 'heading') {
      current.blocks.push(block);
      continue;
    }
    close();
    while (stack.length && stack.at(-1).level >= block.level) stack.pop();
    stack.push({ level: block.level, title: block.title });
    current = { path: stack.map((item) => item.title).join(' > '), index: sections.length, blocks: [] };
  }
  close();
  return sections;
}

/**
 * Returns retrieval chunks plus hierarchy/boundary metadata. The public
 * `chunkMarkdown` compatibility API below returns only strings.
 */
export function chunkMarkdownDetailed(text, {
  targetWords = 200,
  minWords = 45,
  maxWords = 300,
  overlapWords = 32,
  keepCodeAtomic = true,
  headingBreadcrumbs = true,
} = {}) {
  if (!text || !text.trim()) return [];
  if (!(minWords > 0 && minWords <= targetWords && targetWords <= maxWords)) {
    throw new Error('Chunking bounds must satisfy 0 < minWords <= targetWords <= maxWords');
  }

  const output = [];
  for (const section of toSections(tokenizeMarkdown(text))) {
    let current = [];
    let currentWords = 0;
    let continuationPrefix = '';
    let continuationWords = 0;
    let pendingForcedBoundary = false;

    const flush = () => {
      if (!current.length) return;
      const body = current.join('\n\n').trim();
      const withOverlap = continuationPrefix ? `[Продолжение предыдущего фрагмента]\n${continuationPrefix}\n\n${body}` : body;
      const textWithBreadcrumb = headingBreadcrumbs && section.path ? `[${section.path}]\n\n${withOverlap}` : withOverlap;
      output.push({
        text: textWithBreadcrumb,
        sectionPath: section.path,
        sectionIndex: section.index,
        contentWords: currentWords,
        overlapWords: continuationWords,
        boundary: pendingForcedBoundary ? 'forced' : 'semantic',
      });
      continuationPrefix = '';
      continuationWords = 0;
      pendingForcedBoundary = false;
      current = [];
      currentWords = 0;
    };

    for (const block of section.blocks) {
      const isAtomic = block.type === 'table' || block.type === 'list' || (block.type === 'code' && keepCodeAtomic);
      const units = isAtomic
        ? [{ text: block.text, continuation: false, forced: false, atomic: true }]
        : splitBySentences(block.text, maxWords);

      for (const unit of units) {
        const words = countWords(unit.text);
        const mustFlush = currentWords > 0 && (
          currentWords + words > maxWords ||
          (currentWords >= targetWords && !unit.continuation)
        );
        if (mustFlush) {
          const previousText = current.join(' ');
          flush();
          if (unit.continuation && overlapWords > 0) {
            continuationPrefix = tailWords(previousText, overlapWords);
            continuationWords = countWords(continuationPrefix);
            pendingForcedBoundary = true;
          }
        }
        current.push(unit.text);
        currentWords += words;
      }
    }
    flush();
  }

  return output;
}

export function chunkMarkdown(text, options = {}) {
  return chunkMarkdownDetailed(text, options).map((chunk) => chunk.text);
}

export default { chunkMarkdown, chunkMarkdownDetailed };
