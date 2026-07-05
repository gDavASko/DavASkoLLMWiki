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

async function analyzeHardware() {
    console.log("🔍 Анализ оборудования...\n");
    const totalMemGB = Math.round(os.totalmem() / (1024 ** 3));
    console.log(`💻 ОЗУ: ${totalMemGB} ГБ`);
    
    // В идеале тут можно вызвать nvidia-smi, но для кроссплатформенности опираемся на ОЗУ.
    // RLM с локальной LLM требует существенных ресурсов.
    
    console.log("\n--- РЕКОМЕНДАЦИЯ ---");
    if (totalMemGB >= 16) {
        console.log("✅ У вас достаточно оперативной памяти для запуска локальной модели (Ollama).");
        console.log("   Рекомендуемые модели для Tool Calling: qwen2.5-coder:7b-instruct или llama-3-8b-instruct");
    } else {
        console.log("⚠️ Оперативной памяти маловато (< 16ГБ). RLM с локальной моделью будет работать очень медленно или падать.");
        console.log("   Рекомендуем использовать внешнее API (Gemini, OpenAI, OpenRouter) для стабильной работы.");
    }
    console.log("--------------------\n");
}

async function runSetup() {
    console.log("=== Интерактивная настройка RLM движка ===\n");
    await analyzeHardware();

    console.log("Какой движок (Backend) вы хотите использовать для RLM?");
    console.log("1. Локальный (Ollama) - Бесплатно, все данные остаются на ПК, зависит от вашего железа");
    console.log("2. Внешнее API (OpenAI/Gemini/OpenRouter) - Очень быстро, работает на любом ПК, стоит центы");
    
    let backendChoice = '';
    while (backendChoice !== '1' && backendChoice !== '2') {
        backendChoice = await askQuestion("Введите 1 или 2: ");
    }

    const config = {};

    if (backendChoice === '1') {
        config.backend = 'ollama';
        config.baseUrl = await askQuestion("Введите URL Ollama (Enter для 'http://localhost:11434/v1'): ");
        if (!config.baseUrl) config.baseUrl = 'http://localhost:11434/v1';
        
        config.model = await askQuestion("Введите название модели (Enter для 'qwen2.5-coder:7b-instruct'): ");
        if (!config.model) config.model = 'qwen2.5-coder:7b-instruct';
        
        config.apiKey = 'ollama';
    } else {
        config.backend = 'api';
        config.baseUrl = await askQuestion("Введите Base URL (например, https://api.openai.com/v1): ");
        if (!config.baseUrl) throw new Error("Base URL обязателен для API!");
        
        config.apiKey = await askQuestion("Введите API Ключ: ");
        if (!config.apiKey) throw new Error("API Ключ обязателен!");
        
        config.model = await askQuestion("Введите название модели (например, gpt-4o-mini): ");
        if (!config.model) throw new Error("Модель обязательна!");
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4), 'utf8');
    console.log(`\n✅ Настройки успешно сохранены в ${CONFIG_PATH}`);
    
    if (config.backend === 'ollama') {
        console.log(`\n💡 Запуск автоматической проверки и настройки локальной LLM...`);
        try {
            const { ensureLocalLLM } = await import('./setup-local-llm.js');
            await ensureLocalLLM(config.model);
        } catch (e) {
            console.error(`\n❌ Ошибка скрипта настройки Ollama:`, e);
        }
    }

    rl.close();
}

runSetup().catch(err => {
    console.error("Ошибка настройки:", err);
    rl.close();
});
