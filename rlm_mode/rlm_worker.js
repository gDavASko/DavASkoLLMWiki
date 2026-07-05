import { LLMClient } from './llm_client.js';

/**
 * Sub-Агент (Сотрудник).
 * Вызывается Менеджером для анализа конкретных чанков или файлов.
 */
export class RLMWorker {
    constructor(config = {}) {
        this.llm = new LLMClient(config);
    }

    /**
     * Анализирует текст в рамках поставленной подзадачи.
     * @param {string} taskPrompt Инструкция для сотрудника (например: "Найди все упоминания UniTask")
     * @param {string} contextText Кусок текста для анализа
     * @returns {Promise<string>} Ответ модели
     */
    async analyze(taskPrompt, contextText) {
        console.log(`[Worker] Started analyzing chunk (${contextText.length} chars)...`);
        
        const systemPrompt = `Ты - исследовательский ИИ-агент (Сотрудник). Твоя задача: анализировать предоставленные текстовые данные строго в рамках поставленной задачи.
Не придумывай информацию. Если данных нет, отвечай: "Ничего не найдено".
Отвечай кратко и по существу, возвращая только те факты из текста, которые релевантны задаче.`;
        
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `ЗАДАЧА:\n${taskPrompt}\n\nКОНТЕКСТ ДЛЯ АНАЛИЗА:\n${contextText}` }
        ];

        try {
            const response = await this.llm.chatCompletion(messages);
            if (response.choices && response.choices.length > 0) {
                const answer = response.choices[0].message.content.trim();
                console.log(`[Worker] Finished analysis. Answer length: ${answer.length}`);
                return answer;
            }
            throw new Error("Empty response from LLM");
        } catch (error) {
            console.error(`[Worker] Error:`, error.message);
            return `[ERROR] Worker failed: ${error.message}`;
        }
    }
}
