# 📚 DavASko LLM Wiki

**A knowledge base that AI agents can actually search — fully offline.**

🌐 **English** · [Русская версия](README.ru.md)

DavASko LLM Wiki turns your project's scattered docs, code notes, and transcripts into a **structured, layered knowledge base** with a built‑in **hybrid search engine** (keywords + meaning). AI coding agents (Claude, Gemini, GPT) query it *before* answering, so they reason from your real project knowledge instead of guessing.

It runs **100% offline** — the embedding model and all dependencies are vendored.

> ### ✅ It's measured, not promised
> On a real 162‑document knowledge base with 15 labeled questions, semantic search reaches **recall@5 = 0.633 / MRR = 0.718**, vs a plain "grep the files" baseline of **0.333 / 0.435**. In plain words: the search layer **finds ~2× more** of the right pages and ranks the first correct hit **+65% higher** than just searching text. Full method, tables & charts: [`docs/paper/davasko-llm-wiki.html`](docs/paper/davasko-llm-wiki.html).

---

## 🧭 Table of contents

1. [What is this, in one picture](#1--what-is-this-in-one-picture)
2. [Why it exists](#2--why-it-exists)
3. [Core idea: layers](#3--core-idea-layers)
4. [`wiki/` vs `raw/`: derived vs truth](#4--wiki-vs-raw-derived-vs-truth)
5. [One shared model, many knowledge bases](#5--one-shared-model-many-knowledge-bases)
6. [✍️ Writing knowledge (the ingest pipeline)](#6-️-writing-knowledge-the-ingest-pipeline)
7. [🔎 Reading knowledge (the search pipeline)](#7--reading-knowledge-the-search-pipeline)
8. [🧩 The skills — what each one does](#8--the-skills--what-each-one-does)
9. [🚀 Deploy a knowledge base (2 ways)](#9--deploy-a-knowledge-base-2-ways)
10. [⌨️ Command cheat‑sheet](#10-️-command-cheatsheet)
11. [📊 Evaluation & results](#11--evaluation--results)
12. [📐 Data standards](#12--data-standards)
13. [🗂️ Repository layout](#13-️-repository-layout)

---

## 1. 🖼️ What is this, in one picture

Think of it as a **librarian for your AI agent**. You put knowledge in; the agent asks questions; the librarian hands back exactly the right pages.

```mermaid
flowchart LR
    subgraph YOU["👤 You / your team"]
        SRC["📄 Docs, code notes,<br/>GDDs, YouTube talks"]
    end
    subgraph KB["📚 Knowledge Base (per project)"]
        RAW["raw/ — original sources<br/>(the truth)"]
        WIKI["wiki/ — short AI summaries<br/>(the index)"]
        IDX["🔢 Vector index"]
    end
    MODEL["🧠 Shared embedding model<br/>(one copy on the machine)"]
    subgraph AGENT["🤖 AI agent (Claude / Gemini / GPT)"]
        Q["Question"]
        A["Grounded answer<br/>+ citations"]
    end

    SRC -->|ingest| RAW --> WIKI --> IDX
    MODEL -. vectorizes .-> IDX
    Q -->|hybrid search| IDX --> A
```

**The three moving parts:**

| Part | Plain meaning |
|---|---|
| 📚 **Knowledge base** | Your project's facts, organized into folders called *layers*. |
| 🧠 **Embedding model** | Turns text into numbers ("vectors") so the computer can find *meaning*, not just exact words. Installed **once per machine**, shared by every KB. |
| 🔎 **Search engine** | Given a question, returns the most relevant pages — by keyword **and** by meaning. |

---

## 2. 🤔 Why it exists

An AI agent without grounding **guesses**. The common alternative — let it `grep` your files — is weak: grep only finds exact words, misses synonyms, and floods the agent with noise.

This project asks the only honest question: **is a real search layer actually better than grep?** The answer, measured on a real corpus, is yes:

```mermaid
xychart-beta
    title "Recall@5 — how much of the right knowledge is found"
    x-axis ["grep baseline", "this engine"]
    y-axis "Recall@5 (higher = better)" 0 --> 1
    bar [0.333, 0.633]
```

Roughly **double the recall**. See [§11](#11--evaluation--results) for the full numbers.

---

## 3. 🧱 Core idea: layers

Knowledge is split into **layers** — independent folders, each a self‑contained slice. A layer may **depend on** lower layers (and reuse their pages), but never the other way around. This keeps general rules separate from project specifics.

```mermaid
graph TD
    P1["🎮 project-a-wiki<br/>(game A docs)"] --> F
    P2["🎮 project-b-wiki<br/>(game B docs)"] --> F
    F["🧩 framework-wiki<br/>(your code conventions)"] --> E
    E["⚙️ engine-wiki<br/>(Unity / engine rules)"] --> L
    L["🌐 llm-wiki<br/>(universal AI rules + tooling)"]

    classDef base fill:#eef5ff,stroke:#5b8def;
    class L base;
```

- Arrows mean **"depends on / can read from"**. Dependencies flow **strictly downward** — no cycles.
- Each layer carries a manifest `wiki.json`:

```json
{ "name": "project-a-wiki", "dependencies": ["framework-wiki", "engine-wiki", "llm-wiki"] }
```

**Conflict rule:** if the same topic exists in two layers, the **more specific** (closer‑to‑the‑project) layer wins. The agent should warn you about the duplicate and let you override. Order of priority:

```
project layer  >  framework layer  >  engine layer  >  llm-wiki (base)
```

---

## 4. 📂 `wiki/` vs `raw/`: derived vs truth

Every layer has two halves. This split is the heart of the system.

```mermaid
flowchart LR
    subgraph LAYER["one layer"]
        direction TB
        RAW["📦 raw/ — SOURCE OF TRUTH<br/>original files, never edited<br/>(code dumps, GDDs, transcripts)"]
        WIKI["📝 wiki/ — DERIVED<br/>short curated pages that<br/>summarize & link the raw"]
    end
    RAW -->|"summarized into"| WIKI
    RAW -. "provenance hash" .-> WIKI
```

| | `raw/` | `wiki/` |
|---|---|---|
| **Role** | Ground truth | Human/AI‑friendly summary & map |
| **Edited?** | No (immutable snapshots) | Yes (curated) |
| **If they disagree** | `raw/` wins | flagged as possibly stale |

Each wiki page stores a **content hash** of the sources it cites. When a source changes, `check-staleness.js` flags the derived page as out‑of‑date — drift becomes *detectable*, not silent.

Inside `wiki/`, pages are typed: `concepts/`, `entities/`, `runbooks/`, `sources/`, `syntheses/`, `decisions/`, plus three special pages per layer: `index.md` (table of contents), `stubs.md` (planned pages), `contradictions.md` (open conflicts).

---

## 5. 🧠 One shared model, many knowledge bases

The embedding model is ~**1.1 GB**. Copying it into every knowledge base would waste gigabytes. Instead it's installed **once** into a system location, and a small **marker file** tells every KB where to find it.

```mermaid
flowchart TD
    subgraph SYS["💽 System location (per machine)"]
        M["🧠 model (1.1 GB)<br/>in the system models-cache"]
        MARK["🏷️ marker: config.json<br/>(points to the model)"]
    end
    KB1["📚 KB #1"] -->|reads marker| MARK
    KB2["📚 KB #2"] -->|reads marker| MARK
    KB3["📚 KB #3"] -->|reads marker| MARK
    MARK --> M
```

**How a KB finds the model** (`system/lib/model-locator.js`), first match wins:

```mermaid
flowchart LR
    A["env var<br/>DAVASKO_LLM_WIKI_MODELS"] --> B["🏷️ system marker<br/>config.json"] --> C["repo‑local fallback<br/>system/models-cache"] --> D["❌ not found →<br/>ask where to install"]
```

- **Default location:** Windows `%LOCALAPPDATA%\DavASkoLLMWiki\models-cache`, Linux/macOS `~/.davasko-llm-wiki/models-cache`.
- `setup-model.js` installs the model there (copying the bundled source offline, or downloading) and writes the marker. If nothing is found, the deploy **asks you** where to put it.

---

## 6. ✍️ Writing knowledge (the ingest pipeline)

You drop files into `NewData/<layer>/…`, run one command, and the pipeline does the rest — **ending with vectorization**, so the new knowledge is instantly searchable.

```mermaid
flowchart TD
    START(["📥 Put file in<br/>NewData/&lt;layer&gt;/sub/doc.md"]) --> RUN["▶️ node system/scripts/ingest-newdata.js"]
    RUN --> S1["1️⃣ Move → &lt;layer&gt;/raw/sub/doc.md<br/>(re‑encode as UTF‑8 + BOM)"]
    S1 --> S2["2️⃣ Auto‑create wiki summary STUB<br/>&lt;layer&gt;/wiki/sources/doc.md (+ .meta)"]
    S2 --> S3["3️⃣ Delete NewData/, run linter"]
    S3 --> S4["4️⃣ 🔢 build-index — VECTORIZE"]
    S4 --> DONE(["🔎 Searchable"])
    S2 -.->|"⚠️ stub fails lint until you complete it"| FIX["✅ Fill Key Claims + related,<br/>then re‑lint & re‑index"]
```

> ⚠️ **Important:** step 2 creates a *stub* summary (`related: []`, "No claims extracted") that **fails the linter on purpose**. You must fill in real **Key Claims** (each citing the raw source) and a non‑empty **related** list. This is what the **davasko-wiki-ingest** skill walks you through.

### ⚙️ Indexer v4.x with Checkpoints, Bidirectional Overlap and Safe Late Chunking (`build-index.js`)

The indexer is engineered for high reliability and deep context preservation when indexing enterprise-grade knowledge bases:

* **Chunking Profile v4 (Bidirectional Overlap & Hierarchy Breadcrumbs):**
  - Structural chunks target 200 words with a 300-word ceiling.
  - **Bidirectional context window:** Each chunk boundary incorporates 32 words of context from the preceding chunk (`[Контекст предыдущего фрагмента: ...]`) and 32 words of context from the succeeding chunk (`[Контекст следующего фрагмента: ...]`), ensuring zero information loss across split boundaries.
  - **Entity / Tab breadcrumbs:** Nested hierarchy metadata (`[parent_tab > tab_name]`) is prefixed directly into embedding inputs to preserve parent document semantics.
* **Automatic Checkpoints every 20 documents:** Every 20 processed documents (`CHECKPOINT_INTERVAL = 20`), the accumulated embedding batch is atomically committed to LanceDB, the empty document cache is saved, and progress is recorded to `EMBEDDING_MANIFEST_FILE` with status `in_progress`. If the indexing run is interrupted (by user, power loss, or network timeout), subsequent runs **resume directly from the last checkpoint** instead of re-embedding from scratch.
* **Manifest Status Lifecycle:** Starts with status `in_progress` and timestamp. Upon successful completion, status is updated to `complete`.
* **Auto-switch to `--force`:** If embedding model profile or chunking strategy changes, or an incomplete index is detected, the system automatically switches to full rebuild mode.
* **Safe Late Chunking (`late_chunk_max_words: 6000`):** Documents up to 6000 words are embedded as single sequences for maximal context retention. Documents exceeding this threshold automatically route to the chunked batch pathway, preventing GPU memory crashes (DirectML / CUDA OOM).
* **Ollama Embedding Batching:** Requests to local Ollama API are batched in groups of 8 chunks (`BATCH_SIZE = 8`) with a 300-second timeout.
* **No File Size Restrictions:** `max_raw_file_bytes: 0` ensures no large raw sources are skipped.

---

## 7. 🔎 Reading knowledge (the search pipeline)

One command searches by **keyword and meaning at the same time**, then writes the best pages to a context file the agent reads. The entire process is orchestrated by a **LangGraph Control Plane**, which provides strict state typing, contract validation, and selects the optimal tool via the **Query Router**.

```mermaid
flowchart TD
    Q(["❓ node system/query-wiki.js --auto '...'"]) --> VAL["🛡️ Validate Request<br/>(Contracts & Limits)"]
    VAL --> ROUTER{"🧠 Query Router<br/>(Local LLM)"}
    
    ROUTER -->|Code relations,<br/>Dependencies| G["🕸️ Graphify<br/>(AST Call Graph)"]
    ROUTER -->|Deep synthesis,<br/>Architecture| RLM["🤖 RLM Agent<br/>(Deep Research)"]
    ROUTER -->|Fact lookup,<br/>Guides| RAG["🗂️ Jina RAG<br/>(Hybrid Search, Worker Thread)"]

    RAG --> P["Parse query →<br/>symbols + meaning"]
    P --> A["🅰️ Stream A — Symbols<br/>(instant, exact match)"]
    P --> B["🅱️ Stream B — Semantic<br/>(vector similarity)"]
    A & B --> MERGE["🔗 Merge, Graph Lift &<br/>Image Path Normalization"]

    MERGE & RLM --> J1{"⚖️ Judge Initial<br/>(Score ≥ 7?)"}
    J1 -->|Yes| NORM["✨ Normalize Response<br/>(<document> XML Wrapping)"]
    J1 -->|No| FB["🔄 Fallback Tier<br/>(RAG ↔ RLM)"]
    FB --> J2{"⚖️ Judge Fallback<br/>(Score ≥ 7?)"}
    J2 -->|Yes| NORM
    J2 -->|No| CMP1["🔀 Compare Answers<br/>(Pick Best A/B)"]
    CMP1 --> GREP["🔎 Grep Search Fallback<br/>(Text Match Tier)"]
    GREP --> J3{"⚖️ Judge Grep<br/>(Score ≥ 7?)"}
    J3 -->|Yes| NORM
    J3 -->|No| CMP2["🔀 Compare Final<br/>(Best Result)"]
    CMP2 --> NORM
    G --> NORM

    NORM --> DUMP(["📝 .cursor-context-dump.md<br/>(Agent Context)"])
```

**The Search & Control Plane Architecture:**
1. **LangGraph Query Supervisor:** Orchestrates multi-tier retrieval, fallbacks, and quality evaluation:
   - **Validation Node:** Strict input contract checks and resource limits via `orchestration/contracts.js`.
   - **Route Selection:** Intelligent tool assignment (`RAG`, `RLM`, `GRAPHIFY`) via `Query Router`.
   - **LLM-Judge Evaluation:** Evaluates candidate answers against a threshold score $\ge 7$.
   - **Fallback Tier (RAG $\leftrightarrow$ RLM):** If the primary route yields insufficient confidence, automatically triggers the alternate retrieval strategy.
   - **Comparator Nodes (`compare_answers`, `compare_final`):** If no candidate achieves $\ge 7$, an LLM comparator compares candidates side-by-side and selects the highest-fidelity response.
   - **Grep Fallback Tier:** If both semantic pathways fail, falls back to deterministic full-text search (`execute_grep_search`).
   - **Prompt Injection Defense:** All retrieved documents are sanitized and wrapped in strict `<document>` XML tags (`wrapDocumentXml`), neutralizing hostile prompt injection attempts in raw docs.
   - **SQLite WAL Checkpointer:** Graph execution states and traces are persisted to SQLite in WAL mode (`orchestration/checkpointer.js`), supporting execution resumes and audit logging.
   - **Worker Thread Isolation:** Compute-heavy research sub-graphs run in dedicated Node.js Worker Threads with periodic Heartbeat logging every 5 seconds.

2. **The Three Search Paths:**
   - **RAG (Hybrid Search):** Fast semantic + symbolic search using the Jina vector model. Safely executed in isolated Worker Threads. **Image Path Normalization** automatically resolves relative image links to absolute ones against the layer root, preventing filename collisions across different projects.
   - **RLM (Research Language Model):** Deep research agent. Best for complex, multi-hop architectural questions. Uses a local LLM (like Ollama) to read, synthesize, and explore the wiki iteratively.
   - **Graphify:** Codebase knowledge graph. Best for resolving C# class inheritance, component dependencies, and method call chains directly from the AST.

3. **Why two streams in RAG?** Code identifiers (`CowController`) need exact matching; natural‑language questions ("how does physics tuning work?") need meaning. Hybrid search does both and ranks them on one scale.
**Adaptive threshold** keeps only strong matches scoring at least $\tau_q = \max(\text{junk\_floor}, \alpha \cdot \text{top\_score})$.

### ⚡ Resident Search Server (`system/search-server.js`)
For seamless integration with IDEs (Cursor, VS Code), AI agents, and external chat servers (Mattermost, Slack), DavASko LLM Wiki includes a resident search server. It retains LanceDB tables, ONNX runtimes, and vector caches resident in memory, communicating via JSON-RPC/NDJSON over `stdin`/`stdout`.
- Eliminates the ~8s cold-start overhead per process invocation down to **~1.5 seconds** per query!
- Pre-warms embedding models (`warmUp()`) upon initial server startup.
- Safe serialization: diagnostical output is isolated to `stderr`, keeping `stdout` strictly clean for protocol data.

### 🧙‍♂️ Knowledge Base Setup Wizard (`system/scripts/setup-knowledge-base.js`)
An interactive CLI setup tool to:
* Auto-detect or clone the shared knowledge base repository on the machine.
* Configure the `KBPRO_AI_CHAT_WIKI_DIR` environment variable persistently.
* Self-test retrieval and trigger auto-healing (dependency install, vector model init, index compilation).
* Support local project override markers (`.davasko-local-kb` / `.kbpro-local-kb`) to isolate project-specific submodules from global host profiles.

---

## 8. 🧩 The skills — what each one does

Skills are portable instruction packs (`skills/`) that teach any AI agent how to operate the KB. They sync into Cursor, Claude Code, Windsurf, Cline/Roo, Gemini, Copilot.

```mermaid
mindmap
  root((DavASko<br/>skills))
    🚀 davasko-llm-wiki
      deploy & maintain a KB
    ✍️ davasko-wiki-ingest
      add knowledge correctly
    🔎 davasko-wiki-search
      query the KB
    ♻️ davasko-wiki-refresh
      fix stale pages
    ▶️ davasko-youtube-researcher
      YouTube → knowledge
```

| Skill | What it's for | When to use it |
|---|---|---|
| 🚀 **davasko-llm-wiki** | **Deploy & maintain** a knowledge base: scaffold layers, install the shared model + marker, install rules, install skills, set up the test/validation environment. | "Set up / deploy the wiki here", growing the structure. |
| ✍️ **davasko-wiki-ingest** | **Add knowledge** through the exact pipeline (raw placement → auto‑summary → lint → vectorize) and bring the auto‑summary up to standard. | Importing any new source document. |
| 🔎 **davasko-wiki-search** | **Read knowledge**: run a hybrid query and hand the agent the right context. | Before answering any question about the project. |
| ♻️ **davasko-wiki-refresh** | **Actualize** wiki pages that `check-staleness.js` flags because their cited sources changed. | After raw sources change. |
| ▶️ **davasko-youtube-researcher** | **YouTube → knowledge**: pull a transcript, write structured notes, and hand them to the ingest pipeline. | Turning a video/lecture into KB pages. |

---

## 9. 🚀 Deploy a knowledge base (2 ways)

> 🛑 **CRITICAL FOR AI AGENTS:**
> 1. NEVER deploy the wiki by running `git clone` directly into the destination folder.
> 2. ALWAYS deploy locally using the script `node system/scripts/deploy-wiki.js --target <path>` or via the `davasko-llm-wiki` skill.
> 3. If given a remote Git URL and no local source exists, clone ONLY into a temporary scratch directory (`<appDataDir>/brain/<conversation-id>/scratch/repo_temp`), run `deploy-wiki.js --target <path>` from there, and immediately delete the scratch directory.


A full deploy always does the **same five things**:

```mermaid
flowchart LR
    D1["1️⃣ Scaffold KB<br/>layers + plans/ + NewData/"] --> D2["2️⃣ Install shared model<br/>+ marker"] --> D3["3️⃣ Install rules<br/>(CCP)"] --> D4["4️⃣ Install skills"] --> D5["5️⃣ Test environment<br/>+ validation"]
```

### 🅰️ Way A — one command (the script)

Best when you just want it done. From this repo:

```bash
node system/scripts/deploy-wiki.js --target ../my-kb --layers llm-wiki,project-a-wiki
```

It scaffolds the layers (with base pages + Unity `.meta`), copies the engine, runs an **offline** `npm install`, installs the **shared model + marker**, seeds the rules, syncs IDE adapters, and runs `npm test` + lint + `build-index`. A fresh deploy is **lint‑clean**.

| Flag | Meaning |
|---|---|
| `--target <path>` | **(required)** where to deploy |
| `--layers a,b,c` | layers to create (default `llm-wiki`; it's always the base) |
| `--model-dir <path>` | custom system location for the shared model |
| `--no-model` / `--no-install` / `--no-index` | skip heavy steps (reuse existing model, etc.) |
| `--force` | write into a non‑empty folder |

> 🛡️ **Your existing files are safe.** If the target already has a `CLAUDE.md` / `AGENTS.md`, the deploy **appends** its rules in a managed block — your content is preserved, never overwritten.

### 🅱️ Way B — via the skill (conversational)

Best when you want the agent to tailor the layers to your project. Just ask:

> *"Deploy the DavASko LLM Wiki into `./my-kb` with a layer for project A."*

The **davasko-llm-wiki** skill performs the same five functions, inspecting your workspace to choose sensible layers.

---

## 10. ⌨️ Command cheat‑sheet

```mermaid
flowchart LR
    subgraph Setup
        sm["setup-model.js<br/>🧠 install shared model"]
        dw["deploy-wiki.js<br/>🚀 full deploy"]
    end
    subgraph Write
        ing["ingest-newdata.js<br/>✍️ add + vectorize"]
        bi["build-index.js<br/>🔢 re‑vectorize"]
    end
    subgraph Read
        qw["query-wiki.js<br/>🔎 search"]
    end
    subgraph Check
        lint["lint-wiki.js"]
        vl["validate-links.js"]
        ev["eval-retrieval.js"]
        t["npm test"]
    end
```

| Command | What it does |
|---|---|
| `node system/scripts/deploy-wiki.js --target <p>` | **One‑command full deploy** (scaffold + model + rules + skills + tests). |
| `node system/scripts/setup-model.js` | Install the shared model into the system location + configure RLM backend. |
| `node system/scripts/setup-local-llm.js` | Install and configure local Ollama for RLM and Query Routing. |
| `node system/scripts/ingest-newdata.js` | Run the **write pipeline**: place sources, lint, **vectorize**. |
| `node system/build-index.js [--force]` | Build / rebuild the vector index (incremental by default). |
| `node system/query-wiki.js --auto "..." [--locations <paths>] [--top-k <num>]` | **Smart Routed Search** (LangGraph Supervisor: validates, routes to RAG/RLM/Graphify, LLM-Judge score $\ge 7$, RAG $\leftrightarrow$ RLM fallback, A/B comparator, Grep fallback) → `.cursor-context-dump.md`. |
| `node system/query-wiki.js --query "..." [--locations <paths>] [--top-k <num>]` | Manual **Hybrid search** (RAG only) with optional layer and top-k filtering. |
| `node system/query-wiki.js --rlm "..."` | Manual **Deep Research** (RLM agent). |
| `node system/sync-ai-rules.js [--global]` | Sync IDE rules (append‑safe) + compile skill adapters. |
| `node system/scripts/lint-wiki.js` | Validate encoding, frontmatter, links (must be **0 errors**). |
| `node system/scripts/validate-links.js` | Check every `[[wiki link]]` and file link. |
| `node system/search-server.js` | Start resident JSON-RPC / NDJSON search server (~1.5s latency). |
| `node system/scripts/setup-knowledge-base.js` | Interactive setup wizard for knowledge base environment and paths. |
| `node system/scripts/check-staleness.js` | Detect wiki pages whose cited sources changed. |
| `node system/scripts/eval-retrieval.js [--sweep]` | Measure retrieval quality (recall@k / MRR / nDCG) vs baselines. |
| `npm test` | **42 unit tests** of the retrieval core, chunking, graphify, and orchestration (no model needed). |

---

## 10.1. Current index compatibility contract

- `node system/build-index.js` is incremental: it re-embeds only new, changed, or removed source documents.
- Chunking profile **v4** is part of the LanceDB format: structural chunks target 200 words, have a 300-word upper bound, carry bidirectional context (32 words backward context `[Контекст предыдущего фрагмента: ...]` and 32 words forward context `[Контекст следующего фрагмента: ...]`), and include document hierarchy breadcrumbs `[parent_tab > tab_name]`.
- Changing a chunking or embedding profile requires the deliberate `node system/build-index.js --force`; an ordinary incremental run must not mix vectors created by different profiles.
- A valid layer has `wiki.json` and at least one content directory: `wiki/` or `raw/`. Raw-only layers are indexed deliberately because Git omits empty `wiki/` directories.
- **Fault-Tolerant Indexing:** Indexer v4.x writes checkpoints every 20 documents. The `in_progress` manifest ensures configuration validity and enables incremental completion after interruption.
- **Late Chunking & Memory Safety:** The `late_chunk_max_words` parameter (default 6000) provides safe batching fallback to prevent GPU VRAM OOM errors.
- **Unlimited Raw File Size:** By default `max_raw_file_bytes: 0` — all raw/ source documents are indexed without skipping.
- Run `node system/scripts/audit-chunks.js --json` after a full rebuild to inspect chunk counts, overlap coverage, forced boundaries, and unusually large documents.

The detailed profile and migration rules are in [docs/2026-08-12-chunking-profile.md](docs/2026-08-12-chunking-profile.md).

---

## 11. 📊 Evaluation & results

Quality is **measured**, not asserted. `eval-retrieval.js` runs a labeled query set through several retrievers — including a `lexical` (grep‑like) baseline — and reports recall@k / MRR / nDCG.

**Real corpus** (162 docs, 15 labeled questions, top‑k = 5):

| Retriever | recall@5 | MRR | nDCG@5 |
|---|---|---|---|
| **semantic (this engine)** | **0.633** | **0.718** | **0.626** |
| hybrid (symbols + semantic) | 0.633 | 0.718 | 0.626 |
| lexical (grep baseline) | 0.333 | 0.435 | 0.303 |

**Data‑driven refinements** (measured before/after on the same corpus):

| Change | hybrid MRR |
|---|---|
| baseline (strict "symbols first") | 0.641 |
| → unified score‑based ranking | 0.685 |
| → drop generic acronyms (JSON/API) from symbol matching | **0.718** |

Structure‑aware chunking beat fixed‑window by **+7.8% MRR** at equal recall. Embedding runs on **GPU via DirectML** when available — measured **8× faster** than CPU (cosine parity 0.999984).

```bash
node system/build-index.js --force            # build the index (offline)
node system/scripts/eval-retrieval.js         # recall@k / MRR / nDCG + baselines
node system/scripts/eval-retrieval.js --sweep # calibrate the threshold on data
```

> **Honest caveats:** n = 15 questions is small; cluster routing is layer‑coarse; CPU indexing is slow without a GPU. Documented, not hidden — see the report's *Limitations* section.

Full write‑up (method, dataset, charts, threats to validity): [`docs/paper/davasko-llm-wiki.html`](docs/paper/davasko-llm-wiki.html).

---

## 12. 📐 Data standards

A few hard rules keep the KB machine‑readable (the linter enforces them):

- **Encoding:** `.md` → UTF‑8 **with BOM**; `.json` / `.js` / rules → UTF‑8 **without BOM** (a BOM breaks `JSON.parse`).
- **Frontmatter** (every wiki page): `title`, `type`, `status`, `sources`, `last_updated`, **non‑empty** `related`.
- **Links:** Obsidian‑style `[[page-name]]`, resolvable within the layer's dependency chain.
- **Plans** live in the root `plans/` folder — never inside a layer, never cited as a wiki source.

---

## 13. 🗂️ Repository layout

```
DavASkoLLMWiki/
├── orchestration/               # LangGraph Control Plane (StateGraph, Supervisor, Evaluators)
│   ├── contracts.js             # state and action contracts, zod schemas
│   ├── checkpointer.js          # SQLite WAL state checkpointer and trace store
│   ├── evaluator.js             # LLM-judge (score >= 7) and A/B candidate comparator
│   └── graphs/
│       ├── query-supervisor.js  # 5-tier query orchestration supervisor graph
│       └── research-worker.js   # isolated research worker thread graph
├── system/                      # engine v4.x
│   ├── build-index.js           # vectorization with checkpoints (batches of 20 docs)
│   ├── query-wiki.js            # hybrid search & supervisor CLI (RAG / RLM / Graphify)
│   ├── query-target.js          # targeted search across specified layers
│   ├── search-server.js         # resident JSON-RPC / NDJSON search server (~1.5s latency)
│   ├── sync-ai-rules.js         # deploy rules/skills to IDEs (append-safe)
│   ├── index-config.json        # chunking (v4 profile), Late Chunking and limit settings
│   ├── search-config.json       # hybrid search weights and thresholds (BM25 + LanceDB)
│   ├── lib/                     # core: embedding-client, chunker (v4), retrieval, wiki-paths...
│   ├── scripts/                 # deploy-wiki, setup-knowledge-base, ingest-newdata, lint-wiki...
│   ├── tests/                   # 42 unit tests covering all core modules and orchestration
│   ├── vendor/                  # offline npm dependencies (.tgz)
│   └── models-cache/            # bundled model SOURCE (copied to system location)
├── skills/                      # the 5 portable skills (sources of truth)
├── docs/                        # documentation, guides, and scientific papers (EN + RU)
├── CLAUDE.md / AGENTS.md        # agent rules (Core Context Protocol)
├── README.md / README.ru.md     # this file
└── LICENSE.md                   # Proprietary EULA
```

---

<p align="center"><sub>© DavASko · Proprietary (<a href="LICENSE.md">EULA</a>) · Fully offline, reproducible · <a href="README.ru.md">Русская версия</a></sub></p>
