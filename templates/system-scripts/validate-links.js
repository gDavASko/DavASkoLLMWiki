const fs = require('fs');
const path = require('path');

const submoduleRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(submoduleRoot, '../../..');

const errors = [];
const warnings = [];

function addError(file, line, msg) {
  errors.push({ file, line, msg });
}

function addWarning(file, line, msg) {
  warnings.push({ file, line, msg });
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
function getFilesRecursively(dir, extensions, excludeDirs = []) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      const dirName = path.basename(fullPath);
      if (!excludeDirs.includes(dirName) && !file.startsWith('.')) {
        results = results.concat(getFilesRecursively(fullPath, extensions, excludeDirs));
      }
    } else {
      const ext = path.extname(file).toLowerCase();
      if (extensions.includes(ext) || extensions.includes(file)) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

// 1. Dynamic Layer Scanning and Manifest Parsing
const layers = [];
fs.readdirSync(submoduleRoot).forEach(file => {
  const fullPath = path.join(submoduleRoot, file);
  if (fs.statSync(fullPath).isDirectory()) {
    const manifestPath = path.join(fullPath, 'wiki.json');
    if (fs.existsSync(manifestPath)) {
      layers.push(file);
    }
  }
});

const manifests = {};
const dependencyChains = {};

layers.forEach(layer => {
  const manifestPath = path.join(submoduleRoot, layer, 'wiki.json');
  try {
    const manifest = JSON.parse(readUtf8(manifestPath));
    manifests[layer] = manifest;
  } catch (err) {
    addError(manifestPath, 0, `Error parsing wiki.json: ${err.message}`);
  }
});

// Resolve dependency chains
layers.forEach(layer => {
  const chain = [layer];
  const visited = new Set();
  
  function resolve(l) {
    if (visited.has(l)) return;
    visited.add(l);
    const manifest = manifests[l];
    if (manifest && manifest.dependencies && Array.isArray(manifest.dependencies)) {
      manifest.dependencies.forEach(dep => {
        if (!chain.includes(dep)) {
          chain.push(dep);
        }
        resolve(dep);
      });
    }
  }
  
  resolve(layer);
  dependencyChains[layer] = chain;
});

// Registry of all wiki pages: layer -> pageName -> absPath
const wikiPagesRegistry = {};
layers.forEach(layer => {
  const wikiDir = path.join(submoduleRoot, layer, 'wiki');
  if (!fs.existsSync(wikiDir)) return;
  
  const mdFiles = getFilesRecursively(wikiDir, ['.md']);
  mdFiles.forEach(f => {
    const pageName = path.parse(f).name;
    if (!wikiPagesRegistry[layer]) wikiPagesRegistry[layer] = {};
    wikiPagesRegistry[layer][pageName] = f;
  });
});

// Load stubs for each layer
const layerStubs = {};
layers.forEach(layer => {
  const stubsPath = path.join(submoduleRoot, layer, 'wiki', 'stubs.md');
  layerStubs[layer] = new Set();
  if (fs.existsSync(stubsPath)) {
    const content = readUtf8(stubsPath);
    const stubRegex = /\[\[([^\]|#]+)/g;
    let match;
    while ((match = stubRegex.exec(content)) !== null) {
      layerStubs[layer].add(match[1].trim());
    }
  }
});

// Resolve Obsidian Link
function resolveWikiLink(linkTarget, sourceLayer) {
  const chain = dependencyChains[sourceLayer] || [sourceLayer];
  for (const layer of chain) {
    if (wikiPagesRegistry[layer] && wikiPagesRegistry[layer][linkTarget]) {
      return { resolved: true, path: wikiPagesRegistry[layer][linkTarget], type: 'page' };
    }
  }
  for (const layer of chain) {
    if (layerStubs[layer] && layerStubs[layer].has(linkTarget)) {
      return { resolved: true, type: 'stub' };
    }
  }
  return { resolved: false };
}

// Find layer of a file inside the submodule
function getFileLayer(filePath) {
  const rel = path.relative(submoduleRoot, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  if (parts.length > 1 && layers.includes(parts[0])) {
    return parts[0];
  }
  return null;
}

// Main scanning logic
function validateLinks() {
  console.log('=== Starting Link Validation ===');
  console.log('Project root:', projectRoot);
  console.log('Submodule root:', submoduleRoot);

  // Collect files to scan
  let filesToScan = [];

  // 1. All markdown, json, rules inside submodule layers
  layers.forEach(layer => {
    const layerPath = path.join(submoduleRoot, layer);
    filesToScan = filesToScan.concat(
      getFilesRecursively(layerPath, ['.md', '.json', '.clinerules', '.cursorrules', '.windsurfrules'])
    );
  });

  // 2. System files
  const systemPath = path.join(submoduleRoot, 'system');
  if (fs.existsSync(systemPath)) {
    filesToScan = filesToScan.concat(getFilesRecursively(systemPath, ['.md', '.json']));
  }

  // 3. Submodule root files
  fs.readdirSync(submoduleRoot).forEach(file => {
    const fullPath = path.join(submoduleRoot, file);
    if (fs.statSync(fullPath).isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (['.md', '.json'].includes(ext)) {
        filesToScan.push(fullPath);
      }
    }
  });

  // 4. Project root rules
  fs.readdirSync(projectRoot).forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (fs.statSync(fullPath).isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (['.md', '.clinerules', '.cursorrules', '.windsurfrules', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md'].includes(ext) || file === 'AGENTS.md' || file === 'CLAUDE.md' || file === 'GEMINI.md') {
        filesToScan.push(fullPath);
      }
    }
  });

  console.log(`Scanning ${filesToScan.length} files...`);

  filesToScan.forEach(filePath => {
    if (path.basename(filePath) === 'validate_errors.json') return;
    const fileContent = readUtf8(filePath);
    const lines = fileContent.split('\n');
    const fileLayer = getFileLayer(filePath);
    const dirPath = path.dirname(filePath);
    const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

    lines.forEach((lineText, index) => {
      const lineNumber = index + 1;

      // Check for doubled system paths (system\system/ or system/system/)
      if (/system[\\/]system[\\/]/i.test(lineText)) {
        addError(filePath, lineNumber, `Doubled system directory path detected in line: "${lineText.trim()}"`);
      }

      // Check for raw/project-docs/ references that should have been updated
      if (/raw\/project-docs\//i.test(lineText)) {
        addError(filePath, lineNumber, `Deprecated path 'raw/project-docs/' detected in line: "${lineText.trim()}"`);
      }

      // 1. Check Obsidian links [[link]]
      const obsidianRegex = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
      let obsMatch;
      while ((obsMatch = obsidianRegex.exec(lineText)) !== null) {
        const linkTarget = obsMatch[1].trim();
        const ignoredObsidianLinks = ['wiki-links', 'related-page', 'wiki-link', 'some-page'];
        if (ignoredObsidianLinks.includes(linkTarget)) continue;

        if (fileLayer) {
          const resolution = resolveWikiLink(linkTarget, fileLayer);
          if (!resolution.resolved) {
            addError(filePath, lineNumber, `Missing wiki page [[${linkTarget}]] (referenced from layer ${fileLayer})`);
          } else if (resolution.type === 'stub') {
            addWarning(filePath, lineNumber, `Link points to a stub/placeholder [[${linkTarget}]]`);
          }
        } else {
          // If referencing from outside submodule (e.g. root AGENTS.md), we check if page exists in ANY layer
          let found = false;
          for (const layer of layers) {
            if (wikiPagesRegistry[layer] && wikiPagesRegistry[layer][linkTarget]) {
              found = true;
              break;
            }
          }
          if (!found) {
            // Check stubs in any layer
            for (const layer of layers) {
              if (layerStubs[layer] && layerStubs[layer].has(linkTarget)) {
                found = true;
                break;
              }
            }
          }
          if (!found) {
            addError(filePath, lineNumber, `Global reference to missing wiki page [[${linkTarget}]]`);
          }
        }
      }

      // 2. Check Markdown links [label](href)
      const markdownRegex = /\[[^\]]*\]\(([^)]+)\)/g;
      let mdMatch;
      while ((mdMatch = markdownRegex.exec(lineText)) !== null) {
        let href = mdMatch[1].trim();
        
        // Skip network links
        if (/^(https?:|mailto:|tel:)/i.test(href)) {
          continue;
        }

        // Strip anchor if present
        href = href.split('#')[0];
        if (!href) continue;

        // Skip placeholders, templates, examples and ToDo summaries
        if (href.includes('path/to') || href.includes('example') || relPath.includes('/examples/') || relPath.includes('/sample') || relPath.endsWith('ToDo_Summary.md')) {
          continue;
        }

        // Strip url formatting / decoding
        href = decodeURIComponent(href);

        let targetPath = '';

        if (href.startsWith('file:///Assets/') || href.startsWith('file://Assets/')) {
          // Path within project
          const cleanPath = href.replace(/^file:\/\/\/?/, ''); // leaves "Assets/..."
          targetPath = path.resolve(projectRoot, cleanPath);
        } else if (href.startsWith('file://references/') || href.startsWith('file:///references/') ||
                   href.startsWith('file://examples/') || href.startsWith('file:///examples/')) {
          // Skill local reference
          const cleanPath = href.replace(/^file:\/\/\/?/, ''); // leaves "references/..." or "examples/..."
          targetPath = path.resolve(dirPath, cleanPath);
        } else if (href.startsWith('file:///')) {
          // Absolute path or project-root relative
          const cleanPath = href.substring(8); // remove file:///
          if (cleanPath.match(/^[a-zA-Z]:/)) {
            // Absolute path e.g. E:/...
            targetPath = path.resolve(cleanPath);
          } else {
            // Relative to project root
            targetPath = path.resolve(projectRoot, cleanPath);
          }
        } else if (href.startsWith('file://')) {
          // Two slashes, check if relative to project root or absolute
          const cleanPath = href.substring(7);
          targetPath = path.resolve(projectRoot, cleanPath);
        } else {
          // Standard relative markdown path
          targetPath = path.resolve(dirPath, href);
        }

        // Verify file existence
        if (!fs.existsSync(targetPath)) {
          const isPlanFile = relPath.endsWith('_Plan.md') || relPath.endsWith('_plan.md') || relPath.endsWith('PLANS.md') || relPath.endsWith('implementation_plan.md') || relPath.endsWith('task.md') || relPath.endsWith('walkthrough.md');
          if (!isPlanFile) {
            addError(filePath, lineNumber, `Broken file link: "${href}" (resolved to: ${targetPath})`);
          }
        }
      }
    });
  });

  // Write errors and warnings to JSON for reliable parsing
  const jsonOutput = {
    warnings: warnings.map(w => ({ file: path.relative(projectRoot, w.file), line: w.line, msg: w.msg })),
    errors: errors.map(e => ({ file: path.relative(projectRoot, e.file), line: e.line, msg: e.msg }))
  };
  fs.writeFileSync(path.join(submoduleRoot, 'system/validate_errors.json'), JSON.stringify(jsonOutput, null, 2), 'utf8');

  // Display results
  console.log('\n=== Link Validation Summary ===');
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nValidation failed. Errors written to system/validate_errors.json');
    process.exit(1);
  } else {
    console.log('\nValidation passed successfully!');
    process.exit(0);
  }
}

validateLinks();
