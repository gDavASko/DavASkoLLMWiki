#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 * DavASkoLLMWiki v3.x — Установщик модели (setup-model.js)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Скачивает модель jinaai/jina-embeddings-v3 (ONNX, FP16) из
 * Hugging Face Hub и сохраняет в system/models-cache/ для полностью
 * оффлайн-работы build-index.js и query-wiki.js.
 *
 * Использование:
 *   node system/scripts/setup-model.js
 *   node system/scripts/setup-model.js --force   (перезагрузка)
 *
 * После выполнения:
 *   - system/models-cache/ содержит все файлы модели
 *   - Готово для коммита через Git LFS
 * ═══════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// ─── ESM Shim ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Paths ───────────────────────────────────────────────────────────
const SYSTEM_DIR   = path.resolve(__dirname, '..');
const MODELS_CACHE = path.join(SYSTEM_DIR, 'models-cache');

// ─── Model Configuration ────────────────────────────────────────────
const MODEL_ID       = 'jinaai/jina-embeddings-v3';
const MODEL_REVISION = 'main'; // 'main' resolves to latest; pin to SHA for reproducibility

/**
 * Список файлов для скачивания из репозитория модели.
 * Включает config, tokenizer и ONNX-артефакты.
 *
 * Файлы проверены через HF API (siblings list).
 * model_fp16.onnx — предквантизированная FP16-версия.
 */
const MODEL_FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'onnx/model.onnx',
  'onnx/model.onnx_data',
  'onnx/model_fp16.onnx',
];

// ─── ANSI Colors ─────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  dim:    '\x1b[2m',
};

// ═══════════════════════════════════════════════════════════════════════
//  DOWNLOAD ENGINE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Скачивает файл по URL в указанный путь с поддержкой редиректов.
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const makeRequest = (reqUrl, redirects = 0) => {
      if (redirects > 5) {
        return reject(new Error(`Too many redirects for ${reqUrl}`));
      }

      https.get(reqUrl, { headers: { 'User-Agent': 'DavASkoLLMWiki/3.0' } }, (res) => {
        // Handle redirects (301, 302, 307, 308)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); // drain response
          // Resolve relative redirect URLs against the original URL
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith('/')) {
            const parsed = new URL(reqUrl);
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          return makeRequest(redirectUrl, redirects + 1);
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${reqUrl}`));
        }

        const fileStream = fs.createWriteStream(destPath);
        let downloaded = 0;
        const totalSize = parseInt(res.headers['content-length'] || '0', 10);

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (totalSize > 0) {
            const pct = ((downloaded / totalSize) * 100).toFixed(0);
            const mb = (downloaded / 1024 / 1024).toFixed(1);
            process.stdout.write(`\r  ${C.dim}${mb}MB (${pct}%)${C.reset}`);
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          process.stdout.write('\r' + ' '.repeat(40) + '\r');
          resolve();
        });

        fileStream.on('error', (err) => {
          fs.unlinkSync(destPath);
          reject(err);
        });
      }).on('error', reject);
    };

    makeRequest(url);
  });
}

/**
 * Строит URL для скачивания файла из Hugging Face Hub.
 */
function hfUrl(modelId, revision, filePath) {
  return `https://huggingface.co/${modelId}/resolve/${revision}/${filePath}`;
}

// ═══════════════════════════════════════════════════════════════════════
//  CACHE DIRECTORY SETUP
// ═══════════════════════════════════════════════════════════════════════

/**
 * Подготавливает структуру директорий для кэша модели.
 * Структура совместима с @huggingface/transformers env.cacheDir:
 *
 *   models-cache/
 *     jinaai/
 *       jina-embeddings-v3/
 *         config.json
 *         tokenizer.json
 *         onnx/
 *           model.onnx
 *           model.onnx_data
 */
function getModelCacheDir() {
  const parts = MODEL_ID.split('/');
  return path.join(MODELS_CACHE, ...parts);
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const forceDownload = process.argv.includes('--force');

  console.log(`\n${C.bold}═══ DavASkoLLMWiki v3.x — Установка модели ═══${C.reset}\n`);
  console.log(`${C.dim}Модель:    ${MODEL_ID}`);
  console.log(`Ревизия:   ${MODEL_REVISION}`);
  console.log(`Кэш:      ${MODELS_CACHE}${C.reset}\n`);

  const modelDir = getModelCacheDir();

  // Проверка: модель уже скачана?
  const configPath = path.join(modelDir, 'config.json');
  if (!forceDownload && fs.existsSync(configPath)) {
    console.log(`${C.green}[OK]${C.reset} Модель уже загружена в ${modelDir}`);
    console.log(`${C.dim}    Используйте --force для повторной загрузки.${C.reset}\n`);
    return;
  }

  if (forceDownload) {
    console.log(`${C.yellow}[!] Режим --force: перезагрузка всех файлов модели.${C.reset}\n`);
  }

  // Скачивание файлов
  let downloaded = 0;
  let errors = 0;

  for (const filePath of MODEL_FILES) {
    const url      = hfUrl(MODEL_ID, MODEL_REVISION, filePath);
    const destPath = path.join(modelDir, filePath);

    // Пропускаем уже скачанные (если не --force)
    if (!forceDownload && fs.existsSync(destPath)) {
      console.log(`${C.dim}  [SKIP] ${filePath} (exists)${C.reset}`);
      continue;
    }

    process.stdout.write(`  ${C.cyan}[GET]${C.reset} ${filePath}...`);
    try {
      await downloadFile(url, destPath);
      const size = fs.statSync(destPath).size;
      const sizeStr = size > 1024 * 1024
        ? `${(size / 1024 / 1024).toFixed(1)}MB`
        : `${(size / 1024).toFixed(0)}KB`;
      console.log(` ${C.green}OK${C.reset} (${sizeStr})`);
      downloaded++;
    } catch (err) {
      console.log(` ${C.red}FAIL${C.reset} — ${err.message}`);
      errors++;
    }
  }

  // Записываем маркер ревизии
  const revisionFile = path.join(modelDir, '.revision');
  fs.writeFileSync(revisionFile, MODEL_REVISION, 'utf8');

  // Итог
  console.log('');
  if (errors > 0) {
    console.error(
      `${C.red}[ERROR]${C.reset} ${errors} файл(ов) не удалось скачать.\n` +
      `  Проверьте подключение к интернету и повторите.\n`
    );
    process.exit(1);
  }

  console.log(
    `${C.green}[OK]${C.reset} Модель установлена: ${downloaded} файлов загружено.\n` +
    `${C.dim}  Директория: ${modelDir}\n` +
    `  Теперь build-index.js и query-wiki.js будут работать оффлайн.${C.reset}\n`
  );
}

main().catch(err => {
  console.error(`${C.red}[FATAL] ${err.message}${C.reset}`);
  process.exit(1);
});
