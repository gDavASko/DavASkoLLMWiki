﻿# CLAUDE.md — dentistry-cow

## Project
- **Unity Version:** 6000.0.67f1 (from ProjectSettings/ProjectVersion.txt)
- **Primary Code Paths:** `Assets/Core` and `Assets/Dentistry-cow`
- **Platform Submodules:** `Assets/DavASko/*` (including `davasko-modules`, `davasko-logicservice`, `davasko-servicelocator`, `davasko-eventbus`, `davasko.configsystem`, `davasko-datasystem`, `davasko-uisystem`, `davasko-audiosystem`, `davasko-timers`, `davasko-parenttimer`, `davasko-idprocessors`, `davasko-modifier`, `davasko-ai`, `davasko-spine`, `davasko-rustore`, `davasko-analytic`, `davasko-plugins`)
- **Key Dependencies:** UniTask, UniRx, DOTween, Addressables, URP 17, Input System, Cinemachine, TextMeshPro, Odin/NaughtyAttributes, Spine, RuStore SDK, AppMetrica, Google Play packages.

## MCP Servers (.mcp.json)
| Server Name | Purpose | When to Use |
|---|---|---|
| `b24-dev-mcp` | Bitrix24 REST documentation, methods, and task fields. | When working with Bitrix24 task management or automation. |
| `context7` | Up-to-date documentation for libraries like UniTask, DOTween, Addressables. | When NewData/researching external package APIs or best practices. |
| `sequential-thinking` | Structured sequential thinking planning for complex coding tasks. | When designing or breaking down complex features. |
| `memory` | Session-based local MCP memory server. | When maintaining context/state across multiple prompts. |
| `fetch` | Browser fetching capabilities (via Puppeteer). | When retrieving live web documentation. |

## How to Work in This Project
- **Read Before Coding:** Read [architecture.md](Assets/DavASko/davasko-ai-docs/davasko-wiki/raw/architecture.md), [code_style.md](Assets/DavASko/davasko-ai-docs/unity-wiki/raw/code_style.md), and [principals.md](Assets/DavASko/davasko-ai-docs/davasko-wiki/raw/principals.md) inside `Assets/DavASko/davasko-ai-docs/davasko-wiki/raw/`.
- **Read Before AI Code Review:** Read `ai-generated-code-review.md` and `unity-ai-code-review-checklist.md` under `Assets/DavASko/davasko-ai-docs/wiki/runbooks/` and `wiki/concepts/`.
- **Tool Guidance:** Prioritize reading files before editing. Use Grep/Glob patterns to target queries. Use specialized local skills (like `davasko-code-navigator`) before starting changes.
- **Do Not Touch:** `Library/`, `Temp/`, `Logs/`, `obj/`, generated `.csproj` files, or Unity `.meta` files (unless adding/deleting project files).

## ExecPlans
- For complex changes, refactoring, or migrations, follow [PLANS.md](Assets/DavASko/davasko-ai-docs/llm-wiki/raw/PLANS.md).
- Create a self-contained ExecPlan and store it under `Assets/DavASko/davasko-ai-docs/`.

## DavASko Architecture Rules
- Preserve DavASko module boundaries and dependency directions.
- Use `LogicSystem`, `GameComponent`, `ModuleScope`, `[InjectSystems]`, and `[InjectComponent]` where the module framework is used.
- Use `LazySrv<T>` and DavASko `ServiceLocator` patterns for platform services when the surrounding code does so.
- Use `EventBus<T>`, `EventBinding<T>`, and event messages for decoupled communication. Always unregister in `Dispose`.
- Call `base.Initialize()` and `base.Dispose()` in DavASko lifecycle overrides.
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
- **Sync rules script:** `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Utils\sync-ai-rules.ps1`
- **Lint AI knowledge base:** `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Assets\DavASko\davasko-ai-docs\system/lint-wiki.ps1`
- **Build runtime C#:** `dotnet build .\Assembly-CSharp.csproj --no-restore /p:BuildProjectReferences=false /m:1 /v:minimal`
- **Build editor C#:** `dotnet build .\Assembly-CSharp-Editor.csproj --no-restore /p:BuildProjectReferences=false /m:1 /v:minimal`

## Knowledge Base Protocol (Rules for KB Maintenance)
- **Search First**: Before answering any query or modifying code, look up pages using the orchestrator:
  - Search by page name: `node Assets/DavASko/davasko-ai-docs/system/query-wiki.js --page <page_name>`
  - Full-text search: `node Assets/DavASko/davasko-ai-docs/system/query-wiki.js --search "<query>"`
- **Ingest via Pipeline**: To ingest new documents or files, place them in the incoming buffer `NewData/` first, then run:
  - Ingest command: `node Assets/DavASko/davasko-ai-docs/system/query-wiki.js --ingest NewData/<file_name> --layer <target_layer> [--subfolder <subfolder>]`
  - Layers: `unity-wiki`, `davasko-wiki`, `dentistry-cow-wiki`.
- **Decomposition**: If an imported document contains details belonging to multiple layers (e.g. Unity patterns + DavASko APIs + project details), you MUST propose a split schema to the user. Do not ingest monolith files into a single layer without user approval.
- **Stub Handling**: When referring to pages in higher layers or missing docs, add stubs to `dentistry-cow-wiki/wiki/stubs.md` to prevent lint errors. When ingesting a file that closes a stub, ensure the stub is automatically or manually removed from `stubs.md`.
- **Change Logging**: Log detailed changes into the layer's local `dentistry-cow-wiki/wiki/log.md` (UTF-8 with BOM). Then, append a fact reference in the root `log.md` with a link pointing directly to the new lines in the local log (e.g. `[layer/dentistry-cow-wiki/wiki/log.md#L45-L52](../dentistry-cow-wiki/wiki/log.md#L45-L52)`).
- **Validation**: After any knowledge base change, always validate using:
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Assets\DavASko\davasko-ai-docs\system/lint-wiki.ps1`

## Self-Check Before Finishing
- Commit messages: Use imperative mood and Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `docs:`, `chore:`).
- Branching: Use prefix `feature/<scope>`, `fix/<scope>`, `refactor/<scope>`, or `codex/<scope>`.

## Security
- Never commit secrets, API keys, tokens, passwords, signing credentials, local webhooks, or private `.env` files.

## Submodules and Vendor Code
- Do not update submodule revisions casually. Keep submodule edits narrowly scoped.
- Do not reformat or refactor third-party vendor code.

## Documentation
- Add or update documentation under `Assets/DavASko/davasko-ai-docs`.
- For AI-maintained wiki pages, follow `Assets/DavASko/davasko-ai-docs/LLM-WIKI.md`.

## Self-Check Before Finishing
1. Run `git status --short`.
2. Build C# assemblies using `dotnet build`.
3. Check that subscriptions, timers, tweens, async tasks, and pooled objects are disposed or released.
4. Verify `.meta` files are correct and no unrelated changes were introduced.
5. Update `Assets/DavASko/davasko-ai-docs` documentation if needed.
