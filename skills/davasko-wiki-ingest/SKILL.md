---
name: davasko-wiki-ingest
description: Use this skill to ingest new raw data into the DavASko LLM Wiki knowledge base. It handles file placement into NewData/ folders, runs the ingest pipeline, and triggers re-indexing for the vector search engine.
status: stable
owner: DavASko
license: Proprietary
allowed-tools:
  - Bash
  - Write
  - Edit
  - Read
required_reading:
  - ../../system/docs/architecture-setup.md
  - ../../system/docs/data-standards.md
known_risks:
  - Ingesting files without proper frontmatter will cause lint errors.
  - The ingest script deletes the NewData/ folder after processing. Do not store permanent files there.
  - Forgetting to re-run build-index.js after ingestion means the new pages won't appear in semantic search.
---

# DavASko Wiki Ingest (New Data Ingestion Skill)

## Persona / Identity

You are a Knowledge Ingestion Specialist. You manage the pipeline for adding new raw data (markdown documents, transcripts, research notes) into the DavASko LLM Wiki's layered knowledge base and ensuring they are indexed for search.

## Goal

Receive new markdown content, place it into the correct layer via the NewData/ folder structure, run the ingestion pipeline, and trigger re-indexing.

## Prerequisites

1. **Layer structure exists**: At least one layer directory with `wiki.json` must exist.
2. **Dependencies installed**: Run `npm install` from the repository root.
3. **Model downloaded** (for re-indexing): `node system/scripts/setup-model.js`

## Workflow

### Step 1: Prepare the NewData Structure

Create files in the `NewData/` directory at the repository root, organized by target layer:

```
NewData/
├── llm-wiki/
│   └── docs/
│       └── new-research-paper.md
├── engine-wiki/
│   └── transcripts/
│       └── video-transcript.md
└── framework-wiki/
    └── docs/
        └── api-documentation.md
```

Each file must follow the [Data Standards](../../system/docs/data-standards.md):
- UTF-8 with BOM encoding
- YAML frontmatter with `title`, `type`, `status`, `sources`, `last_updated`, `related`
- Proper markdown structure with Summary, Key Claims, Details sections

### Step 2: Run the Ingest Pipeline

```bash
node system/scripts/ingest-newdata.js
```

This script:
1. Scans `NewData/` for layer-named subdirectories
2. Cleans numeric prefixes from filenames (e.g., `01-my-doc.md` → `my-doc.md`)
3. Calls `query-wiki.js --ingest` for each file to place it in the correct `raw/` subfolder
4. Transfers `.meta` files if present (Unity compatibility)
5. Deletes the processed `NewData/` folder
6. Runs the linter for validation

### Step 3: Re-Index for Vector Search

After ingestion, rebuild the search index to include the new documents:

```bash
node system/build-index.js
```

This is incremental — only new/changed files are re-vectorized (MD5 cache).

### Step 4: Verify

1. **Lint check**: Ensure no errors from the auto-run linter
2. **Search test**: Run a query to verify the new content appears:
   ```bash
   node system/query-wiki.js --query "topic from new document"
   ```
3. **Link validation** (optional):
   ```bash
   node system/scripts/validate-links.js
   ```

## Direct Page Ingestion (Alternative)

For ingesting a single file directly without the NewData/ structure:

```bash
node system/scripts/query-wiki.js --ingest "path/to/file.md" --layer llm-wiki --subfolder docs
```

## Post-Ingestion Checklist

- [ ] New file placed in correct `<layer>/raw/<subfolder>/`
- [ ] Lint passes without errors
- [ ] Index rebuilt (`node system/build-index.js`). The indexer chunks Markdown
      by structure (headings/paragraphs, atomic code blocks, heading breadcrumbs —
      `chunk_strategy` in `system/index-config.json`) and embeds in batches.
- [ ] New content findable via `query-wiki.js --query`
- [ ] Wiki links (`[[page-name]]`) resolve correctly
- [ ] If you authored derived `wiki/` pages citing this source, stamp provenance
      so drift is detectable later: `node system/scripts/check-staleness.js --stamp <page>`
      (the **davasko-wiki-refresh** skill re-actualizes pages when sources change).
