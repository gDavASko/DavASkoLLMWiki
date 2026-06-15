# Setup New Wiki Example

This guide demonstrates how an AI agent uses this skill to initialize and validate a brand-new multi-layered knowledge base inside a project.

---

## 1. Directory Structure Design

Suppose we are setting up a knowledge base for a Next.js application called "Plombir Web". We decide to create two layers:
1. `llm-wiki` (Core rules)
2. `web-app-wiki` (Project-specific rules)

We create the folders and manifests:

### Manifest `llm-wiki/wiki.json`
```json
{
  "name": "llm-wiki",
  "dependencies": []
}
```

### Manifest `web-app-wiki/wiki.json`
```json
{
  "name": "web-app-wiki",
  "dependencies": [
    "llm-wiki"
  ]
}
```

---

## 2. Setting Up Baseline Files

We create the mandatory index, stub, and log files in each layer.

### Index Page `web-app-wiki/wiki/index.md`
```markdown
# Plombir Web Wiki Index

**Summary**: Directory index of concepts and runbooks for Plombir Web development.

**Sources**: web-app-wiki/wiki.json

**Last updated**: 2026-06-15

### Concepts
- [[auth-workflow]]

### Sources
- [[readme-synthesis]]

### Related Pages
- [[llm-wiki/wiki/index]]
```

---

## 3. Placing Scripts and Rules

We copy the scripts from `templates/system-scripts/` into a `system/` directory at the project root:
- `system/lint-wiki.js`
- `system/query-wiki.js`
- `system/validate-links.js`
- `system/ingest-newdata.js`

We copy the synchronizer to the root:
- `./sync-ai-rules.ps1`

We write our master rules to `llm-wiki/raw/ide-rules/`:
- `llm-wiki/raw/ide-rules/GEMINI.md`
- `llm-wiki/raw/ide-rules/AGENTS.md`
- `llm-wiki/raw/ide-rules/.cursorrules`

---

## 4. Ingesting Source Documentation

We have an existing `README.md` for the Next.js app. We drop it into the ingestion buffer:
- `NewData/web-app-wiki/docs/app-readme.md`

We run the ingestion automation:
```bash
node system/ingest-newdata.js
```

### Automation Output
1. The file is moved to `web-app-wiki/raw/docs/app-readme.md` and converted to UTF-8 with BOM.
2. A source-summary is generated at `web-app-wiki/wiki/sources/app-readme.md`.
3. The index `web-app-wiki/wiki/index.md` is updated with `[[app-readme]]` in the Sources section.
4. Logs are updated in `web-app-wiki/wiki/log.md` and the root `log.md`.
5. The linter runs automatically.

---

## 5. Running Validation

We verify the integrity of the whole vault:
```bash
node system/validate-links.js
```

If it reports:
```
=== Link Validation Summary ===
Warnings: 0
Errors: 0

Validation passed successfully!
```
The installation is complete, fully functional, and ready to be used by Obsidian and AI agents!
