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

// ─── Target Package ──────────────────────────────────────────────────
const PACKAGE_NAME    = '@huggingface/transformers';
const PACKAGE_VERSION = '^3.0.0';
const OUTPUT_FILENAME = 'huggingface-transformers.tgz';

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

/**
 * Выполняет shell-команду синхронно с выводом в консоль.
 */
function exec(cmd, cwd) {
  console.log(`${C.dim}  $ ${cmd}${C.reset}`);
  return execSync(cmd, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024, // 50MB buffer
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n${C.bold}═══ DavASkoLLMWiki v3.x — Упаковщик зависимостей ═══${C.reset}\n`);
  console.log(`${C.dim}Пакет:    ${PACKAGE_NAME}@${PACKAGE_VERSION}`);
  console.log(`Выход:    ${VENDOR_DIR}/${OUTPUT_FILENAME}${C.reset}\n`);

  // 1. Создаём временную директорию
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'davasko-pack-'));
  console.log(`${C.cyan}[1/5]${C.reset} Временная директория: ${C.dim}${tmpDir}${C.reset}`);

  try {
    // 2. Создаём минимальный package.json с bundledDependencies
    const tmpPkg = {
      name: 'davasko-transformers-bundle',
      version: '1.0.0',
      private: true,
      main: './index.js',
      dependencies: {
        [PACKAGE_NAME]: PACKAGE_VERSION,
      },
      bundleDependencies: true, // Упаковывает ВСЕ node_modules в .tgz
    };
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify(tmpPkg, null, 2)
    );

    // Записываем index.js реэкспорт
    fs.writeFileSync(
      path.join(tmpDir, 'index.js'),
      "export * from './node_modules/@huggingface/transformers/src/transformers.js';\n"
    );

    // 3. Устанавливаем пакет (это скачает все транзитивные зависимости)
    console.log(`\n${C.cyan}[2/5]${C.reset} Установка ${PACKAGE_NAME} со всеми зависимостями...`);
    try {
      exec('npm install --production', tmpDir);
    } catch (err) {
      console.error(`${C.red}[ERROR]${C.reset} npm install failed: ${err.stderr || err.message}`);
      throw err;
    }

    // 4. Считаем количество транзитивных зависимостей
    const nmDir = path.join(tmpDir, 'node_modules');
    let depCount = 0;
    if (fs.existsSync(nmDir)) {
      for (const entry of fs.readdirSync(nmDir)) {
        if (entry.startsWith('.')) continue;
        if (entry.startsWith('@')) {
          // Scoped packages
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

    // 5. Упаковка через npm pack (bundleDependencies = true → все node_modules внутри)
    console.log(`\n${C.cyan}[3/5]${C.reset} Упаковка в .tgz с bundledDependencies...`);
    let packOutput;
    try {
      packOutput = exec('npm pack --json', tmpDir).trim();
    } catch (err) {
      console.error(`${C.red}[ERROR]${C.reset} npm pack failed: ${err.stderr || err.message}`);
      throw err;
    }

    // npm pack --json выводит JSON-массив с метаданными
    let packFilename;
    try {
      const packInfo = JSON.parse(packOutput);
      packFilename = Array.isArray(packInfo) ? packInfo[0].filename : packInfo.filename;
    } catch {
      // Fallback: если не JSON, берём последнюю строку
      const lines = packOutput.split('\n').filter(Boolean);
      packFilename = lines[lines.length - 1];
    }

    const packPath = path.join(tmpDir, packFilename);
    if (!fs.existsSync(packPath)) {
      throw new Error(`Packed file not found: ${packPath}`);
    }

    const packSize = fs.statSync(packPath).size;
    console.log(
      `${C.green}[OK]${C.reset} Упаковано: ${packFilename} ` +
      `(${(packSize / 1024 / 1024).toFixed(1)}MB)`
    );

    // 6. Копируем в system/vendor/
    console.log(`\n${C.cyan}[4/5]${C.reset} Копирование в ${VENDOR_DIR}/...`);
    if (!fs.existsSync(VENDOR_DIR)) fs.mkdirSync(VENDOR_DIR, { recursive: true });

    const destPath = path.join(VENDOR_DIR, OUTPUT_FILENAME);
    fs.copyFileSync(packPath, destPath);

    const destSize = fs.statSync(destPath).size;
    console.log(
      `${C.green}[OK]${C.reset} ${OUTPUT_FILENAME} → ${(destSize / 1024 / 1024).toFixed(1)}MB`
    );

    // 7. Верификация
    console.log(`\n${C.cyan}[5/5]${C.reset} Верификация...`);
    console.log(`${C.dim}  Архив: ${destPath}`);
    console.log(`  Размер: ${(destSize / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  Зависимостей: ${depCount} (включая транзитивные)${C.reset}`);

    console.log(
      `\n${C.green}[OK]${C.reset} Все зависимости упакованы.\n` +
      `${C.dim}  Теперь выполните:\n` +
      `    git add system/vendor/${OUTPUT_FILENAME}\n` +
      `    git commit -m "chore: add bundled transformers dependencies"\n` +
      `  Файл будет автоматически отслеживаться через Git LFS.${C.reset}\n`
    );

  } finally {
    // Очистка временной директории
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      console.log(`${C.dim}[WARN] Не удалось очистить ${tmpDir}${C.reset}`);
    }
  }
}

main().catch(err => {
  console.error(`\n${C.red}[FATAL] ${err.message}${C.reset}`);
  process.exit(1);
});
