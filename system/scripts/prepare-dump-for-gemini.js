#!/usr/bin/env node
import fs from 'fs';

let localData = JSON.parse(fs.readFileSync('local-results.json', 'utf-8'));
let geminiData = JSON.parse(fs.readFileSync('gemini-prep-results.json', 'utf-8'));
let geminiRlmAnswers = JSON.parse(fs.readFileSync('gemini-rlm-answers.json', 'utf-8'));

for (let i = 0; i < geminiData.length; i++) {
    const rlmAns = geminiRlmAnswers.find(x => x.query === geminiData[i].query);
    geminiData[i].rlm_ctx = rlmAns ? rlmAns.rlm_ctx : "";
    geminiData[i].rlm_time = rlmAns ? rlmAns.rlm_time : 0;
}

const allData = [...localData, ...geminiData];

let out = "";
for (let i = 0; i < allData.length; i++) {
    const item = allData[i];
    out += `\n\n=================================\n`;
    out += `QUERY [${i}]: ${item.query}\n`;
    out += `[BASE]\n${(item.baseline_ctx || '').substring(0, 500)}\n`;
    out += `[RAG]\n${(item.rag_ctx || '').substring(0, 1000)}\n`;
    out += `[RLM]\n${(item.rlm_ctx || '').substring(0, 1500)}\n`;
}

fs.writeFileSync('dump_for_gemini.md', out, 'utf-8');
console.log("Dump created.");
