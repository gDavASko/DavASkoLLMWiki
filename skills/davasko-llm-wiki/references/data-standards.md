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
- `contradiction`: Explanations of conflicts between sources, code behaviors, or priority layers.

---

## 3. Recording Priority Contradictions

If there is a conflict of priority between layers (e.g. a base layer concept is contradicted or overridden by a project-specific constraint), the AI agent must not delete the old page. Instead:
1. Create or update a page of type `contradiction` under `wiki/contradictions/` (or update `contradictions.md` of the project layer).
2. Record the conflict clearly:
   - Identify which layers and files contain the contradiction.
   - Summarize the base rule and the project override.
   - Cite the sources of both sides.
   - Describe the resolution chosen for the project.

---

## 4. Page Layout Template

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

## 5. Linking and Citation Policies

- **Wiki Links**: Use Obsidian double-bracket style `[[page-name]]` for references between pages. Filenames must be in lowercase kebab-case (e.g. `module-lifecycle.md` should be linked as `[[module-lifecycle]]`).
- **Source Citations**: Any factual claim made in `wiki/` pages MUST be supported by a citation pointing to an immutable raw file in `raw/` or a file in the project repository using this exact format: `(source: layer-name/raw/docs/source-doc.md)`.
- **File Links**: When linking to actual files in instructions or plans, use markdown links with absolute/relative `file:///` URIs, e.g., `[MyClass](file:///path/to/MyClass.cs)`. Never surround file link text with backticks.

---

## 6. Unity AssetDatabase Integration

If the knowledge base is located inside a Unity project repository (under `Assets/`), every folder and file inside `wiki/`, `raw/`, and `evals/` must have a corresponding `.meta` file. 

The linter will fail if a markdown page is missing its `.meta` file. When programmatically creating wiki files, always generate a corresponding `.meta` containing a unique, randomly generated 32-character hexadecimal GUID.
