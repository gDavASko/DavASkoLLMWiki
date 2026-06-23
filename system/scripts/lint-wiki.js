import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const submoduleRoot = path.resolve(__dirname, '../..');
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

// Helper to parse simple YAML frontmatter
function parseFrontmatter(text) {
  const result = {};
  if (!text || !text.startsWith('---')) return result;
  const parts = text.split('---');
  if (parts.length < 3) return result;
  const yamlLines = parts[1].split('\n');
  
  let currentKey = null;

  yamlLines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Check list item
    if (trimmed.startsWith('-') && currentKey) {
      if (!Array.isArray(result[currentKey])) {
        result[currentKey] = [];
      }
      const val = trimmed.substring(1).trim().replace(/^['"]|['"]$/g, '');
      result[currentKey].push(val);
      return;
    }
    
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;
    
    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    
    currentKey = key;
    if (value === '') {
      result[key] = [];
    } else if (value === 'true') {
      result[key] = true;
    } else if (value === 'false') {
      result[key] = false;
    } else {
      result[key] = value;
    }
  });
  
  return result;
}

// Helper to check raw source deprecation and validation status
function checkRawSourceStatus(filePath) {
  // 1. Explicit .deprecated companion file
  const deprecatedFile = filePath + '.deprecated';
  if (fs.existsSync(deprecatedFile)) {
    try {
      const reason = readUtf8(deprecatedFile).trim();
      return { deprecated: true, reason: reason || 'explicitly deprecated via companion file', validated: false };
    } catch (e) {}
  }

  // 2. Frontmatter check if markdown
  let isMarkdown = filePath.endsWith('.md');
  let frontmatter = {};
  if (isMarkdown) {
    try {
      const text = readUtf8(filePath);
      frontmatter = parseFrontmatter(text);
    } catch (e) {}
  }

  if (frontmatter.deprecated === true) {
    return { deprecated: true, reason: 'explicitly deprecated via frontmatter', validated: false };
  }

  // 3. Age check (> 365 days)
  try {
    const stats = fs.statSync(filePath);
    const mtimeMs = stats.mtimeMs;
    const ageDays = (Date.now() - mtimeMs) / (1000 * 60 * 60 * 24);
    
    if (ageDays > 365) {
      let validated = false;
      const validatedFile = filePath + '.validated';
      if (fs.existsSync(validatedFile)) {
        validated = true;
      } else if (frontmatter.last_validated) {
        const valDate = new Date(frontmatter.last_validated);
        if (!isNaN(valDate.getTime())) {
          const valAgeDays = (Date.now() - valDate.getTime()) / (1000 * 60 * 60 * 24);
          if (valAgeDays <= 365) {
            validated = true;
          }
        }
      }
      
      if (!validated) {
        return { deprecated: true, reason: `implicit deprecation by age (${Math.floor(ageDays)} days without validation)`, validated: false };
      }
    }
  } catch (e) {}

  return { deprecated: false, validated: false };
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
  if (file === 'plans') return; // Skip plans directory in root
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

// 1a. DFS check for cyclic dependencies
const tempVisited = new Set();
const permVisited = new Set();

function checkCycle(l) {
  if (tempVisited.has(l)) {
    addIssue(`[Cycle Detection] Cyclic dependency detected involving layer: ${l}`);
    return;
  }
  if (permVisited.has(l)) return;

  tempVisited.add(l);
  const manifest = manifests[l];
  if (manifest && manifest.dependencies && Array.isArray(manifest.dependencies)) {
    manifest.dependencies.forEach(dep => {
      checkCycle(dep);
    });
  }
  tempVisited.delete(l);
  permVisited.add(l);
}

layers.forEach(layer => {
  checkCycle(layer);
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
// Global page registry to check for duplicate names across all layers
const globalPagesRegistry = {};

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

    // Check duplicate page names across all layers (excluding indexes/stubs/contradictions)
    if (pageName !== 'index' && pageName !== 'stubs' && pageName !== 'contradictions') {
      if (globalPagesRegistry[pageName]) {
        addIssue(`[Duplicate Page Name] Page name "${pageName}" is defined in multiple files: ${globalPagesRegistry[pageName]} and ${rel}`);
      } else {
        globalPagesRegistry[pageName] = rel;
      }
    }
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

// Metrics tracking structure
const metrics = {
  layers: {}
};
layers.forEach(l => {
  metrics.layers[l] = { pagesCount: 0, draftsCount: 0, reviewedCount: 0, stableCount: 0, deprecatedCount: 0, rawCount: 0, rawMentionedCount: 0 };
});

// Run validations
layers.forEach(layer => {
  const wikiDir = path.join(submoduleRoot, layer, 'wiki');
  if (!fs.existsSync(wikiDir)) return;
  
  const mdFiles = getFilesRecursively(wikiDir, ['.md']);
  
  mdFiles.forEach(f => {
    const text = readUtf8(f);
    const rel = path.relative(submoduleRoot, f).replace(/\\/g, '/');
    const filename = path.basename(f);

    // Update metrics: pages count
    metrics.layers[layer].pagesCount++;

    // 1. Bitrix REST check
    if (/https?:\/\/[^\s"'`]*bitrix24\.ru\/rest\//i.test(text)) {
      addIssue(`${rel} contains a hardcoded Bitrix24 REST webhook URL`);
    }

    // 2. Obsidian [[links]] check
    const linkRegex = /\[\[([^\]|#]+)/g;
    let match;
    const warnedLinks = new Set();
    while ((match = linkRegex.exec(text)) !== null) {
      const linkTarget = match[1].trim();
      if (warnedLinks.has(linkTarget)) continue;
      
      const resolution = resolveWikiLink(linkTarget, layer);
      
      if (!resolution.resolved) {
        addIssue(`${rel} links to missing wiki page [[${linkTarget}]]`);
        warnedLinks.add(linkTarget);
      } else if (resolution.type === 'stub') {
        addWarning(`${rel} links to placeholder/stub [[${linkTarget}]]`);
        warnedLinks.add(linkTarget);
      }
    }

    // 3. Required frontmatter check (excluding stubs.md, contradictions.md, index.md)
    if (filename !== 'stubs.md' && filename !== 'contradictions.md' && filename !== 'index.md') {
      const front = parseFrontmatter(text);
      
      // Update metrics: statuses count
      if (front.status === 'draft') metrics.layers[layer].draftsCount++;
      else if (front.status === 'reviewed') metrics.layers[layer].reviewedCount++;
      else if (front.status === 'stable') metrics.layers[layer].stableCount++;
      else if (front.status === 'deprecated') metrics.layers[layer].deprecatedCount++;

      // Validate title
      if (!front.title && !text.includes('# ')) {
        addIssue(`${rel} missing title (must have title in frontmatter or H1 header in body)`);
      }

      // Validate type
      const allowedTypes = ['source-summary', 'concept', 'entity', 'synthesis', 'runbook', 'decision', 'contradiction', 'map', 'index'];
      if (front.type) {
        if (!allowedTypes.includes(front.type)) {
          addIssue(`${rel} has invalid page type: '${front.type}'. Allowed: ${allowedTypes.join(', ')}`);
        }
      } else {
        addIssue(`${rel} missing required frontmatter field: type`);
      }

      // Validate status
      const allowedStatuses = ['draft', 'reviewed', 'stable', 'deprecated', 'accepted', 'rejected', 'active'];
      if (front.status) {
        if (!allowedStatuses.includes(front.status)) {
          addIssue(`${rel} has invalid page status: '${front.status}'. Allowed: ${allowedStatuses.join(', ')}`);
        }
      } else {
        addIssue(`${rel} missing required frontmatter field: status`);
      }

      // Validate sources (either in frontmatter list or specified in body text)
      const hasSources = (front.sources && front.sources.length > 0) || text.includes('**Sources**:') || text.includes('**sources**:') || text.includes('(source:');
      if (!hasSources) {
        addIssue(`${rel} missing required page sources`);
      }

      // Validate last_updated
      const hasLastUpdated = front.last_updated || text.includes('**Last updated**:') || text.includes('**last updated**:');
      if (!hasLastUpdated) {
        addIssue(`${rel} missing required page field: last_updated`);
      }

      // Validate related
      const hasRelated = (front.related && front.related.length > 0) || /## Related( Pages| pages)?/i.test(text);
      if (!hasRelated) {
        addIssue(`${rel} missing required page field: related`);
      }

      // Check for summary in body (must have summary description)
      const hasSummary = text.includes('**Summary**:') || text.includes('**summary**:') || text.includes('## Key Claims');
      if (!hasSummary) {
        addIssue(`${rel} missing page summary`);
      }
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

        let sourceFound = false;
        let resolvedPath = '';
        const chain = dependencyChains[layer] || [layer];
        
        for (const depLayer of chain) {
          const candidate1 = path.join(submoduleRoot, source);
          const candidate2 = path.join(submoduleRoot, depLayer, source);
          
          if (fs.existsSync(candidate1)) {
            sourceFound = true;
            resolvedPath = candidate1;
            break;
          } else if (fs.existsSync(candidate2)) {
            sourceFound = true;
            resolvedPath = candidate2;
            break;
          }
        }
        
        if (!sourceFound) {
          addIssue(`${rel} cites missing source file: ${source}`);
        } else {
          // Check raw source deprecation status
          const status = checkRawSourceStatus(resolvedPath);
          if (status.deprecated) {
            let currentWikiPageDeprecated = false;
            try {
              const front = parseFrontmatter(text);
              if (front.status === 'deprecated' || front.deprecated === true) {
                currentWikiPageDeprecated = true;
              }
            } catch (e) {}
            
            if (!currentWikiPageDeprecated) {
              addWarning(`${rel} cites deprecated raw source ${source} (${status.reason})`);
            }
          }
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
    if (name === 'index' || name === 'stubs' || name === 'contradictions') return;
    
    let hasInboundLink = false;
    const escapedName = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const linkPattern = new RegExp(`\\[\\[${escapedName}(\\]\\]|[#|])`);
    
    for (const otherLayer of layers) {
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

// Unused raw sources check with skills filtering
layers.forEach(layer => {
  const rawDir = path.join(submoduleRoot, layer, 'raw');
  if (!fs.existsSync(rawDir)) return;
  
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
    
    // SKIP skills folders to avoid false positive noise (~100 warnings)
    if (rel.includes('ai-skills~/')) return;

    metrics.layers[layer].rawCount++;
    if (allWikiText.includes(rel)) {
      metrics.layers[layer].rawMentionedCount++;
    } else {
      addWarning(`raw source is not mentioned by any wiki page: ${rel}`);
    }
  });
});

// Encoding policy check (Data Standards §1): .md MUST have a BOM; all other
// text files MUST NOT have a BOM (a BOM breaks JSON.parse and pollutes diffs).
// Directories that are build artifacts, vendored, or runtime-generated — skipped.
const ENCODING_DIR_BLACKLIST = new Set([
  'node_modules', '.git', 'scratch',
  '.agents', '.claude', '.codex', '.cursor', '.windsurf', '.cline', '.roo', '.gemini',
]);
// Files that are runtime artifacts and exempt from the policy.
const ENCODING_FILE_BLACKLIST = new Set(['.cursor-context-dump.md']);
const ENCODING_TEXT_EXT = new Set([
  '.md', '.json', '.js', '.ps1', '.mdc', '.yml', '.yaml',
  '.clinerules', '.cursorrules', '.windsurfrules',
]);

function checkEncodingRecursively(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ENCODING_DIR_BLACKLIST.has(entry.name)) continue;
      // Skip vendored / generated heavy folders under system/
      if (entry.name === 'models-cache' || entry.name === 'vendor' || entry.name === 'index-shards') continue;
      checkEncodingRecursively(full);
      continue;
    }
    if (ENCODING_FILE_BLACKLIST.has(entry.name)) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!ENCODING_TEXT_EXT.has(ext)) continue;

    let hasBom = false;
    try {
      const head = fs.readFileSync(full).slice(0, 3);
      hasBom = head[0] === 0xEF && head[1] === 0xBB && head[2] === 0xBF;
    } catch (e) { continue; }

    const rel = path.relative(submoduleRoot, full).replace(/\\/g, '/');
    if (ext === '.md') {
      if (!hasBom) addIssue(`[Encoding] ${rel} is Markdown but missing UTF-8 BOM (Data Standards §1)`);
    } else {
      if (hasBom) addIssue(`[Encoding] ${rel} must be UTF-8 without BOM (BOM breaks parsers / pollutes diffs)`);
    }
  }
}
checkEncodingRecursively(submoduleRoot);

// Output results
console.log('=== DavASko LLM Wiki Lint ===');
console.log(`Layers parsed: ${layers.join(', ')}`);

// Print Metrics
console.log('\n=== Metrics ===');
layers.forEach(l => {
  const m = metrics.layers[l];
  const coveragePercent = m.rawCount > 0 ? Math.round((m.rawMentionedCount / m.rawCount) * 100) : 100;
  console.log(`Layer: ${l}`);
  console.log(`  - Total Wiki Pages: ${m.pagesCount}`);
  console.log(`    - Drafts: ${m.draftsCount}`);
  console.log(`    - Reviewed: ${m.reviewedCount}`);
  console.log(`    - Stable: ${m.stableCount}`);
  console.log(`    - Deprecated: ${m.deprecatedCount}`);
  console.log(`  - Raw Sources: ${m.rawCount} (Cited: ${m.rawMentionedCount}, Coverage: ${coveragePercent}%)`);
});

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
