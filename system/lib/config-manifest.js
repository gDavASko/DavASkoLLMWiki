/**
 * config-manifest.js — жизненный цикл `config/` профиля базы знаний.
 *
 * Манифест `config/config-manifest.json` служит одновременно маркером активации
 * профиля (его наличие переключает resolver из legacy в profile-режим) и
 * носителем версии схемы конфигурации. Запись — атомарная (temp + rename), чтобы
 * читатель никогда не видел полузаписанный файл.
 *
 * Dependency-free ESM, разделяется приложением, скриптами и миграцией.
 */

import fs from "node:fs";
import path from "node:path";

/** Текущая версия схемы конфигурации, поддерживаемая кодом. */
export const CONFIG_SCHEMA_VERSION = 1;
/** Минимальная версия схемы, с которой код ещё совместим. */
export const CONFIG_MIN_SCHEMA_VERSION = 1;

const MANIFEST_NAME = "config-manifest.json";

/** Стабильные коды ошибок совместимости. */
export const ConfigErrorCode = Object.freeze({
  MISSING: "KBPRO_CONFIG_MISSING",
  INCOMPATIBLE: "KBPRO_CONFIG_INCOMPATIBLE",
});

function configError(code, message) {
  const error = /** @type {Error & { code: string }} */ (new Error(message));
  error.code = code;
  return error;
}

/**
 * Атомарно записывает манифест в `<configDir>/config-manifest.json`.
 * @param {string} configDir
 * @param {number} [schemaVersion=CONFIG_SCHEMA_VERSION]
 */
export function writeConfigManifest(configDir, schemaVersion = CONFIG_SCHEMA_VERSION) {
  fs.mkdirSync(configDir, { recursive: true });
  const target = path.join(configDir, MANIFEST_NAME);
  const tmp = path.join(configDir, `.${MANIFEST_NAME}.${process.pid}.tmp`);
  const body = JSON.stringify({ schemaVersion, updatedAt: new Date().toISOString() }, null, 2) + "\n";
  fs.writeFileSync(tmp, body, "utf8");
  fs.renameSync(tmp, target); // atomic replace
}

/**
 * Читает манифест; возвращает null, если файла нет или он повреждён.
 * @param {string} configDir
 * @returns {{ schemaVersion: number, updatedAt?: string } | null}
 */
export function readConfigManifest(configDir) {
  try {
    const raw = fs.readFileSync(path.join(configDir, MANIFEST_NAME), "utf8").replace(/^﻿/, "");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.schemaVersion !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Preflight совместимости версии профиля с кодом. Бросает понятную ошибку с
 * кодом при отсутствии манифеста или несовместимой версии.
 * @param {string} configDir
 * @param {{ min?: number, current?: number }} [supported]
 */
export function assertConfigCompatible(configDir, supported = {}) {
  const min = supported.min ?? CONFIG_MIN_SCHEMA_VERSION;
  const current = supported.current ?? CONFIG_SCHEMA_VERSION;
  const manifest = readConfigManifest(configDir);
  if (!manifest) {
    throw configError(
      ConfigErrorCode.MISSING,
      `config-manifest.json не найден в ${configDir}. Инициализируйте профиль командой init перед запуском.`,
    );
  }
  const found = manifest.schemaVersion;
  if (found < min || found > current) {
    throw configError(
      ConfigErrorCode.INCOMPATIBLE,
      `Несовместимая версия схемы профиля: найдено ${found}, код поддерживает диапазон [${min}, ${current}]. ` +
        `Требуется миграция профиля${found > current ? " или обновление кода" : ""}.`,
    );
  }
}
