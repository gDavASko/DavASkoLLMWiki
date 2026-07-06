#!/usr/bin/env node
import fs from 'fs';

function generateReport() {
    if (!fs.existsSync('final-stress-results.json')) {
        console.error("final-stress-results.json not found. Run judge script first.");
        process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync('final-stress-results.json', 'utf8'));

    let html = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Advanced Stress Test Report (Local vs Gemini)</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background-color: #f5f7fa; color: #333; }
        h1, h2 { color: #2c3e50; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9em; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #34495e; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .score-good { color: green; font-weight: bold; }
        .score-ok { color: orange; font-weight: bold; }
        .score-bad { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Отчет о стресс-тесте базы знаний (Local vs Gemini)</h1>
    
    <div class="card">
        <h2>Сводные метрики</h2>
        <div class="grid">
            <div>
                <canvas id="qualityChart"></canvas>
            </div>
            <div>
                <canvas id="timeChart"></canvas>
            </div>
        </div>
    </div>

    <div class="card">
        <h2>Локальная LLM (Вопросы 1-15)</h2>
        <table>
            <tr><th>#</th><th>Вопрос</th><th>Baseline</th><th>RAG</th><th>RLM</th></tr>
            ${renderRows(data.slice(0, 15))}
        </table>
    </div>

    <div class="card">
        <h2>Gemini Agent (Вопросы 16-30)</h2>
        <table>
            <tr><th>#</th><th>Вопрос</th><th>Baseline</th><th>RAG</th><th>RLM</th></tr>
            ${renderRows(data.slice(15, 30))}
        </table>
    </div>

    <script>
        ${generateChartJS(data)}
    </script>
</body>
</html>
`;
    fs.writeFileSync('stress_report_v2.html', html, 'utf8');
    console.log("Report generated at stress_report_v2.html");
}

function formatScore(score, reason) {
    let htmlScore = "";
    if (score >= 8) htmlScore = `<span class="score-good">${score}</span>`;
    else if (score >= 5) htmlScore = `<span class="score-ok">${score}</span>`;
    else htmlScore = `<span class="score-bad">${score}</span>`;
    
    const tooltip = reason ? ` title="${reason.replace(/"/g, '&quot;')}"` : '';
    return `<div${tooltip}>${htmlScore}</div>`;
}

function renderRows(items) {
    return items.map((item, index) => {
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${item.query}</td>
                <td>${formatScore(item.baseline_score, item.baseline_reason)} <br><small>${item.baseline_time}ms</small></td>
                <td>${formatScore(item.rag_score, item.rag_reason)} <br><small>${item.rag_time}ms</small></td>
                <td>${formatScore(item.rlm_score, item.rlm_reason)} <br><small>${item.rlm_time}ms</small></td>
            </tr>
        `;
    }).join('');
}

function generateChartJS(data) {
    const local = data.slice(0, 15);
    const gemini = data.slice(15, 30);

    const getAvg = (arr, key) => arr.length > 0 ? (arr.reduce((sum, val) => sum + (val[key] || 0), 0) / arr.length).toFixed(2) : 0;

    const localScores = [getAvg(local, 'baseline_score'), getAvg(local, 'rag_score'), getAvg(local, 'rlm_score')];
    const geminiScores = [getAvg(gemini, 'baseline_score'), getAvg(gemini, 'rag_score'), getAvg(gemini, 'rlm_score')];
    
    const localTimes = [getAvg(local, 'baseline_time'), getAvg(local, 'rag_time'), getAvg(local, 'rlm_time')];
    const geminiTimes = [getAvg(gemini, 'baseline_time'), getAvg(gemini, 'rag_time'), getAvg(gemini, 'rlm_time')];

    return `
        const ctxQuality = document.getElementById('qualityChart').getContext('2d');
        new Chart(ctxQuality, {
            type: 'bar',
            data: {
                labels: ['Baseline (Grep)', 'RAG', 'RLM'],
                datasets: [
                    { label: 'Local LLM Score', data: [${localScores.join(',')}], backgroundColor: 'rgba(54, 162, 235, 0.6)' },
                    { label: 'Gemini Score', data: [${geminiScores.join(',')}], backgroundColor: 'rgba(255, 159, 64, 0.6)' }
                ]
            },
            options: {
                responsive: true,
                plugins: { title: { display: true, text: 'Качество поиска (Средний балл 0-10)' } },
                scales: { y: { min: 0, max: 10 } }
            }
        });

        const ctxTime = document.getElementById('timeChart').getContext('2d');
        new Chart(ctxTime, {
            type: 'bar',
            data: {
                labels: ['Baseline (Grep)', 'RAG', 'RLM'],
                datasets: [
                    { label: 'Local LLM Time (ms)', data: [${localTimes.join(',')}], backgroundColor: 'rgba(75, 192, 192, 0.6)' },
                    { label: 'Gemini Time (ms)', data: [${geminiTimes.join(',')}], backgroundColor: 'rgba(153, 102, 255, 0.6)' }
                ]
            },
            options: {
                responsive: true,
                plugins: { title: { display: true, text: 'Скорость поиска (миллисекунды)' } }
            }
        });
    `;
}

generateReport();
