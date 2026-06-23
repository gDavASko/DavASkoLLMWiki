---
name: davasko-wiki-refresh
description: Use this skill to actualize stale DavASko LLM Wiki pages. It runs the staleness detector, reads the machine-readable worklist of pages whose cited code/raw sources changed, regenerates each page from the updated source, and re-stamps its provenance hashes so the knowledge base stays in sync with the source of truth (the code).
status: stable
owner: DavASko
license: Proprietary
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
required_reading:
  - ../../system/docs/data-standards.md
known_risks:
  - Re-stamping a page WITHOUT actually rewriting its content hides real drift. Always update the page body to match the changed source before stamping.
  - The detector treats code/raw files as the source of truth. If a source file is missing, the page is reported as stale with reason 'source-missing' — resolve the broken citation, do not just re-stamp.
  - source_hashes are sha256 of BOM-stripped file content. Editing a source's whitespace/encoding changes its hash and will (correctly) flag dependent pages.
---

# DavASko Wiki Refresh (Staleness Actualization Skill)

## Persona / Identity

You are a Knowledge Base Maintenance Engineer. The **code is the source of truth**; wiki pages are a curated derived layer. Your job is to keep that derived layer honest: detect pages whose cited sources changed, and bring the page content back in line with the current source — automatically, not by hand.

## Goal

Consume the staleness worklist produced by `check-staleness.js`, regenerate each stale page from its updated source(s), and re-stamp provenance so the page returns to a fresh state.

## Provenance Model (how staleness is detected)

Each wiki page records, in its frontmatter, a `source_hashes` map — the sha256 of every cited source at generation time:

```yaml
sources:
  - framework-wiki/raw/docs/event-bus.md
last_updated: 2026-06-23
source_hashes:
  framework-wiki/raw/docs/event-bus.md: 9645671b...c6c9
```

`check-staleness.js` recomputes those hashes. A mismatch ⇒ the source changed ⇒ the page is **stale**. See [Data Standards §6](../../system/docs/data-standards.md).

Page lifecycle: **fresh** → (source changes) → **stale** → (this skill) → **fresh**.
A page with no `source_hashes` yet is **needs-stamp** (no baseline).

## Workflow

### Step 1: Detect

```bash
node system/scripts/check-staleness.js
```

This writes `system/staleness-report.json` and exits non-zero if any page is stale. The report is the worklist:

```json
{
  "stale": [
    { "page": "framework-wiki/wiki/concepts/event-bus.md", "status": "stale",
      "sources": [ { "source": "framework-wiki/raw/docs/event-bus.md", "reason": "source-changed" } ] }
  ]
}
```

### Step 2: Actualize each stale page

For every entry with `status: "stale"`:

1. **Read the changed source** (`sources[].source`) and the **current page**.
2. **Rewrite the page body** so its Summary, Key Claims, and Details reflect the updated source. Follow the [Data Standards](../../system/docs/data-standards.md) page template. Preserve existing `[[wiki-links]]` and citations.
3. Keep `(source: <path>)` citations accurate; add citations for any new claims.

For entries with `status: "needs-stamp"`, the page simply lacks a baseline — verify the content matches the source, then proceed to stamp.

### Step 3: Re-stamp provenance

After the body is updated, re-stamp the page so its `source_hashes` and `last_updated` reflect the current sources:

```bash
# stamp a single page
node system/scripts/check-staleness.js --stamp "framework-wiki/wiki/concepts/event-bus.md"

# or stamp every page that has a clean body
node system/scripts/check-staleness.js --stamp
```

`--stamp` rewrites the `source_hashes` block and `last_updated` in the page frontmatter (UTF-8 with BOM, per policy).

### Step 4: Verify

```bash
node system/scripts/check-staleness.js   # expect: OK, no stale pages (exit 0)
node system/scripts/lint-wiki.js         # frontmatter / encoding / links still valid
```

If the page references code outside the wiki (e.g. a `(source: ...)` pointing at a `.cs` file in the workspace), make sure that file is present at check time — the detector hashes it directly.

## Important Notes

- **Do not stamp to silence the gate.** Stamping without updating content defeats the mechanism. Update first, stamp second.
- **CI gate**: wire `node system/scripts/check-staleness.js` into CI. Use `--strict` to also fail on `needs-stamp` pages once the knowledge base has full provenance coverage.
- **Relation to ingest**: new pages enter via `davasko-wiki-ingest`; this skill keeps existing pages current. Both end with a re-index (`node system/build-index.js`).
