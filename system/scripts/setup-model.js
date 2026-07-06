import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SYSTEM_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(SYSTEM_DIR, 'rlm-config.json');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function runSetup() {
    console.log("=== Интерактивная настройка RLM движка ===\n");
    
    console.log("В текущей версии локальная модель отключена по умолчанию для RLM.");
    console.log("Пожалуйста, настройте подключение к внешнему API (OpenAI, Gemini, OpenRouter).\n");

    const config = {};
    config.backend = 'api';
    
    config.baseUrl = await askQuestion("Введите Base URL (например, https://api.openai.com/v1 или https://openrouter.ai/api/v1): ");
    if (!config.baseUrl) throw new Error("Base URL обязателен для API!");
    
    config.apiKey = await askQuestion("Введите API Ключ: ");
    if (!config.apiKey) throw new Error("API Ключ обязателен!");
    
    config.model = await askQuestion("Введите название модели (например, gpt-4o-mini, gemini-1.5-flash): ");
    if (!config.model) throw new Error("Модель обязательна!");

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4), 'utf8');
    console.log(`\n✅ Настройки успешно сохранены в ${CONFIG_PATH}`);

    rl.close();
}

runSetup().catch(err => {
    console.error("Ошибка настройки:", err);
    rl.close();
});
