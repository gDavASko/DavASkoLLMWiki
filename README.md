# DavASko LLM Wiki

A multi-layered, self-validating, and Obsidian-compatible knowledge base framework designed specifically to organize AI agent work with high-performance LLMs (such as Claude 3.5 Sonnet, Gemini 1.5 Pro, and GPT-4o) in developer workspaces.

---

## 1. Core Concept & Architecture

The **DavASko LLM Wiki** separates knowledge into hierarchical, independent folders called **layers**. This ensures that general AI rules, engine-specific constraints, framework conventions, and project-specific documentation are kept in separate contexts.

### The Dependency Chain
Dependencies flow strictly **downward**. A higher-level layer can depend on and link to a lower-level layer, but not vice versa.

```mermaid
graph TD
    Project[Project Layer: e.g. dentistry-cow-wiki] --> Framework[Framework Layer: e.g. davasko-wiki]
    Framework --> Engine[Engine Layer: e.g. unity-wiki]
    Engine --> Root[Core LLM Layer: llm-wiki]
```

- **`llm-wiki`** (Core Layer): Contains universal AI rules, project planning guides, and general helper scripts.
- **`unity-wiki`** (Engine Layer): Contains game engine details, naming styles, physics guidelines, and assembly rules.
- **`davasko-wiki`** (Framework Layer): Contains core packages, architectural principles, and custom libraries definitions.
- **`dentistry-cow-wiki`** (Project Layer): Contains gameplay design documents (GDD), scene lists, and project-specific task builders.

Each layer contains a manifest file `wiki.json` specifying its dependencies:
```json
{
  "name": "davasko-wiki",
  "dependencies": ["unity-wiki", "llm-wiki"]
}
```

---

## 2. Knowledge Priorities & Conflict Resolution

Knowledge has different weights depending on its "proximity to the project":

$$\text{Project Layer} > \text{Framework Layer} > \text{Engine Layer} > \text{Core LLM Layer}$$

### The Priority Override Rules
If a page, rule, or concept exists in multiple layers (e.g. both `unity-wiki` and `llm-wiki` contain a rule with conflicting conventions):
1. **Default Option**: The version in the most specific (project-level) layer is chosen and followed by default.
2. **Warn User**: The AI assistant must print a warning message notifying the user about the duplicate rules.
3. **Offer Choice**: The AI assistant must prompt the user to choose between using the default (project-level) rule or overriding it with the general base rule.

---

## 3. Directory Structure of a Layer

Every layer in the system conforms to the following directory layout:

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
    ├── transcripts/            # Text transcripts of meetings or videos
    └── ai-skills~/             # Portable AI skills (SKILL.md and assets)
```

---

## 4. Ingestion Workflow & System Scripts

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

---

## 5. How to Deploy the LLM Wiki in a New Workspace

Follow these steps to initialize the DavASko LLM Wiki in any project:

### Step 1: Clone Rules and Scripts
1. Create a submodule or folder named `davasko-ai-docs` in your repository.
2. Copy the contents of the `templates/system-scripts/` directory into `davasko-ai-docs/system/`.
3. Copy the script `templates/sync-ai-rules.ps1` to the project root directory.

### Step 2: Initialize Layers
1. Create directories for your layers (e.g. `llm-wiki/`, `unity-wiki/`, `project-wiki/`).
2. Add a `wiki.json` manifest to each layer define its dependency chain.
3. In each layer, create the basic folder structures and write initial placeholder lists:
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
Validate the database setup:
```powershell
node davasko-ai-docs/system/lint-wiki.js
node davasko-ai-docs/system/validate-links.js
```

If the validation passes with **0 errors**, your workspace is fully prepared for structured AI collaboration!
