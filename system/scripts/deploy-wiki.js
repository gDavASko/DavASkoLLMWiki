#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 * DavASkoLLMWiki — Однокомандный развёртыватель базы знаний (deploy-wiki.js)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Скриптовый аналог скилла davasko-llm-wiki: разворачивает ПОЛНУЮ базу
 * знаний в указанной папке без участия скилла. Делает всё то же:
 *   1. каркас БЗ (слои + wiki.json DAG, базовые страницы, plans/, NewData/)
 *   2. движок (копия system/, оффлайн npm install)
 *   3. модель векторизации → в ОБЩЕЕ системное место + системная метка
 *   4. правила работы с БЗ (ide-rules + sync-ai-rules)
 *   5. скилы работы с БЗ (bundle skills/)
 *   6. тест-окружение + базовая валидация (npm test, lint, build-index)
 *
 * Источник (откуда берём движок/модель/скилы) — репозиторий, в котором
 * лежит этот скрипт. Цель — папка из --target.
 *
 * Использование:
 *   node system/scripts/deploy-wiki.js --target ../my-kb
 *   node system/scripts/deploy-wiki.js --target D:/kb --layers llm-wiki,project-a-wiki
 *   node system/scripts/deploy-wiki.js --target ./kb --model-dir D:/shared/models
 *   Флаги: --no-model --no-install --no-index --force
 * ═══════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getDefaultSystemModelsDir, getMarkerPath } from '../lib/model-locator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCE_ROOT = path.resolve(__dirname, '../..'); // корень репо-эталона

const C = { reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', red: '\x1b[31m', dim: '\x1b[2m' };
const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
const step = (n, t) => console.log(`\n${C.bold}${C.cyan}[${n}]${C.reset} ${C.bold}${t}${C.reset}`);
const ok = (m) => console.log(`    ${C.green}✓${C.reset} ${m}`);
const warn = (m) => console.warn(`    ${C.yellow}!${C.reset} ${m}`);

// ─── args ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const has = (k) => argv.includes(k);
  return {
    target: get('--target'),
    layers: (get('--layers') || 'llm-wiki').split(',').map(s => s.trim()).filter(Boolean),
    modelDir: get('--model-dir'),
    noModel: has('--no-model'),
    noInstall: has('--no-install'),
    noIndex: has('--no-index'),
    force: has('--force'),
  };
}

// ─── fs helpers ──────────────────────────────────────────────────────────
function copyDir(src, dest, { exclude = [] } = {}) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d, { exclude });
    else fs.copyFileSync(s, d);
  }
}
const guid = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
// Unity .meta для текстового ассета (линтер требует .meta у каждой wiki-страницы).
const writeMeta = (mdPath) => fs.writeFileSync(`${mdPath}.meta`,
  `fileFormatVersion: 2\nguid: ${guid()}\nTextScriptImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`, 'utf8');
const writeMd = (p, body) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.concat([BOM, Buffer.from(body, 'utf8')])); writeMeta(p); };
const writeJson = (p, obj) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8'); }; // JSON без BOM
const sh = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd });

// ─── main ────────────────────────────────────────────────────────────────
function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.target) {
    console.error(`${C.red}[ERROR]${C.reset} Укажите целевую папку: --target <path>`);
    process.exit(2);
  }
  const TARGET = path.resolve(a.target);
  // llm-wiki — обязательный базовый слой (держит правила и корень DAG-зависимостей)
  const layers = [...new Set(['llm-wiki', ...a.layers])];

  console.log(`\n${C.bold}═══ DavASkoLLMWiki — развёртывание базы знаний ═══${C.reset}`);
  console.log(`${C.dim}Источник: ${SOURCE_ROOT}`);
  console.log(`Цель:     ${TARGET}`);
  console.log(`Слои:     ${layers.join(', ')}${C.reset}`);

  if (fs.existsSync(TARGET) && fs.readdirSync(TARGET).length > 0 && !a.force) {
    console.error(`\n${C.red}[ERROR]${C.reset} Папка не пуста: ${TARGET}. Используйте --force, чтобы дописать поверх.`);
    process.exit(2);
  }
  fs.mkdirSync(TARGET, { recursive: true });

  // ── 1. Движок ──────────────────────────────────────────────────────────
  step(1, 'Движок (system/ + package.json)');
  copyDir(path.join(SOURCE_ROOT, 'system'), path.join(TARGET, 'system'), {
    // модель → в общее место (не копируем); индекс/отчёты — пересобираются
    exclude: ['models-cache', 'node_modules', 'wiki-index.json', 'index-shards',
              'staleness-report.json', 'validate_errors.json', 'validate_errors_output.txt'],
  });
  // отчёт eval — не тащим
  fs.rmSync(path.join(TARGET, 'system', 'evals', 'retrieval-report.json'), { force: true });
  if (fs.existsSync(path.join(SOURCE_ROOT, 'package.json'))) fs.copyFileSync(path.join(SOURCE_ROOT, 'package.json'), path.join(TARGET, 'package.json'));
  ok('движок и package.json скопированы');

  // ── 2. Скилы ───────────────────────────────────────────────────────────
  step(2, 'Скилы работы с БЗ (skills/)');
  copyDir(path.join(SOURCE_ROOT, 'skills'), path.join(TARGET, 'skills'));
  ok('skills/ скопированы (search / ingest / refresh / youtube / llm-wiki)');

  // ── 3. Слои + базовые страницы + plans/ + NewData/ ─────────────────────
  step(3, 'Каркас базы знаний (слои, манифесты, plans/, NewData/)');
  for (const layer of layers) {
    const base = layer === 'llm-wiki';
    writeJson(path.join(TARGET, layer, 'wiki.json'), { name: layer, dependencies: base ? [] : ['llm-wiki'] });
    fs.mkdirSync(path.join(TARGET, layer, 'raw'), { recursive: true });
    const title = layer.replace(/-wiki$/, '').replace(/(^|[-_])(\w)/g, (_, s, c) => (s ? ' ' : '') + c.toUpperCase());
    writeMd(path.join(TARGET, layer, 'wiki', 'index.md'),
      `# ${title} — Index\n\n> Hub page for the \`${layer}\` knowledge layer.\n\n## Concepts\n\n## Entities\n\n## Runbooks\n\n## Sources\n`);
    writeMd(path.join(TARGET, layer, 'wiki', 'stubs.md'),
      `# Stubs (${layer})\n\nPlanned pages (placeholders). Links to these resolve as stubs (lint warning, not error).\n`);
    writeMd(path.join(TARGET, layer, 'wiki', 'contradictions.md'),
      `# Contradictions (${layer})\n\nDocumented conflicts between sources.\n\n## Active Items\n\n_None yet._\n\n## Resolved Items\n`);
    fs.mkdirSync(path.join(TARGET, 'NewData', layer), { recursive: true });
    ok(`слой ${layer} (wiki.json deps=[${base ? '' : 'llm-wiki'}], index/stubs/contradictions, raw/, NewData/)`);
  }
  fs.mkdirSync(path.join(TARGET, 'plans'), { recursive: true });
  writeMd(path.join(TARGET, 'plans', 'README.md'), `# Plans\n\nHuman planning only (ExecPlans, checklists). NOT part of the knowledge base — never cited as a wiki source.\n`);
  ok('plans/ создан');

  // ── 4. Правила работы с БЗ ──────────────────────────────────────────────
  step(4, 'Правила работы с БЗ (CCP + ide-rules)');
  const ideRules = path.join(TARGET, 'llm-wiki', 'raw', 'ide-rules');
  fs.mkdirSync(ideRules, { recursive: true });
  for (const f of ['CLAUDE.md', 'AGENTS.md']) {
    const srcF = path.join(SOURCE_ROOT, f);
    if (fs.existsSync(srcF)) fs.copyFileSync(srcF, path.join(ideRules, f)); // источник для sync-ai-rules
  }
  // ВАЖНО: корневые CLAUDE.md/AGENTS.md пишет sync-ai-rules (шаг 7) через merge —
  // если они уже есть в целевом проекте, наш блок ДОПИСЫВАЕТСЯ в конец, а не затирает их.
  ok('правила-источник → llm-wiki/raw/ide-rules (корневые CLAUDE.md/AGENTS.md создаёт sync-ai-rules с сохранением существующих)');

  // ── 5. Оффлайн-зависимости ─────────────────────────────────────────────
  if (!a.noInstall) {
    step(5, 'Оффлайн-зависимости (npm install из system/vendor)');
    try { sh('npm install --no-audit --no-fund --loglevel=error', TARGET); ok('зависимости установлены'); }
    catch { warn('npm install не прошёл — запустите вручную в целевой папке'); }
  } else { step(5, 'Зависимости (--no-install: пропуск)'); }

  // ── 6. Общая модель + системная метка ──────────────────────────────────
  if (!a.noModel) {
    step(6, 'Модель векторизации → общее системное место + метка');
    const dirArg = a.modelDir ? ` --dir "${path.resolve(a.modelDir)}"` : '';
    try {
      sh(`node "${path.join(SOURCE_ROOT, 'system', 'scripts', 'setup-model.js')}"${dirArg}`, SOURCE_ROOT);
      ok(`метка: ${getMarkerPath()}`);
      ok(`место: ${a.modelDir ? path.resolve(a.modelDir) : getDefaultSystemModelsDir()}`);
    } catch { warn('установка модели не прошла — запустите: node system/scripts/setup-model.js'); }
  } else { step(6, 'Модель (--no-model: пропуск; БЗ использует существующую метку)'); }

  // ── 7. Синхронизация правил/скилов по IDE ──────────────────────────────
  step(7, 'Синхронизация правил/скилов (sync-ai-rules)');
  try { sh(`node "${path.join(TARGET, 'system', 'sync-ai-rules.js')}"`, TARGET); ok('IDE-адаптеры сгенерированы'); }
  catch { warn('sync-ai-rules не прошёл — запустите вручную: node system/sync-ai-rules.js'); }

  // ── 8. Тест-окружение / базовая валидация ──────────────────────────────
  step(8, 'Базовая валидация (npm test, lint, build-index)');
  try { sh('node --test', TARGET); ok('юнит-тесты ядра пройдены'); } catch { warn('юнит-тесты вернули ошибки'); }
  try { sh(`node "${path.join(TARGET, 'system', 'scripts', 'lint-wiki.js')}"`, TARGET); ok('lint: ошибок нет'); }
  catch { warn('lint вернул замечания (для свежего каркаса это нормально)'); }
  if (!a.noModel && !a.noIndex) {
    try { sh(`node "${path.join(TARGET, 'system', 'build-index.js')}" --force`, TARGET); ok('индекс собран (векторизация работает)'); }
    catch { warn('build-index не прошёл — проверьте модель/метку'); }
  }

  // ── Итог ────────────────────────────────────────────────────────────────
  console.log(`\n${C.green}${C.bold}═══ Готово ═══${C.reset}`);
  console.log(`${C.dim}База знаний развёрнута: ${TARGET}`);
  console.log(`Дальше: положите источники в NewData/<layer>/ и выполните`);
  console.log(`  node system/scripts/ingest-newdata.js   (разместит + провалидирует + векторизует)`);
  console.log(`Поиск:  node system/query-wiki.js --query "..."${C.reset}\n`);
}

main();
