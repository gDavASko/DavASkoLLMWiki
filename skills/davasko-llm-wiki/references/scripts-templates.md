# Maintenance and Automation Scripts

To keep the DavASko LLM Wiki healthy, validate cross-references, search content, and automatically process incoming documents, four Node.js scripts must be placed in a `system/` directory at the wiki submodule root.

---

## 1. The Wiki Linter: `system/lint-wiki.js`
Validates that:
- Pages are saved in UTF-8 with BOM.
- Pages do not contain hardcoded credentials or Bitrix webhooks.
- Double-bracket links `[[link]]` resolve to pages in the dependency chain.
- Pages (except logs/stubs) contain mandatory fields (`**Summary**:`, etc.).
- Citation paths `(source: ...)` point to existing raw files.
- Orphans (pages with no inbound links) are highlighted.
- Unity `.meta` files exist for all content if inside a Unity project.

```javascript
// Copy system/lint-wiki.js code here or run code generation tools.
```

---

## 2. Global Link Validator: `system/validate-links.js`
Scans all workspace files (codebase, config files, wiki pages, rules) for broken links, deprecated directory mappings, and doubled system paths (`system/system/`).

---

## 3. Query & Ingestion Utility: `system/query-wiki.js`
Handles CLI searching of pages across the dependency chain and single-file ingestion. Usage:
- `node query-wiki.js --page page-name` (Finds absolute paths of a page)
- `node query-wiki.js --search "search query"` (Performs full-text search)
- `node query-wiki.js --ingest "path/to/file.md" --layer "target-layer-name"` (Ingests a file, generates summary, writes logs)

---

## 4. Ingestion Buffer Pipeline: `system/ingest-newdata.js`
Monitors the `NewData/` folder. When files are dropped there under layer subfolders (e.g. `NewData/unity-wiki/...`), running this script automatically:
- Cleans up filename prefixes (e.g. converting `01-my-file.md` to `my-file.md`).
- Executes `query-wiki.js --ingest` on each file.
- Moves corresponding `.meta` files.
- Cleans up the buffer and runs the linter.

---

## Complete Script Source Code

Due to their length, the full source codes for these scripts are provided in the repository's `templates/system-scripts/` directory:

1. **`lint-wiki.js`**: [lint-wiki.js template](file://../../../templates/system-scripts/lint-wiki.js)
2. **`validate-links.js`**: [validate-links.js template](file://../../../templates/system-scripts/validate-links.js)
3. **`query-wiki.js`**: [query-wiki.js template](file://../../../templates/system-scripts/query-wiki.js)
4. **`ingest-newdata.js`**: [ingest-newdata.js template](file://../../../templates/system-scripts/ingest-newdata.js)

When deploying to a new workspace, copy these templates into your `system/` directory.
