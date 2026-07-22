#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 * DavASkoLLMWiki v3.x — Упаковщик зависимостей (pack-deps.js)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Рекурсивно упаковывает @huggingface/transformers и ВСЕ его
 * транзитивные зависимости (включая onnxruntime-node) в единый
 * .tgz-архив для полностью оффлайн-установки.
 *
 * Стратегия:
 *   1. Устанавливаем пакет во временную директорию через npm install
 *   2. Делаем npm pack --pack-destination=vendor/ для КАЖДОГО пакета
 *      в node_modules (рекурсивный обход)
 *   3. Создаём bundledDependencies-пакет из временной директории
 *   4. Копируем финальный .tgz в system/vendor/
 *
 * ВАЖНО: Этот скрипт требует подключения к интернету!
 * Запускайте его ОДИН РАЗ на машине с доступом к npm registry,
 * затем закоммитьте system/vendor/*.tgz через Git LFS.
 *
 * Использование:
 *   node system/scripts/pack-deps.js
 *
 * Результат:
 *   system/vendor/huggingface-transformers.tgz
 *     (полный пакет со всеми транзитивными зависимостями внутри)
 * ═══════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// ─── ESM Shim ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Paths ───────────────────────────────────────────────────────────
const SYSTEM_DIR = path.resolve(__dirname, '..');
const VENDOR_DIR = path.join(SYSTEM_DIR, 'vendor');

// ─── Target Packages ──────────────────────────────────────────────────
const BUNDLES = [
  {
    name: '@huggingface/transformers',
    version: '^3.0.0',
    outputFilename: 'huggingface-transformers.tgz',
    bundleName: 'davasko-transformers-bundle',
    createIndex: "export * from './node_modules/@huggingface/transformers/src/transformers.js';\n"
  },
  {
    name: 'vectordb',
    version: '^0.21.2',
    outputFilename: 'vectordb.tgz',
    bundleName: 'davasko-vectordb-bundle',
    main: './node_modules/vectordb/dist/index.js'
  }
];

// ─── Standalone vendored packages (pinned) ───────────────────────────
const STANDALONE_PACKAGES = [
  'js-yaml@4.1.0',
  'argparse@2.0.1',
  'apache-arrow@18.1.0',
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

function exec(cmd, cwd) {
  console.log(`${C.dim}  $ ${cmd}${C.reset}`);
  return execSync(cmd, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
}

async function main() {
  console.log(`\n${C.bold}═══ DavASkoLLMWiki v3.x — Упаковщик зависимостей ═══${C.reset}\n`);

  for (const bundle of BUNDLES) {
    console.log(`\n${C.bold}--- Упаковка бандла: ${bundle.name} ---${C.reset}`);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'davasko-pack-'));
    console.log(`${C.cyan}[1/5]${C.reset} Временная директория: ${C.dim}${tmpDir}${C.reset}`);

    try {
      const tmpPkg = {
        name: bundle.bundleName,
        version: '1.0.0',
        private: true,
        dependencies: {
          [bundle.name]: bundle.version,
        },
        bundleDependencies: true,
      };

      if (bundle.main) {
        tmpPkg.main = bundle.main;
      } else {
        tmpPkg.main = './index.js';
        fs.writeFileSync(
          path.join(tmpDir, 'index.js'),
          bundle.createIndex
        );
      }

      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify(tmpPkg, null, 2)
      );

      console.log(`\n${C.cyan}[2/5]${C.reset} Установка ${bundle.name} со всеми зависимостями...`);
      try {
        exec('npm install --production', tmpDir);
      } catch (err) {
        console.error(`${C.red}[ERROR]${C.reset} npm install failed: ${err.stderr || err.message}`);
        throw err;
      }

      const nmDir = path.join(tmpDir, 'node_modules');
      let depCount = 0;
      if (fs.existsSync(nmDir)) {
        for (const entry of fs.readdirSync(nmDir)) {
          if (entry.startsWith('.')) continue;
          if (entry.startsWith('@')) {
            const scopeDir = path.join(nmDir, entry);
            for (const subEntry of fs.readdirSync(scopeDir)) {
              if (!subEntry.startsWith('.')) depCount++;
            }
          } else {
            depCount++;
          }
        }
      }
      console.log(`${C.green}[OK]${C.reset} Установлено ${depCount} пакетов (включая транзитивные).`);

      console.log(`\n${C.cyan}[3/5]${C.reset} Упаковка в .tgz с bundledDependencies...`);
      let packOutput;
      try {
        packOutput = exec('npm pack --json', tmpDir).trim();
      } catch (err) {
        console.error(`${C.red}[ERROR]${C.reset} npm pack failed: ${err.stderr || err.message}`);
        throw err;
      }

      let packFilename;
      try {
        const packInfo = JSON.parse(packOutput);
        packFilename = Array.isArray(packInfo) ? packInfo[0].filename : packInfo.filename;
      } catch {
        const lines = packOutput.split('\n').filter(Boolean);
        packFilename = lines[lines.length - 1];
      }

      const packPath = path.join(tmpDir, packFilename);
      const packSize = fs.statSync(packPath).size;
      console.log(`${C.green}[OK]${C.reset} Упаковано: ${packFilename} (${(packSize / 1024 / 1024).toFixed(1)}MB)`);

      console.log(`\n${C.cyan}[4/5]${C.reset} Копирование в ${VENDOR_DIR}/...`);
      if (!fs.existsSync(VENDOR_DIR)) fs.mkdirSync(VENDOR_DIR, { recursive: true });

      const destPath = path.join(VENDOR_DIR, bundle.outputFilename);
      fs.copyFileSync(packPath, destPath);

      const destSize = fs.statSync(destPath).size;
      console.log(`${C.green}[OK]${C.reset} ${bundle.outputFilename} → ${(destSize / 1024 / 1024).toFixed(1)}MB`);

    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
    }
  }

  console.log(`\n${C.cyan}[+]${C.reset} Упаковка standalone-пакетов...`);
  if (!fs.existsSync(VENDOR_DIR)) fs.mkdirSync(VENDOR_DIR, { recursive: true });
  for (const spec of STANDALONE_PACKAGES) {
    try {
      const out = exec(`npm pack ${spec} --pack-destination "${VENDOR_DIR}" --json`, process.cwd()).trim();
      let fname;
      try { const j = JSON.parse(out); fname = (Array.isArray(j) ? j[0] : j).filename; }
      catch { fname = out.split('\n').filter(Boolean).pop(); }
      console.log(`${C.green}[OK]${C.reset} ${spec} → ${fname}`);
    } catch (err) {
      console.error(`${C.red}[ERROR]${C.reset} npm pack ${spec} failed: ${err.stderr || err.message}`);
      throw err;
    }
  }

  console.log(`\n${C.green}[OK]${C.reset} Все зависимости упакованы.\n`);
}

main().catch(err => {
  console.error(`\n${C.red}[FATAL] ${err.message}${C.reset}`);
  process.exit(1);
});
