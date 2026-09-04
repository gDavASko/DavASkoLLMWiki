// Типы для config-manifest.js — жизненный цикл config/ профиля.

export declare const CONFIG_SCHEMA_VERSION: number;
export declare const CONFIG_MIN_SCHEMA_VERSION: number;

export type ConfigErrorCode = "KBPRO_CONFIG_MISSING" | "KBPRO_CONFIG_INCOMPATIBLE";
export declare const ConfigErrorCode: {
  readonly MISSING: "KBPRO_CONFIG_MISSING";
  readonly INCOMPATIBLE: "KBPRO_CONFIG_INCOMPATIBLE";
};

export interface ConfigManifest {
  schemaVersion: number;
  updatedAt?: string;
}

export declare function writeConfigManifest(configDir: string, schemaVersion?: number): void;
export declare function readConfigManifest(configDir: string): ConfigManifest | null;
export declare function assertConfigCompatible(
  configDir: string,
  supported?: { min?: number; current?: number },
): void;
