/**
 * profile-resolver.js — единый resolver внешнего профиля базы знаний.
 *
 * Dependency-free ESM-модуль, физически размещённый рядом с Wiki-скриптами в
 * `knowledge-base/system/lib/`. Его импортируют напрямую автономные Node-скрипты
 * (`node`) и относительным путём из checkout — TS-приложение (`src/`,
 * `MCPReadTool/src/`) под `tsx`. Логика резолвинга существует только здесь; её
 * дублирование в других runtime запрещено.
 *
 * Контракт ошибок: все отказы — это Error со стабильным полем `code`, чтобы
 * вызыватели и тесты сверялись с контрактом, а не с текстом сообщения.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Строгий allowlist-формат идентификатора слоя: строчные буквы/цифры и дефис,
 * первый символ — буква или цифра. Разделители пути, `.`, `..`, `~` и абсолютные
 * префиксы исключены самим форматом.
 */
const LAYER_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/** Стабильные коды ошибок resolver'а. */
export const ProfileErrorCode = Object.freeze({
  MISSING_ROOT: "KBPRO_PROFILE_MISSING_ROOT",
  NOT_ABSOLUTE: "KBPRO_PROFILE_NOT_ABSOLUTE",
  DEPRECATED_ENV: "KBPRO_PROFILE_DEPRECATED_ENV",
  INVALID_LAYER_ID: "KBPRO_PROFILE_INVALID_LAYER_ID",
  LAYER_ESCAPE: "KBPRO_PROFILE_LAYER_ESCAPE",
});

/**
 * @param {string} code
 * @param {string} message
 * @returns {Error & { code: string }}
 */
function profileError(code, message) {
  const error = /** @type {Error & { code: string }} */ (new Error(message));
  error.code = code;
  return error;
}

/**
 * @typedef {Object} Profile
 * @property {string} root             Абсолютный корень профиля (KBPRO_AI_CHAT_WIKI_DIR).
 * @property {string} configDir        `<root>/config`.
 * @property {string} dataDir          `<root>/data`.
 * @property {string} runtimeDir       `<root>/.runtime`.
 * @property {string} agyWorkspaceDir  `<root>/data/agy-workspace`.
 * @property {(layerId: string) => string} layerPath  Валидированный путь слоя.
 */

/**
 * Валидирует и возвращает абсолютный корень профиля из окружения. Тильда не
 * разворачивается, а относительный путь молча привязался бы к cwd — оба запрещены.
 * @param {NodeJS.ProcessEnv} env
 * @returns {string} Абсолютный путь корня.
 */
export function resolveWikiRoot(env) {
  const raw = (env.KBPRO_AI_CHAT_WIKI_DIR ?? "").trim();
  if (!raw) {
    throw profileError(
      ProfileErrorCode.MISSING_ROOT,
      "KBPRO_AI_CHAT_WIKI_DIR не задан. Каждый хост обязан указывать абсолютный путь профиля базы знаний.",
    );
  }
  if (raw.startsWith("~") || !path.isAbsolute(raw)) {
    throw profileError(
      ProfileErrorCode.NOT_ABSOLUTE,
      `KBPRO_AI_CHAT_WIKI_DIR должен быть абсолютным путём без «~»; получено: ${raw}`,
    );
  }
  return path.resolve(raw);
}

/**
 * Fail-fast на устаревшие override-переменные путей данных. Они вывели бы
 * State/Jobs/Facts или agy-workspace за пределы <root>/data и дали бы тихое
 * расхождение профилей. Вызывается только для активированного профиля —
 * во время transition (legacy-раскладка) устаревшие переменные ещё
 * допускаются, чтобы деплой кода не ломал живой сервис до миграции.
 * @param {NodeJS.ProcessEnv} env
 */
export function assertNoDeprecatedEnv(env) {
  const deprecated = ["KBPRO_AI_CHAT_DATA_DIR", "KBPRO_AI_CHAT_STATE_DB_PATH", "KBPRO_AI_CHAT_AGY_WORKSPACE_DIR"].filter(
    (key) => (env[key] ?? "").trim() !== "",
  );
  if (deprecated.length > 0) {
    throw profileError(
      ProfileErrorCode.DEPRECATED_ENV,
      `Переменные ${deprecated.join(", ")} устарели: пути данных выводятся из <KBPRO_AI_CHAT_WIKI_DIR>/data. ` +
        "Удалите их из runtime.env и перенесите существующие SQLite-базы и agy-workspace под <root>/data.",
    );
  }
}

/**
 * Чистая деривация путей профиля из абсолютного корня — без чтения окружения и
 * без проверок устаревших переменных. Единственный источник раскладки профиля;
 * им пользуются и строгий resolveProfile, и transition-потребители (движок, MCP).
 * @param {string} root  Абсолютный корень профиля.
 * @returns {Profile}
 */
export function deriveProfilePaths(root) {
  const dataDir = path.join(root, "data");
  return {
    root,
    configDir: path.join(root, "config"),
    dataDir,
    runtimeDir: path.join(root, ".runtime"),
    agyWorkspaceDir: path.join(dataDir, "agy-workspace"),
    layerPath: (layerId) => resolveLayerPath(root, layerId),
  };
}

/**
 * Разрешает и строго валидирует профиль по окружению (fail-fast на устаревшие
 * переменные). Точка входа для строгих мест: preflight, CLI-старт.
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {Profile}
 */
export function resolveProfile(env = process.env) {
  const root = resolveWikiRoot(env);
  assertNoDeprecatedEnv(env);
  return deriveProfilePaths(root);
}

/**
 * Нормализует значение слоя из каталога: снимает legacy-префикс
 * `knowledge-base/` и обрезает пробелы. Возвращает голый `layerId` (без
 * валидации формата — только приведение legacy-строк к стабильному виду).
 * @param {string} value
 * @returns {string}
 */
export function normalizeLayerId(value) {
  return String(value ?? "").trim().replace(/^knowledge-base[/\\]/, "");
}

/**
 * Валидирует `layerId` (приходит из данных-каталога, доверять нельзя) и строит
 * путь `<root>/<layerId>`, гарантируя, что итог остаётся строго внутри профиля.
 * @param {string} root
 * @param {string} layerId
 * @returns {string}
 */
export function resolveLayerPath(root, layerId) {
  const id = typeof layerId === "string" ? layerId.trim() : "";
  if (!LAYER_ID_RE.test(id)) {
    throw profileError(
      ProfileErrorCode.INVALID_LAYER_ID,
      `Недопустимый layerId «${String(layerId)}»: ожидается формат ${LAYER_ID_RE} без разделителей пути и «..».`,
    );
  }

  const candidate = path.join(root, id);

  // Первый барьер: нормализованный путь обязан быть одним сегментом внутри root.
  const rel = path.relative(root, candidate);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw profileError(ProfileErrorCode.LAYER_ESCAPE, `layerId «${id}» выходит за пределы профиля.`);
  }

  // Второй барьер: если путь существует, разворачиваем симлинки и сверяем, что
  // реальная цель по-прежнему внутри профиля (root тоже realpath'им, т.к. tmp и
  // системные каталоги сами бывают симлинками).
  if (fs.existsSync(candidate)) {
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    const realRel = path.relative(realRoot, realCandidate);
    if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
      throw profileError(
        ProfileErrorCode.LAYER_ESCAPE,
        `layerId «${id}» ведёт по симлинку за пределы профиля (${realCandidate}).`,
      );
    }
  }

  return candidate;
}
