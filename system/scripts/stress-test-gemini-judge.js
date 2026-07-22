#!/usr/bin/env node
import fs from 'fs';

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-flash-lite-latest';

function reduceNoise(query, text, maxParagraphs = 3) {
    if (!text) return "";
    const words = query.toLowerCase().replace(/[^\w\sа-яё]/gi, '').split(/\s+/).filter(w => w.length > 2);
    const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 20);
    
    const scored = paragraphs.map(p => {
        const pLower = p.toLowerCase();
        let score = 0;
        for (const w of words) {
            if (pLower.includes(w)) score++;
        }
        return { text: p, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxParagraphs).map(x => x.text).join('\n\n');
}

async function evaluateWithGemini(query, context, strategyName) {
    const cleanedContext = reduceNoise(query, context);
    if (!cleanedContext) return { reason: "Пустой контекст", score: 0 };

    const prompt = `Ты строгий ИИ-судья. Тебе дан вопрос и извлеченный контекст из базы знаний (Стратегия: ${strategyName}).
Твоя задача — оценить от 0 до 10, насколько данный контекст релевантен и полезен для ответа на вопрос.

Вопрос: "${query}"

Извлеченный контекст:
${cleanedContext.substring(0, 3000)}

Обоснуй свою оценку, а затем верни JSON объект:
{
  "reason": "твой подробный анализ полезности контекста",
  "score": X
}
Правило: Верни строго валидный JSON без маркдаун-блоков.`;

    // Global delay to prevent rate limits (max 10 RPM)
    await new Promise(r => setTimeout(r, 6000));

    let retries = 5;
    while (retries > 0) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: "application/json"
                    }
                })
            });
            
            if (!response.ok) {
                if (response.status === 429 || response.status === 503) {
                    console.log(`Gemini HTTP error ${response.status} [${strategyName}]. Retrying in 15 seconds... (${retries} left)`);
                    await new Promise(r => setTimeout(r, 15000));
                    retries--;
                    continue;
                }
                console.error(`Gemini HTTP error [${strategyName}]:`, response.status, response.statusText);
                return { reason: `HTTP Error ${response.status}`, score: 0 };
            }
            
            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            
            try {
                const parsed = JSON.parse(textResponse);
                return {
                    reason: parsed.reason || "Нет обоснования",
                    score: parsed.score || 0
                };
            } catch(e) {
                return { reason: "JSON Parse Error", score: 0 };
            }
        } catch (e) {
            console.error(`Gemini request error [${strategyName}]:`, e.message);
            if (retries === 1) return { reason: "Network Error", score: 0 };
            await new Promise(r => setTimeout(r, 15000));
            retries--;
        }
    }
    return { reason: "Failed after retries", score: 0 };
}

async function runJudgement() {
    console.log("Loading datasets...");
    
    let localData = [];
    if (fs.existsSync('local-results.json')) {
        localData = JSON.parse(fs.readFileSync('local-results.json', 'utf-8'));
    }

    let geminiData = [];
    if (fs.existsSync('gemini-prep-results.json')) {
        geminiData = JSON.parse(fs.readFileSync('gemini-prep-results.json', 'utf-8'));
    }

    let geminiRlmAnswers = [];
    if (fs.existsSync('gemini-rlm-answers.json')) {
        geminiRlmAnswers = JSON.parse(fs.readFileSync('gemini-rlm-answers.json', 'utf-8'));
    }

    for (let i = 0; i < geminiData.length; i++) {
        const qText = geminiData[i].query;
        const rlmAns = geminiRlmAnswers.find(x => x.query === qText);
        geminiData[i].rlm_ctx = rlmAns ? rlmAns.rlm_ctx : "";
        geminiData[i].rlm_time = rlmAns ? rlmAns.rlm_time : 0;
    }

    const allData = [...localData, ...geminiData];
    console.log(`Evaluating ${allData.length} queries with Gemini Judge (Sequential)...`);
    const finalResults = [];

    for (let i = 0; i < allData.length; i++) {
        const item = allData[i];
        console.log(`[${i+1}/${allData.length}] Judging: ${item.query}`);
        
        const baseResult = await evaluateWithGemini(item.query, item.baseline_ctx, "Baseline");
        console.log(`  Base: ${baseResult.score}`);
        await new Promise(r => setTimeout(r, 4000));

        const ragResult = await evaluateWithGemini(item.query, item.rag_ctx, "RAG");
        console.log(`  RAG: ${ragResult.score}`);
        await new Promise(r => setTimeout(r, 4000));

        const rlmResult = await evaluateWithGemini(item.query, item.rlm_ctx, "RLM");
        console.log(`  RLM: ${rlmResult.score}`);
        await new Promise(r => setTimeout(r, 4000));
        
        finalResults.push({
            query: item.query,
            baseline_time: item.baseline_time,
            baseline_score: baseResult.score,
            baseline_reason: baseResult.reason,
            rag_time: item.rag_time,
            rag_score: ragResult.score,
            rag_reason: ragResult.reason,
            rlm_time: item.rlm_time,
            rlm_score: rlmResult.score,
            rlm_reason: rlmResult.reason
        });
    }

    fs.writeFileSync('final-stress-results.json', JSON.stringify(finalResults, null, 2), 'utf-8');
    console.log("\nJudging completed. Results saved to final-stress-results.json");
}

runJudgement();
