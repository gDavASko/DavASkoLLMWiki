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
    "Какие правила языка действуют для общения ИИ с пользователем?",
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

// Получаем корневой путь репозитория
const __dirname = path.resolve(); // при ESM запуске через node
const ROOT_DIR = path.resolve(__dirname, '..', '..'); 
const DUMP_FILE = path.join(ROOT_DIR, '.cursor-context-dump.md');
const OLLAMA_URL = 'http://localhost:11434/api/generate';
let OLLAMA_MODEL = 'qwen2.5-coder:7b-instruct';

async function evaluateContext(query, context) {
    if (!context || context.trim() === '') return 0;
    
    // Ограничиваем контекст для судьи
    const shortContext = context.substring(0, 4000); 

    const prompt = `Ты строгий ИИ-судья. Оцени от 0 до 10, насколько данный извлеченный контекст полезен и релевантен для ответа на вопрос: "${query}". 
Контекст:
${shortContext}

Правило: Верни только одно число от 0 до 10. Без текста, пояснений и символов.`;

    try {
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                stream: false
            })
        });
        
        if (!response.ok) return 0;
        const data = await response.json();
        const scoreMatch = data.response.match(/\d+/);
        if (scoreMatch) {
            let score = parseInt(scoreMatch[0]);
            return Math.min(Math.max(score, 0), 10);
        }
        return 0;
    } catch (e) {
        console.error("Judge error:", e.message);
        return 0;
    }
}

function runGrepBaseline(query) {
    const words = query.replace(/[?.,()]/g, '').split(' ').filter(w => w.length > 3);
    const keywords = words.slice(0, 2).join('|');
    
    const assetsDir = process.env.UNITY_ASSETS_DIR || path.resolve(__dirname, '../../../Assets');
    try {
        const cmd = `rg -i "${keywords}" --max-count 5 "${assetsDir}"`;
        const stdout = execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
        return stdout.substring(0, 2000);
    } catch (e) {
        return "";
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
        return "";
    } catch (e) {
        return "";
    }
}

async function main() {
    console.log(`Starting stress test for ${queries.length} queries...`);
    const results = [];
    
    try {
        const check = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: OLLAMA_MODEL, prompt: '1', stream: false })
        });
        if (!check.ok) throw new Error("Ollama judge unreachable");
    } catch(e) {
        console.log("Внимание: llama3.1 недоступна, пробуем pochemuchka2");
        // Fallback or warning
    }

    for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        console.log(`\n[${i+1}/${queries.length}] Запрос: ${q}`);
        
        let row = { query: q };

        const t0_base = Date.now();
        const baseCtx = runGrepBaseline(q);
        const t1_base = Date.now();
        row.baseline_time = t1_base - t0_base;
        row.baseline_score = await evaluateContext(q, baseCtx);
        console.log(`  Baseline -> Time: ${row.baseline_time}ms | Score: ${row.baseline_score}`);

        const t0_rag = Date.now();
        const ragCtx = runQueryWiki(q, '');
        const t1_rag = Date.now();
        row.rag_time = t1_rag - t0_rag;
        row.rag_score = await evaluateContext(q, ragCtx);
        console.log(`  RAG      -> Time: ${row.rag_time}ms | Score: ${row.rag_score}`);

        const t0_rlm = Date.now();
        const rlmCtx = runQueryWiki(q, '--rlm');
        const t1_rlm = Date.now();
        row.rlm_time = t1_rlm - t0_rlm;
        row.rlm_score = await evaluateContext(q, rlmCtx);
        console.log(`  RLM      -> Time: ${row.rlm_time}ms | Score: ${row.rlm_score}`);

        results.push(row);
        
        fs.writeFileSync(path.join(__dirname, 'stress-results.json'), JSON.stringify(results, null, 2));
    }
    
    console.log("\nStress test completed. Results saved to stress-results.json");
}

main().catch(console.error);
