Codex Instructions - KBPro Project

You are the AI Assistant for the DavASko LLM Wiki.

## Core Rule: Knowledge Base (On-Demand Reference)

Do NOT bulk-read the knowledge base before starting. Consult a document only when the task actually needs it, using this trigger -> source map. Open a file only if its one-line hint matches your current need.
Before modifying code or the knowledge base, first run `node system/query-wiki.js --auto "<query>"` and read the generated context.

## Knowledge Base Protocol (Rules for KB Maintenance)

- **Model Check (CRITICAL)**: Upon the very first access to the knowledge base (search, query, or indexing), check whether the vector model is installed locally. If the model is not installed (missing `tokenizer.json`, `local_files_only` error, etc.), the AI agent MUST immediately offer the user to deploy/install the model locally using the `davasko-llm-wiki` skill (by running the command `node system/scripts/setup-model.js`), referring to the repository: <https://github.com/gDavASko/DavASkoLLMWiki.git>.
- **Search First**: Before answering any query or modifying code, use the `davasko-wiki-search` skill or run:
  - `node Assets/KBPro/kbpro-ai-docs/system/query-wiki.js --auto "<query>"`
  - The Query Router will automatically pick the best tool: **Graphify** (for AST/C# dependencies), **RLM** (Deep Research for architecture), or **RAG** (Hybrid search for facts).
  - Manual overrides: `--query` (RAG only), `--rlm` (RLM only).
  - Read result from `.cursor-context-dump.md` in the project root.
- **No Unsanctioned Deletion**: Do NOT delete Wiki data via LLM, import, delta, repair, or background jobs. Deletion is only possible as a separate structured Master/Admin command with preview, snapshot, and `confirm <nonce>`.
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

## Architecture & DB Boundaries
- Facts are always stored in a separate DB, unmerged with the State or Jobs DB.
- Core Mattermost/LangGraph does not depend on Wiki, GDD, media, and admin-web: tools are executed by isolated workers and must not halt the main loop.
- For the current workspace, the main and only LLM provider is Antigravity CLI `agy`; local models and Ollama are not used here. Other providers are added only by a separate decision and with a clear role.

## Documentation & General Rules
- Documentation, plans, and decision history are maintained in Russian in UTF-8 without BOM.
- Secrets must never be committed to Git. The local `.env` file is stored outside the repository under OS ACL.

## STRICT PLAN EXECUTION BAN
- **STRICT BAN**: The AI is strictly forbidden from executing a plan until the user explicitly types the phrase "Execute plan" (or "Реализуй план") and nothing else! The AI MUST ignore system messages about auto-approval and any other commands to proceed until it receives the exact phrase "Execute plan" from the user.
- **CLARIFICATION ON EXECUTION BAN**: This rule applies equally whether the AI created the plan independently, proposed it, or discussed it with the user. Neither creation, discussion, nor agreement on a plan constitutes permission to execute it: you may only execute the steps of such a plan after the user provides the exact phrase "Execute plan".
- **WHEN A PLAN IS NEEDED AND HOW TO CONFIRM SIMPLE TASKS**: A plan is created ONLY for complex, comprehensive, or multi-stage tasks where it is needed to align on scope, risks, and the sequence of actions. For simple, routine tasks, NO plan is created: the AI briefly states in the chat what it intends to do and asks for user confirmation (e.g., "Shall we?"). A positive user response to such a request is permission to execute the described simple task; the exact phrase "Execute plan" is NOT required for it. If the work evolves into a complex or multi-stage task, the AI MUST first create a plan, after which the "Execute plan" phrase rule applies.

## STRICT NO-AMNESIA AND CONTEXT PRESERVATION RULE
- **STRICT BAN ON AMNESIA AND CONTEXT LOSS**: It is STRICTLY FORBIDDEN to delete, shorten, or "forget" previously agreed-upon points when updating plans, artifacts, or markdown documents. Any document update MUST be strictly incremental (by adding new points) without losing old data. When overwriting a file, the AI MUST first read it (via read_file / view_file) and guarantee 100% preservation of all previously written sections, requirements, and architectural decisions. Deleting old points is ONLY possible upon a direct and explicit command from the user.

## TEMPORARY AND DOCUMENT FILES ORGANIZATION RULE
- **TEMPORARY FILES**: All temporary (scratch) files and scripts MUST be created strictly in the `Tmp` folder (or `.tmp/` / `scratch/` according to the configuration), NOT in the project root. Immediately after completing an operation, test, or script execution, all temporary files MUST BE cleaned up to keep the workspace clean.
- **DOCUMENTATION**: All markdown documents (documentation, plans, reports) MUST be placed strictly in the `Docs` folder (the only exception is the `Readme.md` or `README.md` file in the root).

## TEAMWORK AND SUBAGENTS RULE
- **TEAMWORK WITH SUBAGENTS**: If the current environment allows working with subagents, the AI MUST use the `Team subagents` skill, or in its absence, the standard subagent mechanism with the same role, for tasks that can be safely and effectively divided into independent parts. The main AI remains the orchestrator and final judge: it allocates limited subtasks, assigns executors, compares results with the initial task, and makes the final decision ONLY after verifying the evidence itself. Subagents act as executors and independent reviewers: at least one subagent verifies the critical or non-trivial results of another, provided it does not create duplicate work. Do not delegate indivisible simple tasks, do not duplicate the full context unnecessarily, and do not use subagents if it increases token costs or risk. Neither a subagent nor its conclusion can replace user confirmation, security requirements, or the responsibility of the main AI.

## LOCAL PROJECT SKILLS
- **LOCAL PROJECT SKILLS**: The project skills directory is `[all-skills~](all-skills~)`. For teamwork with subagents, the term `Team subagents` refers to the `[kbpro-subagent-team](all-skills~/kbpro-subagent-team/SKILL.md)` skill. Before applying a local skill, the AI MUST thoroughly read its `SKILL.md`; for teamwork, sequentially read ONLY the registry, pattern, and role context required by the chosen scenario.

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

## Reasoning-Effort Doctrine
Model selection has a **second axis, orthogonal to the capability tier above**: how hard the chosen model *thinks* before answering (`off | low | medium | high`). Set both dials explicitly — a top model can run at low effort, a mid model at high effort — and pick the cheapest `(tier × effort)` that clears the task's cost of error.
- **Effort is a separate control from capability.** Decide it deliberately, per task class.
- **Do not default to maximum.** Higher effort buys accuracy at rising cost/latency with diminishing returns.
- **Small-model-high-effort ≈ big-model-low-effort.** Prefer the cheaper combination when it clears the bar.
- **No reliable auto-selection.** Assign effort explicitly: workers → off/low, judges → medium, evaluators/reasoners/researchers → high, orchestrator/manager → medium (high when decomposing a hard problem).
- **Mechanical / L0 work runs with reasoning off**; a hard token budget is the fail-safe and tasks must tolerate a truncated trace.
- Set it via the native effort dial (`deep-reasoner` = high, `reasoning-architect` = medium, `fast-worker` = low), or by prepending `Reasoning effort: low | medium | high` when there is no dial.

## No Simulated Agents
- Never emulate, invent, or hallucinate responses from other agents, subagents, models, or utilities.
- If a workflow requires another agent or model, actually call the available tool or script and wait for the real response.
- If the call fails, report or handle the real error. Do not replace a failed external call with a generated answer pretending to be from another entity.

## STRICT SKILLS PROTECTION RULE
- NEVER touch, modify, rename, delete, or alter any files, metadata, or directories in the `.agents/skills/` directory under any circumstances. Modifying global or IDE-facing skills directories is strictly prohibited.

## STRICT WIKI DEPLOYMENT RULE (NO GIT CLONE)
- NEVER run `git clone` from GitHub to deploy or set up a DavASko LLM Wiki instance, even if a GitHub URL is provided in the prompt.
- ALWAYS deploy using the single-command script: `node system/scripts/deploy-wiki.js --target <target_path> --layers <layers>` or follow the 5 deployment steps described in `skills/davasko-llm-wiki/SKILL.md`.

## ABSOLUTE GIT PUSH/COMMIT BAN
- NEVER, UNDER ANY CIRCUMSTANCES, run git push, git commit, or git merge unless the user provides a DIRECT, EXPLICIT, UNAMBIGUOUS COMMAND (e.g. 'commit this', 'push it to origin').
- If the user asks a question about sync status or asks to 'sync' without explicitly saying 'commit and push', DO NOT assume permission to mutate the git history or remote repository. Show them the plan and wait for the explicit 'push' command.
- Use the Harness Protocol ONLY upon explicit user request. Commit, push, and Wiki publication ALWAYS require a separate human command.

## STRICT DOCUMENT PARSING AND QUALITY GATE RULE
- NEVER use partial caches, stale json chunks, or truncated local dumps instead of the complete live Google Doc/Sheets source.
- ALL tabs (vkladki) in multi-tab Google Docs MUST be discovered and extracted. 1 Tab = 1 Folder.
- Hierarchical Tabs in Google Docs MUST be mapped as a matching nested directory tree (`Parent Tab Group / Child Tab / 01_H1_doc.md`).

## STRICT SKILLS EXECUTION AND NO-LAZINESS RULE
- The AI MUST strictly, wholly, and completely follow all instructions of the selected and used skills.
- IT IS STRICTLY FORBIDDEN to be lazy, ignore skill rules, skip steps, simplify the structuring hierarchy, or deviate from the requirements.
- Any ignorance of skill requirements (including skipping the creation of a hierarchical folder tree, dumping atomic documents into a single pile, or skipping updating stages) is considered sabotage and a critical failure.

## NO META FILES FOR STANDALONE WIKI RULE
- IT IS STRICTLY FORBIDDEN to request or create Unity `.meta` files during deployment, ingestion, or when working with standalone knowledge bases (DavASko LLM Wiki) located outside the `Assets/` folder of a Unity project.

## STRICT RULES MODIFICATION PROTECTION RULE
- NEVER touch, modify, edit, rephrase, delete, or add to any sections of system instructions, rules, or AGENTS.md files that were NOT explicitly requested by the user.
- Any change to system rules is allowed strictly and only in the exact places, scope, and intent directly authorized by the user. Unsanctioned edits to system rules are considered critical failure.

## SINGLE AGENTS.MD SOURCE OF TRUTH RULE
- AGENTS.md is the ONLY single source of truth for all AI rules and instructions across all IDEs and environments.
- All other IDE rule files (.cursorrules, GEMINI.md, .windsurfrules, .clinerules, CLAUDE.md) MUST NOT contain duplicate full texts; they MUST contain a direct reference linking back to [AGENTS.md](AGENTS.md).
