# Knowledge Base Data Standards

To maintain compatibility with Obsidian, Unity, Windows, and multiple AI tooling agents, all files within the **DavASko LLM Wiki** must adhere to strict formatting and encoding standards.

---

## 1. Encoding: UTF-8 (BOM only for Markdown)

All text files MUST be saved as **UTF-8**. The Byte Order Mark (BOM) policy depends on the file type:

| File type | Encoding | BOM |
|---|---|---|
| `.md` (Markdown wiki/raw pages) | UTF-8 | **with BOM** (`EF BB BF`) |
| `.json`, `.js`, `.ps1`, `.mdc`, `.yml`/`.yaml`, `.clinerules`, `.cursorrules`, `.windsurfrules` | UTF-8 | **without BOM** |

### Why BOM only for `.md`
Some Markdown consumers on Windows (legacy editors, Unity asset previews, certain Obsidian setups) auto-detect encoding from the BOM signature, so a BOM on `.md` is a safe hint for Cyrillic content. **The BOM is not what stores Cyrillic** — UTF-8 encodes Russian characters identically with or without a BOM. Garbled text appears only when a *reader* wrongly assumes a legacy code page; the correct fix there is to make the reader assume UTF-8 (see "Console" below), not to stamp every file with a BOM.

### Why other file types MUST NOT have a BOM
- **JSON**: A leading BOM is invalid per RFC 8259 and makes `JSON.parse()` throw (`Unexpected token`). Never write BOM into `.json`.
- **`.js` / `.ps1` / rules**: a BOM produces noisy Git diffs, can break shebang/module detection, and is unnecessary.

### Console (the real fix for garbled Cyrillic)
Make the terminal read UTF-8 instead of relying on file BOMs:
```powershell
chcp 65001                                        # switch console code page to UTF-8
[Console]::OutputEncoding = [Text.Encoding]::UTF8 # PowerShell output as UTF-8
```
PowerShell 7+ and the `.editorconfig` in the repo root enforce UTF-8 across editors.

### Writing files in Node.js
```javascript
// Markdown — WITH BOM
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
fs.writeFileSync(mdPath, Buffer.concat([bom, Buffer.from(content, 'utf8')]));

// JSON and everything else — WITHOUT BOM
fs.writeFileSync(jsonPath, Buffer.from(content, 'utf8'));
```

### Writing Markdown with BOM in PowerShell
```powershell
[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($true)))   # $true = emit BOM (.md only)
```

The wiki linter (`system/scripts/lint-wiki.js`) enforces this policy: `.md` files missing a BOM and non-`.md` files carrying a BOM both fail the lint.

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
- **Plans Isolation & Linking**: All execution plans, stabilization plans, task lists (`task.md`), and walkthroughs (`walkthrough.md`) must be placed in the root-level `plans/` directory of the workspace, completely isolated from individual layer repositories. Links to these plan files must use standard Markdown links with absolute or relative `file:///` URIs (e.g., `[task.md](../../plans/task.md)`) and must never wrap the link text in backticks.
- **File Links**: When linking to actual source code or configuration files, use markdown links with absolute or relative `file:///` URIs, e.g., `[MyClass](../../path/to/MyClass.cs)`. Never surround the file link text with backticks.
- **C# Code Style Location**: The C# code style guidelines (`code_style.md`) must reside inside the framework layer: `framework-wiki/raw/code_style.md` (NOT in `engine-wiki/raw/code_style.md`), since coding style conventions are a property of the core Framework framework. All references to code style must link to this path.
- **Full-Text Search Gaps Policy**: If the AI assistant has to perform grep, ripgrep, full-text search, custom Python/Node scripts, or any other global search methods across the codebase due to missing information, maps, or undocumented patterns in the knowledge base, the assistant must document these findings. The new code symbols, directories, and logic patterns must be described and added to the most appropriate layer of the knowledge base. This ensures that future searches are performed directly via the wiki query system, eliminating redundant low-level code searches.
- **Dependencies Paths**: Manifests or documentation explaining layer dependencies must include absolute/relative paths to the target dependency folder (e.g., `[davasko-wiki](../davasko-wiki)`).
- **Aesthetic Independence & Generalization**: All documentation, code rules, and instructions stored in the knowledge base must be kept in a generic, project-agnostic format. Avoid hardcoding proprietary framework names or third-party project identifiers (such as project submodules or specific client directories) in general-purpose rules. Keep files portable and transferable to any target workspace.

---

## 5. Unity AssetDatabase Integration

If the knowledge base is located inside a Unity project repository (under `Assets/`), every folder and file inside `wiki/`, `raw/`, and `evals/` must have a corresponding `.meta` file. 

The linter will fail if a markdown page is missing its `.meta` file. When programmatically creating wiki files, always generate a corresponding `.meta` containing a unique, randomly generated 32-character hexadecimal GUID.

---

## 6. Provenance & Staleness (Source-of-Truth Tracking)

The **code (and its immutable snapshots in `raw/`) is the source of truth**; `wiki/` pages are a curated derived layer. To keep the derived layer honest, every page records the fingerprint of the sources it was generated from, so drift is *detectable* instead of silent.

### Provenance frontmatter

In addition to `sources` and `last_updated`, a page SHOULD carry a `source_hashes` map — the **sha256** (of BOM-stripped content) of each cited source at generation time:

```yaml
sources:
  - framework-wiki/raw/docs/event-bus.md
last_updated: 2026-06-23
source_hashes:
  framework-wiki/raw/docs/event-bus.md: 9645671b...c6c9
```

Sources may point at `raw/` snapshots **or** at real code files in the workspace (e.g. `(source: Assets/.../EventBus.cs)`); the detector hashes whichever file the citation resolves to.

### Page lifecycle

```
fresh ──(a cited source changes)──▶ stale ──(davasko-wiki-refresh)──▶ fresh
```

- **fresh**: recorded `source_hashes` match the current sources.
- **stale**: at least one cited source changed or went missing.
- **needs-stamp**: page has no `source_hashes` baseline yet.

### Tooling

| Command | Purpose |
|---|---|
| `node system/scripts/check-staleness.js` | Recompute hashes, write `system/staleness-report.json`, exit 1 if any page is stale (CI gate). |
| `node system/scripts/check-staleness.js --strict` | Also fail on `needs-stamp` pages (use once coverage is complete). |
| `node system/scripts/check-staleness.js --stamp [page]` | Write/refresh `source_hashes` + `last_updated` after a page's body has been actualized. |

The `staleness-report.json` is a machine-readable worklist consumed by the **davasko-wiki-refresh** skill, which regenerates stale pages from their updated sources and re-stamps them. **Never `--stamp` a page without first updating its body to match the changed source** — that would hide real drift rather than resolve it.
