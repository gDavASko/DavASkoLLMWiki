const fs = require('fs');
const path = require('path');

const submoduleRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(submoduleRoot, '../../..');

const issues = [];
const warnings = [];

function addIssue(msg) {
  issues.push(msg);
}

function addWarning(msg) {
  warnings.push(msg);
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
    addIssue(`[Manifest] Error parsing ${layer}/wiki.json: ${err.message}`);
  }
});

// Resolve dependency chains for all layers
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

// Map to check where each wiki page lives (pageName -> layer)
const wikiPagesRegistry = {};
// Store file names without extension to their full paths
const wikiPagesMap = {}; 

layers.forEach(layer => {
  const wikiDir = path.join(submoduleRoot, layer, 'wiki');
  if (!fs.existsSync(wikiDir)) return;
  
  const mdFiles = getFilesRecursively(wikiDir, ['.md']);
  mdFiles.forEach(f => {
    const pageName = path.parse(f).name;
    const rel = path.relative(submoduleRoot, f).replace(/\\/g, '/');
    
    if (!wikiPagesRegistry[layer]) wikiPagesRegistry[layer] = {};
    wikiPagesRegistry[layer][pageName] = f;
    
    wikiPagesMap[rel] = f;
  });
});

// Load stubs for each layer
const layerStubs = {};
layers.forEach(layer => {
  const stubsPath = path.join(submoduleRoot, layer, 'wiki', 'stubs.md');
  layerStubs[layer] = new Set();
  if (fs.existsSync(stubsPath)) {
    const content = readUtf8(stubsPath);
    // Parse links from stubs.md
    const stubRegex = /\[\[([^\]|#]+)/g;
    let match;
    while ((match = stubRegex.exec(content)) !== null) {
      layerStubs[layer].add(match[1].trim());
    }
  }
});

// Helper to check if a page exists in the dependency chain or stubs
function resolveWikiLink(linkTarget, sourceLayer) {
  const chain = dependencyChains[sourceLayer] || [sourceLayer];
  
  // 1. Search in compiled pages of sourceLayer and dependencies
  for (const layer of chain) {
    if (wikiPagesRegistry[layer] && wikiPagesRegistry[layer][linkTarget]) {
      return { resolved: true, path: wikiPagesRegistry[layer][linkTarget], type: 'page' };
    }
  }
  
  // 2. Search in stubs of sourceLayer and dependencies
  for (const layer of chain) {
    if (layerStubs[layer] && layerStubs[layer].has(linkTarget)) {
      return { resolved: true, type: 'stub' };
    }
  }
  
  return { resolved: false };
}

// Run validations
layers.forEach(layer => {
  const wikiDir = path.join(submoduleRoot, layer, 'wiki');
  if (!fs.existsSync(wikiDir)) return;
  
  const mdFiles = getFilesRecursively(wikiDir, ['.md']);
  
  mdFiles.forEach(f => {
    const text = readUtf8(f);
    const rel = path.relative(submoduleRoot, f).replace(/\\/g, '/');
    const filename = path.basename(f);

    // 1. Bitrix REST check
    if (/https?:\/\/[^\s"'`]*bitrix24\.ru\/rest\//i.test(text)) {
      addIssue(`${rel} contains a hardcoded Bitrix24 REST webhook URL`);
    }

    // 2. Obsidian [[links]] check
    const linkRegex = /\[\[([^\]|#]+)/g;
    let match;
    while ((match = linkRegex.exec(text)) !== null) {
      const linkTarget = match[1].trim();
      const resolution = resolveWikiLink(linkTarget, layer);
      
      if (!resolution.resolved) {
        addIssue(`${rel} links to missing wiki page [[${linkTarget}]]`);
      } else if (resolution.type === 'stub') {
        addWarning(`${rel} links to placeholder/stub [[${linkTarget}]]`);
      }
    }

    // 3. Required headers check (excluding log.md)
    if (filename !== 'log.md' && filename !== 'stubs.md') {
      const requiredFields = [
        '**Summary**:',
        '**Sources**:',
        '**Last updated**:',
        '## Related'
      ];
      requiredFields.forEach(field => {
        if (!text.includes(field)) {
          addIssue(`${rel} missing required page field: ${field}`);
        }
      });
    }

    // 4. Citation sources checks: (source: path)
    const sourceRegex = /\(source: ([^)]+)\)/g;
    while ((match = sourceRegex.exec(text)) !== null) {
      const sourceBlock = match[1].replace(/\s+/g, ' ');
      const items = sourceBlock.split('; source: ');
      
      items.forEach(item => {
        const source = item.trim();
        if (!source || source === 'source-needed') {
          addIssue(`${rel} contains unresolved source marker`);
          return;
        }

        // Resolve source file: path must exist relative to submodule root
        // Wait, source can be e.g. "raw/code_style.md" inside unity-wiki
        // If cited as relative inside the layer, like "raw/code_style.md"
        // Let's resolve relative to current layer and dependency layers
        let sourceFound = false;
        const chain = dependencyChains[layer] || [layer];
        
        for (const depLayer of chain) {
          // Check absolute or layer-relative path
          // If cited as "unity-wiki/raw/code_style.md"
          const candidate1 = path.join(submoduleRoot, source);
          // If cited as "raw/code_style.md" relative to depLayer
          const candidate2 = path.join(submoduleRoot, depLayer, source);
          
          if (fs.existsSync(candidate1) || fs.existsSync(candidate2)) {
            sourceFound = true;
            break;
          }
        }
        
        if (!sourceFound) {
          addIssue(`${rel} cites missing source file: ${source}`);
        }
      });
    }
  });
});

// Check for orphan pages
layers.forEach(layer => {
  const wikiDir = path.join(submoduleRoot, layer, 'wiki');
  if (!fs.existsSync(wikiDir)) return;
  
  const mdFiles = getFilesRecursively(wikiDir, ['.md']);
  mdFiles.forEach(f => {
    const name = path.parse(f).name;
    if (name === 'index' || name === 'log' || name === 'stubs' || name === 'contradictions') return;
    
    let hasInboundLink = false;
    const escapedName = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const linkPattern = new RegExp(`\\[\\[${escapedName}(\\]\\]|[#|])`);
    
    // Check all pages in layers that depend on this layer or are this layer
    for (const otherLayer of layers) {
      // Check if otherLayer can depend on this page's layer
      const otherChain = dependencyChains[otherLayer] || [otherLayer];
      if (!otherChain.includes(layer)) continue;
      
      const otherWikiDir = path.join(submoduleRoot, otherLayer, 'wiki');
      if (!fs.existsSync(otherWikiDir)) continue;
      
      const otherMd = getFilesRecursively(otherWikiDir, ['.md']);
      for (const otherFile of otherMd) {
        if (otherFile === f) continue;
        const otherText = readUtf8(otherFile);
        if (linkPattern.test(otherText)) {
          hasInboundLink = true;
          break;
        }
      }
      if (hasInboundLink) break;
    }
    
    if (!hasInboundLink) {
      const rel = path.relative(submoduleRoot, f).replace(/\\/g, '/');
      addWarning(`wiki page has no inbound links: ${rel}`);
    }
  });
});

// Validate raw markdown links inside raw/ folders
layers.forEach(layer => {
  const rawDir = path.join(submoduleRoot, layer, 'raw');
  if (!fs.existsSync(rawDir)) return;
  
  const mdFiles = getFilesRecursively(rawDir, ['.md']);
  mdFiles.forEach(f => {
    const text = readUtf8(f);
    const dir = path.dirname(f);
    const rel = path.relative(submoduleRoot, f).replace(/\\/g, '/');

    // Bitrix webhook check in raw
    if (/https?:\/\/[^\s"'`]*bitrix24\.ru\/rest\//i.test(text)) {
      addIssue(`${rel} contains a hardcoded Bitrix24 REST webhook URL`);
    }

    // Markdown link checks [label](href)
    const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(text)) !== null) {
      const href = match[1].trim();
      if (/^(https?:|mailto:|#)/i.test(href) || /^\w+:/i.test(href)) {
        continue;
      }

      const clean = href.split('#')[0];
      if (!clean) continue;

      const candidate = path.resolve(dir, clean);
      if (!fs.existsSync(candidate)) {
        addWarning(`${rel} has missing raw Markdown link: ${href}`);
      }
    }
  });
});

// Unity .meta file check for wiki/ and evals/
layers.forEach(layer => {
  const layerPath = path.join(submoduleRoot, layer);
  const checkPaths = [
    path.join(layerPath, 'wiki'),
    path.join(layerPath, 'evals')
  ];
  
  checkPaths.forEach(cp => {
    if (!fs.existsSync(cp)) return;
    const allFiles = getFilesRecursively(cp, ['.md', '.json', '.meta']);
    allFiles.forEach(f => {
      const filename = path.basename(f);
      if (filename.endsWith('.meta')) return;
      
      const metaPath = f + '.meta';
      if (!fs.existsSync(metaPath)) {
        const rel = path.relative(submoduleRoot, f).replace(/\\/g, '/');
        addIssue(`${rel} missing Unity .meta file`);
      }
    });
  });
});

// Unused raw sources check
layers.forEach(layer => {
  const rawDir = path.join(submoduleRoot, layer, 'raw');
  if (!fs.existsSync(rawDir)) return;
  
  // Get all files inside raw/ (excluding .meta)
  const rawFiles = fs.readdirSync(rawDir);
  const extensions = ['.md', '.json', '.ps1', '.clinerules', '.cursorrules', '.windsurfrules', 'mcp_config.json'];
  
  // Combine all texts from all wiki pages in all layers
  let allWikiText = '';
  layers.forEach(l => {
    const wikiDir = path.join(submoduleRoot, l, 'wiki');
    if (!fs.existsSync(wikiDir)) return;
    getFilesRecursively(wikiDir, ['.md']).forEach(f => {
      allWikiText += '\n' + readUtf8(f);
    });
  });
  
  const allRawFiles = getFilesRecursively(rawDir, extensions);
  allRawFiles.forEach(f => {
    const rel = path.relative(submoduleRoot, f).replace(/\\/g, '/');
    if (!allWikiText.includes(rel)) {
      addWarning(`raw source is not mentioned by any wiki page: ${rel}`);
    }
  });
});

// Output results
console.log('=== KBPro LLM Wiki Lint ===');
console.log(`Layers parsed: ${layers.join(', ')}`);

if (warnings.length > 0) {
  console.log('\nWarnings:');
  warnings.forEach(w => console.log(`  - ${w}`));
}

if (issues.length > 0) {
  console.log('\nIssues:');
  issues.forEach(i => console.error(`  - ${i}`));
  process.exit(1);
} else {
  console.log('\nOK: wiki lint passed successfully');
  process.exit(0);
}
