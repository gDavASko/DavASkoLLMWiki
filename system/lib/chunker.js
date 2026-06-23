// ═══════════════════════════════════════════════════════════════════════
//  chunker.js — структурный (Markdown-aware) чанкинг
// ───────────────────────────────────────────────────────────────────────
//  Режет не по фиксированному окну слов, а по СТРУКТУРЕ: заголовки → абзацы
//  → (в крайнем случае) хард-сплит. Размер держится в коридоре [min, max],
//  блоки кода ```...``` остаются атомарными, к каждому чанку приписывается
//  «хлебная крошка» заголовков (путь секции). Чистая функция → юнит-тесты.
// ═══════════════════════════════════════════════════════════════════════

function countWords(s) {
  return s.split(/\s+/).filter(Boolean).length;
}

function hardSplitWords(text, maxWords) {
  const words = text.split(/\s+/).filter(Boolean);
  const parts = [];
  for (let i = 0; i < words.length; i += maxWords) {
    parts.push(words.slice(i, i + maxWords).join(' '));
  }
  return parts.length ? parts : [''];
}

// Токенизация Markdown в блоки: heading | code (атомарный) | text (абзац).
function tokenize(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let buf = [];
  const flushText = () => {
    if (buf.length) {
      const t = buf.join('\n').trim();
      if (t) blocks.push({ type: 'text', text: t });
      buf = [];
    }
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)/);
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (fence) {
      flushText();
      const marker = fence[1];
      const code = [line];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(marker)) { code.push(lines[i]); i++; }
      if (i < lines.length) { code.push(lines[i]); i++; } // закрывающий fence
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    if (heading) {
      flushText();
      blocks.push({ type: 'heading', level: heading[1].length, title: heading[2].trim() });
      i++;
      continue;
    }
    if (line.trim() === '') { flushText(); i++; continue; }
    buf.push(line);
    i++;
  }
  flushText();
  return blocks;
}

// Слить слишком мелкие чанки с соседями (если влезают в max).
function mergeSmall(chunks, minWords, maxWords) {
  const out = [];
  for (const c of chunks) {
    if (out.length === 0) { out.push(c); continue; }
    const prev = out[out.length - 1];
    const prevW = countWords(prev), curW = countWords(c);
    if ((prevW < minWords || curW < minWords) && prevW + curW <= maxWords) {
      out[out.length - 1] = `${prev}\n\n${c}`;
    } else {
      out.push(c);
    }
  }
  return out;
}

/**
 * Структурный чанкинг Markdown.
 * @returns {string[]} список чанков (с префиксом-крошкой, если headingBreadcrumbs)
 */
export function chunkMarkdown(text, {
  targetWords = 250, minWords = 80, maxWords = 400,
  keepCodeAtomic = true, headingBreadcrumbs = true,
} = {}) {
  if (!text || !text.trim()) return [];
  const blocks = tokenize(text);

  const chunks = [];
  const stack = [];           // путь заголовков: [{level, title}]
  let cur = [];               // тексты блоков текущего чанка
  let curWords = 0;
  let curCrumb = '';

  const crumb = () => stack.map(h => h.title).join(' > ');
  const withCrumb = (body, c) => (headingBreadcrumbs && c ? `[${c}]\n\n${body}` : body);

  const flush = () => {
    if (!cur.length) return;
    chunks.push(withCrumb(cur.join('\n\n').trim(), curCrumb));
    cur = []; curWords = 0;
  };
  const add = (blockText, words) => {
    if (curWords > 0 && curWords + words > maxWords) flush();   // не превышаем max
    if (cur.length === 0) curCrumb = crumb();                   // крошка фиксируется на первом блоке
    cur.push(blockText);
    curWords += words;
    if (curWords >= targetWords) flush();                       // достигли цели — закрываем
  };

  for (const b of blocks) {
    if (b.type === 'heading') {
      while (stack.length && stack[stack.length - 1].level >= b.level) stack.pop();
      stack.push({ level: b.level, title: b.title });
      if (curWords >= minWords) flush();                        // закрыть прошлую секцию, если уже набрала min
      continue;
    }
    const words = countWords(b.text);

    if (b.type === 'code' && keepCodeAtomic) {
      if (words > maxWords) {                                   // огромный код — отдельные чанки
        flush();
        for (const part of hardSplitWords(b.text, maxWords)) chunks.push(withCrumb(part, crumb()));
        continue;
      }
      add(b.text, words);
      continue;
    }

    if (words > maxWords) {                                     // огромный абзац — хард-сплит по словам
      flush();
      for (const part of hardSplitWords(b.text, maxWords)) add(part, countWords(part));
      continue;
    }
    add(b.text, words);
  }
  flush();

  return mergeSmall(chunks.filter(c => c && c.trim()), minWords, maxWords);
}

export default { chunkMarkdown };
