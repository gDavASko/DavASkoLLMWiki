﻿﻿# DavASko LLM Wiki

A multi-layered, self-validating, and Obsidian-compatible knowledge base framework designed specifically to organize AI agent work with high-performance LLMs (such as Claude 3.5 Sonnet, Gemini 1.5 Pro, and GPT-4o) in developer workspaces.

---

## 1. Core Concept & Architecture

The **DavASko LLM Wiki** separates knowledge into hierarchical, independent folders called **layers**. This ensures that general AI rules, engine-specific constraints, framework conventions, and project-specific documentation are kept in separate contexts.

### The Dependency Chain
Dependencies flow strictly **downward**. A higher-level layer can depend on and link to a lower-level layer, but not vice versa. Multiple independent project layers can run in parallel and inherit from the common framework layer.

```mermaid
graph TD
    Project1[Project 1 Layer: project-a-wiki] --> Framework[Framework Layer: framework-wiki]
    Project2[Project 2 Layer: project-b-wiki] --> Framework
    Project3[Project 3 Layer: project-c-wiki] --> Framework
    Framework --> Engine[Engine Layer: engine-wiki]
    Engine --> Root[Core LLM Layer: llm-wiki]
```

- **`llm-wiki`** (Core Layer): Contains universal AI rules, developer guidelines, video transcripts, and general helper scripts.
- **`engine-wiki`** (Engine Layer): Contains game engine details, naming styles, physics guidelines, and assembly rules.
- **`framework-wiki`** (Framework Layer): Contains core framework packages, architectural principles, C# code styles, and custom libraries definitions.
- **`project-a-wiki`, `project-b-wiki`, `project-c-wiki`** (Project Layers): Contain GDDs, scene lists, gameplay logic, and module definitions for their respective projects. Each project is fully isolated from others.

Each layer contains a manifest file `wiki.json` specifying its dependencies:
```json
{
  "name": "davasko-wiki",
  "dependencies": ["engine-wiki", "llm-wiki"]
}
```

---

## 2. Knowledge Priorities & Conflict Resolution

Knowledge has different weights depending on its "proximity to the project":

$$\text{Project Layer} > \text{Framework Layer} > \text{Engine Layer} > \text{Core LLM Layer}$$

### The Priority Override Rules
If a page, rule, or concept exists in multiple layers (e.g. both `engine-wiki` and `llm-wiki` contain a rule with conflicting conventions):
1. **Default Option**: The version in the most specific (project-level) layer is chosen and followed by default.
2. **Warn User**: The AI assistant must print a warning message notifying the user about the duplicate rules.
3. **Offer Choice**: The AI assistant must prompt the user to choose between using the default (project-level) rule or overriding it with the general base rule.
4. **Grep Search Gaps**: If the AI assistant searches the codebase using low-level search tools (grep, ripgrep) because of undocumented patterns or missing references, it MUST document the findings in the most appropriate layer of the knowledge base.
5. **Aesthetic Independence**: Rules, schemas, and instructions MUST NOT contain proprietary names or paths (such as client-specific folders or proprietary framework names) in general-purpose layers. Keep all conventions abstract, generalized, and portable.

---

## 3. Document Versioning & Stale Links Policy

To prevent knowledge obsolescence and track link validity across layers:
- **YAML Metadata**: Every wiki page frontmatter must contain a `version: X.Y.Z` field. Any time a page is updated, its version must be bumped (minor/patch) and the `last_updated: YYYY-MM-DD HH:MM` field updated with the current local time.
- **Expected Versions in Links**: All wiki links (`[[page-name]]`) must explicitly declare the expected version of the target document, e.g., `[[page-name]] (vX.Y.Z)`.
- **Stale Document Detection**: If a target document's version is updated to a value higher than expected by a referencing link, the referencing page is marked as **stale**.
- **Stale Markings**: Stale pages must change their status to `status: stale`, list outdated links in a `stale_links: []` frontmatter array, and be added to the registry note `wiki/stale-documents.md` of the corresponding layer.

---

## 4. Full-Text Search Gaps Policy

To continuously improve the quality and coverage of the knowledge base:
- **Search Gap Definition**: If an AI assistant performs a full-text search (using grep, ripgrep, custom script searches, etc.) because a topic, convention, or code pattern was not directly found in the wiki maps or concepts, this indicates a search gap.
- **Mandatory Documentation**: The AI assistant MUST document its findings before completing the task. This involves adding the description, links, and code symbols to the knowledge base (under the appropriate layer, e.g. `davasko-wiki` or `project-wiki`).
- **Linking Updates**: If the topic already exists but lacked the specific links/details that forced the search, it must be updated with the missing references so future searches can be done directly via the wiki query system.

---

## 5. Directory Layout and Plans Isolation

The system separates planning documentation (ExecPlans, checklists) from the durable knowledge base:

### Workspace Root Layout
```
<workspace-root>/
├── plans/                      # Centralized planning: task.md, implementation plans
├── system/                     # Maintenance scripts (lint-wiki.js, etc.)
├── NewData/                    # Buffer folder for manual document ingestion
├── llm-wiki/                   # Core LLM Layer (contains rules, scripts, transcripts)
├── engine-wiki/                 # Engine Layer (Unity specific)
├── framework-wiki/                 # Framework Layer (framework conventions, C# code styles)
└── <project-wiki>/             # Isolated project-specific layers (e.g. project-a-wiki)
```

### Folder Structure of a Single Layer
Each individual layer directory must conform to the following directory layout:
```
<layer-directory>/
├── wiki.json                   # Manifest file specifying dependencies
├── wiki/                       # Compiled, AI-maintained knowledge base
│   ├── index.md                # Layer-specific catalog of pages (Table of Contents)
│   ├── log.md                  # Local append-only operations log
│   ├── contradictions.md       # Open conflicts and questions register
│   ├── stubs.md                # Declared stubs to resolve out-of-boundary references
│   ├── concepts/               # Reusable patterns, guidelines, and rules
│   ├── entities/               # Service definitions, scenes, classes, packages
│   ├── runbooks/               # Step-by-step developer checklists and guides
│   ├── sources/                # AI-generated summaries of raw materials
│   ├── syntheses/              # Comparative designs and analyses
│   └── decisions/              # Architectural Decision Records (ADRs)
└── raw/                        # Immutable source materials (read-only)
    ├── docs/                   # Copied project documentation
    ├── transcripts/            # Text transcripts of meetings (llm-wiki/raw/transcripts/ only)
    └── ai-skills~/             # Portable AI skills (SKILL.md and assets)
```

---

## 6. Ingestion Workflow & System Scripts

The framework includes automation tools in the `system/` directory:

```mermaid
sequenceDiagram
    participant User
    participant NewData as Incoming Buffer (NewData/)
    participant Script as Ingest Script (ingest-newdata.js)
    participant Raw as Immutable Layer (raw/)
    participant Wiki as Derived Wiki Page (wiki/)
    participant Index as index.md / log.md
    
    User->>NewData: Drop raw documentation file
    User->>Script: Run node system/ingest-newdata.js
    Script->>Raw: Move file, convert to UTF-8 BOM, create .meta
    Script->>Wiki: Generate source summary in wiki/sources/
    Script->>Index: Update local index.md and changelogs (log.md)
    Script->>Script: Run system/lint-wiki.js validator
```

- **`lint-wiki.js`**: Checks that all links resolve correctly, pages have the correct frontmatter/headers, UTF-8 BOM is present, and no secrets or Bitrix webhooks are committed.
- **`validate-links.js`**: Scans the entire project workspace (including rules files) to identify broken wiki and markdown file links.
- **`query-wiki.js`**: Provides CLI page searching and handles the single-file ingestion process. If a page exists in multiple layers, it prints a priority conflict warning and defaults to the most specific layer.
- **`ingest-newdata.js`**: Automatically processes the `NewData/` incoming folder, routes files to layers, generates summaries, updates indexes/logs, and runs checks.
- **`update-links.js`**: Safe path migration script using path-boundary regular expressions to prevent substring corruption.
- **`run-evals.js`**: Automated regression test runner to verify LLM Q&A performance on key topics.

---

## 7. How to Deploy the LLM Wiki in a New Workspace

Follow these steps to initialize the DavASko LLM Wiki in any project:

### Step 1: Clone Rules and Scripts
1. Create a submodule or folder named `davasko-ai-docs` in your repository.
2. Copy the contents of the `templates/system-scripts/` directory into `davasko-ai-docs/system/`.
3. Copy the script `templates/sync-ai-rules.ps1` to the project root directory.

### Step 2: Initialize Layers and Plans
1. Create directories for your layers (e.g. `llm-wiki/`, `engine-wiki/`, `framework-wiki/`, and project-specific layers).
2. Create a `plans/` directory in the workspace root.
3. Add a `wiki.json` manifest to each layer to define its dependency chain.
4. In each layer, create the basic folder structures and write initial placeholder lists:
   - `wiki/index.md`
   - `wiki/stubs.md`
   - `wiki/log.md`
   - `wiki/contradictions.md`

### Step 3: Copy Master IDE Rules
1. Copy the rules templates from `templates/ide-rules/` into your core layer `llm-wiki/raw/ide-rules/`.
2. Configure agent instructions in `AGENTS.md` and `GEMINI.md` to point to the newly created layers.

### Step 4: Install AI Skills
You can install the portable skills from this repository either project-locally or globally:

#### Option A: Project-Local Installation (Recommended)
Copy the skills you want to use from the `skills/` directory of this repository into your layer's `raw/ai-skills~/` folder:
- `llm-wiki/raw/ai-skills~/davasko-llm-wiki/`
- `llm-wiki/raw/ai-skills~/davasko-youtube-researcher/`

Run the synchronizer to deploy rules and compile skill adapters for your IDE:
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\sync-ai-rules.ps1
```

#### Option B: Global Installation
Copy the skill folders from the `skills/` directory into your system's global AI configurations directory:
- Path: `C:\Users\<YourUsername>\.gemini\config\skills\` (e.g. copy the folder `skills/davasko-youtube-researcher/` there).

This makes the skill globally available to all projects on this machine.

### Step 5: Verify the Setup
Validate the database setup and run regression tests:
```powershell
node davasko-ai-docs/system/lint-wiki.js
node davasko-ai-docs/system/validate-links.js
node davasko-ai-docs/system/run-evals.js
```

If the validation passes with **0 errors**, your workspace is fully prepared for structured AI collaboration!
