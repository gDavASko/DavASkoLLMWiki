import path from 'node:path';

/**
 * Stable identity for an indexed source document.
 *
 * A raw source is evidence, not the generated wiki page that may describe it.
 * It must therefore never inherit frontmatter `id`: generated pages often use
 * the same ID and would otherwise overwrite the raw document's MD5/vector.
 */
export function documentId({ sourceType, layer, relPath, basename, metaId, wikiBasenameCount, rawBasenameCount }) {
  if (sourceType === 'raw') {
    // Keep the historical raw ID where it was already unambiguous. This avoids
    // a needless one-off re-embedding of an entire existing corpus. A raw file
    // with frontmatter ID (the bug source) or a duplicate basename gets a
    // path-qualified ID instead.
    if (!metaId && rawBasenameCount <= 1) return `raw-${layer}-${basename}`;

    const rawMarker = '/raw/';
    const normalPath = String(relPath).replace(/\\/g, '/');
    const rawRelativePath = normalPath.includes(rawMarker)
      ? normalPath.slice(normalPath.indexOf(rawMarker) + rawMarker.length)
      : path.basename(normalPath);
    return `raw-${layer}-${rawRelativePath.replace(/\.md$/i, '')}`;
  }

  return metaId || (wikiBasenameCount > 1 ? String(relPath).replace(/\.md$/i, '') : basename);
}
