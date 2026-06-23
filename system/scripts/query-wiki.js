import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const submoduleRoot = path.resolve(__dirname, '../..');
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
  
  for (const layer of chain) {
    const wikiDir = path.join(submoduleRoot, layer, 'wiki');
    if (!fs.existsSync(wikiDir)) continue;
    
    // Check root wiki folder first
    const rootCandidate = path.join(wikiDir, `${pageName}.md`);
    if (fs.existsSync(rootCandidate)) {
      return {
        layer,
        subfolder: '',
        absolutePath: rootCandidate,
        relativePath: path.relative(projectRoot, rootCandidate).replace(/\\/g, '/')
      };
    }
    
    for (const sd of subdirs) {
      const candidate = path.join(wikiDir, sd, `${pageName}.md`);
      if (fs.existsSync(candidate)) {
        return {
          layer,
          subfolder: sd,
          absolutePath: candidate,
          relativePath: path.relative(projectRoot, candidate).replace(/\\/g, '/')
        };
      }
    }
  }
  return null;
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


  // 4. Check and resolve stubs.md
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

  // 5. Validate
  if (noValidate) {
    console.log('[INGEST] Skipping validation check as requested.');
    return;
  }
  console.log('Running validation check...');
  try {
    execSync(`node "${path.join(submoduleRoot, 'system', 'scripts', 'lint-wiki.js')}"`, { stdio: 'inherit', cwd: projectRoot });
    console.log('[INGEST] Ingestion and validation completed successfully!');
  } catch (err) {
    console.warn('[INGEST] Warning: Validation returned warnings or errors.');
  }
}

// Highlight occurrences in a line with ANSI yellow/bold
function highlightQuery(line, query) {
  const idx = line.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return line;
  const before = line.substring(0, idx);
  const match = line.substring(idx, idx + query.length);
  const after = line.substring(idx + query.length);
  return before + '\x1b[33m\x1b[1m' + match + '\x1b[0m' + highlightQuery(after, query);
}

// Helper to extract snippets (matching line + 2 lines of context) and merge overlapping
function getSnippets(text, query) {
  const lines = text.split(/\r?\n/);
  const matchingIndices = [];
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(query.toLowerCase())) {
      matchingIndices.push(index);
    }
  });

  if (matchingIndices.length === 0) return [];

  // Merge overlapping ranges
  const ranges = [];
  matchingIndices.forEach(idx => {
    const start = Math.max(0, idx - 2);
    const end = Math.min(lines.length - 1, idx + 2);
    if (ranges.length === 0) {
      ranges.push({ start, end });
    } else {
      const last = ranges[ranges.length - 1];
      if (start <= last.end + 1) {
        last.end = Math.max(last.end, end);
      } else {
        ranges.push({ start, end });
      }
    }
  });

  // Build snippet texts
  return ranges.map(range => {
    const snippetLines = [];
    for (let i = range.start; i <= range.end; i++) {
      const lineNum = i + 1;
      const isMatchLine = matchingIndices.includes(i);
      let formattedLine = lines[i];
      if (isMatchLine) {
        formattedLine = highlightQuery(formattedLine, query);
      }
      snippetLines.push(`      ${lineNum}: ${formattedLine}`);
    }
    return snippetLines.join('\n');
  });
}

// Command dispatcher
function printUsage() {
  console.log(`Usage:
  node query-wiki.js --page <name>                  - Search page across layers
  node query-wiki.js --search <text>                - Full-text search across layers
  node query-wiki.js --context <layer>              - Specify context layer (default: auto-detected)
  node query-wiki.js --list-layers                  - List all layers and dependencies
  node query-wiki.js --info                         - Show general statistics and info
  node query-wiki.js --ingest <path> --layer <name> - Ingest new data
    Options for ingest:
      --subfolder <name>  (Specify subfolder under raw, e.g. GDDDocs)
      --no-validate       (Skip validation during ingestion)
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

// Dynamically determine the context layer
function detectContextLayer() {
  const params = parseArgs();
  if (params.context) {
    return params.context;
  }

  const cwd = process.cwd();
  const relative = path.relative(submoduleRoot, cwd);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    const parts = relative.split(path.sep);
    if (parts.length > 0 && parts[0]) {
      const candidate = parts[0];
      const manifestPath = path.join(submoduleRoot, candidate, 'wiki.json');
      if (fs.existsSync(manifestPath)) {
        return candidate;
      }
    }
  }

  // Fallback: detect the first directory containing wiki.json in submoduleRoot
  try {
    const entries = fs.readdirSync(submoduleRoot);
    for (const file of entries) {
      if (file === 'plans' || file === 'system') continue;
      const fullPath = path.join(submoduleRoot, file);
      if (fs.statSync(fullPath).isDirectory()) {
        const manifestPath = path.join(fullPath, 'wiki.json');
        if (fs.existsSync(manifestPath)) {
          return file;
        }
      }
    }
  } catch (err) {
    // Ignore errors and fallback to 'llm-wiki'
  }

  return 'llm-wiki';
}

function run() {
  const params = parseArgs();
  const contextLayer = detectContextLayer();
  const chain = getDependencyChain(contextLayer);
  
  if (params['list-layers']) {
    console.log('Available Layers & Dependency Chains:');
    const allLayers = [];
    fs.readdirSync(submoduleRoot).forEach(file => {
      const fullPath = path.join(submoduleRoot, file);
      if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'wiki.json'))) {
        allLayers.push(file);
      }
    });
    
    allLayers.forEach(l => {
      const lChain = getDependencyChain(l);
      console.log(`  - ${l} (dependencies: ${lChain.slice(1).join(', ') || 'none'})`);
    });
  } else if (params.info) {
    console.log('Vault Information:');
    const allLayers = [];
    fs.readdirSync(submoduleRoot).forEach(file => {
      const fullPath = path.join(submoduleRoot, file);
      if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'wiki.json'))) {
        allLayers.push(file);
      }
    });
    
    let totalWikiPages = 0;
    let totalRawSources = 0;
    
    console.log(`Submodule Root: ${submoduleRoot}`);
    console.log(`Context Layer: ${contextLayer} (chain: ${chain.join(' -> ')})`);
    console.log(`Layers count: ${allLayers.length}`);
    
    allLayers.forEach(l => {
      const wikiDir = path.join(submoduleRoot, l, 'wiki');
      let pagesCount = 0;
      if (fs.existsSync(wikiDir)) {
        pagesCount = getFilesRecursively(wikiDir, ['.md']).length;
        totalWikiPages += pagesCount;
      }
      const rawDir = path.join(submoduleRoot, l, 'raw');
      let rawCount = 0;
      if (fs.existsSync(rawDir)) {
        rawCount = getFilesRecursively(rawDir, ['.md', '.json', '.ps1', '.clinerules', '.cursorrules', '.windsurfrules', 'mcp_config.json']).length;
        totalRawSources += rawCount;
      }
      console.log(`  Layer [${l}]: ${pagesCount} wiki pages, ${rawCount} raw sources`);
    });
    console.log(`Total: ${totalWikiPages} wiki pages, ${totalRawSources} raw sources`);
  } else if (params.page) {
    const pageName = params.page;
    const page = findPage(pageName, chain);
    if (page) {
      console.log(`Page: [[${pageName}]]`);
      console.log(`Layer: ${page.layer}`);
      console.log(`Type/Subfolder: ${page.subfolder}`);
      console.log(`Relative path: ${page.relativePath}`);
      console.log(`Absolute path: ${page.absolutePath}`);
    } else {
      console.log(`Page [[${pageName}]] not found in context ${contextLayer} or its dependencies.`);
    }
  } else if (params.search) {
    const query = params.search.toLowerCase();
    console.log(`Searching for "${query}" with context "${contextLayer}" (chain: ${chain.join(', ')})...`);
    
    let matchesCount = 0;
    chain.forEach(layer => {
      const wikiDir = path.join(submoduleRoot, layer, 'wiki');
      if (!fs.existsSync(wikiDir)) return;
      
      const mdFiles = getFilesRecursively(wikiDir, ['.md']);
      mdFiles.forEach(f => {
        const text = readUtf8(f);
        if (text.toLowerCase().includes(query)) {
          const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
          console.log(`\n\x1b[32m\x1b[1m[MATCH] ${layer} | ${rel}\x1b[0m`);
          const snippets = getSnippets(text, params.search);
          snippets.forEach(s => {
            console.log(s);
            console.log('      ---');
          });
          matchesCount++;
        }
      });
    });
    console.log(`\nFound ${matchesCount} matching documents.`);
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
