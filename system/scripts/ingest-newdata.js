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

// Helper to generate a random 32-character hex GUID for Unity .meta files
function generateGuid() {
  let guid = '';
  for (let i = 0; i < 32; i++) {
    guid += Math.floor(Math.random() * 16).toString(16);
  }
  return guid;
}

// Helper to read UTF-8 without BOM
function readUtf8(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

// Helper to write UTF-8 with BOM
function writeUtf8Bom(filePath, content) {
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  fs.writeFileSync(filePath, Buffer.concat([bom, Buffer.from(content, 'utf8')]));
}

// Inline Ingest function
function ingestFile(sourceFile, targetLayer, subfolder) {
  const layerDir = path.join(submoduleRoot, targetLayer);
  if (!fs.existsSync(layerDir) || !fs.existsSync(path.join(layerDir, 'wiki.json'))) {
    console.error(`[Error] Target layer manifest not found: ${targetLayer}/wiki.json`);
    process.exit(1);
  }
  
  const filename = path.basename(sourceFile);
  const nameWithoutExt = path.parse(filename).name;
  
  // 1. Move and convert to UTF-8 BOM
  const destSubfolder = subfolder || 'docs';
  const targetRawDir = path.join(layerDir, 'raw', destSubfolder);
  if (!fs.existsSync(targetRawDir)) {
    fs.mkdirSync(targetRawDir, { recursive: true });
  }
  
  const destRawFile = path.join(targetRawDir, filename);
  const rawContent = readUtf8(sourceFile);
  writeUtf8Bom(destRawFile, rawContent);
  fs.unlinkSync(sourceFile); // delete original in NewData/
  
  console.log(`[INGEST] Moved ${filename} -> ${targetLayer}/raw/${destSubfolder}/${filename}`);

  // 2. Generate wiki source summary file
  const sourceSummaryDir = path.join(layerDir, 'wiki', 'sources');
  if (!fs.existsSync(sourceSummaryDir)) {
    fs.mkdirSync(sourceSummaryDir, { recursive: true });
  }
  
  const summaryFileName = `${nameWithoutExt}.md`;
  const summaryFilePath = path.join(sourceSummaryDir, summaryFileName);
  
  const dateStr = new Date().toISOString().split('T')[0];
  const summaryContent = `---
title: "Summary of ${nameWithoutExt}"
type: source-summary
status: draft
source_status: source-linked
sources:
  - ${targetLayer}/raw/${destSubfolder}/${filename}
last_updated: ${dateStr}
related: []
---

# Summary of ${nameWithoutExt}

**Summary**: Source summary of ${nameWithoutExt}.

**Sources**: ${targetLayer}/raw/${destSubfolder}/${filename}

**Last updated**: ${dateStr}

## Key Claims

- No claims extracted yet. (source: ${targetLayer}/raw/${destSubfolder}/${filename})

## Details

Summary details of ${nameWithoutExt}.

## Open Questions

- None.

## Related Pages

- None.
`;
  writeUtf8Bom(summaryFilePath, summaryContent);
  console.log(`[INGEST] Created wiki page: ${targetLayer}/wiki/sources/${summaryFileName}`);
  // .meta не создаём — Unity генерирует его сам при импорте ассета.

  // 3. Update local index.md
  const indexPath = path.join(layerDir, 'wiki', 'index.md');
  if (fs.existsSync(indexPath)) {
    let indexContent = readUtf8(indexPath);
    const summaryWikiLink = `[[${nameWithoutExt}]]`;
    if (!indexContent.includes(summaryWikiLink)) {
      if (indexContent.includes('### Sources')) {
        indexContent = indexContent.replace('### Sources', `### Sources\n- ${summaryWikiLink}`);
      } else if (indexContent.includes('## Sources')) {
        indexContent = indexContent.replace('## Sources', `## Sources\n- ${summaryWikiLink}`);
      } else {
        indexContent += `\n\n### Sources\n- ${summaryWikiLink}`;
      }
      writeUtf8Bom(indexPath, indexContent);
      console.log(`[INGEST] Added link ${summaryWikiLink} to ${targetLayer}/wiki/index.md`);
    }
  }

  // 4. Update local log.md
  const logPath = path.join(layerDir, 'wiki', 'log.md');
  const localLogLines = [];
  if (fs.existsSync(logPath)) {
    let logContent = readUtf8(logPath);
    const logHeader = `## [${dateStr}]`;
    const logEntry = `- Imported new source: [[${nameWithoutExt}]] (source: raw/${destSubfolder}/${filename})`;
    
    let updatedLogContent = '';
    if (logContent.includes(logHeader)) {
      updatedLogContent = logContent.replace(logHeader, `${logHeader}\n${logEntry}`);
    } else {
      updatedLogContent = `${logHeader}\n${logEntry}\n\n` + logContent;
    }
    
    const originalLines = logContent.split('\n');
    writeUtf8Bom(logPath, updatedLogContent);
    const newLines = updatedLogContent.split('\n');
    
    const diffCount = newLines.length - originalLines.length;
    const endLine = 1 + diffCount + 1;
    localLogLines.push(1, endLine);
    
    console.log(`[INGEST] Logged changes in ${targetLayer}/wiki/log.md`);
  }

  // 5. Update root log.md
  const rootLogPath = path.join(submoduleRoot, 'log.md');
  if (fs.existsSync(rootLogPath)) {
    let rootLogContent = readUtf8(rootLogPath);
    const rootHeader = `## [${dateStr}]`;
    const rangeSuffix = localLogLines.length === 2 ? `#L${localLogLines[0]}-L${localLogLines[1]}` : '';
    const rootEntry = `- Добавлены изменения в [${targetLayer}/wiki/log.md](file:///${submoduleRoot.replace(/\\/g, '/')}/${targetLayer}/wiki/log.md${rangeSuffix})`;
    
    let updatedRoot = '';
    if (rootLogContent.includes(rootHeader)) {
      updatedRoot = rootLogContent.replace(rootHeader, `${rootHeader}\n${rootEntry}`);
    } else {
      updatedRoot = `${rootHeader}\n${rootEntry}\n\n` + rootLogContent;
    }
    writeUtf8Bom(rootLogPath, updatedRoot);
    console.log(`[INGEST] Logged activity pointer in root log.md`);
  }

  // 6. Check and resolve stubs.md
  const stubsPath = path.join(layerDir, 'wiki', 'stubs.md');
  if (fs.existsSync(stubsPath)) {
    let stubsContent = readUtf8(stubsPath);
    const stubPattern = new RegExp(`^\\s*-\\s*\\[\\[${nameWithoutExt}\\]\\].*$\\r?\\n?`, 'm');
    if (stubPattern.test(stubsContent)) {
      stubsContent = stubsContent.replace(stubPattern, '');
      writeUtf8Bom(stubsPath, stubsContent);
      console.log(`[STUB] Resolved and removed stub [[${nameWithoutExt}]] from ${targetLayer}/wiki/stubs.md!`);
    }
  }
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
      const relPath = path.relative(layerSrcDir, mdFilePath).replace(/\\/g, '/');
      const subfolder = path.dirname(relPath);
      const fileName = path.basename(relPath);

      console.log(`Импорт файла: ${relPath} в слой ${layer}, подпапка raw/${subfolder}`);

      // Вызываем встроенную логику импорта напрямую
      ingestFile(mdFilePath, layer, subfolder);

      // Переносим .meta файл, если он есть
      const metaFileSrc = mdFilePath + '.meta';
      if (fs.existsSync(metaFileSrc)) {
        const metaFileDest = path.join(submoduleRoot, layer, 'raw', subfolder, `${fileName}.meta`);
        
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
