# KBPro AI Docs Obsidian Vault

Open this folder in Obsidian:

`Assets/KBPro/kbpro-ai-docs`

Start from the `wiki/index.md` of the layer you need. A layer is identified by its `wiki.json` manifest;
the indexer accepts both normal layers (`wiki/` + `raw/`) and raw-only layers (`raw/` only). This matters
after a Git clone because Git does not preserve an empty `wiki/` directory.

The `raw/` folder stores source material and should not be edited by AI agents. The `wiki/` folder stores
compiled knowledge pages maintained by AI agents using `LLM-WIKI.md`.

Recommended workflow:

1. Put source files into `raw/`.
2. Ask the AI agent to ingest the source using `LLM-WIKI.md`.
3. Review the generated pages in Obsidian.
4. Ask for a wiki lint when the graph starts to grow.

The existing KBPro architecture documents remain in place and can be ingested into the
wiki over time.

Indexing is incremental by default with chunking profile v4 (200 words target, 32-word bidirectional overlap, hierarchy breadcrumbs, and checkpoints every 20 documents). The embedding and chunking profiles are part of the index format; after either profile changes, rebuild intentionally with `node system/build-index.js --force` before resuming normal incremental runs.

Search is orchestrated by the LangGraph Control Plane via `node system/query-wiki.js --auto "<query>"` (auto-routing to RAG, RLM, or Graphify, with consensus evaluation via LLM-Judge, fallback tiers, and A/B comparators). High-speed resident search is available via `node system/search-server.js` (~1.5s latency). The core retrieval and orchestration system is validated by 42 unit tests (`npm test`).
