// Markdown-aware chunking for retrieval. Sections are the semantic parent;
// a word/sentence split is used only when one paragraph is too large.

function countWords(text) {
  return String(text).split(/\s+/).filter(Boolean).length;
}

function tailWords(text, count) {
  return String(text).split(/\s+/).filter(Boolean).slice(-count).join(' ');
}

function headWords(text, count) {
  return String(text).split(/\s+/).filter(Boolean).slice(0, count).join(' ');
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

function packUnits(units, maxWords, { prefix = '', suffix = '' } = {}) {
  const out = [];
  let current = [];
  let currentWords = countWords(prefix) + countWords(suffix);
  const flush = () => {
    if (!current.length) return;
    out.push({ text: [prefix, current.join('\n'), suffix].filter(Boolean).join('\n').trim(), continuation: out.length > 0, forced: out.length > 0 });
    current = [];
    currentWords = countWords(prefix) + countWords(suffix);
  };

  for (const unit of units) {
    const unitWords = countWords(unit);
    if (currentWords > countWords(prefix) + countWords(suffix) && currentWords + unitWords > maxWords) flush();
    if (unitWords > maxWords - countWords(prefix) - countWords(suffix)) {
      flush();
      for (const part of splitBySentences(unit, Math.max(1, maxWords - countWords(prefix) - countWords(suffix)))) {
        out.push({ text: [prefix, part.text, suffix].filter(Boolean).join('\n').trim(), continuation: out.length > 0, forced: true });
      }
      continue;
    }
    current.push(unit);
    currentWords += unitWords;
  }
  flush();
  return out;
}

function splitListBlock(text, maxWords) {
  const items = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line) || !items.length) items.push(line);
    else items[items.length - 1] += `\n${line}`;
  }
  return packUnits(items, maxWords);
}

function splitTableBlock(text, maxWords) {
  const lines = String(text).split(/\r?\n/).filter(Boolean);
  // Repeat the header in every continuation so a retrieved table slice stays interpretable.
  const header = lines.slice(0, Math.min(2, lines.length));
  const rows = lines.slice(header.length);
  if (!rows.length || countWords(text) <= maxWords) return [{ text: String(text).trim(), continuation: false, forced: false }];
  return packUnits(rows, maxWords, { prefix: header.join('\n') });
}

function splitCodeBlock(text, maxWords) {
  const lines = String(text).split(/\r?\n/);
  const isFence = (line) => /^\s*(```|~~~)/.test(line);
  const opening = isFence(lines[0]) ? lines.shift() : '```';
  const closing = isFence(lines.at(-1)) ? lines.pop() : '```';
  // A fence is repeated around every piece. We split at lines first; a single
  // generated/minified line falls back to a bounded word split as a last resort.
  return packUnits(lines, maxWords, { prefix: opening, suffix: closing });
}

function splitBlock(block, maxWords, keepCodeAtomic) {
  const text = String(block.text || '').trim();
  if (!text) return [];
  if (countWords(text) <= maxWords) return [{ text, continuation: false, forced: false }];
  if (block.type === 'list') return splitListBlock(text, maxWords);
  if (block.type === 'table') return splitTableBlock(text, maxWords);
  // `keepCodeAtomic` preserves every code block that fits. Oversized code must
  // still be bounded for retrieval; splitting on lines is safer than admitting
  // multi-thousand-word vectors.
  if (block.type === 'code' && keepCodeAtomic) return splitCodeBlock(text, maxWords);
  return splitBySentences(text, maxWords);
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
  // Overlap ВПЕРЁД: к каждому чанку (кроме последнего) приписывается голова
  // следующего фрагмента. По умолчанию симметричен overlapWords, поэтому старые
  // профили с overlapWords:0 остаются без forward-контекста (и не превышают max в
  // тестах word-count). Улучшает связность на границе: чанк «видит», чем
  // продолжается мысль, — как предыдущий контекст, только в другую сторону.
  forwardOverlapWords = overlapWords,
  keepCodeAtomic = true,
  headingBreadcrumbs = true,
} = {}) {
  if (!text || !text.trim()) return [];
  if (!(minWords > 0 && minWords <= targetWords && targetWords <= maxWords)) {
    throw new Error('Chunking bounds must satisfy 0 < minWords <= targetWords <= maxWords');
  }

  const output = [];
  let previousBody = '';
  // Tiny test profiles must remain valid too; production profile 200/300 uses
  // the configured 32-word overlap unchanged.
  const effectiveOverlap = Math.min(overlapWords, Math.floor(targetWords / 4), maxWords - minWords);
  const effectiveForward = Math.max(0, Math.min(forwardOverlapWords, Math.floor(targetWords / 4)));
  const continuationLabel = '[Контекст предыдущего фрагмента]';
  const forwardLabel = '[Контекст следующего фрагмента]';
  for (const section of toSections(tokenizeMarkdown(text))) {
    let current = [];
    let currentWords = 0;
    let pendingForcedBoundary = false;

    const flush = () => {
      if (!current.length) return;
      const body = current.join('\n\n').trim();
      const continuationPrefix = previousBody && effectiveOverlap > 0 ? tailWords(previousBody, effectiveOverlap) : '';
      const continuationWords = countWords(continuationPrefix);
      const withOverlap = continuationPrefix ? `${continuationLabel}\n${continuationPrefix}\n\n${body}` : body;
      const textWithBreadcrumb = headingBreadcrumbs && section.path ? `[${section.path}]\n\n${withOverlap}` : withOverlap;
      output.push({
        text: textWithBreadcrumb,
        _body: body, // сырое тело секции — источник forward-контекста для предыдущего чанка
        sectionPath: section.path,
        sectionIndex: section.index,
        contentWords: currentWords,
        overlapWords: continuationWords,
        forwardWords: 0, // проставится в пост-проходе ниже
        boundary: pendingForcedBoundary ? 'forced' : (continuationWords > 0 ? 'contextual' : 'semantic'),
      });
      previousBody = body;
      pendingForcedBoundary = false;
      current = [];
      currentWords = 0;
    };

    for (const block of section.blocks) {
      // Reserve the overlap budget in every primitive unit. This keeps the
      // final retrievable chunk bounded even after its predecessor context is added.
      const units = splitBlock(block, Math.max(minWords, maxWords - effectiveOverlap), keepCodeAtomic);

      for (const unit of units) {
        const words = countWords(unit.text);
        const currentMaxWords = previousBody ? maxWords - effectiveOverlap : maxWords;
        const mustFlush = currentWords > 0 && (
          currentWords + words > currentMaxWords ||
          (currentWords >= targetWords && !unit.continuation)
        );
        if (mustFlush) {
          flush();
          if (unit.forced) pendingForcedBoundary = true;
        }
        current.push(unit.text);
        currentWords += words;
      }
    }
    flush();
  }

  // Пост-проход: forward-overlap. К каждому чанку (кроме последнего) добавляем
  // голову тела СЛЕДУЮЩЕГО чанка. Отдельным проходом — потому что на момент flush
  // следующий фрагмент ещё не построен. Не резервируем под него бюджет упаковки:
  // это служебный контекст для эмбеддинга, +N слов в хвосте некритичны, а
  // contentWords (исходное содержимое) остаётся в пределах max.
  if (effectiveForward > 0) {
    for (let i = 0; i < output.length - 1; i++) {
      const nextHead = headWords(output[i + 1]._body, effectiveForward);
      if (!nextHead) continue;
      output[i].text = `${output[i].text}\n\n${forwardLabel}\n${nextHead}`;
      output[i].forwardWords = countWords(nextHead);
    }
  }
  for (const chunk of output) delete chunk._body; // служебное поле наружу не отдаём

  return output;
}

export function chunkMarkdown(text, options = {}) {
  return chunkMarkdownDetailed(text, options).map((chunk) => chunk.text);
}

export default { chunkMarkdown, chunkMarkdownDetailed };
