# Maintenance and Automation Scripts

To keep the DavASko LLM Wiki healthy, validate cross-references, search content, safely migrate paths, execute regression tests, and automatically process incoming documents, six Node.js scripts must be placed in a `system/` directory at the workspace root.

---

## 1. The Wiki Linter: `system/lint-wiki.js`
Validates the integrity, format, and dependencies of the knowledge base.
- **Key Enhancements**:
  - Automatically skips the root `plans/` directory to prevent false positives on task checklists.
  - Parse and validate YAML frontmatter structures.
  - DFS (Depth-First Search) cycle detection for `wiki.json` dependency hierarchies.
  - Deduplicate stub error reporting to keep console logs clean.
  - Checks page encoding (must be UTF-8 with BOM) and ensures every page has mandatory fields (`**Summary**:`, etc.).
  - Generates `.meta` file checks inside Unity projects.
  - Validates if raw documents are older than 365 days, warning if they are stale unless they have a `.validated` companion file or `last_validated` field.

---

## 2. Global Link Validator: `system/validate-links.js`
Scans all files inside the workspace (C# code, JSON configs, markdown files, IDE rule files like `.cursorrules`, `.clinerules`, etc.) for broken links, old directory mappings, and doubled system paths (`system/system/`).

---

## 3. Query & Ingestion Utility: `system/query-wiki.js`
Handles CLI-based searching of wiki pages and single-file manual ingestion.
- **Key Enhancements**:
  - Search matches return snippets with line numbers and ANSI-highlighted text.
  - Looks up core files (`index.md`, `contradictions.md`) directly in the root of the layer's `wiki/` directory.
  - Auto-detects the layer context based on current working directory (CWD).
  - New subcommands: `--list-layers` (lists the dependency graph) and `--info` (shows metrics and path configs).

---

## 4. Ingestion Buffer Pipeline: `system/ingest-newdata.js`
Monitors the `NewData/` folder. When raw source files are placed under layer-specific folders inside it, running this script automatically sanitizes filenames, moves them to the appropriate `raw/docs/` layer folder, generates a summary template in `wiki/sources/`, and runs the linter.

---

## 5. Path Migration Tool: `system/update-links.js`
Safely migrates paths, files, and wiki links across all workspace files.
- **Features**:
  - Uses safe regular expressions with word and path boundary matching to prevent partial string matches from corrupting unrelated text.
  - Maintains a lookup dictionary of old-to-new paths.
  - Automatically updates `.cursorrules`, `GEMINI.md`, `AGENTS.md`, and all markdown documents.

---

## 6. Regression Q&A Runner: `system/run-evals.js`
Runs a suite of regression test queries against the search engine to verify that the AI can answer key architectural questions accurately.
- **Features**:
  - Consumes Q&A pairs from `system/evals/questions.md`.
  - Simulates agent queries via `query-wiki.js` and evaluates the presence of key terms in the output.

---

## Complete Script Source Code

The full source codes for these scripts are provided in the repository's `templates/system-scripts/` directory:

1. **`lint-wiki.js`**: [lint-wiki.js template](../../templates/system-scripts/lint-wiki.js)
2. **`validate-links.js`**: [validate-links.js template](../../templates/system-scripts/validate-links.js)
3. **`query-wiki.js`**: [query-wiki.js template](../../templates/system-scripts/query-wiki.js)
4. **`ingest-newdata.js`**: [ingest-newdata.js template](../../templates/system-scripts/ingest-newdata.js)
5. **`update-links.js`**: [update-links.js template](../../templates/system-scripts/update-links.js)
6. **`run-evals.js`**: [run-evals.js template](../../templates/system-scripts/run-evals.js)

When deploying to a new workspace, copy these templates into your `system/` directory.
