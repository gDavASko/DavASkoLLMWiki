#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 * DavASkoLLMWiki v3.x — Универсальный импорт из NewData (ingest-newdata.js)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Сканирует папку NewData/ и автоматически импортирует markdown-файлы
 * в соответствующие слои базы знаний через query-wiki.js --ingest.
 * После импорта запускает линтер для валидации.
 *
 * Использование:
 *   node system/scripts/ingest-newdata.js
 * ═══════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// ─── ESM __dirname Shim ──────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const submoduleRoot = path.resolve(__dirname, '../..');

// Helper to delete directory recursively (cross-platform)
function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

// Helper to recursively find files matching extensions
function getFilesRecursively(dir, extensions) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, extensions));
    } else {
      const ext = path.extname(file).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

function run() {
  const newDataDir = path.join(submoduleRoot, 'NewData');
  if (!fs.existsSync(newDataDir)) {
    console.log('Папка NewData не найдена. Нечего импортировать.');
    return;
  }

  console.log('--- Начинаем универсальный импорт из NewData ---');

  // Динамическое обнаружение слоёв (все папки с wiki.json)
  const validLayers = [];
  fs.readdirSync(submoduleRoot).forEach(entry => {
    const fullPath = path.join(submoduleRoot, entry);
    if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'wiki.json'))) {
      validLayers.push(entry);
    }
  });

  const layersInNewData = fs.readdirSync(newDataDir).filter(f => {
    return fs.statSync(path.join(newDataDir, f)).isDirectory() && validLayers.includes(f);
  });

  if (layersInNewData.length === 0) {
    console.log(`В NewData нет структурированных папок слоев. Допустимые: ${validLayers.join(', ')}`);
    console.log('Пожалуйста, разложите файлы согласно wiki-ingest-protocol.');
    return;
  }

  layersInNewData.forEach(layer => {
    const layerSrcDir = path.join(newDataDir, layer);
    console.log(`\nОбработка слоя: ${layer}`);

    // Сначала очистим имена файлов от числовых префиксов \d+- в этой папке слоя
    const allFilesBeforeCleanup = getFilesRecursively(layerSrcDir, ['.md']);
    allFilesBeforeCleanup.forEach(filePath => {
      const dirName = path.dirname(filePath);
      const fileName = path.basename(filePath);
      const match = fileName.match(/^\d+-(.+)$/);
      
      if (match) {
        const newFileName = match[1];
        const newFilePath = path.join(dirName, newFileName);
        
        console.log(`Переименование: ${fileName} -> ${newFileName}`);
        fs.renameSync(filePath, newFilePath);
        
        const oldMetaPath = filePath + '.meta';
        const newMetaPath = newFilePath + '.meta';
        if (fs.existsSync(oldMetaPath)) {
          fs.renameSync(oldMetaPath, newMetaPath);
        }
      }
    });

    // Теперь находим все md файлы после очистки имен
    const mdFiles = getFilesRecursively(layerSrcDir, ['.md']);
    
    mdFiles.forEach(mdFilePath => {
      // Вычисляем относительный путь от папки слоя
      const relPath = path.relative(layerSrcDir, mdFilePath).replace(/\\/g, '/');
      const subfolder = path.dirname(relPath);
      const fileName = path.basename(relPath);

      // Входной путь для query-wiki (относительно submoduleRoot)
      const inputRelPath = `NewData/${layer}/${relPath}`;
      
      console.log(`Импорт файла: ${relPath} в слой ${layer}, подпапка raw/${subfolder}`);

      // Запускаем query-wiki --ingest
      execSync(`node "${path.join(submoduleRoot, 'system', 'scripts', 'query-wiki.js')}" --ingest "${inputRelPath}" --layer ${layer} --subfolder "${subfolder}" --no-validate`, {
        stdio: 'inherit',
        cwd: submoduleRoot
      });

      // Переносим .meta файл, если он есть
      const metaFileSrc = mdFilePath + '.meta';
      if (fs.existsSync(metaFileSrc)) {
        const metaFileDest = path.join(submoduleRoot, layer, 'raw', subfolder, `${fileName}.meta`);
        
        // Создаем целевую директорию, если она не существует
        const destDir = path.dirname(metaFileDest);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        fs.copyFileSync(metaFileSrc, metaFileDest);
        fs.unlinkSync(metaFileSrc);
        console.log(`Перенесен .meta файл: ${fileName}.meta`);
      }
    });
  });

  // Очищаем пустые папки в NewData
  console.log('\nОчистка временных папок в NewData...');
  deleteFolderRecursive(newDataDir);

  console.log('\n--- Запуск финальной валидации линтером ---');
  try {
    execSync(`node "${path.join(submoduleRoot, 'system', 'scripts', 'lint-wiki.js')}"`, {
      stdio: 'inherit',
      cwd: submoduleRoot
    });
  } catch (err) {
    console.warn('[WARNING] Линтер вернул предупреждения или ошибки.');
  }

  // Финальный шаг пайплайна записи: ВЕКТОРИЗАЦИЯ. Без неё новые raw-документы и
  // их wiki-саммари не попадут в семантический поиск. Инкрементально (MD5-кэш),
  // модель берётся из общего системного места (см. system/lib/model-locator.js).
  console.log('\n--- Векторизация: пересборка индекса (build-index) ---');
  try {
    execSync(`node "${path.join(submoduleRoot, 'system', 'build-index.js')}"`, {
      stdio: 'inherit',
      cwd: submoduleRoot
    });
  } catch (err) {
    console.warn('[WARNING] Векторизация не выполнена. Установите модель (node system/scripts/setup-model.js) и запустите вручную: node system/build-index.js');
  }

  console.log('--- Импорт завершён: знания размещены, провалидированы и векторизованы. ---');
}

run();
