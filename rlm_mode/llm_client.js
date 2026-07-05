import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.resolve(__dirname, '..', 'system', 'rlm-config.json');

/**
 * Универсальный клиент для работы с LLM.
 * Поддерживает OpenAI API и локальные сервера (Ollama, LM Studio).
 */
export class LLMClient {
    constructor(config = {}) {
        let fileConfig = {};
        if (fs.existsSync(CONFIG_PATH)) {
            try {
                fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            } catch (err) {
                console.warn(`[LLMClient] Ошибка чтения ${CONFIG_PATH}:`, err.message);
            }
        } else {
            console.warn(`[LLMClient] Внимание: Конфигурация не найдена. Рекомендуется запустить 'node system/scripts/setup-rlm.js'`);
        }

        this.baseUrl = config.baseUrl || process.env.RLM_BASE_URL || fileConfig.baseUrl || 'http://localhost:11434/v1'; 
        this.apiKey = config.apiKey || process.env.RLM_API_KEY || fileConfig.apiKey || 'ollama'; 
        this.model = config.model || process.env.RLM_MODEL || fileConfig.model || 'qwen2.5-coder:7b-instruct';
        this.temperature = config.temperature !== undefined ? config.temperature : 0.1;
    }

    /**
     * Вызов Chat Completions.
     * @param {Array} messages Массив сообщений [{role, content}]
     * @param {Array} tools Опциональный массив инструментов (Tool Calling)
     * @returns {Promise<Object>} Полный JSON ответ от API
     */
    async chatCompletion(messages, tools = null) {
        const payload = {
            model: this.model,
            messages: messages,
            temperature: this.temperature
        };

        if (tools && tools.length > 0) {
            payload.tools = tools;
            // Для некоторых моделей нужно явно указывать auto
            payload.tool_choice = 'auto';
        }

        const data = JSON.stringify(payload);
        const url = new URL(`${this.baseUrl}/chat/completions`);
        const client = url.protocol === 'https:' ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Length': Buffer.byteLength(data)
            }
        };

        return new Promise((resolve, reject) => {
            const req = client.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => responseData += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(responseData));
                        } catch (e) {
                            reject(new Error(`Failed to parse JSON response: ${e.message}`));
                        }
                    } else {
                        reject(new Error(`LLM API Error ${res.statusCode}: ${responseData}`));
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.write(data);
            req.end();
        });
    }
}
