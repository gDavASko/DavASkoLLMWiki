# KBPro AI Docs Obsidian Vault

Open this folder in Obsidian:

`Assets/KBPro/kbpro-ai-docs`

Start from the `wiki/index.md` of the layer you need. A layer is identified by its `wiki.json` manifest;
the indexer accepts normal layers (`wiki/` + `raw/`) and raw-only layers (`raw/` only). This is intentional:
Git does not preserve an empty `wiki/` directory.

The `raw/` folder stores source material and should not be edited by AI agents. The `wiki/` folder stores
compiled knowledge pages maintained by AI agents using `LLM-WIKI.md`.

Recommended workflow:

1. Put source files into `raw/`.
2. Ask the AI agent to ingest the source using `LLM-WIKI.md`.
3. Review the generated pages in Obsidian.
4. Ask for a wiki lint when the graph starts to grow.

The existing KBPro architecture documents remain in place and can be ingested into the
wiki over time.

Indexing is incremental by default. The chunking profile is part of the index format; after it changes,
run `node system/build-index.js --force` intentionally before resuming normal incremental indexing.
