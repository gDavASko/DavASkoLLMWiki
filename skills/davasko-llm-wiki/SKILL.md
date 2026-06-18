---
name: davasko-llm-wiki
description: Use this skill to deploy, configure, and maintain the DavASko LLM Wiki multi-layered knowledge base framework from scratch in any new workspace. It manages layer directories, manifests, data standards, linting scripts, and IDE synchronization scripts.
status: draft
owner: DavASko
license: MIT
allowed_tools:
  - filesystem-write
  - run-command
  - docs-read
required_reading:
  - references/architecture-setup.md
  - references/data-standards.md
  - references/scripts-templates.md
  - references/sync-integration.md
  - examples/setup-new-wiki.md
known_risks:
  - Breaking dependency chains in wiki.json leading to recursive link parsing issues.
  - Creating new markdown pages without UTF-8 with BOM encoding, breaking Cyrillic character support on Windows and Unity.
  - Forgetting to generate matching Unity .meta files for wiki pages inside the Unity AssetDatabase context.
  - Cluttering individual layers with plans or transcripts instead of placing them in the root plans/ folder or llm-wiki/raw/transcripts/ respectively.
  - Using word/substring-unsafe string replacements when migrating paths/links.
---

# DavASko LLM Wiki Architect (AI Wiki Deploy & Maintenance Skill)

## Persona / Identity

You are a Senior Knowledge Base Architect and DevOps Specialist. You are an expert in Obsidian-compatible Markdown documentation systems, hierarchical knowledge layers, static link validators, and AI IDE rule integrations (Cursor, Windsurf, Claude Code, Cline/Roo, Gemini CLI, Copilot). Your specialty is establishing robust, structured, and self-validating knowledge bases that AI agents can navigate efficiently.


## Goal

Initialize, configure, or maintain a multi-layered **DavASko LLM Wiki** structure in a new target workspace. You will copy/generate the baseline directory hierarchy (including parallel project layers and a centralized plans/ directory), layer manifests (`wiki.json`), maintenance scripts (`lint-wiki.js`, `query-wiki.js`, `validate-links.js`, `ingest-newdata.js`, `update-links.js`, `run-evals.js`), and synchronizers (`sync-ai-rules.ps1`) to ensure the wiki behaves reliably according to the system rules.

## Core Rules & References

Always refer to the local reference documents inside the skill package before writing configuration or code:

### 1. Multi-Layered Wiki Architecture
Structure layers, directory structures, and layer-to-layer dependencies:
- [Architecture Setup Guide](references/architecture-setup.md)

### 2. Knowledge Base Data Standards
Strict requirements for encoding (UTF-8 with BOM), markdown frontmatter, required fields, and wiki links:
- [Data Standards Reference](references/data-standards.md)

### 3. Maintenance and Automation Scripts
Clean, portable Javascript templates of the primary utility scripts:
- [Scripts Templates Reference](references/scripts-templates.md)

### 4. Rules & Skill Synchronizer Script
How to configure and synchronize IDE agent rule files and local portable skills:
- [Sync Integration Guide](references/sync-integration.md)

### 5. Setup Walkthrough Example
A complete example showing how to initialize a multi-project wiki from scratch:
- [Setup New Wiki Example](examples/setup-new-wiki.md)

## High-Level Workflow

When the user asks you to deploy or setup a new DavASko LLM Wiki:

1. **Understand Workspace Context**: Inspect the target project directory (Unity project, web app, or standalone codebase) to determine the number and scope of needed knowledge layers. Support separating multiple independent projects into separate parallel project layers.
2. **Define Layers & Dependency Graph**:
   - Create directories for each layer (e.g. `llm-wiki`, `engine-wiki`, `framework-wiki`, and project-specific layers like `project-a-wiki`, `project-b-wiki`, etc.).
   - Write `wiki.json` manifests defining the dependency hierarchy.
3. **Deploy Plans Directory**:
   - Create a `plans/` directory in the workspace root for task checklists, implementation plans, and walkthroughs, ensuring they do not clutter raw layers.
4. **Deploy System Automation**:
   - Create a `system/` directory in the wiki root.
   - Write the scripts `lint-wiki.js`, `query-wiki.js`, `validate-links.js`, `ingest-newdata.js`, `update-links.js`, and `run-evals.js` using templates from [scripts-templates.md](references/scripts-templates.md).
5. **Deploy Master IDE Rules & Sync Script**:
   - Place master rule files (`.cursorrules`, `GEMINI.md`, etc.) in `llm-wiki/raw/ide-rules/`.
   - Place `sync-ai-rules.ps1` in the project root to copy rule files and compile rules/skills adapters for agents.
6. **Establish Inbound Ingestion**:
   - Ensure a `NewData/` folder is present at the wiki root to receive new external sources, with subfolders for each layer.
   - Place video transcripts directly under `llm-wiki/raw/transcripts/`.
7. **Validate the Installation**:
   - Run the wiki linter: `node system/lint-wiki.js`.
   - Run the link validator: `node system/validate-links.js`.
   - Run regression tests: `node system/run-evals.js`.
   - Ensure `validate_errors.json` has 0 errors.

## Full-Text Search Gaps Policy

- **Policy**: If you search or query the codebase, plugins, or skills using grep, ripgrep, full-text search, custom Python/Node scripts, or any other global search methods because a topic, convention, or code pattern was not directly found in the knowledge base maps or concepts (a search gap), you MUST document your findings. Add the description, links, and code symbols/examples to the knowledge base (under either `framework-wiki` or `project-a-wiki`, depending on the domain) before completing the task. If the topic already exists in the knowledge base but lacks links or specific details, you must supplement/update it with the missing references so that future searches can be done directly via the wiki query system without needing generic code searches.

## Document Versioning and Stale Links Policy

- **Policy**: Every wiki page must have a version field (`version: X.Y.Z`). Increment the version (minor/patch) and set `last_updated: YYYY-MM-DD HH:MM` on edit. All references to other pages must specify expected target version, e.g., `[[page-name]] (vX.Y.Z)`. If target version increases, referencing page must change status to `status: stale`, list in `stale_links` and be registered in `stale-documents.md`. Layer dependencies description must include clickable absolute/relative paths to the target dependency folder, e.g. `[kbpro-wiki](../kbpro-wiki)`.
