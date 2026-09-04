import fs from 'node:fs';
import path from 'node:path';

const FORMAT_VERSION = 1;

export function loadEmptyDocumentCache(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (parsed?.version !== FORMAT_VERSION || typeof parsed.documents !== 'object' || !parsed.documents) return {};
    return Object.fromEntries(
      Object.entries(parsed.documents).filter(([, value]) => typeof value === 'string' && value.length > 0),
    );
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    console.warn(`[WARN] Empty-document cache was ignored: ${error.message}`);
    return {};
  }
}

export function writeEmptyDocumentCache(filePath, documents) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempFile = `${filePath}.new`;
  fs.writeFileSync(tempFile, JSON.stringify({ version: FORMAT_VERSION, documents }, null, 2) + '\n', 'utf8');
  fs.renameSync(tempFile, filePath);
}
