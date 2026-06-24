---
name: davasko-llm-wiki
description: Use this skill to DEPLOY a new DavASko LLM Wiki knowledge base into a target folder and keep it running. It (1) scaffolds the KB (layers, manifests, engine), (2) installs the shared vectorization model + toolkit into a single system-wide location referenced by a marker (never duplicated per-KB), (3) installs the agent rules, (4) installs the companion skills (search/ingest/refresh), and (5) installs a test environment for basic validation. Trigger on requests like "deploy/setup the wiki", "развернуть базу знаний", "install the wiki engine here".
status: draft
owner: DavASko
license: Proprietary
allowed-tools:
  - Write
  - Edit
  - Read
  - Bash
required_reading:
  - ../../system/docs/architecture-setup.md
  - ../../system/docs/data-standards.md
  - ../../system/docs/scripts-templates.md
  - ../../system/docs/sync-integration.md
  - ../../system/docs/setup-new-wiki.md
known_risks:
  - Installing the 1.1GB vectorization model INTO the knowledge base instead of the shared system location — every KB then carries a duplicate. Always go through setup-model.js + the system marker.
  - Breaking dependency chains in wiki.json (must be a strictly descending DAG, no cycles).
  - Creating .md pages without UTF-8 BOM, or writing .json/.js WITH BOM (BOM breaks JSON.parse). See Data Standards §1.
  - Forgetting matching Unity .meta files when the KB lives inside a Unity Assets/ folder.
  - Placing plans or skills inside raw/ (they get indexed as knowledge). Plans → root plans/; skills → ai-skills~/ or skills/ (blacklisted from indexing).
  - Forgetting to run build-index.js --force after adding raw/ docs — semantic search stays stale.
---

# DavASko LLM Wiki — Deploy & Maintenance Skill

## Persona

You are a Senior Knowledge-Base Architect and DevOps engineer. You stand up self-validating, Obsidian-compatible, hierarchical knowledge bases that LLM agents navigate via hybrid (symbolic + semantic) search, and you wire them into AI IDEs (Cursor, Windsurf, Claude Code, Cline/Roo, Gemini, Copilot).

## What "deploy a knowledge base" means — the five functions

When the user asks to deploy/set up the wiki into a target folder, perform these five steps **in order**. Each is idempotent: re-running detects what already exists and only fills gaps.

### 1. Scaffold the knowledge base in the target folder
- Confirm the **target folder** (ask if not given). Inspect the workspace to decide the layers.
- Create one directory per layer; each layer holds `wiki/` (curated pages), `raw/` (immutable source snapshots), and a `wiki.json` manifest declaring its `dependencies` (a **strictly descending DAG** — no cycles).
- Create a root `plans/` directory (human planning only — kept out of layers).
- Create `NewData/<layer>/` inbound folders for ingestion.
- Copy the engine: the `system/` folder (engine `system/lib`, scripts `system/scripts`, configs `index-config.json` / `search-config.json`, vendored deps `system/vendor/*.tgz`).
- Install offline deps: `npm install` (uses the vendored `.tgz`, no registry needed).
- See [Architecture Setup](../../system/docs/architecture-setup.md) and [Setup Walkthrough](../../system/docs/setup-new-wiki.md).

### 2. Install the shared vectorization model + toolkit (system-wide, never per-KB)
**The model (jinaai/jina-embeddings-v3, ~1.1GB) is installed ONCE per machine into a system location and shared by every knowledge base via a marker.** Do not copy it into the KB.

Run from the target's engine:
```bash
node system/scripts/setup-model.js
```
Behavior (implemented in `system/lib/model-locator.js` + `setup-model.js`):
- **System location (default):** Windows `%LOCALAPPDATA%\DavASkoLLMWiki\models-cache`, *nix `~/.davasko-llm-wiki/models-cache` (or `$XDG_DATA_HOME/davasko-llm-wiki`).
- **System marker:** `…/DavASkoLLMWiki/config.json` records `{ modelsCache, modelId, revision }`. This is the single source of truth for the model path.
- **Source of the model:** if the repo carries a bundled copy in `system/models-cache/` (the master *source*), `setup-model.js` **copies it offline** into the system location; otherwise it downloads from Hugging Face.
- **Resolution at runtime:** `build-index.js`, `query-wiki.js`, `eval-retrieval.js` all resolve the path via `resolveModelsCache()` — order: env `DAVASKO_LLM_WIKI_MODELS` → **marker** → repo-local `system/models-cache` (fallback) → none.

**If the marker is missing when deploying a KB**, you (the skill) must:
1. Check `node -e "import('./system/lib/model-locator.js').then(m=>console.log(JSON.stringify(m.readMarker())))"` (or just run `setup-model.js`, which is idempotent).
2. If no model is found anywhere, **ask the user where to place the shared model** for common use, then run `node system/scripts/setup-model.js --dir "<chosen path>"` (omit `--dir` to accept the default system location). This writes the marker so all future KBs link to it automatically.
- `--local` forces the legacy per-KB install into `system/models-cache` (no marker) — only for isolated/offline-bundle cases.

### 3. Install the rules for working with the knowledge base
- Generate the root agent-instruction files and the Core Context Protocol (`CLAUDE.md` / `AGENTS.md` / IDE rule files) that tell agents to query the wiki first.
- Run the synchronizer: `node system/sync-ai-rules.js` — it compiles rule adapters for each IDE and bundles the portable skills.
- See [Sync Integration](../../system/docs/sync-integration.md) and [Data Standards](../../system/docs/data-standards.md) (encoding, frontmatter, links).

### 4. Install the skills for working with the knowledge base
Install/sync the companion skills alongside this one so agents can operate the KB:
- **davasko-wiki-search** — query the KB (hybrid search → context dump).
- **davasko-wiki-ingest** — import new sources from `NewData/` into layers.
- **davasko-wiki-refresh** — actualize wiki pages flagged stale by provenance hashing.
`sync-ai-rules.js` (step 3) deploys these into each IDE's skills folder.

### 5. Install the test environment for basic validation
Set up and run the baseline checks that prove the KB is healthy:
```bash
npm test                                   # engine unit tests (no model required)
node system/build-index.js --force         # build the vector index (uses the shared model)
node system/scripts/lint-wiki.js           # encoding + frontmatter gate (must be 0 errors)
node system/scripts/validate-links.js      # [[link]] + file-link gate
node system/scripts/check-sources.js       # cited sources exist
node system/scripts/eval-retrieval.js      # retrieval quality vs flat & grep baselines (needs a labeled set)
```
A healthy deployment: `npm test` green, lint 0 errors, validate 0 errors, and a live `query-wiki.js` returns relevant context.

## Core data standards (always honor)
- Encoding: **`.md` → UTF-8 WITH BOM**; **`.json` / `.js` / rules → UTF-8 WITHOUT BOM** (a BOM breaks `JSON.parse`). The linter enforces this.
- Wiki pages require frontmatter: `title`, `type`, `status`, `sources`, `last_updated`, non-empty `related`.
- Link pages with Obsidian `[[page-name]]` within the dependency chain.
- Source-of-truth: code/`raw/` is the truth, `wiki/` is derived. Record `source_hashes`; when `check-staleness.js` flags a page, refresh it (don't just re-stamp).

## Indexing model (what gets vectorized)
- Indexed: `<layer>/wiki/**/*.md` and `<layer>/raw/**/*.md`.
- Excluded: `<layer>/raw/ai-skills~/` and `<layer>/skills/` (RAW/FOLDER blacklist) so skills aren't indexed as knowledge.
- Doc IDs: wiki pages → `<basename>`; raw → `raw-<layer>-<basename>`.
- Threshold is adaptive (`relative` mode, per-query τ = max(junk_floor, α·top)); calibrate with `eval-retrieval.js --sweep`, never hand-pick.
- After adding raw/ docs: `node system/build-index.js --force`.

## Full-Text Search Gaps Policy
If you resort to grep/ripgrep/global code search because a topic was not in the KB maps/concepts (a search gap), you MUST document the finding (description, links, code symbols) into the appropriate layer before finishing — so future lookups go through the wiki, not generic search.
