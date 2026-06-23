# Maintenance and Automation Scripts

To keep the DavASko LLM Wiki healthy, validate cross-references, search content, safely migrate paths, execute regression tests, and automatically process incoming documents, the automation scripts are placed under `system/scripts/` and `system/sync-ai-rules.js`.

---

## 1. The Wiki Linter: `system/scripts/lint-wiki.js`
Validates the integrity, format, and dependencies of the knowledge base.
- **Key Features**:
  - Automatically skips the root `plans/` directory to prevent false positives on task checklists.
  - Parses and validates YAML frontmatter structures.
  - DFS (Depth-First Search) cycle detection for `wiki.json` dependency hierarchies.
  - Deduplicates stub error reporting to keep console logs clean.
  - Checks page encoding (must be UTF-8 with BOM) and ensures every page has mandatory fields (`**Summary**:`, etc.).
  - Generates `.meta` file checks inside Unity projects.
  - Validates if raw documents are older than 365 days, warning if they are stale unless they have a `.validated` companion file or `last_validated` field.

---

## 2. Global Link Validator: `system/scripts/validate-links.js`
Scans all files inside the workspace (C# code, JSON configs, markdown files, IDE rule files like `.cursorrules`, `.clinerules`, etc.) for broken links, old directory mappings, and doubled system paths (`system/system/`).

---

## 3. Query & Ingestion Utility: `system/scripts/query-wiki.js`
Handles CLI-based searching of wiki pages and single-file manual ingestion.
- **Key Features**:
  - Search matches return snippets with line numbers and ANSI-highlighted text.
  - Looks up core files (`index.md`, `contradictions.md`) directly in the root of the layer's `wiki/` directory.
  - Auto-detects the layer context based on current working directory (CWD).
  - New subcommands: `--list-layers` (lists the dependency graph) and `--info` (shows metrics and path configs).

---

## 4. Ingestion Buffer Pipeline: `system/scripts/ingest-newdata.js`
Monitors the `NewData/` folder. When raw source files are placed under layer-specific folders inside it, running this script automatically sanitizes filenames, moves them to the appropriate `raw/docs/` layer folder, generates a summary template in `wiki/sources/`, and runs the linter.

---

## 5. Path Migration Tool: `system/scripts/update-links.js` (Deprecated)
Safely migrates paths, files, and wiki links across all workspace files using path-boundary regular expressions to prevent substring corruption.

---

## 6. Source Citation Check: `system/scripts/check-sources.js`
A **citation sanity check**, not a quality measure. Verifies that the source files cited by the Q&A set in `system/evals/questions.md` exist and are non-empty.
- **Features**:
  - Consumes Q&A pairs from `system/evals/questions.md`.
  - For each question, checks that every `required source` file is present.
- For real retrieval-quality measurement (recall@k / MRR / nDCG, baselines, threshold calibration) use `system/scripts/eval-retrieval.js`.

---

## 7. IDE Sync & Skill Compiler: `system/sync-ai-rules.js`
Synchronizes master rules and compiled skill definitions to IDE configuration folders. It dynamically gathers skill required reading files and resolves path mappings.

---

## Complete Script Source Code

The active source code of these scripts is located inside the submodule:

1. **`lint-wiki.js`**: [lint-wiki.js](../scripts/lint-wiki.js)
2. **`validate-links.js`**: [validate-links.js](../scripts/validate-links.js)
3. **`query-wiki.js`**: [query-wiki.js](../scripts/query-wiki.js)
4. **`ingest-newdata.js`**: [ingest-newdata.js](../scripts/ingest-newdata.js)
5. **`update-links.js`**: [update-links.js](../scripts/update-links.js)
6. **`check-sources.js`**: [check-sources.js](../scripts/check-sources.js)
7. **`eval-retrieval.js`**: [eval-retrieval.js](../scripts/eval-retrieval.js)
8. **`sync-ai-rules.js`**: [sync-ai-rules.js](../sync-ai-rules.js)
