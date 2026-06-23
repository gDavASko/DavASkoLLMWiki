import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Project Root and Submodule Root Auto-Detection
const submoduleRoot = path.resolve(__dirname, '..'); // system/ parent is the submodule root

let projectRoot = submoduleRoot;
while (projectRoot) {
  if (fs.existsSync(path.join(projectRoot, 'Assets')) || 
      fs.existsSync(path.join(projectRoot, '.git')) || 
      fs.existsSync(path.join(projectRoot, 'package.json'))) {
    break;
  }
  const parent = path.dirname(projectRoot);
  if (parent === projectRoot) {
    // Fallback: assume project root is 3 levels up from Assets/DavASko/davasko-ai-docs/system
    projectRoot = path.resolve(submoduleRoot, '../../..');
    break;
  }
  projectRoot = parent;
}

// Dev mode: running inside the framework's own repository (submodule root == project
// root). Here skills/ is already the live source the IDE loads, so writing compiled
// copies into .claude/skills, .agents/skills, etc. would double-register every skill.
const isDevRepo = path.resolve(submoduleRoot) === path.resolve(projectRoot);

console.log('=== sync-ai-rules ===');
console.log(`Submodule Root: ${submoduleRoot}`);
console.log(`Project Root:   ${projectRoot}`);
if (isDevRepo) console.log('Mode:           DEV (framework repo) — local IDE skill copies skipped');
console.log('');

// 2. Locate Rules Directory
let rulesDir = '';
const rulesCandidates = [
  path.join(projectRoot, 'Assets', 'DavASko', 'davasko-ai-docs', 'llm-wiki', 'raw', 'ide-rules'),
  path.join(projectRoot, 'davasko-ai-docs', 'llm-wiki', 'raw', 'ide-rules'),
  path.join(submoduleRoot, 'llm-wiki', 'raw', 'ide-rules')
];
for (const c of rulesCandidates) {
  if (fs.existsSync(c)) {
    rulesDir = c;
    break;
  }
}

const bom = Buffer.from([0xEF, 0xBB, 0xBF]);

// Encoding policy (Data Standards \u00A71): BOM only for .md; everything else no BOM.
function shouldHaveBom(filePath) {
  return path.extname(filePath).toLowerCase() === '.md';
}

// Helper to write UTF-8 text honoring the BOM-only-for-.md policy.
function writeText(filePath, content) {
  const contentBuf = Buffer.from(content, 'utf8');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const out = shouldHaveBom(filePath) ? Buffer.concat([bom, contentBuf]) : contentBuf;
  fs.writeFileSync(filePath, out);
}

// Helper to read UTF-8 (stripping BOM if present)
function readText(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.startsWith('\uFEFF')) {
    content = content.substring(1);
  }
  return content;
}

// Helper to copy a text file, re-emitting with the correct BOM policy.
function copyTextFile(src, dest) {
  if (!fs.existsSync(src)) return;
  const content = readText(src);
  writeText(dest, content);
}

// Helper to copy a directory recursively, applying the BOM policy to text files.
function copyDirectory(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const items = fs.readdirSync(srcDir);
  items.forEach(item => {
    if (item.endsWith('.meta')) return; // skip Unity meta files
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      const ext = path.extname(item).toLowerCase();
      const textExtensions = ['.md', '.txt', '.json', '.ps1', '.js', '.mdc', '.yml', '.yaml', '.clinerules', '.cursorrules', '.windsurfrules'];
      if (textExtensions.includes(ext) || item === 'AGENTS.md' || item === 'CLAUDE.md' || item === 'GEMINI.md') {
        copyTextFile(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  });
}

// Bundle any ../../system/docs|scripts files a skill references into the skill
// itself (references/, examples/, scripts/) and rewrite the paths, so the synced
// SKILL.md is self-contained in every IDE destination. Generic for all skills.
function bundleSkillSystemRefs(dest) {
  const destSkillMd = path.join(dest, 'SKILL.md');
  if (!fs.existsSync(destSkillMd)) return;
  let content = readText(destSkillMd);

  const systemDocsDir = path.join(submoduleRoot, 'system', 'docs');
  const systemScriptsDir = path.join(submoduleRoot, 'system', 'scripts');

  const collect = (re) => {
    const names = new Set();
    let m;
    while ((m = re.exec(content)) !== null) names.add(m[1]);
    return names;
  };

  // Docs: setup-new-wiki.md \u2192 examples/, the rest \u2192 references/
  collect(/\.\.\/\.\.\/system\/docs\/([A-Za-z0-9._-]+)/g).forEach(file => {
    const sub = (file === 'setup-new-wiki.md') ? 'examples' : 'references';
    copyTextFile(path.join(systemDocsDir, file), path.join(dest, sub, file));
  });
  // Scripts \u2192 scripts/
  collect(/\.\.\/\.\.\/system\/scripts\/([A-Za-z0-9._-]+)/g).forEach(file => {
    copyTextFile(path.join(systemScriptsDir, file), path.join(dest, 'scripts', file));
  });

  content = rewriteSystemRefs(content);
  writeText(destSkillMd, content);
}

// Rewrite ../../system/... references to the bundled, self-contained locations.
function rewriteSystemRefs(content) {
  return content
    .replace(/\.\.\/\.\.\/system\/docs\/setup-new-wiki\.md/g, 'examples/setup-new-wiki.md')
    .replace(/\.\.\/\.\.\/system\/docs\//g, 'references/')
    .replace(/\.\.\/\.\.\/system\/scripts\//g, 'scripts/');
}

// Helper to delete directory recursively
function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach(file => {
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

// 3. Synchronize main rule files
if (rulesDir) {
  console.log(`Source rules dir found: ${rulesDir}`);
  const ruleTargets = [
    { src: '.cursorrules', dst: '.cursorrules' },
    { src: 'GEMINI.md', dst: 'GEMINI.md' },
    { src: '.windsurfrules', dst: '.windsurfrules' },
    { src: '.clinerules', dst: '.clinerules' },
    { src: 'copilot-instructions.md', dst: path.join('.github', 'copilot-instructions.md') },
    { src: 'AGENTS.md', dst: 'AGENTS.md' },
    { src: 'CLAUDE.md', dst: 'CLAUDE.md' }
  ];

  ruleTargets.forEach(t => {
    const srcPath = path.join(rulesDir, t.src);
    const dstPath = path.join(projectRoot, t.dst);
    if (fs.existsSync(srcPath)) {
      copyTextFile(srcPath, dstPath);
      console.log(`  [OK] Rule: ${t.src}  ->  ${t.dst}`);
    } else {
      console.log(`  [SKIP] Rule ${t.src} not found in rules directory.`);
    }
  });
} else {
  console.log('Rules directory (ide-rules) not found. Skipping main rules synchronization.');
}

// 4. Synchronize Claude Commands
const claudeCmdsSource = path.join(projectRoot, 'Assets', 'DavASko', 'davasko-ai-docs', 'llm-wiki', 'raw', 'claude-commands');
const claudeCmdsDest = path.join(projectRoot, '.claude', 'commands');
if (fs.existsSync(claudeCmdsSource)) {
  if (!fs.existsSync(claudeCmdsDest)) {
    fs.mkdirSync(claudeCmdsDest, { recursive: true });
  }
  fs.readdirSync(claudeCmdsSource).forEach(file => {
    if (file.endsWith('.md')) {
      copyTextFile(path.join(claudeCmdsSource, file), path.join(claudeCmdsDest, file));
      console.log(`  [OK] Claude command: ${file}  ->  .claude/commands/${file}`);
    }
  });
}

// 5. Gather and sync skills dynamically
const args = process.argv.slice(2);
const isGlobal = args.includes('--global') || args.includes('-g');

const layers = [];
fs.readdirSync(submoduleRoot).forEach(file => {
  if (file === 'plans' || file === 'system') return;
  const fullPath = path.join(submoduleRoot, file);
  if (fs.statSync(fullPath).isDirectory()) {
    if (fs.existsSync(path.join(fullPath, 'wiki.json'))) {
      layers.push(file);
    }
  }
});

const activeSkills = [];
const activeSkillNames = [];

layers.forEach(layer => {
  const layerSkillsDir = path.join(submoduleRoot, layer, 'raw', 'ai-skills~');
  // Also scan workspace layers if they exist outside the submodule root
  const workspaceLayerSkillsDir = path.join(projectRoot, 'Assets', 'DavASko', 'davasko-ai-docs', layer, 'raw', 'ai-skills~');
  
  [layerSkillsDir, workspaceLayerSkillsDir].forEach(sDir => {
    if (fs.existsSync(sDir)) {
      fs.readdirSync(sDir).forEach(file => {
        if (file.endsWith('.meta')) return;
        const skillPath = path.join(sDir, file);
        if (fs.statSync(skillPath).isDirectory() && fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
          if (!activeSkillNames.includes(file)) {
            activeSkillNames.push(file);
            activeSkills.push({ name: file, path: skillPath });
          }
        }
      });
    }
  });
});

// Also scan the root repository's skills directory (useful for direct framework development)
const rootSkillsDir = path.join(submoduleRoot, 'skills');
if (fs.existsSync(rootSkillsDir)) {
  fs.readdirSync(rootSkillsDir).forEach(file => {
    if (file.endsWith('.meta')) return;
    const skillPath = path.join(rootSkillsDir, file);
    if (fs.statSync(skillPath).isDirectory() && fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
      if (!activeSkillNames.includes(file)) {
        activeSkillNames.push(file);
        activeSkills.push({ name: file, path: skillPath });
      }
    }
  });
}

console.log(`\nActive skills found: ${activeSkillNames.join(', ')}`);
console.log(`Synchronizing ${activeSkills.length} skills...`);

// 5a. Clean up obsolete skills in local destinations
const skillDestFolders = ['.agents/skills', '.codex/skills', '.claude/skills', '.gemini/skills'];
skillDestFolders.forEach(folder => {
  const targetFolder = path.join(projectRoot, folder);
  if (fs.existsSync(targetFolder)) {
    fs.readdirSync(targetFolder).forEach(file => {
      const fullPath = path.join(targetFolder, file);
      if (fs.statSync(fullPath).isDirectory() && !activeSkillNames.includes(file)) {
        deleteFolderRecursive(fullPath);
        console.log(`  [CLEAN] Removed obsolete skill folder: ${folder}/${file}`);
      }
    });
  }
});

// 5b. Clean up obsolete single rule files
const singleRuleDestinations = [
  { dir: '.claude/commands', ext: '.md' },
  { dir: '.cursor/rules', ext: '.mdc' },
  { dir: '.windsurf/rules', ext: '.md' },
  { dir: '.cline/rules', ext: '.md' },
  { dir: '.roo/rules', ext: '.md' },
  { dir: '.github/instructions', ext: '.instructions.md' }
];

let claudeCmdNames = [];
if (fs.existsSync(claudeCmdsSource)) {
  claudeCmdNames = fs.readdirSync(claudeCmdsSource).filter(f => f.endsWith('.md')).map(f => path.parse(f).name);
}

singleRuleDestinations.forEach(fd => {
  const targetDir = path.join(projectRoot, fd.dir);
  if (fs.existsSync(targetDir)) {
    fs.readdirSync(targetDir).forEach(file => {
      const ext = path.extname(file).toLowerCase();
      let baseName = path.parse(file).name;
      if (fd.ext === '.instructions.md') {
        if (file.endsWith('.instructions.md')) {
          baseName = file.replace(/\.instructions\.md$/, '');
        } else {
          return;
        }
      }

      if (fd.dir === '.claude/commands' && claudeCmdNames.includes(baseName)) {
        return; // do not delete standard claude commands
      }

      if (ext === fd.ext || (fd.ext === '.instructions.md' && file.endsWith('.instructions.md'))) {
        if (!activeSkillNames.includes(baseName)) {
          fs.unlinkSync(path.join(targetDir, file));
          console.log(`  [CLEAN] Removed obsolete rule file: ${fd.dir}/${file}`);
        }
      }
    });
  }
});

// 6. Compile and Sync Active Skills
activeSkills.forEach(skill => {
  const skillName = skill.name;
  const skillSourceDir = skill.path;
  const skillMdPath = path.join(skillSourceDir, 'SKILL.md');

  // Define local IDE folder destinations. In dev mode these are skipped so the
  // framework repo does not double-register its own skills.
  const dirDestinations = isDevRepo ? [] : [
    path.join(projectRoot, '.agents', 'skills', skillName),
    path.join(projectRoot, '.codex', 'skills', skillName),
    path.join(projectRoot, '.claude', 'skills', skillName),
    path.join(projectRoot, '.gemini', 'skills', skillName)
  ];

  // If --global flag is set, add global .gemini config folder (allowed even in dev mode)
  if (isGlobal) {
    const homeDir = process.env.USERPROFILE || process.env.HOME || process.env.HOMEPATH;
    if (homeDir) {
      const globalSkillsDir = path.join(homeDir, '.gemini', 'config', 'skills', skillName);
      dirDestinations.push(globalSkillsDir);
      console.log(`  [GLOBAL] Target: ${globalSkillsDir}`);
    }
  }

  // Sync skill directory recursively to all target folders, then bundle any
  // ../../system/docs|scripts the SKILL.md references so it is self-contained.
  dirDestinations.forEach(dest => {
    copyDirectory(skillSourceDir, dest);
    bundleSkillSystemRefs(dest);
  });

  // Compile and sync SKILL.md to single rule file destinations (same path rewrite).
  const originalSkillMdContent = readText(skillMdPath);
  const compiledSkillMdContent = rewriteSystemRefs(originalSkillMdContent);

  const singleTargets = isDevRepo ? [] : [
    { path: path.join(projectRoot, '.claude', 'commands', `${skillName}.md`) },
    { path: path.join(projectRoot, '.cursor', 'rules', `${skillName}.mdc`) },
    { path: path.join(projectRoot, '.windsurf', 'rules', `${skillName}.md`) },
    { path: path.join(projectRoot, '.cline', 'rules', `${skillName}.md`) },
    { path: path.join(projectRoot, '.roo', 'rules', `${skillName}.md`) },
    { path: path.join(projectRoot, '.github', 'instructions', `${skillName}.instructions.md`) }
  ];

  singleTargets.forEach(t => {
    writeText(t.path, compiledSkillMdContent);
  });

  console.log(`  [OK] Skill '${skillName}' ${isDevRepo ? 'compiled (dev mode: local IDE copies skipped)' : 'synced and compiled'}.`);
});

console.log('\nDone! All files and skills synced.\n');
