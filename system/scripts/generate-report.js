#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();
const resultsPath = path.join(__dirname, 'stress-results.json');
const reportPath = path.join(__dirname, 'stress_report.html');

if (!fs.existsSync(resultsPath)) {
    console.error("Results not found. Run stress-test.js first.");
    process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Calculate averages
let avgBaseTime = 0, avgRagTime = 0, avgRlmTime = 0;
let avgBaseScore = 0, avgRagScore = 0, avgRlmScore = 0;

results.forEach(r => {
    avgBaseTime += r.baseline_time;
    avgRagTime += r.rag_time;
    avgRlmTime += r.rlm_time;
    
    avgBaseScore += r.baseline_score;
    avgRagScore += r.rag_score;
    avgRlmScore += r.rlm_score;
});

const count = results.length;
avgBaseTime /= count; avgRagTime /= count; avgRlmTime /= count;
avgBaseScore /= count; avgRagScore /= count; avgRlmScore /= count;

// Format rows
const tbody = results.map((r, i) => {
    return `
    <tr>
        <td>${i+1}</td>
        <td>${r.query}</td>
        <td>${r.baseline_score} (${(r.baseline_time/1000).toFixed(1)}s)</td>
        <td>${r.rag_score} (${(r.rag_time/1000).toFixed(1)}s)</td>
        <td><strong>${r.rlm_score}</strong> (${(r.rlm_time/1000).toFixed(1)}s)</td>
    </tr>`;
}).join('');

const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Stress Test Report - DavASkoLLMWiki</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #0f172a; color: #f8fafc; padding: 2rem; }
        h1 { text-align: center; color: #38bdf8; }
        .dashboard { display: flex; gap: 2rem; justify-content: center; margin-bottom: 2rem; }
        .card { background: #1e293b; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); width: 45%; }
        table { width: 100%; border-collapse: collapse; margin-top: 2rem; background: #1e293b; }
        th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #334155; }
        th { background: #0f172a; color: #38bdf8; }
        tr:hover { background: #334155; }
    </style>
</head>
<body>

    <h1>DavASkoLLMWiki: Нагрузочное тестирование (30 запросов)</h1>
    
    <div class="dashboard">
        <div class="card">
            <canvas id="scoreChart"></canvas>
        </div>
        <div class="card">
            <canvas id="timeChart"></canvas>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Запрос</th>
                <th>Baseline (ripgrep)</th>
                <th>RAG (Vector)</th>
                <th>RLM (Deep Research)</th>
            </tr>
        </thead>
        <tbody>
            ${tbody}
        </tbody>
    </table>

    <script>
        const ctxScore = document.getElementById('scoreChart').getContext('2d');
        new Chart(ctxScore, {
            type: 'bar',
            data: {
                labels: ['Baseline', 'RAG', 'RLM'],
                datasets: [{
                    label: 'Средняя релевантность (0-10)',
                    data: [${avgBaseScore}, ${avgRagScore}, ${avgRlmScore}],
                    backgroundColor: ['#ef4444', '#3b82f6', '#10b981']
                }]
            },
            options: {
                plugins: {
                    title: { display: true, text: 'Качество поиска (по версии ИИ-судьи)', color: '#f8fafc' },
                    legend: { labels: { color: '#f8fafc' } }
                },
                scales: { y: { beginAtZero: true, max: 10, ticks: { color: '#f8fafc' } }, x: { ticks: { color: '#f8fafc' } } }
            }
        });

        const ctxTime = document.getElementById('timeChart').getContext('2d');
        new Chart(ctxTime, {
            type: 'bar',
            data: {
                labels: ['Baseline', 'RAG', 'RLM'],
                datasets: [{
                    label: 'Среднее время ответа (секунды)',
                    data: [${(avgBaseTime/1000).toFixed(1)}, ${(avgRagTime/1000).toFixed(1)}, ${(avgRlmTime/1000).toFixed(1)}],
                    backgroundColor: ['#ef4444', '#3b82f6', '#10b981']
                }]
            },
            options: {
                plugins: {
                    title: { display: true, text: 'Скорость поиска', color: '#f8fafc' },
                    legend: { labels: { color: '#f8fafc' } }
                },
                scales: { y: { beginAtZero: true, ticks: { color: '#f8fafc' } }, x: { ticks: { color: '#f8fafc' } } }
            }
        });
    </script>
</body>
</html>
`;

fs.writeFileSync(reportPath, html);
console.log("HTML report generated at: " + reportPath);
