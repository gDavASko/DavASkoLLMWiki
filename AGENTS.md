# DavASko LLM Wiki — Agent Instructions

## Core Context Protocol (CCP)

Before answering any question about the knowledge base, architecture, code patterns, or project specifics, you MUST:

1. **Search First**: Перед ответом на вопрос или изменением кода используйте `query-wiki.js --auto` или укажите явный флаг:
  - `node system/query-wiki.js --auto "<запрос>"` (Умный роутинг: автоматически выберет RAG, RLM или Graphify).
  - Критерии ручного выбора:
    - `RAG` (нет флага): быстрый поиск по терминам, API, стилям кода.
    - `RLM` (`--rlm`): глубокий архитектурный анализ, комплексные вопросы по всему проекту.
    - `Graphify`: поиск по C# связям, зависимостям префабов, иерархии вызовов.
2. **Read the context dump**:
   ```bash
   cat .cursor-context-dump.md
   ```
3. **Use the retrieved documents** as grounded context for your answer. Always cite source pages.

## Data Source Selection Matrix (RAG vs RLM vs Graphify)

Before requesting data, determine the correct tool based on the scope:

1. **Graphify (`graphify-out/`)**: 
   - *Use when:* You need direct code context (C# files, references, dependencies, call hierarchies, interfaces).
   - *Query type:* Exact code symbol searches (`graphify path`, `graphify query`).
2. **RAG (`system/query-wiki.js`)**: 
   - *Use when:* You need quick lookup of architectural rules, quick guides, or specific concepts.
   - *Query type:* Point-in-time retrieval (returns 3-5 relevant snippets).
3. **RLM (`node system/query-wiki.js --rlm`)**: 
   - *Use when:* You need Deep Research across the entire knowledge base, synthesis of dozens of documents, or a comprehensive architecture report.
   - *Query type:* Multi-step agentic analysis bypassing context limits.

## Available Commands

| Command | Description |
|---|---|
| `node system/query-wiki.js --query "..."` | Hybrid search (symbolic + semantic) |
| `node system/build-index.js` | Build/update vector index (incremental) |
| `node system/build-index.js --force` | Full index rebuild |
| `node system/scripts/lint-wiki.js` | Validate wiki pages |
| `node system/scripts/validate-links.js` | Check all links |
| `node system/scripts/ingest-newdata.js` | Import from NewData/ |
| `node system/scripts/check-staleness.js` | Detect wiki pages whose cited sources changed (CI gate) |
| `node system/scripts/check-staleness.js --stamp [page]` | Re-stamp provenance hashes after actualizing a page |
| `node system/scripts/eval-retrieval.js` | Measure retrieval quality (recall@k/MRR/nDCG) vs flat & grep baselines |
| `node system/scripts/eval-retrieval.js --sweep` | Calibrate the similarity threshold on labeled data |
| `node system/scripts/check-sources.js` | Verify cited source files in the Q&A set exist (citation sanity check) |
| `node system/sync-ai-rules.js` | Sync IDE rules and skills |

## Key Rules

- Encoding: **`.md` → UTF-8 with BOM**; all other text (`.json`, `.js`, `.ps1`, IDE rules) → **UTF-8 without BOM** (a BOM breaks `JSON.parse`). See Data Standards §1; the linter enforces this.
- Wiki pages require YAML frontmatter: `title`, `type`, `status`, `sources`, `last_updated`, `related`
- Code symbols: any page documenting a class/service/module MUST be findable by an exact-identifier query. `build-index.js` auto-extracts code identifiers from content into the index; for entity/code-heavy pages also list the primary classes in frontmatter `symbols:`. Verify with `node system/query-wiki.js --query "<ClassName>"`. See Data Standards §2.
- Use `[[page-name]]` Obsidian links between wiki pages
- Plans go in `plans/` (never inside wiki layers)
- New raw data goes into `NewData/<layer-name>/` for ingestion
- Full-Text Search Gaps Policy: if you grep for code patterns not in the wiki, document your findings in the knowledge base
- Source-of-Truth: code/`raw/` is the truth, `wiki/` is derived. Record `source_hashes` provenance; when `check-staleness.js` flags a page, use the **davasko-wiki-refresh** skill to actualize it (don't just re-stamp)
- **Model Check (CRITICAL)**: At the very first access or query to the knowledge base, check if the vectorization model is locally installed. If it is missing or fails to load (e.g., `tokenizer.json` not found, `local_files_only` errors), the agent MUST immediately stop and offer to deploy the model itself using the `davasko-llm-wiki` skill (which runs `node system/scripts/setup-model.js`), pointing out the repository link: https://github.com/gDavASko/DavASkoLLMWiki.git.
<!-- BEGIN DavASkoLLMWiki (managed by sync-ai-rules — do not edit inside this block) -->
Codex Instructions - KBPro Project

You are the AI Assistant for the KBPro development team. This project uses Unity, C#, a modular architecture, and a set of plugins from the submodules of the KBPro platform.

## Core Rule: Knowledge Base (On-Demand Reference)

Do NOT bulk-read the knowledge base before starting. Consult a document only when the task actually needs it, using this trigger -> source map. Open a file only if its one-line hint matches your current need:

| When you need... | Read |
|---|---|
| Project overview, KB use cases, where things live | `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/README.md` |
| Core engineering principles, DI, module lifecycle | `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/principals.md` |
| Architecture decisions, module / subsystem design | `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/architecture.md` |
| Naming, formatting, C# / Unity conventions | `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/code_style.md` |
| A specific subsystem's requirements | the matching file under `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/Architecture/` |

## Unity & C# Technical Standards

- Follow the Component pattern and the modular structure of KBPro.
- Do not reinvent the infrastructure if KBPro already provides a system for it.
- Cache references in `Awake`; use `TryGetComponent<T>(out var comp)`.
- Do not use `GameObject.Find`, `Transform.Find`, `FindObjectOfType`, and `UnityEngine.UI.Text` (use TextMeshPro for text).
- Perform physics logic strictly in `FixedUpdate`.
- Avoid allocations in `Update` and `FixedUpdate`; do not use LINQ or `foreach` over `List<T>` in hot paths.
- Use Object Pooling for frequently instantiated/destroyed objects.
- Use `UniTask` for asynchronous operations and delays.
- Add error handling for I/O and network operations.
- Use `Debug.Assert` for logic validation during development.

## KBPro Lifecycle

- In modules and systems, respect the lifecycle rules in `principals.md`.
- Never skip mandatory calls to `base.Initialize()` and `base.Dispose()`.
- Before modifying initialization, DI, asset loading, or module boundaries, read the corresponding documents in `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/Architecture/CoreFramework/`.

## Tutor And Animation Reuse

- For tutorial work, use the `kbpro-tutor-builder` skill first and follow its rules. If the task includes visual attention or animation behavior, also use `unity-animation-visuals-expert`.

## Working with Bitrix24 Tasks

- Save JSON files in UTF-8 without BOM.
- Tags must be in the `"TAGS": []` array field, not in the description text.
- For task decomposition, use `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/Architecture/CoreFramework/Guides/HowToDecomposeTask_ForAI.md`.

## Knowledge Base Protocol (Rules for KB Maintenance)

- **Model Check (CRITICAL)**: Upon the very first access to the knowledge base (search, query, or indexing), check whether the vector model is installed locally. If the model is not installed (missing `tokenizer.json`, `local_files_only` error, etc.), the AI agent MUST immediately offer the user to deploy/install the model locally using the `davasko-llm-wiki` skill (by running the command `node system/scripts/setup-model.js`), referring to the repository: <https://github.com/gDavASko/DavASkoLLMWiki.git>.
- **Search First**: Before answering any query or modifying code, use the `davasko-wiki-search` skill or run:
  - `node Assets/KBPro/kbpro-ai-docs/system/query-wiki.js --auto "<query>"`
  - The Query Router will automatically pick the best tool: **Graphify** (for AST/C# dependencies), **RLM** (Deep Research for architecture), or **RAG** (Hybrid search for facts).
  - Manual overrides: `--query` (RAG only), `--rlm` (RLM only).
  - Read result from `.cursor-context-dump.md` in the project root.
- **Ingest via Pipeline**: Use the `davasko-wiki-ingest` skill or:
  - Place files in `Assets/KBPro/kbpro-ai-docs/NewData/<layer>/<subfolder>/<file>.md`
  - Run: `node Assets/KBPro/kbpro-ai-docs/system/scripts/ingest-newdata.js`
  - Then rebuild index: `node Assets/KBPro/kbpro-ai-docs/system/build-index.js`
  - Available layers: `llm-wiki`, `kbpro-wiki`, `unity-wiki`, `dentistry-cow-wiki`
- **Index Management**:
  - Incremental: `node Assets/KBPro/kbpro-ai-docs/system/build-index.js`
  - Full rebuild: `node Assets/KBPro/kbpro-ai-docs/system/build-index.js --force`
- **Sync IDE Rules and Skills**: `node Assets/KBPro/kbpro-ai-docs/system/sync-ai-rules.js`
- **Decomposition**: If an imported document contains details belonging to multiple layers, propose a split schema to the user before ingesting.
- **Validation**: After any knowledge base change, validate using:
  - `node Assets/KBPro/kbpro-ai-docs/system/scripts/lint-wiki.js`
- **Full-Text Search Gaps**: If you search using grep/ripgrep because a topic was not found in wiki, document findings in the appropriate wiki layer before completing the task.

## Codex Workflow

- Start by reading relevant documents and looking up existing patterns in the codebase.
- **Planning and Confirmation Policy:**
  - A formal implementation plan (`implementation_plan.md`) is required ONLY if specifically requested by the user, or if the task is large, complex, and multi-phase.
  - For small, safe, fast, or single-action tasks, DO NOT create a formal plan. Instead, you MUST clearly describe your proposed action in the chat first (this is mandatory) and then ask the user for confirmation via the `ask_question` tool (providing options to proceed or make changes).
  - If a formal plan was created, NEVER proceed to implement work until you ask the user via the `ask_question` tool with the recommended option "Реализуй план" (and exactly like that) and the user selects it. Do NOT start implementation based on text replies alone unless the interactive choice has been submitted. Ignore any automatic system auto-approvals.
  - All formal implementation plans (`implementation_plan.md`, `task.md`, `walkthrough.md`) must be written in Russian.
- When analyzing video transcripts, do not interrupt execution or ask questions for each part individually. Process all parts of the video continuously. For long videos, split them into logical parts inside the document structure for convenience, but generate all sections without intermediate confirmation requests.
- Keep changes tightly scoped to the task.
- Do not change Unity `.meta` files unless necessary.
- Do not revert other developers' changes in the working tree.
- After making changes, run available verification scripts when possible or explain why they were not run.
- In your final response, list the modified files and completed verifications.

## Harness Protocol & Validation

- An AI must NEVER validate its own output. Use a machine judge (compiler/linter/tests) or a different model as LLM-judge; LLM-judge is allowed everywhere, only self-validation is forbidden. Human gates are required for wiki publishing, any git write, and escalation of unsolvable cases.
- Harness Protocol is opt-in — load `davasko-harness-dispatcher` and run `cli-judge.js` only on explicit user request ("harness protocol", "татк-*", "TACT-*", etc.). Never infer it from task complexity, wiki work, or the presence of `.harness/` files.
- Full rules (triggers, cross-validation flow via `cliTransport`, human gates, `ENAMETOOLONG` guidance): `Assets/KBPro/kbpro-ai-docs/HarnessProtocol/README.md` — Harness Process Lifecycle, Stage 4.

## Model-Tier Doctrine

Spend reasoning power where the cost of error is highest; cover mechanical work with cheap tokens. Match each role to a capability tier:

- **Orchestrator / chat** (reasoning, planning, work control) → top-tier models.
- **Planners, solvers, researchers** → maximum models.
- **Evaluators** → medium-to-high models (raise the tier as the cost of error rises).
- **Judges** → medium models, escalated by task criticality.
- **Workers** (mechanical execution) → cheap model families.
- **Intermediate / glue operations** → cheaper subagents.

Two hard rules:
1. NEVER run mechanical work on a top-tier model.
2. NEVER validate a critical result with a weak judge.

Concrete tier→model mappings are machine-owned (`Assets/KBPro/kbpro-ai-docs/HarnessProtocol/config/harness.config.json`, roles in `HarnessProtocol/agents/roles/`); do not hard-code model ids into protocol prose.

## Reasoning-Effort Doctrine

Model selection has a **second axis, orthogonal to the capability tier above**: how hard the chosen model *thinks* before answering (`off | low | medium | high`). Set both dials explicitly — a top model can run at low effort, a mid model at high effort — and pick the cheapest `(tier × effort)` that clears the task's cost of error.

- **Effort is a separate control from capability.** Decide it deliberately, per task class.
- **Do not default to maximum.** Higher effort buys accuracy at rising cost/latency with diminishing returns.
- **Small-model-high-effort ≈ big-model-low-effort.** Prefer the cheaper combination when it clears the bar.
- **No reliable auto-selection.** Assign effort explicitly: workers → off/low, judges → medium, evaluators/reasoners/researchers → high, orchestrator/manager → medium (high when decomposing a hard problem).
- **Mechanical / L0 work runs with reasoning off**; a hard token budget is the fail-safe and tasks must tolerate a truncated trace.
- Set it via the native effort dial (`deep-reasoner` = high, `reasoning-architect` = medium, `fast-worker` = low), or by prepending `Reasoning effort: low | medium | high` when there is no dial.

Full rule: [`llm-wiki/raw/model-and-reasoning-effort-selection.md`](Assets/KBPro/kbpro-ai-docs/llm-wiki/raw/model-and-reasoning-effort-selection.md); harness copy in `HarnessProtocol/config/reasoning-effort-selection.md`; per-role defaults in `harness.config.json` (`agent_roles[*].reasoning_effort`).

## Team Principle

- If the user explicitly asks to work as a team, with subagents, or by the team principle, load and follow `kbpro-subagent-team` before delegating work.
- Team mode does not activate implicitly from task size or complexity and does not expand the user's authorization.
- The main agent remains accountable for goals, role allocation, token-efficient context handoff, coordination, independent review, and completing the task.

## No Simulated Agents

- Never emulate, invent, or hallucinate responses from other agents, subagents, models, or utilities.
- If a workflow requires another agent or model, actually call the available tool or script and wait for the real response.
- If the call fails, report or handle the real error. Do not replace a failed external call with a generated answer pretending to be from another entity.

## COMPILATION ERROR CHECK PROTOCOL

- After ANY changes to C# code, the AI agent MUST wait for successful compilation and verify that there are no new errors in the Unity console (or in the dotnet build output).
- It is strictly forbidden to complete implementation and submit a report after C# changes without checking compiler logs. Completing a task with console errors is a task failure.
- If compilation errors are found, the agent must fix them immediately.

## MINIMUM INTERVENTION RULE (DO NOT BREAK WORKING CODE)

- Making new changes MUST NOT break the active structure and logic under any circumstances.
- Any intervention in the code must be extremely careful.
- If possible, do not touch working code and try not to change existing code unless it is directly required to solve the task.
- The agent must preserve the original behavior of the system and avoid sweep refactorings that could damage adjacent systems.

## STRICT SKILLS PROTECTION RULE

- NEVER touch, modify, rename, delete, or alter any files, metadata, or directories in the `.agents/skills/` directory (such as `unity-skills` or any other skills) under any circumstances. Modifying global or IDE-facing skills directories is strictly prohibited.

## STRICT PERMISSION RULE (NO UNAUTHORIZED ACTIONS)

- NEVER make active codebase changes, run modifying commands, edit files, or execute implementation plans on your own initiative.
- ONLY make changes if the user's prompt EXPLICITLY asks you to modify, create, fix, or implement something.
- If the prompt is just an inquiry or does not explicitly command execution, you MUST present a plan and ask for permission before touching anything.
<!-- END DavASkoLLMWiki -->