CLAUDE.md — dentistry-cow

## Project
- **Unity Version:** 6000.0.67f1 (from ProjectSettings/ProjectVersion.txt)
- **Primary Code Paths:** `Assets/Core` and `Assets/Dentistry-cow`
- **Platform Submodules:** `Assets/KBPro/*` (including `kbpro-modules`, `kbpro-logicservice`, `kbpro-servicelocator`, `kbpro-eventbus`, `kbpro.configsystem`, `kbpro-datasystem`, `kbpro-uisystem`, `kbpro-audiosystem`, `kbpro-timers`, `kbpro-parenttimer`, `kbpro-idprocessors`, `kbpro-modifier`, `kbpro-ai`, `kbpro-spine`, `kbpro-rustore`, `kbpro-analytic`, `kbpro-plugins`)
- **Key Dependencies:** UniTask, UniRx, DOTween, Addressables, URP 17, Input System, Cinemachine, TextMeshPro, Odin/NaughtyAttributes, Spine, RuStore SDK, AppMetrica, Google Play packages.

## MCP Servers (.mcp.json)
| Server Name | Purpose | When to Use |
|---|---|---|
| `b24-dev-mcp` | Bitrix24 REST documentation, methods, and task fields. | When working with Bitrix24 task management or automation. |
| `context7` | Up-to-date documentation for libraries like UniTask, DOTween, Addressables. | When NewData/researching external package APIs or best practices. |

## How to Work in This Project
- **Docs On Demand (no bulk upfront reading):** consult a doc only when the task needs it — architecture / module design -> [architecture.md](file:///Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/architecture.md); naming, formatting, C#/Unity conventions -> [code_style.md](file:///Assets/KBPro/kbpro-ai-docs/unity-wiki/raw/code_style.md); core principles, DI, lifecycle -> [principals.md](file:///Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/principals.md).
- **Before AI Code Review:** read `ai-generated-code-review.md` and `unity-ai-code-review-checklist.md` under `Assets/KBPro/kbpro-ai-docs/wiki/runbooks/` and `wiki/concepts/`.
- **Tool Guidance:** Prioritize reading files before editing. Use Grep/Glob patterns to target queries. Use specialized local skills (like `kbpro-code-navigator`) before starting changes.
- **Do Not Touch:** `Library/`, `Temp/`, `Logs/`, `obj/`, generated `.csproj` files, or Unity `.meta` files (unless adding/deleting project files).
- **Never Implement Without Consent:** Never proceed to implement work (making code changes, running synchronizations, etc.) until the user explicitly says the phrase: "Реализуй план" (and exactly like that).

## ExecPlans
- For complex changes, refactoring, or migrations, follow [PLANS.md](file:///Assets/KBPro/kbpro-ai-docs/llm-wiki/raw/PLANS.md).
- Create a self-contained ExecPlan and store it under `Assets/KBPro/kbpro-ai-docs/`.

## KBPro Architecture Rules
- Preserve KBPro module boundaries and dependency directions.
- Use `LogicSystem`, `GameComponent`, `ModuleScope`, `[InjectSystems]`, and `[InjectComponent]` where the module framework is used.
- Use `LazySrv<T>` and KBPro `ServiceLocator` patterns for platform services when the surrounding code does so.
- Use `EventBus<T>`, `EventBinding<T>`, and event messages for decoupled communication. Always unregister in `Dispose`.
- Call `base.Initialize()` and `base.Dispose()` in KBPro lifecycle overrides.
- Use `DataService`, config assets, data trees, and ID processors for game data instead of ad hoc registries.
- Use `[ConstSelector]`, generated constants, and typed IDs instead of magic strings.
- Use the UI MVP stack (`UIPBase`, `UIVBase`, `UIPWindow`, `UIVWindow`, `IUIShowParams`) for UI.
- Use existing audio, timer, tutor, modifier, analytics, and RuStore services before adding new ones.
- Do not mutate ScriptableObject configuration at runtime unless explicitly designed as mutable state.

## Tutor And Animation Reuse
- For tutorial work, use the `kbpro-tutor-builder` skill first and follow its rules. If the task includes visual attention or animation behavior, also use `unity-animation-visuals-expert`.

## C# / Unity Code Style
- Namespace format: `KBP.{CATEGORY}` matching folder structure.
- One public class/interface per file, matching the file name.
- Member order: Constants, static fields, serialized/public fields, private fields, properties, constructors/Unity init, lifecycle methods, public, protected, private methods, cleanup.
- Naming: PascalCase for classes, structs, methods, properties, public fields. Interface prefix `I`. camelCase for local variables, `_camelCase` for private fields. `UPPER_SNAKE_CASE` for constants.
- Async suffix: `Async` for all asynchronous methods.
- Enums: Explicit integer values for enum members.
- Formatting: Allman braces, 4 spaces indentation, keep lines near 100 characters.
- References: Prefer `[SerializeField] private` for Unity references. Use `TryGetComponent` for local components.
- Do not use `GameObject.Find`, `Transform.Find`, `FindObjectOfType`.
- Text: Always use `TextMeshPro` components, do not use `UnityEngine.UI.Text`.
- Async: Use `UniTask` instead of coroutines. Pass and honor `CancellationToken`. Null out owned `CancellationTokenSource` on cleanup.

## Performance
- No allocations in `Update`, `FixedUpdate`, hot paths, event handlers, or loops (avoid LINQ, boxing, closure allocations).
- Physics: Run Rigidbody and physics logic strictly in `FixedUpdate`.
- Object Pooling: Use object pools for frequently spawned/removed objects.

## Developer Commands
- **Git status:** `git status --short`
- **Sync rules & skills:** `node Assets/KBPro/kbpro-ai-docs/system/sync-ai-rules.js`
- **Lint wiki:** `node Assets/KBPro/kbpro-ai-docs/system/scripts/lint-wiki.js`
- **Build runtime C#:** `dotnet build .\Assembly-CSharp.csproj --no-restore /p:BuildProjectReferences=false /m:1 /v:minimal`
- **Build editor C#:** `dotnet build .\Assembly-CSharp-Editor.csproj --no-restore /p:BuildProjectReferences=false /m:1 /v:minimal`

## Knowledge Base Protocol (Rules for KB Maintenance)
- **Search First**: Before answering any query or modifying code, look up pages using the orchestrator:
  - Search by page name: `node Assets/KBPro/kbpro-ai-docs/system/query-wiki.js --query "<search phrase>"`
  - Full-text search: `node Assets/KBPro/kbpro-ai-docs/system/query-wiki.js --query "<search phrase>"`
- **Ingest via Pipeline**: To ingest new documents or files, place them in the incoming buffer `NewData/` first, then run:
  - Run: `node Assets/KBPro/kbpro-ai-docs/system/scripts/ingest-newdata.js`\r
  - Rebuild: `node Assets/KBPro/kbpro-ai-docs/system/build-index.js`\r
  - Available layers: `llm-wiki`, `kbpro-wiki`, `unity-wiki`, `dentistry-cow-wiki`
- **Decomposition**: If an imported document contains details belonging to multiple layers (e.g. Unity patterns + KBPro APIs + project details), you MUST propose a split schema to the user. Do not ingest monolith files into a single layer without user approval.
- **Stub Handling**: When referring to pages in higher layers or missing docs, add stubs to `dentistry-cow-wiki/wiki/stubs.md` to prevent lint errors. When ingesting a file that closes a stub, ensure the stub is automatically or manually removed from `stubs.md`.
- **Validation**: After any knowledge base change, always validate using:

  - `node Assets/KBPro/kbpro-ai-docs/system/scripts/lint-wiki.js`
- **Grep Search Gaps**: If you have to search the codebase using grep, ripgrep, or full-text search because the topic, convention, or code pattern was not directly found in the knowledge base maps or concepts, you must document your findings. You must add the description, links, and code symbols/examples to the knowledge base (under either `kbpro-wiki` or `dentistry-cow-wiki`, depending on the domain). If the topic already exists in the knowledge base but lacks links or specific details, you must supplement/update it with the missing references so that future searches can be done directly via the wiki query system without needing generic grep searches.

## Self-Check Before Finishing
- Commit messages: Use imperative mood and Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `docs:`, `chore:`).
- Branching: Use prefix `feature/<scope>`, `fix/<scope>`, `refactor/<scope>`, or `codex/<scope>`.

## Security
- Never commit secrets, API keys, tokens, passwords, signing credentials, local webhooks, or private `.env` files.

## Submodules and Vendor Code
- Do not update submodule revisions casually. Keep submodule edits narrowly scoped.
- Do not reformat or refactor third-party vendor code.

## Documentation
- Add or update documentation under `Assets/KBPro/kbpro-ai-docs`.
- For AI-maintained wiki pages, follow `Assets/KBPro/kbpro-ai-docs/LLM-WIKI.md`.

## Self-Check Before Finishing
1. Run `git status --short`.
2. Build C# assemblies using `dotnet build`.
3. Check that subscriptions, timers, tweens, async tasks, and pooled objects are disposed or released.
4. Verify `.meta` files are correct and no unrelated changes were introduced.
5. Update `Assets/KBPro/kbpro-ai-docs` documentation if needed.

<!-- BEGIN DavASkoLLMWiki (managed by sync-ai-rules — do not edit inside this block) -->
CLAUDE.md — dentistry-cow

## Project
- **Unity Version:** 6000.0.67f1 (from ProjectSettings/ProjectVersion.txt)
- **Primary Code Paths:** `Assets/Core` and `Assets/Dentistry-cow`
- **Platform Submodules:** `Assets/KBPro/*` (including `kbpro-modules`, `kbpro-logicservice`, `kbpro-servicelocator`, `kbpro-eventbus`, `kbpro.configsystem`, `kbpro-datasystem`, `kbpro-uisystem`, `kbpro-audiosystem`, `kbpro-timers`, `kbpro-parenttimer`, `kbpro-idprocessors`, `kbpro-modifier`, `kbpro-ai`, `kbpro-spine`, `kbpro-rustore`, `kbpro-analytic`, `kbpro-plugins`)
- **Key Dependencies:** UniTask, UniRx, DOTween, Addressables, URP 17, Input System, Cinemachine, TextMeshPro, Odin/NaughtyAttributes, Spine, RuStore SDK, AppMetrica, Google Play packages.

## MCP Servers (.mcp.json)
| Server Name | Purpose | When to Use |
|---|---|---|
| `b24-dev-mcp` | Bitrix24 REST documentation, methods, and task fields. | When working with Bitrix24 task management or automation. |
| `context7` | Up-to-date documentation for libraries like UniTask, DOTween, Addressables. | When NewData/researching external package APIs or best practices. |

## How to Work in This Project
- **Docs On Demand (no bulk upfront reading):** consult a doc only when the task needs it — architecture / module design -> [architecture.md](file:///Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/architecture.md); naming, formatting, C#/Unity conventions -> [code_style.md](file:///Assets/KBPro/kbpro-ai-docs/unity-wiki/raw/code_style.md); core principles, DI, lifecycle -> [principals.md](file:///Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/principals.md).
- **Before AI Code Review:** read `ai-generated-code-review.md` and `unity-ai-code-review-checklist.md` under `Assets/KBPro/kbpro-ai-docs/wiki/runbooks/` and `wiki/concepts/`.
- **Tool Guidance:** Prioritize reading files before editing. Use Grep/Glob patterns to target queries. Use specialized local skills (like `kbpro-code-navigator`) before starting changes.
- **Do Not Touch:** `Library/`, `Temp/`, `Logs/`, `obj/`, generated `.csproj` files, or Unity `.meta` files (unless adding/deleting project files).
- **Never Implement Without Consent:** Never proceed to implement work (making code changes, running synchronizations, etc.) until the user explicitly says the phrase: "Реализуй план" (and exactly like that).

## ExecPlans
- For complex changes, refactoring, or migrations, follow [PLANS.md](file:///Assets/KBPro/kbpro-ai-docs/llm-wiki/raw/PLANS.md).
- Create a self-contained ExecPlan and store it under `Assets/KBPro/kbpro-ai-docs/`.

## KBPro Architecture Rules
- Preserve KBPro module boundaries and dependency directions.
- Use `LogicSystem`, `GameComponent`, `ModuleScope`, `[InjectSystems]`, and `[InjectComponent]` where the module framework is used.
- Use `LazySrv<T>` and KBPro `ServiceLocator` patterns for platform services when the surrounding code does so.
- Use `EventBus<T>`, `EventBinding<T>`, and event messages for decoupled communication. Always unregister in `Dispose`.
- Call `base.Initialize()` and `base.Dispose()` in KBPro lifecycle overrides.
- Use `DataService`, config assets, data trees, and ID processors for game data instead of ad hoc registries.
- Use `[ConstSelector]`, generated constants, and typed IDs instead of magic strings.
- Use the UI MVP stack (`UIPBase`, `UIVBase`, `UIPWindow`, `UIVWindow`, `IUIShowParams`) for UI.
- Use existing audio, timer, tutor, modifier, analytics, and RuStore services before adding new ones.
- Do not mutate ScriptableObject configuration at runtime unless explicitly designed as mutable state.

## C# / Unity Code Style
- Namespace format: `KBP.{CATEGORY}` matching folder structure.
- One public class/interface per file, matching the file name.
- Member order: Constants, static fields, serialized/public fields, private fields, properties, constructors/Unity init, lifecycle methods, public, protected, private methods, cleanup.
- Naming: PascalCase for classes, structs, methods, properties, public fields. Interface prefix `I`. camelCase for local variables, `_camelCase` for private fields. `UPPER_SNAKE_CASE` for constants.
- Async suffix: `Async` for all asynchronous methods.
- Enums: Explicit integer values for enum members.
- Formatting: Allman braces, 4 spaces indentation, keep lines near 100 characters.
- References: Prefer `[SerializeField] private` for Unity references. Use `TryGetComponent` for local components.
- Do not use `GameObject.Find`, `Transform.Find`, `FindObjectOfType`.
- Text: Always use `TextMeshPro` components, do not use `UnityEngine.UI.Text`.
- Async: Use `UniTask` instead of coroutines. Pass and honor `CancellationToken`. Null out owned `CancellationTokenSource` on cleanup.

## Performance
- No allocations in `Update`, `FixedUpdate`, hot paths, event handlers, or loops (avoid LINQ, boxing, closure allocations).
- Physics: Run Rigidbody and physics logic strictly in `FixedUpdate`.
- Object Pooling: Use object pools for frequently spawned/removed objects.

## Developer Commands
- **Git status:** `git status --short`
- **Sync rules & skills:** `node Assets/KBPro/kbpro-ai-docs/system/sync-ai-rules.js`
- **Lint wiki:** `node Assets/KBPro/kbpro-ai-docs/system/scripts/lint-wiki.js`
- **Build runtime C#:** `dotnet build .\Assembly-CSharp.csproj --no-restore /p:BuildProjectReferences=false /m:1 /v:minimal`
- **Build editor C#:** `dotnet build .\Assembly-CSharp-Editor.csproj --no-restore /p:BuildProjectReferences=false /m:1 /v:minimal`

## Knowledge Base Protocol (Rules for KB Maintenance)
- **Model Check (CRITICAL)**: При первом же обращении к базе знаний (поиске, запросе или индексации) проверьте, установлена ли локально векторная модель. Если модель не установлена (отсутствует `tokenizer.json`, ошибка `local_files_only` и т.д.), ИИ-агент обязан незамедлительно сам предложить пользователю развернуть/установить модель локально с помощью скила `davasko-llm-wiki` (запустив команду `node system/scripts/setup-model.js`), сославшись на репозиторий: https://github.com/gDavASko/DavASkoLLMWiki.git.
- **Search First**: Before answering any query or modifying code, look up pages using the orchestrator:
  - Search by page name: `node Assets/KBPro/kbpro-ai-docs/system/query-wiki.js --query "<search phrase>"`
  - Full-text search: `node Assets/KBPro/kbpro-ai-docs/system/query-wiki.js --query "<search phrase>"`
- **Ingest via Pipeline**: To ingest new documents or files, place them in the incoming buffer `NewData/` first, then run:
  - Run: `node Assets/KBPro/kbpro-ai-docs/system/scripts/ingest-newdata.js`\r
  - Rebuild: `node Assets/KBPro/kbpro-ai-docs/system/build-index.js`\r
  - Available layers: `llm-wiki`, `kbpro-wiki`, `unity-wiki`, `dentistry-cow-wiki`
- **Decomposition**: If an imported document contains details belonging to multiple layers (e.g. Unity patterns + KBPro APIs + project details), you MUST propose a split schema to the user. Do not ingest monolith files into a single layer without user approval.
- **Stub Handling**: When referring to pages in higher layers or missing docs, add stubs to `dentistry-cow-wiki/wiki/stubs.md` to prevent lint errors. When ingesting a file that closes a stub, ensure the stub is automatically or manually removed from `stubs.md`.
- **Validation**: After any knowledge base change, always validate using:

  - `node Assets/KBPro/kbpro-ai-docs/system/scripts/lint-wiki.js`
- **Grep Search Gaps**: If you have to search the codebase using grep, ripgrep, or full-text search because the topic, convention, or code pattern was not directly found in the knowledge base maps or concepts, you must document your findings. You must add the description, links, and code symbols/examples to the knowledge base (under either `kbpro-wiki` or `dentistry-cow-wiki`, depending on the domain). If the topic already exists in the knowledge base but lacks links or specific details, you must supplement/update it with the missing references so that future searches can be done directly via the wiki query system without needing generic grep searches.

## Self-Check Before Finishing
- Commit messages: Use imperative mood and Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `docs:`, `chore:`).
- Branching: Use prefix `feature/<scope>`, `fix/<scope>`, `refactor/<scope>`, or `codex/<scope>`.

## Security
- Never commit secrets, API keys, tokens, passwords, signing credentials, local webhooks, or private `.env` files.

## Submodules and Vendor Code
- Do not update submodule revisions casually. Keep submodule edits narrowly scoped.
- Do not reformat or refactor third-party vendor code.

## Documentation
- Add or update documentation under `Assets/KBPro/kbpro-ai-docs`.
- For AI-maintained wiki pages, follow `Assets/KBPro/kbpro-ai-docs/LLM-WIKI.md`.

## Self-Check Before Finishing
1. Run `git status --short`.
2. Build C# assemblies using `dotnet build`.
3. Check that subscriptions, timers, tweens, async tasks, and pooled objects are disposed or released.
4. Verify `.meta` files are correct and no unrelated changes were introduced.
5. Update `Assets/KBPro/kbpro-ai-docs` documentation if needed.
<!-- END DavASkoLLMWiki (managed by sync-ai-rules) -->

<!-- BEGIN DavASkoLLMWiki (managed by sync-ai-rules — do not edit inside this block) -->
CLAUDE.md — dentistry-cow

## Project
- **Unity Version:** 6000.0.67f1 (from ProjectSettings/ProjectVersion.txt)
- **Primary Code Paths:** `Assets/Core` and `Assets/Dentistry-cow`
- **Platform Submodules:** `Assets/KBPro/*` (including `kbpro-modules`, `kbpro-logicservice`, `kbpro-servicelocator`, `kbpro-eventbus`, `kbpro.configsystem`, `kbpro-datasystem`, `kbpro-uisystem`, `kbpro-audiosystem`, `kbpro-timers`, `kbpro-parenttimer`, `kbpro-idprocessors`, `kbpro-modifier`, `kbpro-ai`, `kbpro-spine`, `kbpro-rustore`, `kbpro-analytic`, `kbpro-plugins`)
- **Key Dependencies:** UniTask, UniRx, DOTween, Addressables, URP 17, Input System, Cinemachine, TextMeshPro, Odin/NaughtyAttributes, Spine, RuStore SDK, AppMetrica, Google Play packages.

## MCP Servers (.mcp.json)
| Server Name | Purpose | When to Use |
|---|---|---|
| `b24-dev-mcp` | Bitrix24 REST documentation, methods, and task fields. | When working with Bitrix24 task management or automation. |
| `context7` | Up-to-date documentation for libraries like UniTask, DOTween, Addressables. | When NewData/researching external package APIs or best practices. |

## How to Work in This Project
- **Docs On Demand (no bulk upfront reading):** consult a doc only when the task needs it — architecture / module design -> [architecture.md](file:///Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/architecture.md); naming, formatting, C#/Unity conventions -> [code_style.md](file:///Assets/KBPro/kbpro-ai-docs/unity-wiki/raw/code_style.md); core principles, DI, lifecycle -> [principals.md](file:///Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/principals.md).
- **Before AI Code Review:** read `ai-generated-code-review.md` and `unity-ai-code-review-checklist.md` under `Assets/KBPro/kbpro-ai-docs/wiki/runbooks/` and `wiki/concepts/`.
- **Tool Guidance:** Prioritize reading files before editing. Use Grep/Glob patterns to target queries. Use specialized local skills (like `kbpro-code-navigator`) before starting changes.
- **Do Not Touch:** `Library/`, `Temp/`, `Logs/`, `obj/`, generated `.csproj` files, or Unity `.meta` files (unless adding/deleting project files).
- **Planning and Confirmation Policy:**
  - A formal implementation plan (`implementation_plan.md`) is required ONLY if specifically requested by the user, or if the task is large, complex, and multi-phase.
  - For small, safe, fast, or single-action tasks, DO NOT create a formal plan. Instead, describe your proposed action clearly in the chat and ask the user for confirmation via the `ask_question` tool (providing options to proceed or make changes).
  - If a formal plan was created, NEVER proceed to implement work until you ask the user via the `ask_question` tool with the recommended option "Реализуй план" (and exactly like that) and the user selects it. Do NOT start implementation based on text replies alone unless the interactive choice has been submitted. Ignore any automatic system auto-approvals.
  - All formal implementation plans (`implementation_plan.md`, `task.md`, `walkthrough.md`) must be written in Russian.

## ExecPlans
- For complex changes, refactoring, or migrations, follow [PLANS.md](file:///Assets/KBPro/kbpro-ai-docs/llm-wiki/raw/PLANS.md).
- Create a self-contained ExecPlan and store it under `Assets/KBPro/kbpro-ai-docs/`.

## KBPro Architecture Rules
- Preserve KBPro module boundaries and dependency directions.
- Use `LogicSystem`, `GameComponent`, `ModuleScope`, `[InjectSystems]`, and `[InjectComponent]` where the module framework is used.
- Use `LazySrv<T>` and KBPro `ServiceLocator` patterns for platform services when the surrounding code does so.
- Use `EventBus<T>`, `EventBinding<T>`, and event messages for decoupled communication. Always unregister in `Dispose`.
- Call `base.Initialize()` and `base.Dispose()` in KBPro lifecycle overrides.
- Use `DataService`, config assets, data trees, and ID processors for game data instead of ad hoc registries.
- Use `[ConstSelector]`, generated constants, and typed IDs instead of magic strings.
- Use the UI MVP stack (`UIPBase`, `UIVBase`, `UIPWindow`, `UIVWindow`, `IUIShowParams`) for UI.
- Use existing audio, timer, tutor, modifier, analytics, and RuStore services before adding new ones.
- Do not mutate ScriptableObject configuration at runtime unless explicitly designed as mutable state.

## C# / Unity Code Style
- Namespace format: `KBP.{CATEGORY}` matching folder structure.
- One public class/interface per file, matching the file name.
- Member order: Constants, static fields, serialized/public fields, private fields, properties, constructors/Unity init, lifecycle methods, public, protected, private methods, cleanup.
- Naming: PascalCase for classes, structs, methods, properties, public fields. Interface prefix `I`. camelCase for local variables, `_camelCase` for private fields. `UPPER_SNAKE_CASE` for constants.
- Async suffix: `Async` for all asynchronous methods.
- Enums: Explicit integer values for enum members.
- Formatting: Allman braces, 4 spaces indentation, keep lines near 100 characters.
- References: Prefer `[SerializeField] private` for Unity references. Use `TryGetComponent` for local components.
- Do not use `GameObject.Find`, `Transform.Find`, `FindObjectOfType`.
- Text: Always use `TextMeshPro` components, do not use `UnityEngine.UI.Text`.
- Async: Use `UniTask` instead of coroutines. Pass and honor `CancellationToken`. Null out owned `CancellationTokenSource` on cleanup.

## Performance
- No allocations in `Update`, `FixedUpdate`, hot paths, event handlers, or loops (avoid LINQ, boxing, closure allocations).
- Physics: Run Rigidbody and physics logic strictly in `FixedUpdate`.
- Object Pooling: Use object pools for frequently spawned/removed objects.

## Developer Commands
- **Git status:** `git status --short`
- **Sync rules & skills:** `node Assets/KBPro/kbpro-ai-docs/system/sync-ai-rules.js`
- **Lint wiki:** `node Assets/KBPro/kbpro-ai-docs/system/scripts/lint-wiki.js`
- **Build runtime C#:** `dotnet build .\Assembly-CSharp.csproj --no-restore /p:BuildProjectReferences=false /m:1 /v:minimal`
- **Build editor C#:** `dotnet build .\Assembly-CSharp-Editor.csproj --no-restore /p:BuildProjectReferences=false /m:1 /v:minimal`

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

## Knowledge Base Protocol (Rules for KB Maintenance)
- **Model Check (CRITICAL)**: При первом же обращении к базе знаний (поиске, запросе или индексации) проверьте, установлена ли локально векторная модель. Если модель не установлена (отсутствует `tokenizer.json`, ошибка `local_files_only` и т.д.), ИИ-агент обязан незамедлительно сам предложить пользователю развернуть/установить модель локально с помощью скила `davasko-llm-wiki` (запустив команду `node system/scripts/setup-model.js`), сославшись на репозиторий: https://github.com/gDavASko/DavASkoLLMWiki.git.
- **Search First**: Before answering any query or modifying code, look up pages using the orchestrator:
  - `node Assets/KBPro/kbpro-ai-docs/system/query-wiki.js --auto "<query>"`
  - The Query Router will automatically pick the best tool: **Graphify** (for AST/C# dependencies), **RLM** (Deep Research for architecture), or **RAG** (Hybrid search for facts).
  - Manual overrides: `--query` (RAG only), `--rlm` (RLM only).
- **Ingest via Pipeline**: To ingest new documents or files, place them in the incoming buffer `NewData/` first, then run:
  - Run: `node Assets/KBPro/kbpro-ai-docs/system/scripts/ingest-newdata.js`\r
  - Rebuild: `node Assets/KBPro/kbpro-ai-docs/system/build-index.js`\r
  - Available layers: `llm-wiki`, `kbpro-wiki`, `unity-wiki`, `dentistry-cow-wiki`
- **Decomposition**: If an imported document contains details belonging to multiple layers (e.g. Unity patterns + KBPro APIs + project details), you MUST propose a split schema to the user. Do not ingest monolith files into a single layer without user approval.
- **Stub Handling**: When referring to pages in higher layers or missing docs, add stubs to `dentistry-cow-wiki/wiki/stubs.md` to prevent lint errors. When ingesting a file that closes a stub, ensure the stub is automatically or manually removed from `stubs.md`.
- **Validation**: After any knowledge base change, always validate using:

  - `node Assets/KBPro/kbpro-ai-docs/system/scripts/lint-wiki.js`
- **Grep Search Gaps**: If you have to search the codebase using grep, ripgrep, or full-text search because the topic, convention, or code pattern was not directly found in the knowledge base maps or concepts, you must document your findings. You must add the description, links, and code symbols/examples to the knowledge base (under either `kbpro-wiki` or `dentistry-cow-wiki`, depending on the domain). If the topic already exists in the knowledge base but lacks links or specific details, you must supplement/update it with the missing references so that future searches can be done directly via the wiki query system without needing generic grep searches.

## Self-Check Before Finishing
- Commit messages: Use imperative mood and Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `docs:`, `chore:`).
- Branching: Use prefix `feature/<scope>`, `fix/<scope>`, `refactor/<scope>`, or `codex/<scope>`.

## Security
- Never commit secrets, API keys, tokens, passwords, signing credentials, local webhooks, or private `.env` files.

## Submodules and Vendor Code
- Do not update submodule revisions casually. Keep submodule edits narrowly scoped.
- Do not reformat or refactor third-party vendor code.

## Documentation
- Add or update documentation under `Assets/KBPro/kbpro-ai-docs`.
- For AI-maintained wiki pages, follow `Assets/KBPro/kbpro-ai-docs/LLM-WIKI.md`.

## Self-Check Before Finishing
1. Run `git status --short`.
2. Build C# assemblies using `dotnet build`.
3. Check that subscriptions, timers, tweens, async tasks, and pooled objects are disposed or released.
4. Verify `.meta` files are correct and no unrelated changes were introduced.
5. Update `Assets/KBPro/kbpro-ai-docs` documentation if needed.


## COMPILATION ERROR CHECK PROTOCOL
- After ANY changes to C# code, the AI agent MUST wait for successful compilation and verify that there are no new errors in the Unity console (or in the dotnet build output).
- It is strictly forbidden to complete implementation and submit a report after C# changes without checking compiler logs. Completing a task with console errors is a task failure.
- If compilation errors are found, the agent must fix them immediately.

## MINIMUM INTERVENTION RULE (DO NOT BREAK WORKING CODE)
- Making new changes MUST NOT break the active structure and logic under any circumstances.
- Any intervention in the code must be extremely careful.
- If possible, do not touch working code and try not to change existing code unless it is directly required to solve the task.
- The agent must preserve the original behavior of the system and avoid sweep refactorings that could damage adjacent systems.
<!-- END DavASkoLLMWiki -->
