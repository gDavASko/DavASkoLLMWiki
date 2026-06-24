#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 * DavASkoLLMWiki v3.x — Установщик общей модели (setup-model.js)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Ставит модель jinaai/jina-embeddings-v3 (ONNX, FP16) в ОДНО системное
 * место (per-user) и публикует путь через системную метку. Любая база
 * знаний находит модель по метке и работает с одной копией — без дублей
 * по 1.1 GB в каждой развёрнутой базе.
 *
 * Источник модели (по приоритету):
 *   1. Репо-исходник <system>/models-cache (offline-копия) — если есть
 *   2. Скачивание из Hugging Face Hub — фолбэк
 *
 * Использование:
 *   node system/scripts/setup-model.js                 # → системное место + метка
 *   node system/scripts/setup-model.js --dir <path>    # системное место вручную
 *   node system/scripts/setup-model.js --local         # легаси: в <system>/models-cache, без метки
 *   node system/scripts/setup-model.js --force          # переустановить
 *
 * После выполнения:
 *   - модель лежит в системном месте (или указанном --dir)
 *   - системная метка (global config.json) указывает на неё
 * ═══════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import {
  getDefaultSystemModelsDir, getMarkerPath, writeMarker, isModelPresent,
} from '../lib/model-locator.js';

// ─── ESM Shim ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Paths ───────────────────────────────────────────────────────────
const SYSTEM_DIR    = path.resolve(__dirname, '..');
const LOCAL_MODELS  = path.join(SYSTEM_DIR, 'models-cache'); // репо-исходник

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
//  TARGET / SOURCE HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** Каталог модели внутри данной models-cache: <cache>/<org>/<model>. */
function modelDirIn(modelsCache) {
  return path.join(modelsCache, ...MODEL_ID.split('/'));
}

/** Разбор аргументов: --force, --local, --dir <path>. */
function parseArgs(argv) {
  const force = argv.includes('--force');
  const local = argv.includes('--local');
  const di = argv.indexOf('--dir');
  const dir = di >= 0 ? argv[di + 1] : null;
  return { force, local, dir };
}

/** Рекурсивная копия каталога модели (offline-перенос репо-исходника). */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const { force, local, dir } = parseArgs(process.argv.slice(2));

  // Целевое место: --dir > --local (репо) > системное место по умолчанию.
  const targetCache = local ? LOCAL_MODELS : (dir ? path.resolve(dir) : getDefaultSystemModelsDir());
  const targetModelDir = modelDirIn(targetCache);

  console.log(`\n${C.bold}═══ DavASkoLLMWiki — Установка общей модели ═══${C.reset}\n`);
  console.log(`${C.dim}Модель:   ${MODEL_ID}`);
  console.log(`Цель:     ${targetCache}${local ? ' (--local, легаси)' : ''}${C.reset}\n`);

  // Уже установлена?
  if (!force && isModelPresent(targetCache, MODEL_ID)) {
    console.log(`${C.green}[OK]${C.reset} Модель уже на месте: ${targetModelDir}`);
    if (!local) {
      const m = writeMarker({ modelsCache: targetCache, modelId: MODEL_ID, revision: MODEL_REVISION });
      console.log(`${C.dim}    Метка обновлена: ${m}${C.reset}`);
    }
    console.log(`${C.dim}    Используйте --force для переустановки.${C.reset}\n`);
    return;
  }
  if (force) console.log(`${C.yellow}[!] --force: переустановка.${C.reset}\n`);

  // Источник №1 — репо-исходник (offline-копия).
  const haveLocalSource = isModelPresent(LOCAL_MODELS, MODEL_ID);
  if (haveLocalSource && path.resolve(targetCache) !== path.resolve(LOCAL_MODELS)) {
    process.stdout.write(`  ${C.cyan}[COPY]${C.reset} репо-исходник → системное место...`);
    try {
      copyDir(modelDirIn(LOCAL_MODELS), targetModelDir);
      console.log(` ${C.green}OK${C.reset}`);
      const m = writeMarker({ modelsCache: targetCache, modelId: MODEL_ID, revision: MODEL_REVISION });
      console.log(`\n${C.green}[OK]${C.reset} Модель скопирована в ${targetModelDir}`);
      if (!local) console.log(`${C.dim}  Метка: ${m}${C.reset}`);
      console.log(`${C.dim}  build-index.js и query-wiki.js работают оффлайн через метку.${C.reset}\n`);
      return;
    } catch (err) {
      console.log(` ${C.red}FAIL${C.reset} — ${err.message} ${C.dim}(перехожу на загрузку)${C.reset}`);
    }
  }

  // Источник №2 — Hugging Face Hub.
  let downloaded = 0, errors = 0;
  for (const filePath of MODEL_FILES) {
    const url = hfUrl(MODEL_ID, MODEL_REVISION, filePath);
    const destPath = path.join(targetModelDir, filePath);
    if (!force && fs.existsSync(destPath)) { console.log(`${C.dim}  [SKIP] ${filePath}${C.reset}`); continue; }
    process.stdout.write(`  ${C.cyan}[GET]${C.reset} ${filePath}...`);
    try {
      await downloadFile(url, destPath);
      const size = fs.statSync(destPath).size;
      const sizeStr = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)}MB` : `${(size / 1024).toFixed(0)}KB`;
      console.log(` ${C.green}OK${C.reset} (${sizeStr})`); downloaded++;
    } catch (err) { console.log(` ${C.red}FAIL${C.reset} — ${err.message}`); errors++; }
  }
  fs.writeFileSync(path.join(targetModelDir, '.revision'), MODEL_REVISION, 'utf8');

  console.log('');
  if (errors > 0) {
    console.error(`${C.red}[ERROR]${C.reset} ${errors} файл(ов) не удалось скачать. Проверьте сеть и повторите.\n`);
    process.exit(1);
  }
  const m = writeMarker({ modelsCache: targetCache, modelId: MODEL_ID, revision: MODEL_REVISION });
  console.log(
    `${C.green}[OK]${C.reset} Модель установлена: ${downloaded} файлов.\n` +
    `${C.dim}  Директория: ${targetModelDir}\n` +
    (local ? '' : `  Метка: ${m}\n`) +
    `  build-index.js и query-wiki.js будут работать оффлайн.${C.reset}\n`
  );
}

main().catch(err => {
  console.error(`${C.red}[FATAL] ${err.message}${C.reset}`);
  process.exit(1);
});
