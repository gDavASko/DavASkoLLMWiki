const fs = require('fs');
const path = require('path');

const submoduleRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(submoduleRoot, '../../..');

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

// Helper to parse questions.md
function parseQuestions(filePath) {
  const content = readUtf8(filePath);
  const sections = content.split(/\r?\n## /);
  const questions = [];
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const lines = section.split(/\r?\n/);
    const questionText = lines[0].trim();
    
    let expectedAnswer = '';
    let requiredSources = [];
    let lastChecked = '';
    
    let state = 'none'; // 'expected', 'sources', 'last'
    
    for (let j = 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (!line) continue;
      
      if (line.toLowerCase().startsWith('expected answer:')) {
        state = 'expected';
        continue;
      }
      if (line.toLowerCase().startsWith('required sources:')) {
        state = 'sources';
        continue;
      }
      if (line.toLowerCase().startsWith('last checked:')) {
        lastChecked = line.substring('last checked:'.length).trim();
        state = 'last';
        continue;
      }
      
      if (state === 'expected') {
        expectedAnswer += (expectedAnswer ? ' ' : '') + line;
      } else if (state === 'sources') {
        if (line.startsWith('-') || line.startsWith('*')) {
          const src = line.substring(1).trim().replace(/^`|`$/g, '').replace(/\\/g, '/');
          requiredSources.push(src);
        }
      }
    }
    
    questions.push({
      question: questionText,
      expectedAnswer,
      requiredSources,
      lastChecked
    });
  }
  return questions;
}

// Find a file by relative path or page name across the submodule
function resolveSourcePath(sourcePath) {
  // 1. Direct path check
  const p1 = path.join(submoduleRoot, sourcePath);
  if (fs.existsSync(p1)) {
    return p1;
  }

  // 2. Scan layers
  const layers = [];
  fs.readdirSync(submoduleRoot).forEach(file => {
    const fullPath = path.join(submoduleRoot, file);
    if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'wiki.json'))) {
      layers.push(file);
    }
  });

  for (const layer of layers) {
    const p2 = path.join(submoduleRoot, layer, sourcePath);
    if (fs.existsSync(p2)) {
      return p2;
    }

    // Try checking if it's a page name referenced without folder structure
    const wikiDir = path.join(submoduleRoot, layer, 'wiki');
    if (fs.existsSync(wikiDir)) {
      const subdirs = ['concepts', 'runbooks', 'entities', 'sources', 'syntheses', 'decisions', 'maps'];
      for (const sd of subdirs) {
        const p3 = path.join(wikiDir, sd, sourcePath);
        const p4 = path.join(wikiDir, sd, sourcePath + '.md');
        if (fs.existsSync(p3)) return p3;
        if (fs.existsSync(p4)) return p4;
      }
    }
  }

  return null;
}

function runEvals() {
  const questionsFile = path.join(submoduleRoot, 'system', 'evals', 'questions.md');
  if (!fs.existsSync(questionsFile)) {
    console.error(`Error: Questions file not found at ${questionsFile}`);
    process.exit(1);
  }

  console.log('=== Running KBPro LLM Wiki Regression Evals ===');
  const questions = parseQuestions(questionsFile);
  console.log(`Loaded ${questions.length} regression questions.\n`);

  let passedQuestions = 0;
  let totalChecks = 0;
  let failedChecks = 0;
  const failuresList = [];

  questions.forEach((q, index) => {
    console.log(`[Q${index + 1}] ${q.question}`);
    let questionPassed = true;

    if (q.requiredSources.length === 0) {
      console.log('  ⚠️ No required sources specified for this question.');
      return;
    }

    q.requiredSources.forEach(src => {
      totalChecks++;
      const resolved = resolveSourcePath(src);
      if (resolved) {
        // Content verification: check if file is not empty and has minimum content
        try {
          const stats = fs.statSync(resolved);
          if (stats.size > 10) {
            console.log(`  ✅ Source exists: ${src}`);
          } else {
            questionPassed = false;
            failedChecks++;
            failuresList.push(`[Q${index + 1}] Required source file is empty: ${src}`);
            console.log(`  ❌ Source exists but is empty: ${src}`);
          }
        } catch (e) {
          questionPassed = false;
          failedChecks++;
          failuresList.push(`[Q${index + 1}] Error reading source: ${src}`);
          console.log(`  ❌ Error reading source: ${src}`);
        }
      } else {
        questionPassed = false;
        failedChecks++;
        failuresList.push(`[Q${index + 1}] Missing required source: ${src}`);
        console.log(`  ❌ Missing required source: ${src}`);
      }
    });

    if (questionPassed) {
      passedQuestions++;
    }
    console.log('');
  });

  console.log('=== Evals Summary ===');
  console.log(`Questions Evaluated: ${questions.length}`);
  console.log(`Questions Passed: ${passedQuestions} / ${questions.length}`);
  console.log(`Total Source Checks: ${totalChecks}`);
  console.log(`Passed Checks: ${totalChecks - failedChecks}`);
  console.log(`Failed Checks: ${failedChecks}`);

  if (failedChecks > 0) {
    console.log('\nDetailed Failures:');
    failuresList.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('\nOK: All regression checks passed successfully.');
    process.exit(0);
  }
}

runEvals();
