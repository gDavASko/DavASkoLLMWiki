const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const submoduleRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(submoduleRoot, '../../..');

// Helper to write UTF-8 with BOM
function writeUtf8Bom(filePath, content) {
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  const contentBuf = Buffer.from(content, 'utf8');
  const totalBuf = Buffer.concat([bom, contentBuf]);
  fs.writeFileSync(filePath, totalBuf);
}

// Helper to read UTF-8 without BOM
function readUtf8(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.startsWith('\uFEFF')) {
    content = content.substring(1);
  }
  return content;
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
      if (extensions.includes(ext) || extensions.includes(file)) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

// Helper to get dependencies recursively
function getDependencyChain(contextLayer) {
  const chain = [contextLayer];
  const visited = new Set();
  
  function resolve(layer) {
    if (visited.has(layer)) return;
    visited.add(layer);
    
    const manifestPath = path.join(submoduleRoot, layer, 'wiki.json');
    if (!fs.existsSync(manifestPath)) return;
    
    try {
      const manifest = JSON.parse(readUtf8(manifestPath));
      if (manifest.dependencies && Array.isArray(manifest.dependencies)) {
        manifest.dependencies.forEach(dep => {
          if (!chain.includes(dep)) {
            chain.push(dep);
          }
          resolve(dep);
        });
      }
    } catch (err) {
      console.error(`Error parsing manifest for ${layer}:`, err.message);
    }
  }
  
  resolve(contextLayer);
  return chain;
}

// Search for a page by name across the dependency chain
function findPage(pageName, chain) {
  const subdirs = ['concepts', 'runbooks', 'entities', 'sources', 'syntheses', 'decisions', 'maps'];
  const matches = [];
  
  for (const layer of chain) {
    const wikiDir = path.join(submoduleRoot, layer, 'wiki');
    if (!fs.existsSync(wikiDir)) continue;
    
    for (const sd of subdirs) {
      const candidate = path.join(wikiDir, sd, `${pageName}.md`);
      if (fs.existsSync(candidate)) {
        matches.push({
          layer,
          subfolder: sd,
          absolutePath: candidate,
          relativePath: path.relative(projectRoot, candidate).replace(/\\/g, '/')
        });
      }
    }
  }
  
  if (matches.length === 0) return null;
  
  if (matches.length > 1) {
    console.warn(`\n[WARNING] Priority Conflict: Page "${pageName}" exists in multiple layers:`);
    matches.forEach((m, idx) => {
      console.warn(`  [${idx}] ${m.layer} (Path: ${m.relativePath})`);
    });
    console.warn(`Defaulting to the most specific project layer: "${matches[0].layer}"\n`);
  }
  
  return matches[0];
}

// Helper to generate a random 32-character hex GUID for Unity .meta files
function generateGuid() {
  let guid = '';
  for (let i = 0; i < 32; i++) {
    guid += Math.floor(Math.random() * 16).toString(16);
  }
  return guid;
}

// Ingest file from NewData
function ingestFile(sourceFileRel, targetLayer, subfolder, noValidate) {
  const sourceFile = path.resolve(submoduleRoot, sourceFileRel);
  if (!fs.existsSync(sourceFile)) {
    console.error(`[Error] Source file not found: ${sourceFileRel}`);
    process.exit(1);
  }

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
  
  const rawRelPath = path.relative(layerDir, destRawFile).replace(/\\/g, '/');
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

  // Generate Unity .meta file for the wiki page
  const metaFilePath = summaryFilePath + '.meta';
  const metaContent = `fileFormatVersion: 2
guid: ${generateGuid()}
TextScriptImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
  writeUtf8Bom(metaFilePath, metaContent);
  console.log(`[INGEST] Created .meta file: ${targetLayer}/wiki/sources/${summaryFileName}.meta`);

  // 3. Update local index.md
  const indexPath = path.join(layerDir, 'wiki', 'index.md');
  if (fs.existsSync(indexPath)) {
    let indexContent = readUtf8(indexPath);
    const summaryWikiLink = `[[${nameWithoutExt}]]`;
    if (!indexContent.includes(summaryWikiLink)) {
      // Find the "### Sources" or "## Sources" section to insert link
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
    
    // Calculate added lines for root log reference
    const originalLines = logContent.split('\n');
    writeUtf8Bom(logPath, updatedLogContent);
    const newLines = updatedLogContent.split('\n');
    
    // Find the range of changes
    const diffCount = newLines.length - originalLines.length;
    const endLine = 1 + diffCount + 1; // approximate header + entries
    localLogLines.push(1, endLine);
    
    console.log(`[INGEST] Logged changes in ${targetLayer}/wiki/log.md`);
  }

  // 5. Update root log.md with link to line range of local log
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
    // Stub representation: e.g. "- [[nameWithoutExt]]" or "- [[nameWithoutExt]] (description)"
    const stubPattern = new RegExp(`^\\s*-\\s*\\[\\[${nameWithoutExt}\\]\\].*$\\r?\\n?`, 'm');
    if (stubPattern.test(stubsContent)) {
      stubsContent = stubsContent.replace(stubPattern, '');
      writeUtf8Bom(stubsPath, stubsContent);
      console.log(`[STUB] Resolved and removed stub [[${nameWithoutExt}]] from ${targetLayer}/wiki/stubs.md!`);
    } else {
      // Print unresolved stubs check warning
      const stubsLines = stubsContent.split('\n').filter(line => line.includes('[['));
      if (stubsLines.length > 0) {
        console.log(`[WARNING] В базе данных ${targetLayer} по-прежнему отсутствуют описания для следующих заглушек (stubs):\n` + stubsLines.join('\n'));
      }
    }
  }

  // 7. Validate
  if (noValidate) {
    console.log('[INGEST] Skipping validation check as requested.');
    return;
  }
  console.log('Running validation check...');
  try {
    execSync(`node "${path.join(submoduleRoot, 'system', 'lint-wiki.js')}"`, { stdio: 'inherit', cwd: projectRoot });
    console.log('[INGEST] Ingestion and validation completed successfully!');
  } catch (err) {
    console.warn('[INGEST] Warning: Validation returned warnings or errors.');
  }
}

// Command dispatcher
function printUsage() {
  console.log(`Usage:
  node query-wiki.js --page <name>                  - Search page across layers
  node query-wiki.js --search <text>                - Full-text search across layers
  node query-wiki.js --ingest <path> --layer <name> - Ingest new data
    Options for ingest:
      --subfolder <name>  (Specify subfolder under raw, e.g. GDDDocs)
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      if (i + 1 < args.length && !args[i+1].startsWith('--')) {
        params[key] = args[i+1];
        i++;
      } else {
        params[key] = true;
      }
    }
  }
  return params;
}

function run() {
  const params = parseArgs();
  
  if (params.page) {
    const pageName = params.page;
    // Default context layer is dentistry-cow-wiki
    const chain = getDependencyChain('dentistry-cow-wiki');
    const page = findPage(pageName, chain);
    if (page) {
      console.log(`Page: [[${pageName}]]`);
      console.log(`Layer: ${page.layer}`);
      console.log(`Type/Subfolder: ${page.subfolder}`);
      console.log(`Relative path: ${page.relativePath}`);
      console.log(`Absolute path: ${page.absolutePath}`);
    } else {
      console.log(`Page [[${pageName}]] not found in dentistry-cow-wiki or dependencies.`);
    }
  } else if (params.search) {
    const query = params.search.toLowerCase();
    const chain = getDependencyChain('dentistry-cow-wiki');
    console.log(`Searching for "${query}" across layers...`);
    
    let matchesCount = 0;
    chain.forEach(layer => {
      const wikiDir = path.join(submoduleRoot, layer, 'wiki');
      if (!fs.existsSync(wikiDir)) return;
      
      const mdFiles = getFilesRecursively(wikiDir, ['.md']);
      mdFiles.forEach(f => {
        const text = readUtf8(f);
        if (text.toLowerCase().includes(query)) {
          const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
          console.log(`  [MATCH] ${layer} | ${rel}`);
          matchesCount++;
        }
      });
    });
    console.log(`Found ${matchesCount} matching documents.`);
  } else if (params.ingest) {
    const file = params.ingest;
    const layer = params.layer;
    if (!layer) {
      console.error('[Error] Missing --layer argument for ingest.');
      printUsage();
      process.exit(1);
    }
    ingestFile(file, layer, params.subfolder, params['no-validate']);
  } else {
    printUsage();
  }
}

run();
