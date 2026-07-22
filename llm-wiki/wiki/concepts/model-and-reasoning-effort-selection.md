---
title: "Model & Reasoning-Effort Selection"
type: concept
status: draft
source_status: source-linked
sources:
  - llm-wiki/raw/model-and-reasoning-effort-selection.md
  - AGENTS.md
  - HarnessProtocol/config/harness.config.json
last_updated: 2026-07-22
related:
  - "[[operations-map]]"
tags:
  - llm
  - ai-rules
  - concept
  - model-selection
  - reasoning-effort
symbols:
  - ReasoningEffort
  - ModelTier
  - Orchestration
  - HarnessProtocol
---

# Model & Reasoning-Effort Selection

**Summary**: Model selection is two orthogonal dials — capability tier (*which*
model) and reasoning effort (*how hard* it thinks). Both must be set explicitly for
every delegated task, because reliable automatic effort selection does not exist.

**Sources**: llm-wiki/raw/model-and-reasoning-effort-selection.md, AGENTS.md,
HarnessProtocol/config/harness.config.json

**Last updated**: 2026-07-22

## Key Claims

- Capability tier and reasoning effort are independent axes; set both on purpose and
  never let one default silently. (source: llm-wiki/raw/model-and-reasoning-effort-selection.md)
- Higher effort raises accuracy at rising cost and latency with diminishing returns —
  do not default to maximum effort. (source: llm-wiki/raw/model-and-reasoning-effort-selection.md)
- A smaller model at higher effort can match a larger model at lower effort; prefer
  the cheaper combination when it clears the bar. (source: llm-wiki/raw/model-and-reasoning-effort-selection.md)
- Automatic effort selection is not reliable, so each task class needs an explicitly
  assigned effort level. (source: llm-wiki/raw/model-and-reasoning-effort-selection.md)
- Mechanical/predetermined work runs with reasoning off; a hard token budget is the
  fail-safe and tasks must tolerate truncated reasoning. (source: llm-wiki/raw/model-and-reasoning-effort-selection.md)

## Details

The rule provides a five-step selection procedure (classify → pick tier → pick effort
→ try the cheaper swap → cap and protect) and a `role/criticality → effort` table that
maps L0–L3 and agent roles onto `off / low / medium / high`. It aligns with the
existing IDE subagents: `deep-reasoner` (high), `reasoning-architect` (medium),
`fast-worker` (low). Concrete model ids stay machine-owned in `harness.config.json`;
this rule governs the decision procedure, not the id mapping.

Full text: [model-and-reasoning-effort-selection.md](file:///e:/UnityProjects/IRI/dentistry-cow/Assets/KBPro/kbpro-ai-docs/llm-wiki/raw/model-and-reasoning-effort-selection.md)

## Related Pages

- [[operations-map]]
