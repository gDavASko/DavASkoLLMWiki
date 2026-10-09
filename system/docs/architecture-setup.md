 Architecture Setup Guide

The **DavASko LLM Wiki** is a multi-layered, Obsidian-compatible knowledge base designed to cleanly separate general AI rules, engine-specific rules, framework-specific details, and project-specific documentation.

---

## 1. The Multi-Layer Concept

Instead of a monolith knowledge base, the wiki uses distinct, hierarchical folders called **layers**. Each layer behaves like an independent sub-wiki but can reference layers below it in the dependency chain.

### Conceptual Hierarchy
```mermaid
graph TD
    ProjectLayer1[Project 1 Wiki: project-a-wiki] --> FrameworkLayer[Framework Wiki: framework-wiki]
    ProjectLayer2[Project 2 Wiki: project-b-wiki] --> FrameworkLayer
    ProjectLayer3[Project 3 Wiki: project-c-wiki] --> FrameworkLayer
    FrameworkLayer --> EngineLayer[Engine Wiki: engine-wiki]
    EngineLayer --> RootLayer[Core LLM Wiki: llm-wiki]
```

- **Core LLM Layer (`llm-wiki`)**: Completely independent. Contains general rules for writing code with AI, managing plans, video transcripts, and general helper scripts.
- **Engine Layer (`engine-wiki`)**: Knows about the development platform (e.g. Unity, Unreal, Next.js). Inherits from the LLM Layer.
- **Framework Layer (`framework-wiki`)**: Knows about the target core libraries, custom packages, code styles, and architecture protocols. Inherits from the Engine Layer.
- **Project Layers (`project-a-wiki`, `project-b-wiki`, etc.)**: Each contains independent business logic, specifications/game design documents, and feature definitions for that specific project. All projects inherit from the same common Framework Layer, but remain completely isolated from each other.

---

## 2. Layer Manifest: `wiki.json`

Every layer directory MUST contain a `wiki.json` file in its root. This manifest defines the layer name and its explicit dependencies. In the layer description indexes and LLM-WIKI guides, dependency references must include clickable local paths to their folders, e.g. `[davasko-wiki](../davasko-wiki)`.

For authoring, a layer normally contains both `wiki/` and `raw/`. For indexing, a manifest with either directory is valid: a raw-only layer must be indexed because Git does not retain an empty `wiki/` directory after cloning. A layer with neither directory is ignored as invalid.

### Configuration Format
```json
{
  "name": "project-wiki",
  "dependencies": [
    "framework-wiki",
    "engine-wiki",
    "llm-wiki"
  ]
}
```

*Note: Order in the `dependencies` array defines the search priority for link resolution. The current layer is always searched first, followed by dependencies in order.*

---

## 3. Directory Layout of a Layer

The overall workspace directory layout consists of root-level folders and multi-layered subdirectories:

### Workspace Root Layout
```
<workspace-root>/
├── plans/                      ← Task checklists, implementation plans, walkthroughs (centralized)
├── system/                     ← Maintenance scripts (lint-wiki.js, query-wiki.js, etc.)
├── NewData/                    ← Incoming buffer folder for manual ingestion
├── llm-wiki/                   ← Core LLM Layer (contains general rules, scripts, transcripts)
├── engine-wiki/                ← Engine Layer (Engine/platform specific)
├── framework-wiki/             ← Framework Layer (contains framework details, code style)
├── project-a-wiki/             ← Project-specific Layer (Project A)
├── project-b-wiki/             ← Project-specific Layer (Project B)
├── project-c-wiki/             ← Project-specific Layer (Project C)
```

### Folder Structure of a Single Layer
Each individual layer directory must have the following structure:
```
<layer-directory>/
├── wiki.json                   ← Manifest file defining dependencies
├── wiki/                       ← Compiled, AI-maintained knowledge (durable)
│   ├── index.md                ← Required layer table of contents
│   ├── contradictions.md       ← Log of conflicting claims and open questions
│   ├── stubs.md                ← Placeholder/stub links for cyclic dependencies
│   ├── concepts/               ← Reusable ideas and rules
│   ├── entities/               ← Classes, packages, tools, scenes
│   ├── runbooks/               ← Step-by-step procedures
│   ├── sources/                ← AI-generated summaries of raw materials
│   ├── syntheses/              ← Comparative analyses
│   └── decisions/              ← Architectural decisions (ADRs)
└── raw/                        ← Immutable source materials (read-only)
    ├── docs/                   ← Copied source docs
    ├── transcripts/            ← Meeting or review notes (llm-wiki/raw/transcripts/ only)
    └── all-skills~/             ← Portable AI skills package folders
```

---

## 4. Resolving Cyclic Dependencies: The Stub Mechanism

Dependencies flow **downward** (e.g., Project Layer can reference Engine Layer, but Engine Layer cannot reference Project Layer). 

If a lower-level page (e.g., a page in the Engine Layer) needs to mention a page belonging to a higher layer (e.g., a Project Layer), it cannot use a direct link because that would cause a validation error (out-of-bounds dependency).

### Solution: `stubs.md`
To reference a page that is outside or above the layer's dependency chain, register a link to that page inside the layer's `wiki/stubs.md` file:

```markdown
# Placeholder Stubs

- [[my-project-specific-module]] - Project-specific gameplay module definition.
```

The wiki linter will recognize this stub as a valid reference. When the actual page is eventually ingested into the project layer, the stub prevents link errors while keeping the engine/framework layer completely portable and independent.

---

## 5. LangGraph Control Plane Architecture

The knowledge retrieval subsystem is governed by a deterministic, multi-tiered LangGraph Control Plane located in `orchestration/`:

```mermaid
flowchart TD
    REQ[Client Query] --> VAL[Validate Request]
    VAL --> ROUTE{Query Router}
    ROUTE -->|RAG| RAG_NODE[Execute RAG Search]
    ROUTE -->|RLM| RLM_NODE[Start Research Subgraph]
    ROUTE -->|Graphify| GRAPH_NODE[AST Graph Query]
    
    RAG_NODE & RLM_NODE --> JUDGE1{Judge Initial Score >= 7?}
    JUDGE1 -->|Yes| NORM[Normalize Response]
    JUDGE1 -->|No| FALLBACK[Execute Fallback Tier: RAG <-> RLM]
    FALLBACK --> JUDGE2{Judge Fallback Score >= 7?}
    JUDGE2 -->|Yes| NORM
    JUDGE2 -->|No| COMP1[Compare Answers A/B]
    COMP1 --> GREP[Execute Grep Search Fallback]
    GREP --> JUDGE3{Judge Grep Score >= 7?}
    JUDGE3 -->|Yes| NORM
    JUDGE3 -->|No| COMP2[Compare Final Best]
    COMP2 --> NORM
    GRAPH_NODE --> NORM
    NORM --> DUMP[.cursor-context-dump.md]
```

### Components
1. **State & Action Contracts (`orchestration/contracts.js`)**: Strictly typed request parameters, validation rules, token budgets, and search modes.
2. **5-Tier Supervisor Graph (`orchestration/graphs/query-supervisor.js`)**:
   - **Tier 1 (Validation & Route Selection)**: Validates limits and dispatches to RAG, RLM, or Graphify via local LLM router.
   - **Tier 2 (Initial Search)**: Performs targeted semantic/symbolic retrieval or launches research worker.
   - **Tier 3 (Consensus & LLM-Judge)**: Independent judge evaluates candidate completeness and relevance against threshold score $\ge 7$.
   - **Tier 4 (Fallback Retrieval & A/B Comparators)**: Runs complementary search method if score $< 7$, comparing candidates side-by-side.
   - **Tier 5 (Deterministic Grep Search Fallback)**: Catches edge-case keywords when semantic pathways fail.
3. **SQLite WAL State Checkpointing (`orchestration/checkpointer.js`)**: All state transitions, tool invocations, and evaluations are atomically recorded in a local SQLite database in WAL mode for replayability and audit traces.
4. **Worker Thread Isolation (`orchestration/graphs/research-worker.js`)**: Heavy RLM research runs in a dedicated Node.js Worker Thread with periodic heartbeats every 5 seconds to keep the main event loop responsive.
5. **Prompt Injection Hardening**: All retrieved documents are sanitized and encapsulated within `<document id="...">` XML blocks before injection into context dumps.

---

## 6. Resident Search Server (`system/search-server.js`)

To eliminate Node.js cold-start overhead (~8 seconds per search), the engine provides a resident background process:
- Communicates via JSON-RPC / NDJSON over standard I/O (`stdin`/`stdout`).
- Retains LanceDB tables, ONNX embedding models, and vector indexes warm in memory, dropping response latency to **~1.5 seconds**.
- Diagnostic logging is routed strictly to `stderr` to ensure protocol streams on `stdout` remain uncorrupted.

---

## 7. Knowledge Base Isolation Markers (`.davasko-local-kb` / `.kbpro-local-kb`)

The system supports project-level overrides to decouple local submodules from global machine installations:
- If a project directory contains a `.davasko-local-kb` or `.kbpro-local-kb` marker file, `system/lib/wiki-paths.js` pins all indexing and retrieval operations strictly to the local repository, ignoring global system-wide environment variables (`KBPRO_AI_CHAT_WIKI_DIR`).
- Configurable via `system/scripts/setup-knowledge-base.js`.
