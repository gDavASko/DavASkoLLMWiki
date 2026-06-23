// ═══════════════════════════════════════════════════════════════════════
//  frontmatter.js — единый разбор/сборка YAML-фронтматтера на js-yaml
// ───────────────────────────────────────────────────────────────────────
//  Заменяет самописные построчные парсеры (хрупкие на вложенных картах,
//  списках, кавычках, многострочных значениях). Один источник истины для
//  build-index, lint-wiki, check-staleness и т.д.
// ═══════════════════════════════════════════════════════════════════════

import yaml from 'js-yaml';

function stripBom(s) {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

/**
 * Разбирает фронтматтер.
 * @returns {{ meta: object, body: string, hasFrontmatter: boolean, error: string|null }}
 *   error !== null означает синтаксическую ошибку YAML (meta тогда пустой);
 *   вызывающий сам решает, считать это lint-ошибкой или пропустить.
 */
export function parseFrontmatter(content) {
  content = stripBom(content);
  const m = content.match(FM_RE);
  if (!m) return { meta: {}, body: content, hasFrontmatter: false, error: null };

  let meta = {};
  let error = null;
  try {
    const loaded = yaml.load(m[1]);
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) meta = loaded;
  } catch (e) {
    error = e.message;
  }
  return { meta, body: content.slice(m[0].length), hasFrontmatter: true, error };
}

/**
 * Собирает документ обратно: --- <yaml> --- <body>.
 * Порядок ключей сохраняется (sortKeys:false); lineWidth:-1 не переносит длинные строки.
 */
export function stringifyFrontmatter(meta, body) {
  const dumped = yaml.dump(meta, { lineWidth: -1, noRefs: true, sortKeys: false });
  const sep = body.startsWith('\n') ? '' : '\n';
  return `---\n${dumped}---${sep}${body}`;
}

/**
 * Загружает документ, даёт мутировать meta через callback, возвращает новый текст.
 * Удобно для штамповки provenance (source_hashes, last_updated) без ручной правки YAML.
 * @returns {{ content: string, changed: boolean, error: string|null }}
 */
export function updateFrontmatter(content, mutate) {
  const hadBom = content.charCodeAt(0) === 0xFEFF;
  const { meta, body, hasFrontmatter, error } = parseFrontmatter(content);
  if (error) return { content, changed: false, error };
  if (!hasFrontmatter) return { content, changed: false, error: 'no frontmatter' };
  mutate(meta);
  let out = stringifyFrontmatter(meta, body);
  if (hadBom) out = '﻿' + out; // сохранить BOM для .md (Data Standards §1)
  return { content: out, changed: out !== content, error: null };
}

export default { parseFrontmatter, stringifyFrontmatter, updateFrontmatter };
