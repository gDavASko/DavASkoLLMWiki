 Knowledge Base Data Standards

To maintain compatibility with Obsidian, Unity, Windows, and multiple AI tooling agents, all files within the **DavASko LLM Wiki** must adhere to strict formatting and encoding standards.

---

## 1. Encoding: BOM for Markdown, NO BOM for scripts and JSON

Encoding rules differ by file type (the linter enforces this):

- **Markdown (`.md`)** — MUST be saved as **UTF-8 WITH BOM** (Byte Order Mark).
- **Everything else (`.js`, `.mjs`, `.json`, `.ps1`, `.mdc`, `.yml`, `.yaml`, `.clinerules`, `.cursorrules`, `.windsurfrules`)** — MUST be saved as **UTF-8 WITHOUT BOM**. A BOM breaks `JSON.parse`, pollutes diffs, and can break script loaders and rule parsers.
- **Exception — skill folders (`skill/`, `skills/`, `all-skills~/`):** ALL skill files, including `.md`, are saved **WITHOUT BOM** — a BOM before the YAML frontmatter (`---`) breaks skill loading. These are distribution copies, not knowledge-base pages, and are excluded from the encoding check.

### Why BOM is Mandatory for Markdown
Windows-based tools, PowerShell, Unity Editor, and Obsidian require the BOM signature (`EF BB BF`) to correctly interpret Cyrillic (Russian) characters. Without BOM, human-facing content written in Russian will appear as garbled text (corrupted encoding) in CLI and IDE logs.

### Writing .md Files with BOM in PowerShell
Prefer using .NET file methods over standard redirectors:
```powershell
[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($true)))
```

### Writing .md Files with BOM in Node.js
Prepend the BOM buffer when writing Markdown files:
```javascript
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
const contentBuf = Buffer.from(content, 'utf8');
fs.writeFileSync(filePath, Buffer.concat([bom, contentBuf]));
```

### Writing .js / .json Files in Node.js (no BOM)
```javascript
fs.writeFileSync(filePath, content, 'utf8'); // plain UTF-8, no BOM
```

---

## 2. Page Frontmatter Metadata

Every markdown wiki page (except `stubs.md`) must begin with a YAML frontmatter block containing metadata:

```yaml
---
title: "Page Title"
type: concept
status: draft
source_status: source-linked
sources:
  - my-layer-name/raw/docs/source-doc.md
last_updated: YYYY-MM-DD HH:MM
related:
  - "[[related-page-name]]"
---
```

<h3>Supported Page Types (`type`)</h3>
- `source-summary`: Overview of one specific raw source or codebase document.
- `concept`: Reusable design patterns, architectural rules, or code style constraints.
- `entity`: Modules, services, scenes, tools, or assets.
- `synthesis`: Cross-source analyses, conclusions, or comparison tables.
- `runbook`: Practical step-by-step procedures.
- `decision`: Architectural Decisions Records (ADRs) explaining choices and context.
- `contradiction`: Explanations of conflicts between sources or code behaviors.

---

## 3. Page Layout Template

Every wiki page must use this strict layout to pass the linter:

```markdown
# Page Title

**Summary**: One or two sentences summarizing the purpose and contents of this page.

**Sources**: my-layer-name/raw/docs/source-doc.md

**Last updated**: YYYY-MM-DD

## Key Claims

- Factual claim description. (source: my-layer-name/raw/docs/source-doc.md)
- Another claim with timestamp or line citation. (source: my-layer-name/raw/docs/source-doc.md#L45)

## Details

Main body of the document goes here. Use standard Markdown headers, code snippets, lists, and tables. 
Use Obsidian links `[[page-name]]` to link to other concept, entity, or runbook pages.

## Open Questions

- List of unresolved issues, missing evidence, or conflicting source material.

## Related Pages

- [[related-page-name]]
```

---

## 4. Linking and Citation Policies

- **Wiki Links**: Use Obsidian double-bracket style `[[page-name]]` for references between pages. Filenames must be in lowercase kebab-case (e.g. `module-lifecycle.md` should be linked as `[[module-lifecycle]]`).
- **Source Citations**: Any factual claim made in `wiki/` pages MUST be supported by a citation pointing to an immutable raw file in `raw/` or a file in the project repository using this exact format: `(source: layer-name/raw/docs/source-doc.md)`.
- **Plans Isolation & Linking**: All execution plans, stabilization plans, task lists (`task.md`), and walkthroughs (`walkthrough.md`) must be placed in the root-level `plans/` directory of the workspace, completely isolated from individual layer repositories. Links to these plan files must use portable relative Markdown paths (e.g., `[task.md](../../plans/task.md)`) and must never wrap the link text in backticks.
- **File Links**: Use only portable relative Markdown links, e.g., `[MyClass](../../path/to/MyClass.cs)`. `file://` URIs and absolute OS paths are forbidden. Never surround the file link text with backticks.
- **Правило корня Wiki**: Явные `./` и `../` всегда считаются от папки Markdown-файла. Относительный путь без такого префикса всегда считается от корня `knowledge-base/`; ссылка не может выйти за его пределы.
- **C# Code Style Location**: The C# code style guidelines (`code_style.md`) must reside inside the framework layer: `framework-wiki/raw/code_style.md` (NOT in `engine-wiki/raw/code_style.md`), since coding style conventions are a property of the core Framework framework. All references to code style must link to this path.
- **Full-Text Search Gaps Policy**: If the AI assistant has to perform grep, ripgrep, full-text search, custom Python/Node scripts, or any other global search methods across the codebase due to missing information, maps, or undocumented patterns in the knowledge base, the assistant must document these findings. The new code symbols, directories, and logic patterns must be described and added to the most appropriate layer of the knowledge base. This ensures that future searches are performed directly via the wiki query system, eliminating redundant low-level code searches.
- **Dependencies Paths**: Manifests or documentation explaining layer dependencies must include relative paths to the target dependency folder (e.g., `[davasko-wiki](../davasko-wiki)`).
- **Aesthetic Independence & Generalization**: All documentation, code rules, and instructions stored in the knowledge base must be kept in a generic, project-agnostic format. Avoid hardcoding proprietary framework names or third-party project identifiers (such as project submodules or specific client directories) in general-purpose rules. Keep files portable and transferable to any target workspace.

---

## 5. Unity AssetDatabase Integration

If the knowledge base is located inside a Unity project repository (under `Assets/`), Unity generates the `.meta` files automatically when it imports the assets.

Do **NOT** hand-create `.meta` files. The ingestion pipeline no longer generates them and the linter no longer requires them — Unity creates each `.meta` (with its own GUID) on import.

---

## 6. Structural Chunking v4 & Embedding Standards

To maximize semantic retrieval accuracy and retain cross-boundary context, indexers must implement the **Chunking Profile v4**:

1. **Size Targets**:
   - Target chunk length: ~200 words.
   - Hard upper limit: 300 words.
2. **Bidirectional Context Windows**:
   - Every chunk after the first includes 32 words of context from the previous chunk prefixed as:
     `[Контекст предыдущего фрагмента: ...]`
   - Every chunk before the last includes 32 words of context from the following chunk suffixed as:
     `[Контекст следующего фрагмента: ...]`
3. **Hierarchy & Entity Breadcrumbs**:
   - When ingesting structured documents (such as multi-tab sheets or nested guides), tab or heading hierarchy must be prefixed directly to the chunk text:
     `[parent_tab > tab_name]`
4. **Late Chunking & GPU Safeguards**:
   - Single-sequence late chunking is permitted for documents up to **6000 words** (`late_chunk_max_words: 6000`). Documents exceeding this threshold must be segmented prior to embedding to prevent GPU VRAM exhaustion (DirectML / CUDA OOM).
5. **Fault Tolerance & Manifest Status**:
   - Vector batches must be committed to LanceDB in checkpoints every **20 documents** (`CHECKPOINT_INTERVAL = 20`).
   - The embedding manifest file tracks status lifecycle (`in_progress` during execution, `complete` on successful termination).
6. **Prompt Injection Defense**:
   - Documents retrieved by the search engine are sanitized and wrapped in `<document id="...">` XML blocks before injection into context dumps.
