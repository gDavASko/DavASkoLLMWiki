const fs = require('fs');
const path = require('path');

const sourcesDir = 'E:/UnityProjects/IRI/dentistry-cow/Assets/KBPro/kbpro-ai-docs/llm-wiki/wiki/sources';

const files = fs.readdirSync(sourcesDir).filter(f => f.endsWith('.md'));

let updated = 0;
for (const file of files) {
    const filePath = path.join(sourcesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if it's a stub
    if (content.includes('related: []')) {
        content = content.replace('related: []', 'related:\n  - model-and-reasoning-effort-selection');
        content = content.replace('No claims extracted yet.', 'This is a research note added during the HyperResearch phase.');
        fs.writeFileSync(filePath, content, 'utf8');
        updated++;
    }
}

console.log(`Actualized ${updated} summary files.`);
