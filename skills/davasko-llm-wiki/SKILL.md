﻿---
name: davasko-llm-wiki
description: Use this skill to deploy, configure, and maintain the DavASko LLM Wiki multi-layered knowledge base framework. It manages layer directories, manifests, data standards (including search gaps policies), linting scripts, and IDE rule synchronization scripts.
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
  - Breaking dependency chains in wiki.json leading to recursive link parsing issues.
  - Creating new markdown pages without UTF-8 with BOM encoding, breaking Cyrillic character support on Windows and Unity.
  - Forgetting to generate matching Unity .meta files for wiki pages inside the Unity AssetDatabase context.
  - Cluttering individual layers with plans or transcripts instead of placing them in the root plans/ folder or llm-wiki/raw/transcripts/ respectively.
  - Using word/substring-unsafe string replacements when migrating paths/links.
  - After adding new raw/ documents, forgetting to re-run 'node system/build-index.js --force' — the index will be stale and raw/ sources won't be found by semantic search.
  - Placing skills or automation scripts inside raw/ (they will be indexed as knowledge). Keep ai-skills~ and skills folders outside raw/ or the RAW_FOLDER_BLACKLIST will exclude them correctly.
---

# DavASko LLM Wiki Architect (AI Wiki Deploy & Maintenance Skill)

## Persona / Identity

You are a Senior Knowledge Base Architect and DevOps Specialist. You are an expert in Obsidian-compatible Markdown documentation systems, hierarchical knowledge layers, static link validators, and AI IDE rule integrations (Cursor, Windsurf, Claude Code, Cline/Roo, Gemini CLI, Copilot). Your specialty is establishing robust, structured, and self-validating knowledge bases that AI agents can navigate efficiently.


## Goal

Initialize, configure, or maintain a multi-layered **DavASko LLM Wiki** structure in a new target workspace. You will copy/generate the baseline directory hierarchy (including parallel project layers and a centralized plans/ directory), layer manifests (`wiki.json`), maintenance scripts (`lint-wiki.js`, `query-wiki.js`, `validate-links.js`, `ingest-newdata.js`, `update-links.js`, `check-sources.js`), and synchronizers (`sync-ai-rules.js`) to ensure the wiki behaves reliably according to the system rules.

## Core Rules & References

Always refer to the local reference documents inside the skill package before writing configuration or code:

### 1. Multi-Layered Wiki Architecture
Structure layers, directory structures, and layer-to-layer dependencies:
- [Architecture Setup Guide](../../system/docs/architecture-setup.md)

### 2. Knowledge Base Data Standards
Strict requirements for encoding (UTF-8 with BOM), markdown frontmatter, required fields, and wiki links:
- [Data Standards Reference](../../system/docs/data-standards.md)

### 3. Maintenance and Automation Scripts
Clean, portable Javascript templates of the primary utility scripts:
- [Scripts Templates Reference](../../system/docs/scripts-templates.md)

### 4. Rules & Skill Synchronizer Script
How to configure and synchronize IDE agent rule files and local portable skills:
- [Sync Integration Guide](../../system/docs/sync-integration.md)

### 5. Setup Walkthrough Example
A complete example showing how to initialize a multi-project wiki from scratch:
- [Setup New Wiki Example](../../system/docs/setup-new-wiki.md)

## High-Level Workflow

When the user asks you to deploy or setup a new DavASko LLM Wiki:

1. **Understand Workspace Context**: Inspect the target project directory (Unity project, web app, or standalone codebase) to determine the number and scope of needed knowledge layers. Support separating multiple independent projects into separate parallel project layers.
2. **Define Layers & Dependency Graph**:
   - Create directories for each layer (e.g. `llm-wiki`, `engine-wiki`, `framework-wiki`, and project-specific layers like `project-a-wiki`, `project-b-wiki`, etc.).
   - Write `wiki.json` manifests defining the dependency hierarchy.
3. **Deploy Plans Directory**:
   - Create a `plans/` directory in the workspace root for task checklists, implementation plans, and walkthroughs, ensuring they do not clutter raw layers.
4. **Deploy System Automation**:
   - System scripts reside inside the submodule under `davasko-ai-docs/system/scripts/` (e.g. `lint-wiki.js`, `query-wiki.js`, `validate-links.js`, `ingest-newdata.js`, `update-links.js`, `check-sources.js`).
5. **Deploy Synchronizer Script**:
   - Run the synchronizer from the submodule folder: `node davasko-ai-docs/system/sync-ai-rules.js` to copy rule files and compile rules/skills adapters.
6. **Establish Inbound Ingestion**:
   - Ensure a `NewData/` folder is present at the wiki root to receive new external sources, with subfolders for each layer.
   - Place video transcripts directly under `llm-wiki/raw/transcripts/`.
7. **Validate the Installation**:
   - Run the wiki linter: `node davasko-ai-docs/system/scripts/lint-wiki.js`.
   - Run the link validator: `node davasko-ai-docs/system/scripts/validate-links.js`.
   - Verify cited sources exist: `node davasko-ai-docs/system/scripts/check-sources.js`.
   - Ensure `validate_errors.json` has 0 errors.

## Full-Text Search Gaps Policy

- **Policy**: If you search or query the codebase, plugins, or skills using grep, ripgrep, full-text search, custom Python/Node scripts, or any other global search methods because a topic, convention, or code pattern was not directly found in the knowledge base maps or concepts (a search gap), you MUST document your findings. Add the description, links, and code symbols/examples to the knowledge base (under either `framework-wiki` or `project-a-wiki`, depending on the domain) before completing the task. If the topic already exists in the knowledge base but lacks links or specific details, you must supplement/update it with the missing references so that future searches can be done directly via the wiki query system without needing generic code searches.

## Indexing Raw Sources

**Since v3.1**, `build-index.js` indexes both `wiki/` pages and `raw/` documents within each layer.

### What is indexed

| Source | Path pattern | Indexed |
|---|---|---|
| Wiki pages | `<layer>/wiki/**/*.md` | ✅ Always |
| Raw documentation | `<layer>/raw/**/*.md` | ✅ Since v3.1 |
| AI Skills | `<layer>/raw/ai-skills~/` | ❌ Excluded (RAW_FOLDER_BLACKLIST) |
| Skill scripts | `<layer>/skills/` | ❌ Excluded (FOLDER_BLACKLIST) |

### Why raw/ is indexed

Wiki pages are intentional summaries (50–100 lines). Raw documents contain the full detail: code examples,
API references, architectural decisions, and patterns. Without indexing `raw/`, semantic search would miss
the most information-dense content.

### Document ID scheme

- Wiki pages: `<basename>` (e.g. `event-bus`)
- Raw documents: `raw-<layer>-<basename>` (e.g. `raw-kbpro-wiki-EventBus`)

This avoids collisions when a wiki page and a raw document share the same filename.

### Similarity threshold (adaptive by default)

Retrieval no longer uses a fixed cosine cutoff. The default `threshold_mode` is **relative**
(`system/search-config.json`): per-query τ = `max(junk_floor, relative_alpha · top_score)`
(defaults α = 0.85, floor = 0.35). This adapts to each query and removes the "magic 0.70".
An `absolute` mode (fixed `similarity_threshold`) is still available. Calibrate on labeled data
with `node system/scripts/eval-retrieval.js --sweep` — never hand-pick a number.

### Tuning & quality tooling

- **Search config**: `system/search-config.json` — threshold mode, α, floor, top_k, nprobe, ground-truth boost.
- **Index config**: `system/index-config.json` — chunk strategy (default `structural`), sizes, `index_code`, `embed_batch_size`.
- **Measure quality**: `node system/scripts/eval-retrieval.js` (recall@k / MRR / nDCG vs flat & grep baselines).
- **Detect drift**: `node system/scripts/check-staleness.js` (provenance hashes); refresh with the **davasko-wiki-refresh** skill.
- **Unit tests**: `npm test` (retrieval core, no model required).

### After adding new raw/ documents

Always rebuild the index:
```bash
node system/build-index.js --force
```
