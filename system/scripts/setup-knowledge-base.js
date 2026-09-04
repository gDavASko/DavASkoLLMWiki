#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 * DavASkoLLMWiki — Мастер настройки и подключения базы знаний
 * (setup-knowledge-base.js)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Автоматизирует первый запуск и подключение глобальной базы знаний:
 * 1. Проверяет наличие KBPRO_AI_CHAT_WIKI_DIR и валидность профиля.
 * 2. Если базы нет:
 *    - Спрашивает пользователя (или принимает флаг --target), куда клонировать.
 *    - Клонирует https://gitlab.kbpro.ru/ai-env/kbpro-knowledge-base.git
 *    - Прописывает переменную окружения KBPRO_AI_CHAT_WIKI_DIR персистентно в системе.
 * 3. Тестирует работоспособность поиска (query-wiki.js).
 * 4. Если обнаружены ошибки (отсутствие зависимостей, модели, индекса) —
 *    автоматически устраняет их и повторяет проверку.
 *
 * Флаги:
 *   --target <path>      Путь для клонирования базы знаний
 *   --repo <url>         URL Git-репозитория базы знаний
 *   --non-interactive    Использовать дефолтный путь без вопросов
 *   --force              Перезаписать/обновить переменную среды, даже если задана
 * ═══════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SYSTEM_DIR = path.resolve(__dirname, '..');
const SUBMODULE_ROOT = path.resolve(SYSTEM_DIR, '..');

const DEFAULT_REPO = 'https://gitlab.kbpro.ru/ai-env/kbpro-knowledge-base.git';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

const step = (n, t) => console.log(`\n${C.bold}${C.cyan}[Шаг ${n}]${C.reset} ${C.bold}${t}${C.reset}`);
const ok = (m) => console.log(`    ${C.green}✓${C.reset} ${m}`);
const warn = (m) => console.warn(`    ${C.yellow}!${C.reset} ${m}`);
const err = (m) => console.error(`    ${C.red}✗${C.reset} ${m}`);

function parseArgs(argv = process.argv.slice(2)) {
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const has = (k) => argv.includes(k);
  return {
    target: get('--target'),
    repo: get('--repo') || DEFAULT_REPO,
    nonInteractive: has('--non-interactive'),
    force: has('--force'),
  };
}

function getDefaultTarget() {
  if (process.platform === 'win32') {
    // Проверяем доступные диски: сначала C:, затем текущий диск
    const candidates = ['C:\\KBProData\\knowledge-base', 'D:\\KBProData\\knowledge-base', path.join(os.homedir(), 'KBProData', 'knowledge-base')];
    for (const c of candidates) {
      const root = path.parse(c).root;
      if (fs.existsSync(root)) return c;
    }
    return path.join(os.homedir(), 'KBProData', 'knowledge-base');
  }
  return path.join(os.homedir(), 'KBProData', 'knowledge-base');
}

function isValidProfile(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') return false;
  if (!fs.existsSync(dirPath)) return false;
  const manifest = path.join(dirPath, 'config', 'config-manifest.json');
  return fs.existsSync(manifest);
}

function ask(question, defaultValue = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const promptText = defaultValue ? `${question} [по умолчанию: ${defaultValue}]: ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(promptText, (ans) => {
      rl.close();
      const res = (ans || '').trim();
      resolve(res || defaultValue);
    });
  });
}

function setEnvVarPersistent(key, val) {
  process.env[key] = val;
  if (process.platform === 'win32') {
    try {
      const psCommand = `[System.Environment]::SetEnvironmentVariable('${key}', '${val.replace(/'/g, "''")}', 'User')`;
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`, { stdio: 'ignore' });
      ok(`Переменная окружения ${key} сохранена в профиле пользователя Windows.`);
      return true;
    } catch (e) {
      warn(`Не удалось установить переменную через PowerShell: ${e.message}`);
      try {
        execSync(`setx ${key} "${val}"`, { stdio: 'ignore' });
        ok(`Переменная окружения ${key} сохранена через setx.`);
        return true;
      } catch (e2) {
        err(`Не удалось сохранить переменную среды персистентно: ${e2.message}`);
        return false;
      }
    }
  } else {
    // Linux/macOS: дописываем в bashrc/zshrc
    const rcFiles = [path.join(os.homedir(), '.bashrc'), path.join(os.homedir(), '.zshrc')];
    for (const rc of rcFiles) {
      if (fs.existsSync(rc)) {
        try {
          const content = fs.readFileSync(rc, 'utf8');
          const line = `export ${key}="${val}"`;
          if (!content.includes(line)) {
            fs.appendFileSync(rc, `\n# KBPro LLM Wiki\n${line}\n`);
            ok(`Добавлена строка в ${rc}`);
          }
        } catch { /* skip */ }
      }
    }
    return true;
  }
}

function cloneOrUpdateRepo(repoUrl, targetDir) {
  if (fs.existsSync(targetDir)) {
    const gitDir = path.join(targetDir, '.git');
    if (fs.existsSync(gitDir)) {
      ok(`Папка уже существует и является Git-репозиторием: ${targetDir}`);
      console.log(`    Выполняем git pull...`);
      try {
        execSync(`git -C "${targetDir}" pull`, { stdio: 'inherit' });
        ok('Репозиторий успешно обновлен.');
        return true;
      } catch (e) {
        warn(`git pull завершился с замечанием: ${e.message}`);
        return true;
      }
    } else {
      warn(`Папка ${targetDir} существует, но не содержит .git. Проверяем содержимое...`);
      if (isValidProfile(targetDir)) {
        ok(`Обнаружен валидный профиль базы знаний в ${targetDir}`);
        return true;
      }
    }
  }

  // Создаем родительскую папку
  const parent = path.dirname(targetDir);
  fs.mkdirSync(parent, { recursive: true });

  console.log(`    Клонируем ${repoUrl} в ${targetDir}...`);
  execSync(`git clone "${repoUrl}" "${targetDir}"`, { stdio: 'inherit' });
  ok(`База знаний успешно склонирована в ${targetDir}`);
  return true;
}

function testSearch(targetDir) {
  console.log(`    Запуск тестового поискового запроса...`);
  const queryScript = path.join(SYSTEM_DIR, 'query-wiki.js');
  const env = { ...process.env, KBPRO_AI_CHAT_WIKI_DIR: targetDir };
  
  const res = spawnSync(process.execPath, [queryScript, '--query', 'LogicSystem', '--stdout'], {
    env,
    encoding: 'utf8',
    timeout: 45000,
  });

  if (res.status === 0 && res.stdout && res.stdout.length > 50) {
    ok('Тестовый поиск успешно выполнен! Документы получены.');
    return { ok: true };
  }

  const output = (res.stderr || '') + (res.stdout || '');
  return { ok: false, error: output };
}

function autoHeal(targetDir, errorOutput) {
  console.log(`\n${C.yellow}Обнаружены проблемы при тестировании, применяем авто-починку...${C.reset}`);

  // 1. Проверка npm-зависимостей
  if (errorOutput.includes('ERR_MODULE_NOT_FOUND') || errorOutput.includes('Cannot find package')) {
    console.log(`    Устанавливаем недостающие зависимости в ${SUBMODULE_ROOT}...`);
    try {
      execSync('npm install --no-audit --no-fund', { cwd: SUBMODULE_ROOT, stdio: 'inherit' });
      ok('Зависимости установлены.');
    } catch (e) {
      warn(`Ошибка npm install: ${e.message}`);
    }
  }

  // 2. Проверка модели эмбеддингов
  if (errorOutput.includes('modelsCache') || errorOutput.includes('модель') || errorOutput.includes('setup-model')) {
    console.log(`    Инициализируем общую модель векторизации...`);
    const setupModelScript = path.join(SYSTEM_DIR, 'scripts', 'setup-model.js');
    if (fs.existsSync(setupModelScript)) {
      try {
        execSync(`node "${setupModelScript}"`, { cwd: SUBMODULE_ROOT, stdio: 'inherit' });
        ok('Модель векторизации инициализирована.');
      } catch (e) {
        warn(`Ошибка setup-model: ${e.message}`);
      }
    }
  }

  // 3. Проверка индекса
  if (errorOutput.includes('wiki-index.json') || errorOutput.includes('индекс не найден') || errorOutput.includes('lancedb')) {
    console.log(`    Собираем индекс базы знаний...`);
    const buildIndexScript = path.join(SYSTEM_DIR, 'build-index.js');
    if (fs.existsSync(buildIndexScript)) {
      try {
        const env = { ...process.env, KBPRO_AI_CHAT_WIKI_DIR: targetDir };
        execSync(`node "${buildIndexScript}"`, { cwd: SUBMODULE_ROOT, env, stdio: 'inherit' });
        ok('Векторный индекс успешно собран.');
      } catch (e) {
        warn(`Ошибка сборки индекса: ${e.message}`);
      }
    }
  }
}

async function main() {
  console.log(`\n${C.bold}═══ Мастер настройки глобальной базы знаний KBPro ═══${C.reset}`);
  const args = parseArgs();

  const currentWikiDir = (process.env.KBPRO_AI_CHAT_WIKI_DIR || '').trim();
  if (currentWikiDir && isValidProfile(currentWikiDir) && !args.force && !args.target) {
    ok(`Глобальная база знаний уже настроена и валидна: ${currentWikiDir}`);
    step('Проверка', 'Тестирование поиска');
    const test = testSearch(currentWikiDir);
    if (test.ok) {
      console.log(`\n${C.green}${C.bold}Все системы работают штатно! База знаний готова к использованию.${C.reset}\n`);
      return;
    }
    warn('Тест поиска выявил проблемы, пытаемся устранить...');
    autoHeal(currentWikiDir, test.error);
    const retest = testSearch(currentWikiDir);
    if (retest.ok) {
      console.log(`\n${C.green}${C.bold}Проблемы устранены! База знаний работает.${C.reset}\n`);
      return;
    }
  }

  // Шаг 1. Определение целевого пути
  step(1, 'Выбор директории для базы знаний');
  let targetPath = args.target;
  if (!targetPath) {
    const defaultTarget = getDefaultTarget();
    if (args.nonInteractive) {
      targetPath = defaultTarget;
      console.log(`    Используется путь по умолчанию: ${targetPath}`);
    } else {
      console.log(`База знаний хранит общие стандарты, документацию KBPro, Unity-гайды и ГДД проектов.`);
      targetPath = await ask('Куда склонировать базу знаний на ваш диск?', defaultTarget);
    }
  }
  targetPath = path.resolve(targetPath);

  // Шаг 2. Клонирование репозитория
  step(2, 'Клонирование репозитория базы знаний');
  try {
    cloneOrUpdateRepo(args.repo, targetPath);
  } catch (e) {
    err(`Ошибка при клонировании репозитория: ${e.message}`);
    console.error(`Убедитесь, что у вас есть доступ к ${args.repo} и установлен Git.`);
    process.exit(1);
  }

  // Шаг 3. Установка переменной окружения
  step(3, 'Настройка переменной окружения KBPRO_AI_CHAT_WIKI_DIR');
  setEnvVarPersistent('KBPRO_AI_CHAT_WIKI_DIR', targetPath);

  // Шаг 4. Тестирование и автопочинка
  step(4, 'Тестирование работы базы знаний и авто-исправление');
  let testResult = testSearch(targetPath);
  if (!testResult.ok) {
    autoHeal(targetPath, testResult.error);
    testResult = testSearch(targetPath);
  }

  if (testResult.ok) {
    console.log(`\n${C.green}${C.bold}═══ Настройка успешно завершена! ═══${C.reset}`);
    console.log(`База знаний:        ${targetPath}`);
    console.log(`Переменная среды:   KBPRO_AI_CHAT_WIKI_DIR=${targetPath}`);
    console.log(`Статус поиска:      АКТИВЕН И ПРОТЕСТИРОВАН\n`);
  } else {
    warn(`Настройка завершена, но тестовый запрос вернул замечание:`);
    console.error(testResult.error);
    console.log(`\nПопробуйте выполнить вручную: node system/query-wiki.js --query "test"\n`);
  }
}

main().catch((e) => {
  err(`Критический сбой мастера настройки: ${e.message}`);
  process.exit(1);
});
