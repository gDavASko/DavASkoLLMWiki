#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const queries = [
    "Как правильно использовать класс LazySrv<T>?",
    "Разрешено ли использовать LINQ в методах Update?",
    "Как использовать UniTask вместо корутин?",
    "Какой слой в KBPro занимается загрузкой ассетов?",
    "Как использовать namespace KBP.{CATEGORY}?",
    "В каком формате и кодировке нужно сохранять JSON файлы?",
    "Можно ли менять .meta файлы Unity напрямую?",
    "Где должны храниться временные scratch файлы при работе ИИ?",
    "Что такое архитектура UIPBase и UIVBase?",
    "Можно ли использовать UnityEngine.UI.Text в UI коров?",
    "В чем заключается протокол перекрестной валидации (CROSS-VALIDATION)?",
    "Зачем нужен навык davasko-harness-dispatcher?",
    "Какая версия Unity используется в текущем проекте?",
    "Как работают генераторы констант и [ConstSelector]?",
    "Какие обязательные поля при создании задачи Bitrix (GROUP_ID, RESPONSIBLE_ID)?"
];

const __dirname = path.resolve(); 
const ROOT_DIR = path.resolve(__dirname, '..', '..'); 
const DUMP_FILE = path.join(ROOT_DIR, '.cursor-context-dump-gemini.md');

function runGrepBaseline(query) {
    const words = query.replace(/[?.,()<>{}]/g, '').split(' ').filter(w => w.length > 3);
    const keywords = words.slice(0, 2).join('|');
    const assetsDir = process.env.UNITY_ASSETS_DIR || path.resolve(__dirname, '../../../Assets');
    try {
        const cmd = `rg -i "${keywords}" --max-count 5 "${assetsDir}"`;
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
    console.log("Starting Phase 2 Prep (Grep and RAG) for questions 16-30...");
    const results = [];

    for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        console.log(`\n[${i+16}/30] Запрос: ${q}`);
        const row = { query: q };

        const t0_base = Date.now();
        row.baseline_ctx = runGrepBaseline(q);
        row.baseline_time = Date.now() - t0_base;
        console.log(`  Baseline -> Time: ${row.baseline_time}ms`);

        const t0_rag = Date.now();
        row.rag_ctx = runQueryWiki(q, '');
        row.rag_time = Date.now() - t0_rag;
        console.log(`  RAG      -> Time: ${row.rag_time}ms`);

        results.push(row);
    }

    fs.writeFileSync('gemini-prep-results.json', JSON.stringify(results, null, 2), 'utf-8');
    console.log("\nPhase 2 Prep completed. Raw contexts saved to gemini-prep-results.json");
}

runTest();
