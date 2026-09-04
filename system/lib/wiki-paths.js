/**
 * wiki-paths.js — единый резолвинг файловых путей движка Wiki для автономных
 * Node-скриптов (query-wiki.js, query-target.js, build-index.js).
 *
 * Разводит три класса, которые исторически смешивались в `SYSTEM_DIR`/`ROOT_DIR`:
 *   - код       — всегда из checkout (systemDir и его родитель);
 *   - config    — search-config.json, index-config.json;
 *   - runtime   — индекс, LanceDB, manifest, кэши, dump;
 *   - данные    — слои/документы (dataRoot).
 *
 * Переключение на внешний профиль включается только при наличии маркера
 * `config/config-manifest.json` в профиле, заданном через KBPRO_AI_CHAT_WIKI_DIR.
 * Пока маркера нет, поведение бит-в-бит совпадает с legacy (__dirname-раскладкой),
 * а WIKI_DIR игнорируется — ровно как в текущих скриптах, которые его не читают.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveWikiRoot, deriveProfilePaths, assertNoDeprecatedEnv } from "./profile-resolver.js";

/**
 * @typedef {Object} WikiPaths
 * @property {"legacy"|"profile"} mode
 * @property {string} systemDir              Каталог движка в checkout.
 * @property {string} checkoutRoot           Родитель systemDir (для hyperresearch/build-index.js).
 * @property {string} dataRoot               Корень данных: слои/документы.
 * @property {string} searchConfigFile
 * @property {string} indexConfigFile
 * @property {string} lancedbDir
 * @property {string} embeddingManifestFile
 * @property {string} emptyDocCacheFile
 * @property {string} indexFile
 * @property {string} dumpFile
 * @property {string} modelsCacheFallback
 */

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} systemDir  Каталог скрипта в checkout (обычно __dirname).
 * @returns {WikiPaths}
 */
export function resolveWikiPaths(env, systemDir) {
  const checkoutRoot = path.resolve(systemDir, "..");

  // Checkout-local override: маркер `.kbpro-local-kb` в корне checkout принудительно
  // включает ЛОКАЛЬНУЮ базу знаний этого checkout (legacy-раскладка: dataRoot =
  // checkoutRoot, индекс в system/.lancedb), игнорируя глобальный
  // KBPRO_AI_CHAT_WIKI_DIR. Нужен проектным сабмодулям (напр. в Unity-проекте),
  // чтобы держать собственную БЗ и не зависеть от общего профиля хоста/бота.
  const localOverride = fs.existsSync(path.join(checkoutRoot, ".kbpro-local-kb"));

  const wikiDir = (env.KBPRO_AI_CHAT_WIKI_DIR ?? "").trim();
  // Заданный WIKI_DIR обязан быть абсолютным (fail-fast), но деривация путей —
  // без проверки устаревших env: она сработает только при активации профиля.
  const profile = (!localOverride && wikiDir) ? deriveProfilePaths(resolveWikiRoot(env)) : null;
  const activated =
    profile !== null && fs.existsSync(path.join(profile.configDir, "config-manifest.json"));

  if (profile && activated) {
    // Активированный (мигрированный) профиль требует чистого окружения.
    assertNoDeprecatedEnv(env);
    const { configDir, runtimeDir } = profile;
    return {
      mode: "profile",
      systemDir,
      checkoutRoot,
      dataRoot: profile.root,
      searchConfigFile: path.join(configDir, "search-config.json"),
      indexConfigFile: path.join(configDir, "index-config.json"),
      lancedbDir: path.join(runtimeDir, ".lancedb"),
      embeddingManifestFile: path.join(runtimeDir, "embedding-profile.json"),
      emptyDocCacheFile: path.join(runtimeDir, "empty-document-cache.json"),
      indexFile: path.join(runtimeDir, "wiki-index.json"),
      dumpFile: path.join(runtimeDir, ".cursor-context-dump.md"),
      modelsCacheFallback: path.join(runtimeDir, "models-cache"),
    };
  }

  // Legacy: всё колокировано в checkout, как в текущих скриптах.
  return {
    mode: "legacy",
    systemDir,
    checkoutRoot,
    dataRoot: checkoutRoot,
    searchConfigFile: path.join(systemDir, "search-config.json"),
    indexConfigFile: path.join(systemDir, "index-config.json"),
    lancedbDir: path.join(systemDir, ".lancedb"),
    embeddingManifestFile: path.join(systemDir, "embedding-profile.json"),
    emptyDocCacheFile: path.join(systemDir, "empty-document-cache.json"),
    indexFile: path.join(systemDir, "wiki-index.json"),
    dumpFile: path.join(checkoutRoot, ".cursor-context-dump.md"),
    modelsCacheFallback: path.join(systemDir, "models-cache"),
  };
}
