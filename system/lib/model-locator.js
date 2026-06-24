// ═══════════════════════════════════════════════════════════════════════
//  model-locator.js — единая точка разрешения пути к общей модели
// ───────────────────────────────────────────────────────────────────────
//  Раньше каждый скрипт хардкодил MODELS_CACHE = system/models-cache, из-за
//  чего модель (~1.1 GB) дублировалась в каждой развёрнутой базе знаний.
//  Теперь модель ставится ОДИН раз в системное место, а её путь публикуется
//  через системную метку (global config). Любая база знаний находит модель
//  по метке и работает с одной-единственной копией.
//
//  Порядок разрешения (resolveModelsCache):
//    1. env DAVASKO_LLM_WIKI_MODELS  — явный override (CI, нестандартные сетапы)
//    2. системная метка (global config.modelsCache) — основной путь
//    3. локальный <repo>/system/models-cache — легаси-фолбэк / репо-исходник
//    4. null — модели нет; вызывающий просит запустить setup-model
//
//  Чистый модуль (fs/path/os) — без сетевых и модельных зависимостей.
// ═══════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import os from 'os';

export const DEFAULT_MODEL_ID = 'jinaai/jina-embeddings-v3';

// ─── системные пути (per-user, без прав администратора) ──────────────────

/** Корневая системная папка инструмента (per-user). */
export function getSystemRoot() {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'DavASkoLLMWiki');
  }
  // *nix/macOS: XDG-совместимо, с фолбэком на ~/.davasko-llm-wiki
  const xdg = process.env.XDG_DATA_HOME;
  if (xdg) return path.join(xdg, 'davasko-llm-wiki');
  return path.join(os.homedir(), '.davasko-llm-wiki');
}

/** Путь системной метки (global config) — единый источник пути к модели. */
export function getMarkerPath() {
  return path.join(getSystemRoot(), 'config.json');
}

/** Дефолтное системное место для общей модели (models-cache). */
export function getDefaultSystemModelsDir() {
  return path.join(getSystemRoot(), 'models-cache');
}

// ─── чтение/запись метки ─────────────────────────────────────────────────

/** Читает системную метку. Возвращает объект конфига или null. */
export function readMarker() {
  const p = getMarkerPath();
  try {
    let raw = fs.readFileSync(p, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // BOM-tolerant
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Пишет/обновляет системную метку. JSON без BOM (правило Data Standards §1).
 * @returns {string} путь записанной метки
 */
export function writeMarker({ modelsCache, modelId = DEFAULT_MODEL_ID, revision = 'main' } = {}) {
  const root = getSystemRoot();
  fs.mkdirSync(root, { recursive: true });
  const existing = readMarker() || {};
  const cfg = {
    ...existing,
    modelsCache: path.resolve(modelsCache),
    modelId,
    revision,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(getMarkerPath(), JSON.stringify(cfg, null, 2), 'utf8');
  return getMarkerPath();
}

// ─── проверка наличия модели ─────────────────────────────────────────────

/** Есть ли модель в данной models-cache директории (config.json модели). */
export function isModelPresent(cacheDir, modelId = DEFAULT_MODEL_ID) {
  if (!cacheDir) return false;
  const cfg = path.join(cacheDir, ...modelId.split('/'), 'config.json');
  return fs.existsSync(cfg);
}

// ─── разрешение пути к модели ─────────────────────────────────────────────

/**
 * Разрешает models-cache по приоритету env → метка → локальный фолбэк.
 * @param {object} opts
 * @param {string} [opts.localFallback] путь <repo>/system/models-cache для легаси/исходника
 * @param {string} [opts.modelId]
 * @returns {{ dir: string|null, source: 'env'|'marker'|'local'|'none', present: boolean }}
 */
export function resolveModelsCache({ localFallback, modelId = DEFAULT_MODEL_ID } = {}) {
  const envDir = process.env.DAVASKO_LLM_WIKI_MODELS;
  if (envDir && isModelPresent(envDir, modelId)) {
    return { dir: path.resolve(envDir), source: 'env', present: true };
  }

  const marker = readMarker();
  if (marker && marker.modelsCache && isModelPresent(marker.modelsCache, modelId)) {
    return { dir: path.resolve(marker.modelsCache), source: 'marker', present: true };
  }

  if (localFallback && isModelPresent(localFallback, modelId)) {
    return { dir: path.resolve(localFallback), source: 'local', present: true };
  }

  // ничего не нашли: вернём наиболее вероятный путь подсказкой, present=false
  const hint = (envDir && path.resolve(envDir))
    || (marker && marker.modelsCache && path.resolve(marker.modelsCache))
    || (localFallback && path.resolve(localFallback))
    || getDefaultSystemModelsDir();
  return { dir: null, source: 'none', present: false, hint };
}

export default {
  DEFAULT_MODEL_ID,
  getSystemRoot,
  getMarkerPath,
  getDefaultSystemModelsDir,
  readMarker,
  writeMarker,
  isModelPresent,
  resolveModelsCache,
};
