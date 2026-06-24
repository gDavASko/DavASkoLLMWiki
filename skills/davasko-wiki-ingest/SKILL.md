---
name: davasko-wiki-ingest
description: Use this skill to ingest new raw data into the DavASko LLM Wiki. It places files into NewData/<layer>/ and runs the ingest pipeline, which moves each source into <layer>/raw/ (UTF-8 BOM), auto-creates a wiki source-summary stub in <layer>/wiki/sources/, generates Unity .meta, lints, and re-runs vectorization (build-index). You then MUST complete the auto-generated summary stub so it passes the rules.
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
  - The auto-generated wiki summary is a STUB (empty `related: []`, "No claims extracted"). It FAILS the linter until you fill Key Claims + a non-empty `related`. Always actualize it after ingest.
  - The pipeline DELETES the NewData/ folder after processing — never keep permanent files there.
  - Raw files must be UTF-8 with BOM and free of secrets/webhook URLs (the linter rejects hardcoded Bitrix REST URLs).
  - Plans and skills must NOT go through ingest into raw/ (they would be indexed as knowledge). Plans → root plans/; skills → ai-skills~/.
---

# DavASko Wiki Ingest (New Data → KB pipeline)

## Persona / Identity

You are a Knowledge Ingestion Specialist. You add new raw sources into the layered KB **exactly** through the standard pipeline, then bring the auto-generated pages up to the data standards and confirm they are vectorized and searchable.

## What the pipeline actually does (ground truth)

`node system/scripts/ingest-newdata.js` performs, in order:

1. **Discovers layers** — every root folder containing `wiki.json` is a valid layer.
2. **Normalizes names** — strips numeric prefixes (`01-my-doc.md` → `my-doc.md`), moving any sibling `.md.meta` too.
3. **Places each file** via `system/scripts/query-wiki.js --ingest`, which:
   - moves `NewData/<layer>/<sub>/file.md` → `<layer>/raw/<sub>/file.md`, re-encoded as **UTF-8 with BOM** (subfolder mirrors the NewData structure; defaults to `docs`), and deletes the NewData original;
   - **auto-creates a wiki source-summary** at `<layer>/wiki/sources/<name>.md` with valid frontmatter (`type: source-summary`, `status: draft`, `source_status: source-linked`, `sources:` → the raw path, `related: []`) and a body skeleton (`**Summary**`, `**Sources**`, `## Key Claims` with a `(source: …)` citation, `## Details`, `## Open Questions`, `## Related Pages`);
   - generates a Unity `.meta` for that wiki page.
4. **Transfers `.meta`** of the raw file, then **deletes** the `NewData/` tree.
5. **Lints** the whole KB (`lint-wiki.js`).
6. **Vectorizes** — re-runs `build-index.js` (incremental, shared model) so the new raw doc + its summary enter semantic search.

## Workflow

### Step 1 — Stage files under NewData/
Create `NewData/<layer>/<subfolder>/<file>.md` at the KB root, where `<layer>` is an existing layer (has `wiki.json`) and `<subfolder>` becomes the `raw/` subfolder:
```
NewData/
└── unity-wiki/
    └── transcripts/
        └── kent-beck-tdd-ai-agents.md
```
Each raw file must be **UTF-8 with BOM** and contain no secrets/webhook URLs. Frontmatter on the raw file is optional (the summary page carries the required frontmatter), but a clear title/structure helps later actualization. See [Data Standards](../../system/docs/data-standards.md).

### Step 2 — Run the pipeline (place + lint + vectorize)
```bash
node system/scripts/ingest-newdata.js
```
This runs all six steps above, ending with vectorization. (Prerequisites: `npm install` done; shared model installed — `node system/scripts/setup-model.js` — see [model-locator](../../system/lib/model-locator.js).)

### Step 3 — Actualize the auto-generated summary (REQUIRED — rules gate)
The generated `<layer>/wiki/sources/<name>.md` is a **stub** and will FAIL the linter (`missing required page field: related`, plus an empty "No claims extracted"). Bring it to standard:
- Read the moved raw file and write real **`## Key Claims`** (each with a `(source: <layer>/raw/<sub>/<file>)` citation).
- Set a **non-empty `related:`** (link genuinely related pages with `[[page-name]]` from this layer or its dependencies) **or** add a `## Related` section.
- Fill `**Summary**` / `## Details`; set an accurate `status`.
- Keep encoding: `.md` → UTF-8 **with** BOM.

### Step 4 — Re-validate and re-vectorize
After editing the summary, re-run the gates:
```bash
node system/scripts/lint-wiki.js          # must be 0 errors
node system/scripts/validate-links.js     # [[links]] resolve
node system/build-index.js                # re-vectorize your edits (incremental)
```

### Step 5 — Verify retrieval
Confirm the new knowledge is findable:
```bash
node system/query-wiki.js --query "<topic from the ingested source>"
```
The result should include the raw doc (`raw-<layer>-<name>`) and/or the summary page.

## Direct single-file ingest (no NewData/ staging)
```bash
node system/scripts/query-wiki.js --ingest "path/to/file.md" --layer <layer> --subfolder <sub>
```
Note: the direct form does NOT lint or vectorize — run `lint-wiki.js` and `build-index.js` yourself afterward.

## Post-Ingestion Checklist
- [ ] Raw file in `<layer>/raw/<subfolder>/` as UTF-8 BOM
- [ ] Auto-summary in `<layer>/wiki/sources/` **actualized** (real Key Claims + non-empty `related`)
- [ ] `lint-wiki.js` → 0 errors; `validate-links.js` → links resolve
- [ ] Index rebuilt (automatic in the pipeline; re-run after manual edits)
- [ ] Findable via `query-wiki.js --query`
- [ ] If the summary cites sources that may later change, stamp provenance: `node system/scripts/check-staleness.js --stamp <page>` (the **davasko-wiki-refresh** skill re-actualizes pages when sources drift)
