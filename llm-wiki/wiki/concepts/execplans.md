---
title: "ExecPlans"
type: concept
status: draft
source_status: source-linked
sources:
  - llm-wiki/raw/PLANS.md
  - AGENTS.md
last_updated: 2026-06-22 17:06
related:
  - "[[current-kbpro-ai-docs]]"
tags:
  - llm
  - ai-rules
  - concept
symbols:
  - ExecPlans
  - Sources
  - PLANS
  - AGENTS
  - Last
  - Complex
---

# ExecPlans

**Summary**: ExecPlans are self-contained living implementation plans for complex or
risky work, designed so a stateless agent or novice can continue safely.

**Sources**: llm-wiki/raw/PLANS.md, AGENTS.md

**Last updated**: 2026-05-17

## Key Claims

- Complex features, risky refactors, system migrations, and multi-step architecture
  work should use an ExecPlan. (source: AGENTS.md)
- Every ExecPlan must be self-contained, kept current, and capable of guiding a
  complete novice to a demonstrably working outcome. (source: llm-wiki/raw/PLANS.md)
- ExecPlans must maintain `Progress`, `Surprises & Discoveries`, `Decision Log`, and
  `Outcomes & Retrospective` sections. (source: llm-wiki/raw/PLANS.md)
- ExecPlans must include validation and acceptance instructions, not just code-change
  descriptions. (source: llm-wiki/raw/PLANS.md)

## Details

ExecPlans belong to the durable documentation layer, but when they are active they are
also operational state. They should be treated as raw sources for wiki synthesis and
may also be updated directly while executing their work.

## Related Pages

- [[current-kbpro-ai-docs]]
