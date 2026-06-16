# Knowledge Base Data Standards

To maintain compatibility with Obsidian, Unity, Windows, and multiple AI tooling agents, all files within the **DavASko LLM Wiki** must adhere to strict formatting and encoding standards.

---

## 1. Encoding: UTF-8 with BOM

All text and markdown files (`.md`, `.json`, `.clinerules`, `.cursorrules`, `.windsurfrules`, `.ps1`, `.js`) MUST be saved in **UTF-8 with BOM** (Byte Order Mark) encoding.

### Why BOM is Mandatory
Windows-based tools, PowerShell, Unity Editor, and Obsidian require the BOM signature (`EF BB BF`) to correctly interpret Cyrillic (Russian) characters. Without BOM, comments, plans, and instructions written in Russian will appear as garbled text (corrupted encoding) in CLI and IDE logs.

### Writing Files with BOM in PowerShell
Prefer using .NET file methods over standard redirectors:
```powershell
[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($true)))
```

### Writing Files with BOM in Node.js
Always prepend the BOM buffer when writing files:
```javascript
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
const contentBuf = Buffer.from(content, 'utf8');
fs.writeFileSync(filePath, Buffer.concat([bom, contentBuf]));
```

---

## 2. Page Frontmatter Metadata

Every markdown wiki page (except `log.md` and `stubs.md`) must begin with a YAML frontmatter block containing metadata:

```yaml
---
title: "Page Title"
type: concept
status: draft
source_status: source-linked
sources:
  - my-layer-name/raw/docs/source-doc.md
last_updated: YYYY-MM-DD
related:
  - "[[related-page-name]]"
---
```

### Supported Page Types (`type`)
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
- **Plans Isolation & Linking**: All execution plans, stabilization plans, task lists (`task.md`), and walkthroughs (`walkthrough.md`) must be placed in the root-level `plans/` directory of the workspace, completely isolated from individual layer repositories. Links to these plan files must use standard Markdown links with absolute or relative `file:///` URIs (e.g., `[task.md](file:///path/to/plans/task.md)`) and must never wrap the link text in backticks.
- **File Links**: When linking to actual source code or configuration files, use markdown links with absolute or relative `file:///` URIs, e.g., `[MyClass](file:///path/to/MyClass.cs)`. Never surround the file link text with backticks.
- **C# Code Style Location**: The C# code style guidelines (`code_style.md`) must reside inside the framework layer: `kbpro-wiki/raw/code_style.md` (NOT in `unity-wiki/raw/code_style.md`), since coding style conventions are a property of the core KBPro framework. All references to code style must link to this path.

---

## 5. Unity AssetDatabase Integration

If the knowledge base is located inside a Unity project repository (under `Assets/`), every folder and file inside `wiki/`, `raw/`, and `evals/` must have a corresponding `.meta` file. 

The linter will fail if a markdown page is missing its `.meta` file. When programmatically creating wiki files, always generate a corresponding `.meta` containing a unique, randomly generated 32-character hexadecimal GUID.
