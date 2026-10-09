 Maintenance and Automation Scripts

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
  - Validates if raw documents are older than 365 days, warning if they are stale unless they have a `.validated` companion file or `last_validated` field.

---

## 2. Global Link Validator: `system/scripts/validate-links.js`
Проверяет Markdown-страницы Wiki, управляемый экспорт GDD и системную документацию на битые ссылки, устаревшие пути и удвоенные пути (`system/system/`). Относительные пути без `./` и `../` разрешаются от корня `knowledge-base/`.

---

## 3. Query & Supervisor Utility: `system/query-wiki.js`
Handles CLI-based searching of wiki pages and multi-tier orchestration via LangGraph Control Plane.
- **Key Features**:
  - `--auto "<query>"`: Automatic tool selection via Query Router (RAG, RLM, Graphify), consensus check via LLM-Judge (score $\ge 7$), automated fallbacks, and A/B candidate comparators. Writes final results to `.cursor-context-dump.md`.
  - `--query "<query>"`: Direct Hybrid search (Jina embeddings + exact symbol matches).
  - `--rlm "<query>"`: Direct Deep Research agent using local LLM.
  - `--locations <paths>`: Limits search scope to specific layers or directories.
  - `--top-k <num>`: Overrides candidate limit (defaults to 8).
  - New subcommands: `--list-layers` (lists dependency graph) and `--info` (shows metrics and path configs).

---

## 4. Vector Indexer: `system/build-index.js`
Builds and maintains the LanceDB vector store using chunking profile v4:
- **Incremental by Default**: Only re-embeds added, modified, or removed files.
- **Chunking Profile v4**: 200 words target, 300 words ceiling, 32 words backward context overlap (`[Контекст предыдущего фрагмента]`), 32 words forward context overlap (`[Контекст следующего фрагмента]`), and hierarchy breadcrumbs `[parent_tab > tab_name]`.
- **Automatic Checkpoints every 20 documents**: Persists embedding batches atomically to LanceDB with status `in_progress`, enabling resume on interruption.
- **Safe Late Chunking (`late_chunk_max_words: 6000`)**: Prevents GPU OOM by routing documents > 6000 words to batched chunking.

---

## 5. Resident Search Server: `system/search-server.js`
Background persistent search process communicating via JSON-RPC / NDJSON over standard streams:
- Keeps LanceDB tables and ONNX models pre-warmed in memory.
- Reduces query latency from ~8s to **~1.5s**.
- Safe stream separation: diagnostics go to `stderr`, protocol frames go to `stdout`.

---

## 6. Setup Wizard: `system/scripts/setup-knowledge-base.js`
Interactive CLI wizard to configure the knowledge base environment:
- Locates or clones the shared repository.
- Manages `KBPRO_AI_CHAT_WIKI_DIR` environment variable.
- Creates local isolation marker files (`.davasko-local-kb` / `.kbpro-local-kb`).
- Performs end-to-end self-tests and automatic healing.

---

## 7. Ingestion Buffer Pipeline: `system/scripts/ingest-newdata.js`
Monitors the `NewData/` folder. When raw source files are placed under layer-specific folders inside it, running this script automatically sanitizes filenames, moves them to the appropriate `raw/docs/` layer folder, generates a summary template in `wiki/sources/`, and runs the linter.

---

## 8. Path Migration Tool: `system/scripts/update-links.js` (Deprecated)
Safely migrates paths, files, and wiki links across all workspace files using path-boundary regular expressions to prevent substring corruption.

---

## 9. Model & Local LLM Setup: `system/scripts/setup-model.js` & `setup-local-llm.js`
- `setup-model.js`: Installs shared embedding model (1.1 GB) to machine system location and writes marker config.
- `setup-local-llm.js`: Configures local Ollama model for query routing and RLM deep research.

---

## 10. IDE Sync & Skill Compiler: `system/sync-ai-rules.js`
Synchronizes master rules and compiled skill definitions to IDE configuration folders (Cursor, Claude Code, Windsurf, Cline, Gemini, Copilot). Safely appends rules in managed blocks.

---

## 11. Regression & Evaluation Suite
- `eval-retrieval.js`: Evaluates recall@k, MRR, and nDCG against baselines.
- `npm test`: Runs **42 unit tests** across 7 test suites in `system/tests/` verifying retrieval, chunking, graphify, profile resolution, and orchestration.

---

## Complete Script Source Code

The active source code of these scripts is located inside the submodule:

1. **`lint-wiki.js`**: [lint-wiki.js](../scripts/lint-wiki.js)
2. **`validate-links.js`**: [validate-links.js](../scripts/validate-links.js)
3. **`query-wiki.js`**: [query-wiki.js](../query-wiki.js)
4. **`build-index.js`**: [build-index.js](../build-index.js)
5. **`search-server.js`**: [search-server.js](../search-server.js)
6. **`setup-knowledge-base.js`**: [setup-knowledge-base.js](../scripts/setup-knowledge-base.js)
7. **`setup-model.js`**: [setup-model.js](../scripts/setup-model.js)
8. **`setup-local-llm.js`**: [setup-local-llm.js](../scripts/setup-local-llm.js)
9. **`ingest-newdata.js`**: [ingest-newdata.js](../scripts/ingest-newdata.js)
10. **`update-links.js`**: [update-links.js](../scripts/update-links.js)
11. **`eval-retrieval.js`**: [eval-retrieval.js](../scripts/eval-retrieval.js)
12. **`sync-ai-rules.js`**: [sync-ai-rules.js](../sync-ai-rules.js)
