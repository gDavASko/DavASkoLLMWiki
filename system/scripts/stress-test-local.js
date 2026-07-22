#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const queries = [
    "Что такое Harness Protocol и как его запустить?",
    "Какие слои зависят от kbpro-eventbus?",
    "В чем суть архитектурного принципа ModuleScope?",
    "Как работает InjectSystems для зависимостей?",
    "Можно ли использовать GameObject.Find в коде?",
    "В чем отличие ServiceLocator от InjectSystems?",
    "Как правильно писать теги (TAGS) в задачах Bitrix24?",
    "Где должны храниться скрипты навыков (skills)?",
    "Что делает команда node system/scripts/lint-wiki.js?",
    "Какие требования к написанию кода для физики в Unity?",
    "В каком методе нужно кэшировать ссылки (Awake или Start)?",
    "Как добавить новую модель в базу Graphify?",
    "Что такое Graphify и для чего он нужен?",
    "Что такое RLM (Research Language Model)?",
    "Какие правила языка действуют для общения ИИ с пользователем?"
];

const __dirname = path.resolve(); 
const ROOT_DIR = path.resolve(__dirname, '..', '..'); 
const DUMP_FILE = path.join(ROOT_DIR, '.cursor-context-dump-local.md');

function runGrepBaseline(query) {
    const words = query.replace(/[?.,()]/g, '').split(' ').filter(w => w.length > 3);
    const keywords = words.slice(0, 2).join('|');
    
    try {
        const cmd = `rg -i "${keywords}" --max-count 5 "E:\\UnityProjects\\IRI\\dentistry-cow\\Assets"`;
        const stdout = execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
        return stdout.substring(0, 5000);
    } catch (e) {
        if (e.stdout) return e.stdout.toString().substring(0, 5000);
        return '';
    }
}

function runQueryWiki(query, modeFlag) {
    const cwd = path.join(__dirname, '..');
    try {
        if (fs.existsSync(DUMP_FILE)) fs.unlinkSync(DUMP_FILE);
        execSync(`node query-wiki.js --query "${query}" --out "${DUMP_FILE}" ${modeFlag}`, { cwd, encoding: 'utf-8', stdio: 'ignore' });
        if (fs.existsSync(DUMP_FILE)) {
            return fs.readFileSync(DUMP_FILE, 'utf-8');
        }
        return '';
    } catch (e) {
        return '';
    }
}

async function runTest() {
    console.log("Starting Phase 1 (Local LLM) for 15 queries...");
    const results = [];

    for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        console.log(`\n[${i+1}/15] Запрос: ${q}`);
        const row = { query: q };

        const t0_base = Date.now();
        row.baseline_ctx = runGrepBaseline(q);
        row.baseline_time = Date.now() - t0_base;
        console.log(`  Baseline -> Time: ${row.baseline_time}ms`);

        const t0_rag = Date.now();
        row.rag_ctx = runQueryWiki(q, '');
        row.rag_time = Date.now() - t0_rag;
        console.log(`  RAG      -> Time: ${row.rag_time}ms`);

        const t0_rlm = Date.now();
        row.rlm_ctx = runQueryWiki(q, '--rlm');
        row.rlm_time = Date.now() - t0_rlm;
        console.log(`  RLM      -> Time: ${row.rlm_time}ms`);

        results.push(row);
    }

    fs.writeFileSync('local-results.json', JSON.stringify(results, null, 2), 'utf-8');
    console.log("\nPhase 1 completed. Raw contexts saved to local-results.json");
}

runTest();
