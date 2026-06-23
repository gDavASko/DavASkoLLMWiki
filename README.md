# DavASko LLM Wiki

A multi-layered, self-validating, Obsidian-compatible knowledge base framework with a built-in hybrid (symbolic + semantic) retrieval engine, designed to organize AI-agent work with modern LLMs (Claude, Gemini, GPT) in developer workspaces. It runs **fully offline** (vendored model + dependencies).

> **Validated on a real corpus.** On a deployed 162-document knowledge base (KBPro) with 15 labeled questions, the semantic retriever reaches **recall@5 = 0.633 / MRR = 0.718**, versus a lexical (grep) baseline of **0.333 / 0.435** — i.e. the retrieval layer roughly **doubles recall** and **+65 % MRR** over "just grep the files". Two data-driven fixes raised the hybrid ranker's MRR from 0.641 to 0.718 (+12 %), and structure-aware chunking beat fixed-window by +7.8 % MRR. Full methodology, tables and charts: [`docs/paper/davasko-llm-wiki.html`](docs/paper/davasko-llm-wiki.html). See §6 below.

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

## 3. Full-Text Search Gaps Policy

To continuously improve the quality and coverage of the knowledge base:
- **Search Gap Definition**: If an AI assistant performs a full-text search (using grep, ripgrep, custom script searches, etc.) because a topic, convention, or code pattern was not directly found in the wiki maps or concepts, this indicates a search gap.
- **Mandatory Documentation**: The AI assistant MUST document its findings before completing the task. This involves adding the description, links, and code symbols to the knowledge base (under the appropriate layer, e.g. `davasko-wiki` or `project-wiki`).
- **Linking Updates**: If the topic already exists but lacked the specific links/details that forced the search, it must be updated with the missing references so future searches can be done directly via the wiki query system.

---

## 4. Directory Layout and Plans Isolation

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

## 5. RAG Vector Search Engine (v3.x)

The framework includes a built-in **Retrieval-Augmented Generation (RAG)** engine powered by [Jina v3 embeddings](https://huggingface.co/jinaai/jina-embeddings-v3) for semantic search across the entire knowledge base.

### Architecture Overview

```mermaid
flowchart LR
    subgraph Indexing ["build-index.js (offline)"]
        A["Scan layers<br/>(wiki.json)"] --> B["Chunk text<br/>(config: index-config.json)"]
        B --> C["Embed chunks<br/>(passage: prefix)"]
        C --> D["One shard per layer<br/>centroid = mean of members"]
        D --> E["Write shards<br/>(sorted by centroid)"]
    end

    subgraph Query ["query-wiki.js (runtime)"]
        F["Parse query"] --> G["Stream A: Symbol match<br/>(instant)"]
        F --> H["Stream B: Semantic search<br/>(query: prefix)"]
        G --> I["Merge + Graph Lift"]
        H --> I
        I --> J["Write .cursor-context-dump.md"]
    end
```

### Search Algorithm

**Hybrid search** combines two parallel streams:

| Stream | Method | Speed | Use Case |
|---|---|---|---|
| **A — Symbolic** | Exact match on `id`, `symbols`, `tags`, `wikilinks` | Instant | C# classes, interfaces, enums |
| **B — Semantic** | Cosine similarity with Jina v3 vectors | 1–2s | Natural language queries (RU/EN) |

**Adaptive threshold** (`threshold_mode` in `system/search-config.json`, default `relative`):

A fixed cosine cutoff is fragile — score distributions shift with model, language and document length, so there is no universal "good" number. The default **relative** mode computes a per-query threshold from that query's own best match:

$$\tau_q = \max\bigl(\text{junk\_floor},\; \alpha \cdot \max_d \text{sim}(q,d)\bigr),\quad \alpha = 0.85,\ \text{junk\_floor} = 0.35$$

This adapts to each query (robust to RU/EN and length) and keeps only a low floor to reject noise. The legacy **absolute** mode (fixed `similarity_threshold` + `similarity_fallback`) is still available via config. Calibrate `α` (relative) or `τ` (absolute) on labeled data with `eval-retrieval.js --sweep` — don't hand-pick a magic number.

**Cluster probing (IVF multi-probe)**: Stream B ranks clusters by their centroid and scans the `nprobe` nearest (default `8`). When `nprobe ≥ cluster count` (the small-corpus case) the search is **exhaustive** — zero recall loss. `nprobe` trades recall for speed only on large corpora and is meant to be calibrated on labeled data via `system/scripts/eval-retrieval.js`.

**Graph Lift** (+1 step): For exact matches, the engine also returns:
- Parent document via `extends` field
- Referenced documents via `[[WikiLinks]]` in the body

All retrieval constants (`similarity_threshold`, `similarity_fallback`, `top_k_documents`, `nprobe`, `ground_truth_boost`) live in `system/search-config.json`, **not** hardcoded.

### Jina v3 Asymmetric Prefixes

The model uses **asymmetric prefixing** for optimal retrieval:
- **Indexing**: `passage: <chunk text>` — used when embedding document chunks
- **Querying**: `query: <search phrase>` — used when embedding the search query

### Model & Vector Specs

| Parameter | Value |
|---|---|
| Model | `jinaai/jina-embeddings-v3` |
| Precision | FP16 |
| Vector dimensions | 1024 |
| Chunking | structure-aware by default (`chunk_strategy: structural`): splits on Markdown headings/paragraphs, keeps code blocks atomic, adds heading breadcrumbs, size kept within `[chunk_min_words, chunk_max_words]`. `fixed` (word-window + overlap) still available |
| Chunk size | target 250 words (configurable, `system/index-config.json`) |
| Code in embeddings | on by default (`index_code`); set `false` to strip code blocks |
| Storage | one JSON shard per layer in `system/index-shards/` (gitignored) |

### Core Context Protocol (CCP)

AI agents should follow this protocol before answering questions:

```bash
# 1. Search the knowledge base
node system/query-wiki.js --query "CowController, blend tree optimization"

# 2. Read the context dump
cat .cursor-context-dump.md

# 3. Use retrieved documents as grounded context
```

The context dump file (`.cursor-context-dump.md`) is limited to **120KB** and only a short status line is sent to stdout to prevent IDE buffer overflow.

---

## 6. Evaluation & Results (measured, not assumed)

Retrieval quality is **measured**, not asserted. `system/scripts/eval-retrieval.js` runs a labeled query set through several retrievers and reports **recall@k / MRR / nDCG@k**, including a `lexical` (grep-like) baseline that answers the only question that matters: *does the RAG layer beat just reading the files?*

**Result on a real deployed corpus** (KBPro, 162 docs across 2 layers, 15 labeled questions, top-k = 5):

| Retriever | recall@5 | MRR | nDCG@5 |
|---|---|---|---|
| **semantic (this engine)** | **0.633** | **0.718** | **0.626** |
| hybrid (symbols + semantic) | 0.633 | 0.718 | 0.626 |
| lexical (grep baseline) | 0.333 | 0.435 | 0.303 |

The retrieval layer roughly **doubles recall** and improves first-hit ranking by **+65 % MRR** over a lexical baseline — empirical justification for the engine's existence.

**Data-driven refinements** (each measured before/after on the same corpus):

| Change | hybrid MRR |
|---|---|
| baseline (strict "symbols first" merge) | 0.641 |
| → unified score-based ranking | 0.685 |
| → drop generic acronyms (JSON/API) from symbol matching | **0.718** |

**Chunking A/B** (structure-aware vs fixed word-window, same corpus): MRR **0.718 vs 0.666 (+7.8 %)**, nDCG +7 %, equal recall — structure-aware chunking wins.

**Reproduce it:**
```bash
node system/build-index.js --force                 # build the index (offline)
node system/scripts/eval-retrieval.js              # recall@k / MRR / nDCG + baselines
node system/scripts/eval-retrieval.js --sweep      # calibrate the threshold on data
npm test                                           # 32 unit tests of the retrieval core
```

Full write-up — method, dataset, all tables, charts, threat-to-validity — is the bundled scientific report: [`docs/paper/davasko-llm-wiki.html`](docs/paper/davasko-llm-wiki.html).

**Speed.** Embedding runs on **GPU via DirectML when available** (auto-detected, CPU fallback) — measured **8× faster** than CPU (cosine parity 0.999984); CPU-side batching adds a further ~11 %. Set `device` in `system/index-config.json` / `search-config.json` (`auto` by default).

> Honest caveats: n = 15 questions (small); cluster routing is layer-coarse; without a GPU, CPU indexing is slow. These are documented, not hidden — see the report's *Limitations* section.

---

## 7. System Scripts & Commands

The framework includes automation tools in the `system/` directory:

```mermaid
sequenceDiagram
    participant User
    participant NewData as Incoming Buffer (NewData/)
    participant Script as Ingest Script (ingest-newdata.js)
    participant Raw as Immutable Layer (raw/)
    participant Wiki as Derived Wiki Page (wiki/)
    participant Index as index.md

    User->>NewData: Drop raw documentation file
    User->>Script: Run node system/scripts/ingest-newdata.js
    Script->>Raw: Move file, convert to UTF-8 BOM, create .meta
    Script->>Wiki: Generate source summary in wiki/sources/
    Script->>Index: Update local index.md
    Script->>Script: Run system/scripts/lint-wiki.js validator
```

### RAG Engine Scripts

| Command | Description |
|---|---|
| `node system/build-index.js` | Build/update vector index (incremental, MD5 cache) |
| `node system/build-index.js --force` | Full index rebuild (ignores MD5 cache) |
| `node system/query-wiki.js --query "..."` | Hybrid search → `.cursor-context-dump.md` |
| `node system/scripts/setup-model.js` | Download Jina v3 model to `system/models-cache/` |
| `node system/scripts/pack-deps.js` | Pack all npm dependencies into `system/vendor/` |

### Maintenance Scripts

| Command | Description |
|---|---|
| `node system/sync-ai-rules.js` | Sync IDE rules and compile skill adapters |
| `node system/scripts/lint-wiki.js` | Validate wiki pages (frontmatter, links, BOM) |
| `node system/scripts/validate-links.js` | Check all wiki and markdown links |
| `node system/scripts/query-wiki.js` | Legacy page lookup and single-file ingestion |
| `node system/scripts/ingest-newdata.js` | Process `NewData/` incoming folder |
| `node system/scripts/update-links.js` | Safe path migration (DEPRECATED) |
| `node system/scripts/check-sources.js` | Citation sanity check (cited source files exist); not a quality metric |
| `node system/scripts/eval-retrieval.js` | Retrieval quality: recall@k/MRR/nDCG vs flat & grep baselines |
| `npm test` | Unit tests for the retrieval core (cosine, multi-probe, threshold, frontmatter, metrics) — no model required |

---

## 8. How to Deploy the LLM Wiki in a New Workspace

Follow these steps to initialize the DavASko LLM Wiki in any project:

### Step 1: Clone Submodule
1. Add this repository as a submodule named `davasko-ai-docs` in your project repository:
   ```bash
   git submodule add <repo-url> Assets/DavASko/davasko-ai-docs
   ```

### Step 2: Install Dependencies
1. Install Node.js dependencies (uses offline `.tgz` from `system/vendor/`):
   ```bash
   npm install
   ```
2. Download the Jina v3 embedding model (one-time, requires internet):
   ```bash
   node system/scripts/setup-model.js
   ```

### Step 3: Initialize Layers and Plans
1. Create directories for your layers (e.g. `llm-wiki/`, `engine-wiki/`, `framework-wiki/`, and project-specific layers).
2. Create a `plans/` directory in the workspace root.
3. Add a `wiki.json` manifest to each layer to define its dependency chain.
4. In each layer, create the basic folder structures and write initial placeholder lists:
   - wiki/index.md
   - wiki/stubs.md
   - wiki/contradictions.md

### Step 4: Build the Search Index
Build the vector index for semantic search:
```bash
node system/build-index.js
```

### Step 5: Install AI Skills
You can install the portable skills from this repository either project-locally or globally:

#### Option A: Project-Local Installation (Recommended)
Copy the skills you want to use from the `skills/` directory of this repository into your layer's `raw/ai-skills~/` folder:
- `llm-wiki/raw/ai-skills~/davasko-llm-wiki/`
- `llm-wiki/raw/ai-skills~/davasko-wiki-search/`
- `llm-wiki/raw/ai-skills~/davasko-wiki-ingest/`
- `llm-wiki/raw/ai-skills~/davasko-youtube-researcher/`

Run the synchronizer to deploy rules and compile skill adapters for your IDE:
```bash
node system/sync-ai-rules.js
```

#### Option B: Global Installation
You can synchronize the skills globally to your system's global AI configurations directory (`~/.gemini/config/skills/`) by running the synchronizer with the `--global` flag:
```bash
node system/sync-ai-rules.js --global
```

This makes the skill globally available to all projects on this machine.

### Step 6: Verify the Setup
Validate the database setup and run regression tests:
```bash
node system/scripts/lint-wiki.js
node system/scripts/validate-links.js
node system/scripts/check-sources.js
```

Test the search engine:
```bash
node system/query-wiki.js --query "test query"
cat .cursor-context-dump.md
```

If the validation passes with **0 errors**, your workspace is fully prepared for structured AI collaboration!

