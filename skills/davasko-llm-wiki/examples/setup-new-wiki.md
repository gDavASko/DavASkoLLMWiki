# Setup New Wiki Example

This guide demonstrates how an AI agent uses this skill to initialize and validate a brand-new multi-layered knowledge base inside a project.

---

## 1. Directory Structure Design

Suppose we are setting up a knowledge base for a Next.js application called "Plombir Web" and we want to separate it from its microservice "Plombir Auth". We decide to create three layers and one root plans folder:
1. `plans/` (Workspace-wide execution plans and task lists)
2. `llm-wiki` (Core rules)
3. `web-app-wiki` (Main Next.js app layer)
4. `auth-service-wiki` (Auth service project layer)

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

### Manifest `auth-service-wiki/wiki.json`
```json
{
  "name": "auth-service-wiki",
  "dependencies": [
    "llm-wiki"
  ]
}
```

---

## 2. Setting Up Baseline Files

We create the mandatory index, stub, and log files in each layer, and create a root plans folder.

### Root Plans Folder `plans/`
- `plans/implementation_plan.md` (Design plans)
- `plans/task.md` (TODO checklists)

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
- `system/update-links.js`
- `system/run-evals.js`

We copy the synchronizer to the root:
- `./sync-ai-rules.ps1`

We write our master rules to `llm-wiki/raw/ide-rules/`:
- `llm-wiki/raw/ide-rules/GEMINI.md`
- `llm-wiki/raw/ide-rules/AGENTS.md`
- `llm-wiki/raw/ide-rules/.cursorrules`

---

## 4. Ingesting Source Documentation & Transcripts

Suppose we have an existing design readme and a video review transcript. We drop them into the ingestion buffers:
- **Project Doc**: `NewData/web-app-wiki/docs/app-readme.md`
- **Meeting Transcript**: `NewData/llm-wiki/transcripts/review-transcript.md`

We run the ingestion automation:
```bash
node system/ingest-newdata.js
```

### Automation Output
1. The project file is moved to `web-app-wiki/raw/docs/app-readme.md` and converted to UTF-8 with BOM.
2. The transcript is moved to `llm-wiki/raw/transcripts/review-transcript.md` and converted to UTF-8 with BOM.
3. A source-summary is generated at `web-app-wiki/wiki/sources/app-readme.md`.
4. The index `web-app-wiki/wiki/index.md` is updated with `[[app-readme]]` in the Sources section.
5. Logs are updated in local log files and the global `log.md`.
6. The linter runs automatically.

---

## 5. Running Validation & Regression Tests

We verify the integrity and regression performance of the whole vault:
```bash
node system/validate-links.js
node system/run-evals.js
```

If the link validation reports:
```
=== Link Validation Summary ===
Warnings: 0
Errors: 0

Validation passed successfully!
```

And `run-evals.js` reports:
```
=== Regression Evals Summary ===
Total tests: 5
Passed: 5
Failed: 0

Regression tests passed successfully!
```

The installation is complete, fully functional, and ready to be used by Obsidian and AI agents!

