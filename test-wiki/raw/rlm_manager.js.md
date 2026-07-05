import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LLMClient } from './llm_client.js';
import { RLMWorker } from './rlm_worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SYSTEM_DIR = path.resolve(__dirname, '..', 'system');
const INDEX_PATH = path.join(SYSTEM_DIR, 'models-cache', 'wiki-index.json');

/**
 * Root-Агент (Менеджер).
 * Управляет процессом RLM. Имеет доступ к инструментам (Tool Calling).
 */
export class RLMManager {
    constructor(config = {}) {
        this.llm = new LLMClient(config);
        this.worker = new RLMWorker(config);
        
        // Кэш для избежания повторных чтений
        this.fileCache = new Map();
        this.wikiIndex = null;
    }

    _loadIndex() {
        if (!this.wikiIndex && fs.existsSync(INDEX_PATH)) {
            this.wikiIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
        }
        return this.wikiIndex || { fileIdToPath: {} };
    }

    /**
     * Инструмент: получить список всех файлов в слое.
     */
    list_layer(layerName) {
        const index = this._loadIndex();
        const files = [];
        for (const [fileId, info] of Object.entries(index.fileIdToPath)) {
            if (info.layer === layerName) {
                files.push(fileId);
            }
        }
        return `Files in layer '${layerName}':\n` + files.join('\n');
    }

    /**
     * Инструмент: запустить сотрудника для анализа конкретных файлов.
     */
    async spawn_worker(prompt, fileIds) {
        const index = this._loadIndex();
        let aggregatedContext = '';
        
        for (const fileId of fileIds) {
            const info = index.fileIdToPath[fileId];
            if (!info) {
                aggregatedContext += `[File ${fileId} not found]\n`;
                continue;
            }
            
            const absolutePath = path.join(SYSTEM_DIR, '..', info.layer, info.relPath);
            try {
                const content = fs.readFileSync(absolutePath, 'utf8');
                aggregatedContext += `=== File: ${fileId} ===\n${content}\n\n`;
            } catch (err) {
                aggregatedContext += `[Error reading ${fileId}: ${err.message}]\n`;
            }
        }

        return await this.worker.analyze(prompt, aggregatedContext);
    }

    _getTools() {
        return [
            {
                type: "function",
                function: {
                    name: "list_layer",
                    description: "Получить список всех файлов в указанном слое базы знаний",
                    parameters: {
                        type: "object",
                        properties: {
                            layerName: { type: "string", description: "Название слоя (например, 'llm-wiki')" }
                        },
                        required: ["layerName"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "spawn_worker",
                    description: "Запустить sub-агента для анализа конкретных файлов",
                    parameters: {
                        type: "object",
                        properties: {
                            prompt: { type: "string", description: "Узкая задача для агента" },
                            fileIds: { type: "array", items: { type: "string" }, description: "Список fileId для анализа" }
                        },
                        required: ["prompt", "fileIds"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "finish",
                    description: "Завершить работу и выдать финальный ответ пользователю",
                    parameters: {
                        type: "object",
                        properties: {
                            final_answer: { type: "string", description: "Итоговый ответ" }
                        },
                        required: ["final_answer"]
                    }
                }
            }
        ];
    }

    async run(userQuery) {
        console.log(`[Manager] Starting RLM loop for query: "${userQuery}"`);
        
        const messages = [
            { 
                role: 'system', 
                content: `Ты - Root-агент (Менеджер) базы знаний DavASkoLLMWiki.
Твоя задача - глубоко исследовать запрос пользователя, используя инструменты.
Если нужно проанализировать много данных, используй list_layer, а затем вызывай spawn_worker для групп файлов.
Когда соберешь всю нужную информацию, вызови инструмент finish.` 
            },
            { role: 'user', content: userQuery }
        ];

        const tools = this._getTools();
        const maxIterations = 10;

        for (let i = 0; i < maxIterations; i++) {
            console.log(`[Manager] Iteration ${i + 1}...`);
            const response = await this.llm.chatCompletion(messages, tools);
            const message = response.choices[0].message;

            messages.push(message);

            if (message.tool_calls && message.tool_calls.length > 0) {
                for (const toolCall of message.tool_calls) {
                    const fnName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`[Manager] Tool called: ${fnName}(${JSON.stringify(args)})`);

                    let toolResult = "";

                    if (fnName === 'finish') {
                        console.log(`[Manager] Finished!`);
                        return args.final_answer;
                    } else if (fnName === 'list_layer') {
                        toolResult = this.list_layer(args.layerName);
                    } else if (fnName === 'spawn_worker') {
                        toolResult = await this.spawn_worker(args.prompt, args.fileIds);
                    } else {
                        toolResult = `Error: Unknown tool ${fnName}`;
                    }

                    messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: toolResult
                    });
                }
            } else {
                // Модель ответила текстом без тул-колла, что нежелательно, но бывает.
                console.log(`[Manager] Model responded with text instead of tool call.`);
                return message.content;
            }
        }

        return "[Manager] Max iterations reached without calling finish().";
    }
}
