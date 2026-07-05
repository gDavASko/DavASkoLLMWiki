import os from 'os';
import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';

function isOllamaRunning() {
    return new Promise((resolve) => {
        const req = http.get('http://localhost:11434/', (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.end();
    });
}

function installOllamaWindows() {
    console.log("Скачивание OllamaSetup.exe для Windows...");
    const installerPath = path.join(os.tmpdir(), 'OllamaSetup.exe');
    try {
        execSync(`powershell -Command "Invoke-WebRequest -Uri https://ollama.com/download/OllamaSetup.exe -OutFile '${installerPath}'"`, { stdio: 'inherit' });
        console.log("Установка Ollama...");
        execSync(`"${installerPath}" /SILENT`, { stdio: 'inherit' });
    } catch (e) {
        console.error("Ошибка при установке Ollama на Windows:", e.message);
        throw e;
    }
}

function installOllamaUnix() {
    console.log("Установка Ollama через официальный скрипт...");
    try {
        execSync('curl -fsSL https://ollama.com/install.sh | sh', { stdio: 'inherit' });
    } catch (e) {
        console.error("Ошибка при установке Ollama на Linux/macOS:", e.message);
        throw e;
    }
}

export async function ensureLocalLLM(modelName) {
    console.log(`\n=== Подготовка локальной LLM: ${modelName} ===`);
    
    let running = await isOllamaRunning();
    
    if (!running) {
        console.log("Ollama не запущена на порту 11434. Проверяем наличие установщика...");
        try {
            execSync('ollama --version', { stdio: 'ignore' });
            console.log("Ollama установлена, но не запущена. Пытаемся запустить в фоне...");
            if (process.platform === 'win32') {
                spawn('ollama', ['serve'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
            } else {
                spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' }).unref();
            }
            // Подождём пару секунд для старта
            await new Promise(r => setTimeout(r, 3000));
        } catch (err) {
            console.log("Ollama не найдена в системе. Начинаем автоматическую установку.");
            if (process.platform === 'win32') {
                installOllamaWindows();
            } else {
                installOllamaUnix();
            }
            
            console.log("Ожидание запуска сервиса Ollama после установки...");
            await new Promise(r => setTimeout(r, 5000));
        }
        
        running = await isOllamaRunning();
        if (!running) {
            console.error("❌ Не удалось запустить сервис Ollama автоматически. Пожалуйста, запустите его вручную (введите 'ollama serve' в консоли).");
            return false;
        }
    }
    
    console.log("✅ Сервис Ollama активен.");
    console.log(`Скачивание (Pull) модели ${modelName}. Это может занять время в зависимости от скорости интернета...`);
    try {
        execSync(`ollama pull ${modelName}`, { stdio: 'inherit' });
        console.log(`✅ Модель ${modelName} успешно загружена и готова к работе!`);
        return true;
    } catch (e) {
        console.error(`❌ Ошибка загрузки модели ${modelName}:`, e.message);
        return false;
    }
}

import { fileURLToPath } from 'url';
// Позволяет запускать скрипт напрямую
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
    const defaultModel = 'qwen2.5-coder:7b-instruct';
    ensureLocalLLM(process.argv[2] || defaultModel).catch(console.error);
}
