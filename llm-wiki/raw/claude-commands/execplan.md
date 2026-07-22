Create a KBPro ExecPlan for the described feature or task.

Feature / task description: $ARGUMENTS

## Before writing the plan

1. Read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/wiki/maps/architecture-map.md` first to choose the relevant architecture path.
2. Read `Assets/KBPro/kbpro-ai-docs/llm-wiki/wiki/concepts/execplans.md`.
3. Read `Assets/KBPro/kbpro-ai-docs/llm-wiki/raw/PLANS.md` in full and follow its format and requirements exactly.
4. Follow wiki links into raw sources only after the map identifies the relevant sources.
5. Grep and read relevant source files in `Assets/Core/` and `Assets/KBPro/` to understand the current state.

## ExecPlan requirements

- Fully self-contained: a developer with only the plan and the repo can implement it end-to-end.
- Every term of art defined in plain language.
- Anchored to observable outcomes: what the user can do after, commands to run, expected output.
- Files named with full repo-relative paths, functions named precisely.
- Milestones: each independently verifiable, narrative not bureaucratic.
- Required sections: `Progress`, `Surprises & Discoveries`, `Decision Log`, `Outcomes & Retrospective`.
- No nested triple-backtick fences inside the plan.

## Output

Save the ExecPlan to:
```
Assets/KBPro/kbpro-ai-docs/plans/{feature-name}-execplan.md
```

Create the `plans/` folder and Unity `.meta` files if needed. Do not store new
maintained plans under `raw/` unless the user explicitly says the plan is an immutable
raw source.

Then print the full path and a one-line summary of the plan's scope.
