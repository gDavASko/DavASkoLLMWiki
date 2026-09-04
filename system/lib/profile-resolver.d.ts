// Типы для profile-resolver.js — dependency-free ESM-модуль, разделяемый
// TS-приложением и автономными Wiki-скриптами. Импортируется относительным
// путём из checkout; в dist не компилируется.

export type ProfileErrorCode =
  | "KBPRO_PROFILE_MISSING_ROOT"
  | "KBPRO_PROFILE_NOT_ABSOLUTE"
  | "KBPRO_PROFILE_DEPRECATED_ENV"
  | "KBPRO_PROFILE_INVALID_LAYER_ID"
  | "KBPRO_PROFILE_LAYER_ESCAPE";

export declare const ProfileErrorCode: {
  readonly MISSING_ROOT: "KBPRO_PROFILE_MISSING_ROOT";
  readonly NOT_ABSOLUTE: "KBPRO_PROFILE_NOT_ABSOLUTE";
  readonly DEPRECATED_ENV: "KBPRO_PROFILE_DEPRECATED_ENV";
  readonly INVALID_LAYER_ID: "KBPRO_PROFILE_INVALID_LAYER_ID";
  readonly LAYER_ESCAPE: "KBPRO_PROFILE_LAYER_ESCAPE";
};

export interface Profile {
  /** Абсолютный корень профиля (KBPRO_AI_CHAT_WIKI_DIR). */
  readonly root: string;
  /** `<root>/config`. */
  readonly configDir: string;
  /** `<root>/data`. */
  readonly dataDir: string;
  /** `<root>/.runtime`. */
  readonly runtimeDir: string;
  /** `<root>/data/agy-workspace`. */
  readonly agyWorkspaceDir: string;
  /** Валидированный путь слоя `<root>/<layerId>`; бросает при escape/невалидном id. */
  layerPath(layerId: string): string;
}

/** Ошибка resolver'а несёт стабильный код в поле `code`. */
export interface ProfileError extends Error {
  code: ProfileErrorCode;
}

/**
 * Разрешает и валидирует профиль по окружению. Бросает ProfileError при
 * отсутствии/относительном корне или заданных устаревших override-переменных.
 */
export declare function resolveProfile(env?: NodeJS.ProcessEnv): Profile;

/** Валидирует и возвращает абсолютный корень профиля из окружения. */
export declare function resolveWikiRoot(env: NodeJS.ProcessEnv): string;

/** Fail-fast на устаревшие override-переменные путей данных. */
export declare function assertNoDeprecatedEnv(env: NodeJS.ProcessEnv): void;

/** Чистая деривация путей профиля из абсолютного корня. */
export declare function deriveProfilePaths(root: string): Profile;

/** Снимает legacy-префикс `knowledge-base/` и обрезает пробелы. */
export declare function normalizeLayerId(value: string): string;

/** Валидирует layerId и строит путь `<root>/<layerId>` внутри профиля. */
export declare function resolveLayerPath(root: string, layerId: string): string;
