// Типы для wiki-paths.js — резолвинг путей движка Wiki, разделяемый скриптами.

export interface WikiPaths {
  readonly mode: "legacy" | "profile";
  readonly systemDir: string;
  readonly checkoutRoot: string;
  readonly dataRoot: string;
  readonly searchConfigFile: string;
  readonly indexConfigFile: string;
  readonly lancedbDir: string;
  readonly embeddingManifestFile: string;
  readonly emptyDocCacheFile: string;
  readonly indexFile: string;
  readonly dumpFile: string;
  readonly modelsCacheFallback: string;
}

export declare function resolveWikiPaths(env: NodeJS.ProcessEnv, systemDir: string): WikiPaths;
