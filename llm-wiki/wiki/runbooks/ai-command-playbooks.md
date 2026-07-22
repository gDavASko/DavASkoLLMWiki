---
title: "AI Command Playbooks"
type: runbook
status: draft
source_status: derived
sources:
  - llm-wiki/raw/claude-commands/execplan.md
  - llm-wiki/raw/claude-commands/kbpro-event.md
  - llm-wiki/raw/claude-commands/kbpro-module.md
  - llm-wiki/raw/claude-commands/kbpro-review.md
  - llm-wiki/raw/claude-commands/unity-perf.md
last_updated: 2026-06-22 17:06
related:
  - "[[execplans]]"
  - "[[create-game-module]]"
  - "[[event-bus]]"
  - "[[kbpro-code-style]]"
tags:
  - llm
  - ai-rules
  - runbook
---

# AI Command Playbooks

**Summary**: Operational guide to the Claude command templates preserved in raw
project docs.

**Sources**: llm-wiki/raw/claude-commands/execplan.md,
llm-wiki/raw/claude-commands/kbpro-event.md,
llm-wiki/raw/claude-commands/kbpro-module.md,
llm-wiki/raw/claude-commands/kbpro-review.md,
llm-wiki/raw/claude-commands/unity-perf.md

**Last updated**: 2026-05-18

---

## ExecPlan Command

The ExecPlan command tells an agent to start from [[architecture-map]], read
[[execplans]], read `PLANS.md`, inspect relevant project code, decompose the task, and
write a self-contained plan. (source: llm-wiki/raw/claude-commands/execplan.md)

The command's output path now points into `wiki/plans/`, keeping new maintained plans
out of `raw/` unless the user explicitly marks a plan as an immutable raw source.
(source: llm-wiki/raw/claude-commands/execplan.md; source: LLM-WIKI.md)

## Module Command

The KBPro module command tells an agent to start from [[architecture-map]] and
[[module-creation-workflow]], then read the raw module creation guide, module
documentation guide, closest examples, and code style before generating a gameplay
module. (source: llm-wiki/raw/claude-commands/kbpro-module.md)

It expects the output to include a `GameComponent` module entry point, one or more
`LogicSystem` classes, optional config assets, dependency injection attributes, wiring
notes, and `git status --short`. (source: llm-wiki/raw/claude-commands/kbpro-module.md)

## Event Command

The KBPro event command is a focused playbook for creating an event message and showing
publisher and subscriber usage through the project's EventBus conventions. (source: llm-wiki/raw/claude-commands/kbpro-event.md)

## Review Commands

The KBPro review command prioritizes architecture, code style, lifecycle cleanup,
dependency injection, EventBus usage, and performance risks. (source: llm-wiki/raw/claude-commands/kbpro-review.md)

The Unity performance command focuses on allocations, object lifecycle, physics,
rendering, Addressables, and measurable fixes. (source: llm-wiki/raw/claude-commands/unity-perf.md)

## Related Pages

- [[execplans]]
- [[create-game-module]]
- [[event-bus]]
- [[kbpro-code-style]]
- [[automation-scripts-and-rules]]
- [[architecture-map]]
- [[module-creation-workflow]]
