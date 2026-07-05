import { LLMClient } from '../../rlm_mode/llm_client.js';

/**
 * Маршрутизатор запросов (Query Router).
 * Классифицирует пользовательский запрос на один из трех типов:
 * - GRAPHIFY: поиск по графу кода (C# зависимости, иерархия, вызовы)
 * - RLM: глубокий архитектурный анализ
 * - RAG: быстрый поиск по базе знаний (API, гайды, факты)
 */
export class QueryRouter {
    constructor(config = {}) {
        this.llm = new LLMClient(config);
    }

    /**
     * Классифицирует запрос.
     * @param {string} query 
     * @returns {Promise<string>} 'GRAPHIFY', 'RLM' или 'RAG'
     */
    async route(query) {
        const systemPrompt = `Ты - интеллектуальный маршрутизатор поисковых запросов в базе знаний разработчика.
Твоя задача - классифицировать запрос пользователя и вернуть СТРОГО ОДНО СЛОВО: RAG, RLM или GRAPHIFY. Никаких других символов!

КРИТЕРИИ КЛАССИФИКАЦИИ:
1. "GRAPHIFY": Используй, если вопрос касается ТОЛЬКО структуры кода C#, иерархии классов, зависимостей префабов, или кто кого наследует/вызывает.
   Примеры: "Какие классы наследуются от AbstractGameModule?", "Покажи связи PatientSelectionMenu".

2. "RLM": Используй, если вопрос требует глубокого архитектурного анализа, синтеза информации из нескольких скриптов, или объяснения принципов работы под капотом (архитектура, логика систем, рефакторинг).
   Примеры: "Проанализируй архитектуру RLM и скриптов установки", "Как в целом работает подсистема инвентаря?".

3. "RAG": Используй для быстрых, конкретных точечных вопросов, поиска правил именования, поиска конкретного термина, стиля кода или гайдов. Это поиск фактов.
   Примеры: "Как правильно называть компоненты?", "Что такое PhysicsController?", "Где лежит конфиг?".`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
        ];

        try {
            const response = await this.llm.chatCompletion(messages);
            if (response.choices && response.choices.length > 0) {
                let answer = response.choices[0].message.content.trim().toUpperCase();
                
                // Извлекаем первое подходящее слово на случай, если модель ответит с лишним текстом
                if (answer.includes('GRAPHIFY')) return 'GRAPHIFY';
                if (answer.includes('RLM')) return 'RLM';
                if (answer.includes('RAG')) return 'RAG';
                
                return 'RAG'; // Фолбэк по умолчанию
            }
            return 'RAG';
        } catch (err) {
            console.error(`[Router Error] Failed to route query: ${err.message}. Falling back to RAG.`);
            return 'RAG';
        }
    }
}
