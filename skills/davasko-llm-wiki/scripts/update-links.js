// DEPRECATED: Migration tool. Use with caution to prevent double replacement of substrings.
const fs = require('fs');
const path = require('path');

const submoduleRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(submoduleRoot, '../../..');

// Helper to write file as UTF-8 with BOM
function writeUtf8Bom(filePath, content) {
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  const contentBuf = Buffer.from(content, 'utf8');
  const totalBuf = Buffer.concat([bom, contentBuf]);
  fs.writeFileSync(filePath, totalBuf);
}

// Helper to read file content (removing BOM if present for processing)
function readUtf8(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.startsWith('\uFEFF')) {
    content = content.substring(1);
  }
  return content;
}

// Helper to recursively find all files in a directory matching extensions
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

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Main logic
function main() {
  console.log('--- Starting Link Actualization ---');
  console.log('Submodule root:', submoduleRoot);
  console.log('Project root:', projectRoot);

  // 1. Hardcoded raw mappings
  const rawMappings = {
    // raw files
    'raw/project-docs/code_style.md': 'davasko-wiki/raw/code_style.md',
    'raw/project-docs/code_style.md.meta': 'davasko-wiki/raw/code_style.md.meta',
    'unity-wiki/raw/code_style.md': 'davasko-wiki/raw/code_style.md',
    'unity-wiki/raw/code_style.md.meta': 'davasko-wiki/raw/code_style.md.meta',
    'raw/shader-ai-guidelines.md': 'unity-wiki/raw/shader-ai-guidelines.md',
    'raw/shader-ai-guidelines.md.meta': 'unity-wiki/raw/shader-ai-guidelines.md.meta',
    'raw/project-docs/OptimizationDocs': 'unity-wiki/raw/OptimizationDocs',
    
    'raw/project-docs/principals.md': 'davasko-wiki/raw/principals.md',
    'raw/project-docs/principals.md.meta': 'davasko-wiki/raw/principals.md.meta',
    'raw/project-docs/architecture.md': 'davasko-wiki/raw/architecture.md',
    'raw/project-docs/architecture.md.meta': 'davasko-wiki/raw/architecture.md.meta',
    'raw/project-docs/SETUP_NEW_PROJECT.md': 'davasko-wiki/raw/SETUP_NEW_PROJECT.md',
    'raw/project-docs/SETUP_NEW_PROJECT.md.meta': 'davasko-wiki/raw/SETUP_NEW_PROJECT.md.meta',
    'raw/project-docs/Architecture': 'davasko-wiki/raw/Architecture',
    'raw/ModuleComponents.md': 'davasko-wiki/raw/ModuleComponents.md',
    'raw/ModuleComponents.md.meta': 'davasko-wiki/raw/ModuleComponents.md.meta',
    'raw/ModuleSystems.md': 'davasko-wiki/raw/ModuleSystems.md',
    'raw/ModuleSystems.md.meta': 'davasko-wiki/raw/ModuleSystems.md.meta',
    
    'raw/project-docs/PLANS.md': 'llm-wiki/raw/PLANS.md',
    'raw/project-docs/PLANS.md.meta': 'llm-wiki/raw/PLANS.md.meta',
    'raw/project-docs/GDDDocs': 'dentistry-cow-wiki/raw/GDDDocs',
    'raw/project-docs/create_plombir_tasks.ps1': 'dentistry-cow-wiki/raw/create_plombir_tasks.ps1',
    'raw/project-docs/create_plombir_tasks.ps1.meta': 'dentistry-cow-wiki/raw/create_plombir_tasks.ps1.meta',
    'raw/project-docs/test_bitrix_webhook.ps1': 'davasko-wiki/raw/test_bitrix_webhook.ps1',
    'raw/project-docs/test_bitrix_webhook.ps1.meta': 'davasko-wiki/raw/test_bitrix_webhook.ps1.meta',
    'raw/project-docs/claude-commands': 'llm-wiki/raw/claude-commands',
    'raw/project-docs/ide-rules': 'llm-wiki/raw/ide-rules',
    'raw/project-docs/ai-skills': 'llm-wiki/raw/ai-skills~',
    'raw/project-docs/ai-skills~': 'llm-wiki/raw/ai-skills~',

    // execution plans (pattern search will also be done, but let's list the known stabilization plans)
    'raw/project-docs/ExecPlan_ModuleSystem_Stabilization.md': 'davasko-wiki/raw/ExecPlan_ModuleSystem_Stabilization.md',
    'raw/project-docs/ExecPlan_ModuleSystem_Stabilization.md.meta': 'davasko-wiki/raw/ExecPlan_ModuleSystem_Stabilization.md.meta',
    'raw/project-docs/ExecPlan_ScenarioGraph_Stabilization.md': 'davasko-wiki/raw/ExecPlan_ScenarioGraph_Stabilization.md',
    'raw/project-docs/ExecPlan_ScenarioGraph_Stabilization.md.meta': 'davasko-wiki/raw/ExecPlan_ScenarioGraph_Stabilization.md.meta',
    
    // system tools and configs
    'lint-wiki.js': 'system/lint-wiki.js',
    'lint-wiki.ps1': 'system/lint-wiki.ps1',
    'lint-wiki.ps1.meta': 'system/lint-wiki.ps1.meta',
    'query-wiki.js': 'system/query-wiki.js',
    'update-links.js': 'system/update-links.js',
    'readme.human.md': 'system/readme.human.md',
    'readme.human.md.meta': 'system/readme.human.md.meta',
    'AI-Docs-Refactoring_plan.md': 'system/AI-Docs-Refactoring_plan.md',
    'evals/failures.md': 'system/evals/failures.md',
    'evals/failures.md.meta': 'system/evals/failures.md.meta',
    'evals/questions.md': 'system/evals/questions.md',
    'evals/questions.md.meta': 'system/evals/questions.md.meta',
    
    // new data migrations
    'NewData/external-skills': 'unity-wiki/raw/external-skills',
    'NewData/research/vibe-code-review-youtube': 'unity-wiki/raw/transcripts/ai-vibe-code-review',
    'raw/transcripts/ai-vibe-code-review/kent-beck-tdd-ai-agents.md': 'unity-wiki/raw/transcripts/ai-vibe-code-review/kent-beck-tdd-ai-agents-and-coding.md',
    'raw/transcripts/ai-vibe-code-review/addy-osmani-beyond-vibe-coding.md': 'unity-wiki/raw/transcripts/ai-vibe-code-review/pragmatic-engineer-addy-osmani-beyond-vibe-coding.md',
    'raw/transcripts/ai-vibe-code-review/martin-fowler-ai-software-engineering.md': 'unity-wiki/raw/transcripts/ai-vibe-code-review/pragmatic-engineer-martin-fowler-ai-software-engineering.md',
    'raw/transcripts/ai-vibe-code-review/thoughtworks-vibe-coding.md': 'unity-wiki/raw/transcripts/ai-vibe-code-review/thoughtworks-we-need-to-talk-about-vibe-coding.md',
    
    // wiki page renames due to filenames cleanup
    '[[kent-beck-tdd-ai-agents]]': '[[kent-beck-tdd-ai-agents-and-coding]]',
    '[[addy-osmani-beyond-vibe-coding]]': '[[pragmatic-engineer-addy-osmani-beyond-vibe-coding]]',
    '[[martin-fowler-ai-software-engineering]]': '[[pragmatic-engineer-martin-fowler-ai-software-engineering]]',
    '[[thoughtworks-vibe-coding]]': '[[thoughtworks-we-need-to-talk-about-vibe-coding]]',

    // Specific dentistry-cow-wiki moves to new layers
    'dentistry-cow-wiki/raw/PLANS.md': 'llm-wiki/raw/PLANS.md',
    'dentistry-cow-wiki/raw/PLANS.md.meta': 'llm-wiki/raw/PLANS.md.meta',
    'dentistry-cow-wiki/raw/ide-rules': 'llm-wiki/raw/ide-rules',
    'dentistry-cow-wiki/raw/ide-rules.meta': 'llm-wiki/raw/ide-rules.meta',
    'dentistry-cow-wiki/raw/claude-commands': 'llm-wiki/raw/claude-commands',
    'dentistry-cow-wiki/raw/claude-commands.meta': 'llm-wiki/raw/claude-commands.meta',
    'dentistry-cow-wiki/raw/ExecPlan_ModuleSystem_Stabilization.md': 'davasko-wiki/raw/ExecPlan_ModuleSystem_Stabilization.md',
    'dentistry-cow-wiki/raw/ExecPlan_ModuleSystem_Stabilization.md.meta': 'davasko-wiki/raw/ExecPlan_ModuleSystem_Stabilization.md.meta',
    'dentistry-cow-wiki/raw/ExecPlan_ScenarioGraph_Stabilization.md': 'davasko-wiki/raw/ExecPlan_ScenarioGraph_Stabilization.md',
    'dentistry-cow-wiki/raw/ExecPlan_ScenarioGraph_Stabilization.md.meta': 'davasko-wiki/raw/ExecPlan_ScenarioGraph_Stabilization.md.meta',
    'dentistry-cow-wiki/raw/test_bitrix_webhook.ps1': 'davasko-wiki/raw/test_bitrix_webhook.ps1',
    'dentistry-cow-wiki/raw/test_bitrix_webhook.ps1.meta': 'davasko-wiki/raw/test_bitrix_webhook.ps1.meta',

    'dentistry-cow-wiki/wiki/concepts/execplans.md': 'llm-wiki/wiki/concepts/execplans.md',
    'dentistry-cow-wiki/wiki/concepts/execplans.md.meta': 'llm-wiki/wiki/concepts/execplans.md.meta',
    'dentistry-cow-wiki/wiki/runbooks/raw-data-ingest-workflow.md': 'llm-wiki/wiki/runbooks/raw-data-ingest-workflow.md',
    'dentistry-cow-wiki/wiki/runbooks/raw-data-ingest-workflow.md.meta': 'llm-wiki/wiki/runbooks/raw-data-ingest-workflow.md.meta',
    'dentistry-cow-wiki/wiki/runbooks/setup-ai-project-rules.md': 'llm-wiki/wiki/runbooks/setup-ai-project-rules.md',
    'dentistry-cow-wiki/wiki/runbooks/setup-ai-project-rules.md.meta': 'llm-wiki/wiki/runbooks/setup-ai-project-rules.md.meta',
    'dentistry-cow-wiki/wiki/maps/operations-map.md': 'llm-wiki/wiki/maps/operations-map.md',
    'dentistry-cow-wiki/wiki/maps/operations-map.md.meta': 'llm-wiki/wiki/maps/operations-map.md.meta',

    'dentistry-cow-wiki/wiki/runbooks/bitrix-task-import.md': 'davasko-wiki/wiki/runbooks/bitrix-task-import.md',
    'dentistry-cow-wiki/wiki/runbooks/bitrix-task-import.md.meta': 'davasko-wiki/wiki/runbooks/bitrix-task-import.md.meta',
    'dentistry-cow-wiki/wiki/runbooks/decompose-task-to-backlog.md': 'davasko-wiki/wiki/runbooks/decompose-task-to-backlog.md',
    'dentistry-cow-wiki/wiki/runbooks/decompose-task-to-backlog.md.meta': 'davasko-wiki/wiki/runbooks/decompose-task-to-backlog.md.meta',
    'dentistry-cow-wiki/wiki/sources/scenario-graph-execplans.md': 'davasko-wiki/wiki/sources/scenario-graph-execplans.md',
    'dentistry-cow-wiki/wiki/sources/scenario-graph-execplans.md.meta': 'davasko-wiki/wiki/sources/scenario-graph-execplans.md.meta',
    'dentistry-cow-wiki/wiki/sources/automation-scripts-and-rules.md': 'llm-wiki/wiki/sources/llm-rules-and-skills.md',
    'dentistry-cow-wiki/wiki/sources/automation-scripts-and-rules.md.meta': 'llm-wiki/wiki/sources/llm-rules-and-skills.md.meta',

    // Dentistry Cow / Plombir script reorganisation
    'dentistry-cow-wiki/raw/create_plombir_tasks.ps1': 'plombir-buildings-wiki/raw/create_plombir_tasks.ps1',
    'dentistry-cow-wiki/raw/create_plombir_tasks.ps1.meta': 'plombir-buildings-wiki/raw/create_plombir_tasks.ps1.meta',

    // Stabilization / Exec Plans moved to root plans/ folder
    'davasko-wiki/raw/ExecPlan_ScenarioGraph_Stabilization.md': 'plans/ExecPlan_ScenarioGraph_Stabilization.md',
    'davasko-wiki/raw/ExecPlan_ScenarioGraph_Stabilization.md.meta': 'plans/ExecPlan_ScenarioGraph_Stabilization.md.meta',
    'davasko-wiki/raw/ExecPlan_ModuleSystem_Stabilization.md': 'plans/ExecPlan_ModuleSystem_Stabilization.md',
    'davasko-wiki/raw/ExecPlan_ModuleSystem_Stabilization.md.meta': 'plans/ExecPlan_ModuleSystem_Stabilization.md.meta',
    'dentistry-cow-wiki/raw/GDDDocs/Dentistry_cow/ToothExtractionStage_Plan.md': 'plans/ToothExtractionStage_Plan.md',
    'dentistry-cow-wiki/raw/GDDDocs/Dentistry_cow/ToothExtractionStage_Plan.md.meta': 'plans/ToothExtractionStage_Plan.md.meta',
    'dentistry-cow-wiki/raw/GDDDocs/Dentistry_cow/dentistry_cow_import_plan.md': 'plans/dentistry_cow_import_plan.md',
    'dentistry-cow-wiki/raw/GDDDocs/Dentistry_cow/dentistry_cow_import_plan.md.meta': 'plans/dentistry_cow_import_plan.md.meta',
    'davasko-wiki/raw/Architecture/Skills/CodeReviewSkillCreatePlan.md': 'plans/CodeReviewSkillCreatePlan.md',
    'davasko-wiki/raw/Architecture/Skills/CodeReviewSkillCreatePlan.md.meta': 'plans/CodeReviewSkillCreatePlan.meta',
    'system/AI-Docs-Refactoring_plan.md': 'plans/AI-Docs-Refactoring_plan.md',
    'system/AI-Docs-Refactoring_plan.md.meta': 'plans/AI-Docs-Refactoring_plan.md.meta'
  };

  // 1a. Dynamically scan target layers for skills to map from dentistry-cow-wiki
  const skillLayers = ['llm-wiki', 'davasko-wiki', 'unity-wiki'];
  skillLayers.forEach(layer => {
    const skillsDir = path.join(submoduleRoot, layer, 'raw/ai-skills~');
    if (fs.existsSync(skillsDir)) {
      fs.readdirSync(skillsDir).forEach(skill => {
        if (skill.endsWith('.meta')) return;
        const oldPath = `dentistry-cow-wiki/raw/ai-skills~/${skill}`;
        const newPath = `${layer}/raw/ai-skills~/${skill}`;
        rawMappings[oldPath] = newPath;
        rawMappings[`${oldPath}.meta`] = `${newPath}.meta`;
      });
    }
  });

  const dynamicMappings = {};

  // Layers to scan for dynamic wiki page mappings
  const layers = ['llm-wiki', 'unity-wiki', 'davasko-wiki', 'dentistry-cow-wiki', 'plombir-buildings-wiki', 'railway-wiki'];
  
  layers.forEach(layer => {
    const wikiPath = path.join(submoduleRoot, layer, 'wiki');
    if (fs.existsSync(wikiPath)) {
      const files = getFilesRecursively(wikiPath, ['.md', '.meta']);
      files.forEach(f => {
        const relPath = path.relative(submoduleRoot, f).replace(/\\/g, '/');
        // relPath is e.g. "unity-wiki/wiki/concepts/ai-learning-loop.md"
        // The old path is e.g. "wiki/concepts/ai-learning-loop.md"
        const oldPath = relPath.substring(layer.length + 1);
        dynamicMappings[oldPath] = relPath;
      });
    }
  });

  // Combine mappings
  const allMappings = { ...rawMappings, ...dynamicMappings };

  console.log(`Generated ${Object.keys(allMappings).length} path mappings.`);

  // Define files to scan for replacements
  // 1. Files inside submodule (under layers and submodule root)
  let filesToScan = [];
  layers.forEach(layer => {
    const layerPath = path.join(submoduleRoot, layer);
    filesToScan = filesToScan.concat(getFilesRecursively(layerPath, ['.md', '.json', '.ps1', '.clinerules', '.cursorrules', '.windsurfrules']));
  });
  
  // Scan system directory (excluding .ps1)
  const systemPath = path.join(submoduleRoot, 'system');
  if (fs.existsSync(systemPath)) {
    filesToScan = filesToScan.concat(getFilesRecursively(systemPath, ['.md', '.json', '.clinerules', '.cursorrules', '.windsurfrules']));
  }
  
  fs.readdirSync(submoduleRoot).forEach(file => {
    const fullPath = path.join(submoduleRoot, file);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (['.md', '.json', '.clinerules', '.cursorrules', '.windsurfrules'].includes(ext) || file === 'AGENTS.md' || file === 'LLM-WIKI.md') {
        filesToScan.push(fullPath);
      }
    }
  });

  // 2. Main rule files in project root
  const rootExtensions = ['.md', '.clinerules', '.cursorrules', '.windsurfrules', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];
  fs.readdirSync(projectRoot).forEach(file => {
    const fullPath = path.join(projectRoot, file);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (rootExtensions.includes(ext) || rootExtensions.includes(file)) {
        filesToScan.push(fullPath);
      }
    }
  });

  // 3. Project rules under .agents, .claude, etc.
  const additionalDirs = [
    path.join(projectRoot, '.agents'),
    path.join(projectRoot, '.claude'),
    path.join(projectRoot, '.cursor'),
    path.join(projectRoot, '.windsurf'),
    path.join(projectRoot, '.cline'),
    path.join(projectRoot, '.roo'),
    path.join(projectRoot, '.github')
  ];

  additionalDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      filesToScan = filesToScan.concat(getFilesRecursively(dir, ['.md', '.mdc', '.json', '.instructions.md']));
    }
  });

  console.log(`Scanning and updating ${filesToScan.length} files...`);

  let updatedCount = 0;

  filesToScan.forEach(f => {
    // Avoid scanning update-links.js itself
    if (f === __filename) return;

    let content = readUtf8(f);
    let changed = false;

    // Apply replacements
    for (const [oldPath, newPath] of Object.entries(allMappings)) {
      // 1. Match full path format with boundary checks to prevent substring issues
      const oldFullPath1 = `Assets/DavASko/davasko-ai-docs/${oldPath}`;
      const newFullPath1 = `Assets/DavASko/davasko-ai-docs/${newPath}`;
      const regexFull = new RegExp('(?<![\\w-\\/])' + escapeRegExp(oldFullPath1) + '(?!\\w)', 'g');

      if (regexFull.test(content)) {
        content = content.replace(regexFull, newFullPath1);
        changed = true;
      }

      // 2. Match relative path formats used inside wiki with boundary checks
      const regexRel = new RegExp('(?<![\\w-\\/])' + escapeRegExp(oldPath) + '(?!\\w)', 'g');
      if (regexRel.test(content)) {
        content = content.replace(regexRel, newPath);
        changed = true;
      }
    }

    // Match general references to raw/project-docs/ for LLM tools
    const llmPlansPattern = /raw\/project-docs\/(PLANS|ide-rules|claude-commands|ai-skills)/g;
    if (llmPlansPattern.test(content)) {
      content = content.replace(llmPlansPattern, 'llm-wiki/raw/$1');
      changed = true;
    }

    // Match general references to raw/project-docs/ for project tools
    const plansPattern = /raw\/project-docs\/(ExecPlan|GDDDocs|create_plombir)/g;
    if (plansPattern.test(content)) {
      content = content.replace(plansPattern, 'dentistry-cow-wiki/raw/$1');
      changed = true;
    }

    // Match general references to raw/project-docs/ for DavASko webhook
    const davaskoWebhookPattern = /raw\/project-docs\/test_bitrix_webhook/g;
    if (davaskoWebhookPattern.test(content)) {
      content = content.replace(davaskoWebhookPattern, 'davasko-wiki/raw/test_bitrix_webhook');
      changed = true;
    }

    // Match dentistry-cow-wiki paths for rule files that moved to llm-wiki
    const generalCowRulePattern = /dentistry-cow-wiki\/raw\/(PLANS|ide-rules|claude-commands)/g;
    if (generalCowRulePattern.test(content)) {
      content = content.replace(generalCowRulePattern, 'llm-wiki/raw/$1');
      changed = true;
    }

    // Match dentistry-cow-wiki paths for stabilization plans that moved to davasko-wiki
    const generalCowStabilizationPattern = /dentistry-cow-wiki\/raw\/(ExecPlan_ModuleSystem_Stabilization|ExecPlan_ScenarioGraph_Stabilization|test_bitrix_webhook)/g;
    if (generalCowStabilizationPattern.test(content)) {
      content = content.replace(generalCowStabilizationPattern, 'davasko-wiki/raw/$1');
      changed = true;
    }

    const optimizationPattern = /raw\/project-docs\/OptimizationDocs/g;
    if (optimizationPattern.test(content)) {
      content = content.replace(optimizationPattern, 'unity-wiki/raw/OptimizationDocs');
      changed = true;
    }

    const codeStylePattern = /raw\/project-docs\/code_style.md/g;
    if (codeStylePattern.test(content)) {
      content = content.replace(codeStylePattern, 'davasko-wiki/raw/code_style.md');
      changed = true;
    }

    const generalRawPattern = /raw\/project-docs\//g;
    if (generalRawPattern.test(content)) {
      content = content.replace(generalRawPattern, 'davasko-wiki/raw/');
      changed = true;
    }

    // Ensure all ai-skills references use the tilde directory name 'ai-skills~'
    if (content.includes('dentistry-cow-wiki/raw/ai-skills') && !content.includes('dentistry-cow-wiki/raw/ai-skills~')) {
      content = content.split('dentistry-cow-wiki/raw/ai-skills').join('dentistry-cow-wiki/raw/ai-skills~');
      changed = true;
    }
    if (content.includes('llm-wiki/raw/ai-skills') && !content.includes('llm-wiki/raw/ai-skills~')) {
      content = content.split('llm-wiki/raw/ai-skills').join('llm-wiki/raw/ai-skills~');
      changed = true;
    }
    if (content.includes('davasko-wiki/raw/ai-skills') && !content.includes('davasko-wiki/raw/ai-skills~')) {
      content = content.split('davasko-wiki/raw/ai-skills').join('davasko-wiki/raw/ai-skills~');
      changed = true;
    }
    if (content.includes('unity-wiki/raw/ai-skills') && !content.includes('unity-wiki/raw/ai-skills~')) {
      content = content.split('unity-wiki/raw/ai-skills').join('unity-wiki/raw/ai-skills~');
      changed = true;
    }

    if (changed) {
      writeUtf8Bom(f, content);
      updatedCount++;
    }
  });

  console.log(`Link Actualization completed. Updated paths in ${updatedCount} files.`);
}

main();
