Codex Instructions - KBPro Project

You are the AI Assistant for the DavASko LLM Wiki.

## Core Rule: Knowledge Base (On-Demand Reference)
Do NOT bulk-read the knowledge base before starting. Consult a document only when the task actually needs it, using this trigger -> source map. Open a file only if its one-line hint matches your current need:

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

## ABSOLUTE GIT PUSH/COMMIT BAN
- NEVER, UNDER ANY CIRCUMSTANCES, run git push, git commit, or git merge unless the user provides a DIRECT, EXPLICIT, UNAMBIGUOUS COMMAND (e.g. 'commit this', 'push it to origin').
- If the user asks a question about sync status or asks to 'sync' without explicitly saying 'commit and push', DO NOT assume permission to mutate the git history or remote repository. Show them the plan and wait for the explicit 'push' command.

## TEMPORARY FILES ISOLATION AND CLEANUP RULE
- NEVER create temporary files, test scripts, HTML/JSON dumps, or scratch files in arbitrary project locations or working directories.
- All temporary, experimental, or scratch files MUST be created strictly inside a designated temporary folder (e.g. `<appDataDir>\brain\<conversation-id>/scratch/` or a dedicated `.tmp/` / `scratch/` folder).
- Immediately after finishing the operation, test, or script execution, all temporary files and directories created during the task MUST be cleaned up and deleted to ensure the workspace remains completely clean.

## STRICT DOCUMENT PARSING AND QUALITY GATE RULE
- NEVER use partial caches, stale json chunks, or truncated local dumps instead of the complete live Google Doc/Sheets source.
- ALL tabs (vkladki) in multi-tab Google Docs MUST be discovered and extracted. 1 Tab = 1 Folder.
- Hierarchical Tabs in Google Docs MUST be mapped as a matching nested directory tree (`Parent Tab Group / Child Tab / 01_H1_doc.md`).

## STRICT RULES MODIFICATION PROTECTION RULE
- NEVER touch, modify, edit, rephrase, delete, or add to any sections of system instructions, rules, or AGENTS.md files that were NOT explicitly requested by the user.
- Any change to system rules is allowed strictly and only in the exact places, scope, and intent directly authorized by the user. Unsanctioned edits to system rules are considered critical failure.

## SINGLE AGENTS.MD SOURCE OF TRUTH RULE
- AGENTS.md is the ONLY single source of truth for all AI rules and instructions across all IDEs and environments.
- All other IDE rule files (.cursorrules, GEMINI.md, .windsurfrules, .clinerules, CLAUDE.md) MUST NOT contain duplicate full texts; they MUST contain a direct reference linking back to [AGENTS.md](AGENTS.md).