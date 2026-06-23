# DavASko LLM Wiki — Claude Instructions

## Core Context Protocol (CCP)

Before answering any question about the knowledge base, architecture, code patterns, or project specifics, you MUST:

1. **Search the wiki first**:
   ```bash
   node system/query-wiki.js --query "RelevantSymbol, relevant topic phrase"
   ```
2. **Read the context dump**:
   ```bash
   cat .cursor-context-dump.md
   ```
3. **Use the retrieved documents** as grounded context for your answer. Always cite source pages.

## Available Commands

| Command | Description |
|---|---|
| `node system/query-wiki.js --query "..."` | Hybrid search (symbolic + semantic) |
| `node system/build-index.js` | Build/update vector index (incremental) |
| `node system/build-index.js --force` | Full index rebuild |
| `node system/scripts/lint-wiki.js` | Validate wiki pages |
| `node system/scripts/validate-links.js` | Check all links |
| `node system/scripts/ingest-newdata.js` | Import from NewData/ |
| `node system/scripts/check-staleness.js` | Detect wiki pages whose cited sources changed (CI gate) |
| `node system/scripts/check-staleness.js --stamp [page]` | Re-stamp provenance hashes after actualizing a page |
| `node system/scripts/eval-retrieval.js` | Measure retrieval quality (recall@k/MRR/nDCG) vs flat & grep baselines |
| `node system/scripts/eval-retrieval.js --sweep` | Calibrate the similarity threshold on labeled data |
| `node system/scripts/run-evals.js` | Run regression tests |
| `node system/sync-ai-rules.js` | Sync IDE rules and skills |

## Key Rules

- Encoding: **`.md` → UTF-8 with BOM**; all other text (`.json`, `.js`, `.ps1`, IDE rules) → **UTF-8 without BOM** (a BOM breaks `JSON.parse`). See Data Standards §1; the linter enforces this.
- Wiki pages require YAML frontmatter: `title`, `type`, `status`, `sources`, `last_updated`, `related`
- Use `[[page-name]]` Obsidian links between wiki pages
- Plans go in `plans/` (never inside wiki layers)
- New raw data goes into `NewData/<layer-name>/` for ingestion
- Full-Text Search Gaps Policy: if you grep for code patterns not in the wiki, document your findings in the knowledge base
- Source-of-Truth: code/`raw/` is the truth, `wiki/` is derived. Record `source_hashes` provenance; when `check-staleness.js` flags a page, use the **davasko-wiki-refresh** skill to actualize it (don't just re-stamp)
