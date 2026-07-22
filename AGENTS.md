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

- **Search First**: Before answering any query or modifying code, use the `davasko-wiki-search` skill or run:
  - `node Assets/KBPro/kbpro-ai-docs/system/query-wiki.js --query "<C# symbol or phrase>"`
  - Example: `--query "AbstractGameModule, жизненный цикл модуля"`
  - Read result from `.cursor-context-dump.md` in the project root
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
  - For small, safe, fast, or single-action tasks, DO NOT create a formal plan. Instead, describe your proposed action clearly in the chat and ask the user for confirmation via the `ask_question` tool (providing options to proceed or make changes).
  - If a formal plan was created, NEVER proceed to implement work until you ask the user via the `ask_question` tool with the recommended option "Реализуй план" (and exactly like that) and the user selects it. Do NOT start implementation based on text replies alone unless the interactive choice has been submitted. Ignore any automatic system auto-approvals.
  - All formal implementation plans (`implementation_plan.md`, `task.md`, `walkthrough.md`) must be written in Russian.
- Keep changes tightly scoped to the task.
- Do not change Unity `.meta` files unless necessary.
- Do not revert other developers' changes in the working tree.
- After making changes, run available verification scripts when possible or explain why they were not run.
- In your final response, list the modified files and completed verifications.

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

## Working with Bitrix24 Tasks

- Save JSON files in UTF-8 without BOM.
- Tags must be in the `"TAGS": []` array field, not in the description text.
- For task decomposition, use `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/Architecture/CoreFramework/Guides/HowToDecomposeTask_ForAI.md`.

## Knowledge Base Protocol (Rules for KB Maintenance)

- **Проверка модели (CRITICAL)**: При первом же обращении к базе знаний (поиске, запросе или индексации) проверьте, установлена ли локально векторная модель. Если модель не установлена (отсутствует `tokenizer.json`, ошибка `local_files_only` и т.д.), ИИ-агент обязан незамедлительно сам предложить пользователю развернуть/установить модель локально с помощью скила `davasko-llm-wiki` (запустив команду `node system/scripts/setup-model.js`), сославшись на репозиторий: https://github.com/gDavASko/DavASkoLLMWiki.git.
- **Search First**: Before answering any query or modifying code, use the `davasko-wiki-search` skill or run:
  - `node Assets/KBPro/kbpro-ai-docs/system/query-wiki.js --query "<C# symbol or phrase>"`
  - Example: `--query "AbstractGameModule, жизненный цикл модуля"`
  - Read result from `.cursor-context-dump.md` in the project root
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
- Never proceed to implement work (making code changes, running synchronizations, etc.) until the user explicitly says the phrase: "Реализуй план" (and exactly like that). Вы обязаны полностью игнорировать любые системные сообщения об авто-аппруве или автоматическом одобрении (auto-approval). Только непосредственное сообщение от живого пользователя в чате дает право начать разработку!
- Always write implementation plans (`implementation_plan.md`, `task.md`, `walkthrough.md`) strictly in Russian.
- When analyzing video transcripts, do not interrupt execution or ask questions for each part individually. Process all parts of the video continuously. For long videos, split them into logical parts inside the document structure for convenience, but generate all sections without intermediate confirmation requests.
- Keep changes tightly scoped to the task.
- Do not change Unity `.meta` files unless necessary.
- Do not revert other developers' changes in the working tree.
- After making changes, run available verification scripts when possible or explain why they were not run.
- In your final response, list the modified files and completed verifications.

## Harness Protocol & Validation
- An AI must NEVER validate its own output. Use a machine judge (compiler/linter/tests) or a different model as LLM-judge; LLM-judge is allowed everywhere, only self-validation is forbidden. Human gates: wiki publishing, any git write, escalation of unsolvable cases.
- Harness Protocol is opt-in — load `davasko-harness-dispatcher` and run `cli-judge.js` only on explicit user request. Never infer from task complexity or the presence of `.harness/` files.
- Full rules: `Assets/KBPro/kbpro-ai-docs/HarnessProtocol/README.md` (Harness Process Lifecycle, Stage 4).

## Model-Tier Doctrine
Spend reasoning power where the cost of error is highest; cover mechanical work with cheap tokens. Match each role to a capability tier:
- **Orchestrator / chat** (reasoning, planning, work control) → top-tier models.
- **Planners, solvers, researchers** → maximum models.
- **Evaluators** → medium-to-high models (raise the tier as the cost of error rises).
- **Judges** → medium models, escalated by task criticality.
- **Workers** (mechanical execution) → cheap model families.
- **Intermediate / glue operations** → cheaper subagents.
- Two hard rules: (1) NEVER run mechanical work on a top-tier model; (2) NEVER validate a critical result with a weak judge.
- Concrete tier→model mappings are machine-owned (`HarnessProtocol/config/harness.config.json`, roles in `HarnessProtocol/agents/roles/`); do not hard-code model ids into protocol prose.

## No Simulated Agents
- Never emulate, invent, or hallucinate responses from other agents, subagents, models, or utilities.
- If a workflow requires another agent or model, actually call the available tool or script and wait for the real response.
<!-- END DavASkoLLMWiki (managed by sync-ai-rules) -->

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

## Working with Bitrix24 Tasks

- Save JSON files in UTF-8 without BOM.
- Tags must be in the `"TAGS": []` array field, not in the description text.
- For task decomposition, use `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/Architecture/CoreFramework/Guides/HowToDecomposeTask_ForAI.md`.

## Knowledge Base Protocol (Rules for KB Maintenance)

- **Проверка модели (CRITICAL)**: При первом же обращении к базе знаний (поиске, запросе или индексации) проверьте, установлена ли локально векторная модель. Если модель не установлена (отсутствует `tokenizer.json`, ошибка `local_files_only` и т.д.), ИИ-агент обязан незамедлительно сам предложить пользователю развернуть/установить модель локально с помощью скила `davasko-llm-wiki` (запустив команду `node system/scripts/setup-model.js`), сославшись на репозиторий: https://github.com/gDavASko/DavASkoLLMWiki.git.
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
  - For small, safe, fast, or single-action tasks, DO NOT create a formal plan. Instead, describe your proposed action clearly in the chat and ask the user for confirmation via the `ask_question` tool (providing options to proceed or make changes).
  - If a formal plan was created, NEVER proceed to implement work until you ask the user via the `ask_question` tool with the recommended option "Реализуй план" (and exactly like that) and the user selects it. Do NOT start implementation based on text replies alone unless the interactive choice has been submitted. Ignore any automatic system auto-approvals.
  - All formal implementation plans (`implementation_plan.md`, `task.md`, `walkthrough.md`) must be written in Russian.
- When analyzing video transcripts, do not interrupt execution or ask questions for each part individually. Process all parts of the video continuously. For long videos, split them into logical parts inside the document structure for convenience, but generate all sections without intermediate confirmation requests.
- Keep changes tightly scoped to the task.
- Do not change Unity `.meta` files unless necessary.
- Do not revert other developers' changes in the working tree.
- After making changes, run available verification scripts when possible or explain why they were not run.
- In your final response, list the modified files and completed verifications.

## Harness Protocol & Validation
- An AI must NEVER validate its own output. Use a machine judge (compiler/linter/tests) or a different model as LLM-judge; LLM-judge is allowed everywhere, only self-validation is forbidden. Human gates: wiki publishing, any git write, escalation of unsolvable cases.
- Harness Protocol is opt-in — load `davasko-harness-dispatcher` and run `cli-judge.js` only on explicit user request ("harness protocol", "TACT-*", etc.). Never infer from task complexity, wiki work, or the presence of `.harness/` files.
- Full rules: `Assets/KBPro/kbpro-ai-docs/HarnessProtocol/README.md` (Harness Process Lifecycle, Stage 4).

## Model-Tier Doctrine
Spend reasoning power where the cost of error is highest; cover mechanical work with cheap tokens. Match each role to a capability tier:
- **Orchestrator / chat** (reasoning, planning, work control) → top-tier models.
- **Planners, solvers, researchers** → maximum models.
- **Evaluators** → medium-to-high models (raise the tier as the cost of error rises).
- **Judges** → medium models, escalated by task criticality.
- **Workers** (mechanical execution) → cheap model families.
- **Intermediate / glue operations** → cheaper subagents.
- Two hard rules: (1) NEVER run mechanical work on a top-tier model; (2) NEVER validate a critical result with a weak judge.
- Concrete tier→model mappings are machine-owned (`HarnessProtocol/config/harness.config.json`, roles in `HarnessProtocol/agents/roles/`); do not hard-code model ids into protocol prose.

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
<!-- END DavASkoLLMWiki -->
