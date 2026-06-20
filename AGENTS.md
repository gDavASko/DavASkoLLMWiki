# DavASko LLM Wiki — Agent Instructions

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
| `node system/scripts/run-evals.js` | Run regression tests |
| `node system/sync-ai-rules.js` | Sync IDE rules and skills |

## Key Rules

- All files must be **UTF-8 with BOM** encoding
- Wiki pages require YAML frontmatter: `title`, `type`, `status`, `sources`, `last_updated`, `related`
- Use `[[page-name]]` Obsidian links between wiki pages
- Plans go in `plans/` (never inside wiki layers)
- New raw data goes into `NewData/<layer-name>/` for ingestion
- Full-Text Search Gaps Policy: if you grep for code patterns not in the wiki, document your findings in the knowledge base
