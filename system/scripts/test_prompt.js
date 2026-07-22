const fs = require('fs');

const prep = JSON.parse(fs.readFileSync('gemini-prep-results.json', 'utf8'));
const rlm = JSON.parse(fs.readFileSync('gemini-rlm-answers.json', 'utf8'));
const qText = prep[0].query;
const rlmAns = rlm.find(x => x.query === qText);
const baseCtx = prep[0].baseline_ctx || '';
const ragCtx = prep[0].rag_ctx || '';
const rlmCtx = rlmAns ? rlmAns.rlm_ctx : '';

const prompt = `Ты строгий ИИ-судья. Оцени от 0 до 10, насколько каждый из 3 извлеченных контекстов полезен и релевантен для ответа на вопрос: "${qText}".

Контекст 1 (Baseline):
${(baseCtx || '').substring(0, 4000)}

Контекст 2 (RAG):
${(ragCtx || '').substring(0, 4000)}

Контекст 3 (RLM):
${(rlmCtx || '').substring(0, 4000)}

Правило: Верни строго валидный JSON объект вида: {"base": X, "rag": Y, "rlm": Z}, где X,Y,Z - числа от 0 до 10. Без маркдауна, только JSON.`;

fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + process.env.GEMINI_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } })
}).then(r => r.json()).then(data => console.log(data.candidates[0].content.parts[0].text)).catch(console.error);
