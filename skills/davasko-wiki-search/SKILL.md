---
name: davasko-wiki-search
description: Use this skill to perform hybrid (symbolic + semantic) search across the DavASko LLM Wiki knowledge base. It queries the pre-built vector index using Jina v3 embeddings and returns relevant wiki pages via a context dump file.
status: stable
owner: DavASko
license: Proprietary
allowed-tools:
  - Bash
  - Read
required_reading:
  - ../../system/docs/architecture-setup.md
  - ../../system/docs/data-standards.md
known_risks:
  - Running query-wiki.js without a built index (wiki-index.json) will fail. Always run build-index.js first.
  - The semantic search model loads into RAM (~500MB). On low-memory machines the script may crash.
  - The default .cursor-context-dump.md file is overwritten on every query. For parallel queries (multiple agents/sessions) pass `--out <path>` to write to a per-session file, or `--stdout` to stream the dump instead of touching the shared file.
---

# DavASko Wiki Search (Hybrid RAG Query Skill)

## Persona / Identity

You are a Knowledge Retrieval Specialist. You use the DavASko LLM Wiki's hybrid search engine to find the most relevant wiki pages for any user query. You understand both C# code symbols (PascalCase classes, interfaces) and natural language concepts in Russian and English.

## Goal

Execute a hybrid search (symbolic + semantic) against the pre-built wiki vector index and deliver the matched context to the AI agent for grounded reasoning.

## Prerequisites

Before using this skill, ensure:

1. **Index exists**: `system/wiki-index.json` must exist. If not, build it:
   ```bash
   node system/build-index.js
   ```
2. **Shared model installed**: The Jina v3 model lives in a single **system-wide** location referenced by a marker (`…/DavASkoLLMWiki/config.json`) — it is NOT stored inside the KB. If the query can't find it, install once:
   ```bash
   node system/scripts/setup-model.js
   ```
   Resolution order (see `system/lib/model-locator.js`): env `DAVASKO_LLM_WIKI_MODELS` → marker → repo-local `system/models-cache` (fallback). If nothing is found, `setup-model.js` asks where to place the shared model.
3. **Dependencies installed**: Run `npm install` from the repository root (uses offline `.tgz` from `system/vendor/`).

## Workflow

### Step 1: Formulate the Query

Construct a `--query` string combining:
- **C# Symbols** (PascalCase): `CowController`, `INetworkMessage`, `ModuleBase`
- **Semantic phrases** (any language): `blend tree optimization`, `оптимизация физики`

Separate multiple items with commas:
```
"CowController, blend tree animation optimization"
```

### Step 2: Execute the Search

Run the query orchestrator:
```bash
node system/query-wiki.js --query "CowController, blend tree animation optimization"
```

**What happens inside:**
- **Stream A** (instant): Matches symbols against `id`, `symbols`, `tags`, `wikilinks` fields in the index
- **Stream B** (1–2s): Vectorizes the semantic phrase with `query:` prefix, ranks clusters by centroid and scans the `nprobe` nearest shards (IVF multi-probe; exhaustive when `nprobe ≥ cluster count`), then filters by an **adaptive threshold** — default `relative` mode keeps chunks with cosine ≥ `max(junk_floor, relative_alpha · top_score)` (per-query), `absolute` mode uses a fixed `similarity_threshold`. Returns Top-`top_k_documents`. All knobs come from `system/search-config.json`
- **Graph Lift**: For exact matches (Stream A), loads `extends` parent (+1) and `[[WikiLinks]]` references (+1)
- **Context Dump**: Writes matched documents to `.cursor-context-dump.md` in the project root

### Step 3: Read the Context Dump

After the command completes, read the generated context file:
```
.cursor-context-dump.md
```

This file contains:
- Query metadata (timestamp, document count)
- Each matched document with source tag (🎯 Exact / 🧠 Semantic / 🔗 Graph+1)
- A **Kind** label per result: `📄 SOURCE (ground truth)` for raw/code vs `📝 SUMMARY (derived — may lag the source)` for wiki pages — prefer the SOURCE when they disagree
- Cosine similarity scores
- Full cleaned document body (frontmatter stripped)

The file is limited to ~120KB to prevent IDE buffer overflow. For parallel queries
(multiple agents/sessions), pass `--out <path>` to write to a per-session file, or
`--stdout` to stream the dump instead of touching the shared file.

### Step 4: Use the Context

Use the retrieved documents as grounded context for answering the user's question. Always cite the source documents using their `id` and `path` fields.

## Important Notes

- **stdout vs stderr**: The script outputs only a short status line to stdout (`WIKI_QUERY_RESULT: ...`). All diagnostic information goes to stderr. This prevents IDE buffer overflow.
- **Symbol-only queries**: If the query contains only PascalCase symbols (no semantic phrase), the model is NOT loaded, making the search instant.
- **PascalCase extraction**: only strict code identifiers (PascalCase with ≥2 humps, `I`-interfaces, `m_` fields) are extracted for Stream A. Generic capitalised words/acronyms (How, JSON, API) are NOT treated as symbols — they only added ranking noise. E.g. `"как регистрировать EventBus"` → symbol `EventBus` + semantic phrase.
- **Ranking**: results are interleaved by score (symbol and semantic hits compete on a unified scale), not "symbols always first" — a strong semantic hit outranks a weak symbol match. Graph-lifted neighbours trail as context.
- **Adaptive threshold**: by default the inclusion threshold adapts per query (`relative` mode in `system/search-config.json`); there is no fixed cosine cutoff.
- **Incremental updates**: If wiki pages change, re-run `node system/build-index.js` to update the index. Unchanged files are skipped via MD5 cache.
- **Full rebuild**: Use `node system/build-index.js --force` to rebuild the entire index from scratch.
- **Raw documents**: Since v3.1, both `wiki/` pages and `raw/` source documents are indexed. Raw documents contain full code examples and API details; wiki pages are summaries. Both are searched simultaneously. IDs of raw documents are prefixed with `raw-<layer>-`.
