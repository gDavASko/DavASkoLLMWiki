---
title: "Raw Data Ingest Workflow"
type: runbook
status: reviewed
source_status: source-linked
sources:
  - LLM-WIKI.md
  - kbpro-wiki/wiki/sources/current-kbpro-ai-docs.md
last_updated: 2026-06-22 17:06
related:
  - "[[current-kbpro-ai-docs]]"
  - "[[legacy-documents-as-raw-sources]]"
tags:
  - llm
  - ai-rules
  - runbook
---

# Raw Data Ingest Workflow

**Summary**: Use this workflow when adding or processing raw documentation into the
Obsidian-compatible LLM Wiki.

**Sources**: LLM-WIKI.md, kbpro-wiki/wiki/sources/current-kbpro-ai-docs.md

**Last updated**: 2026-05-17

## Key Claims

- New external sources belong in `raw/`, while existing KBPro documents live under
  `kbpro-wiki/raw/`. (source: LLM-WIKI.md)
- Every ingest should update source summaries, relevant concept/entity/synthesis pages,
  `dentistry-cow-wiki/wiki/index.md`, and `dentistry-cow-wiki/wiki/log.md`. (source: LLM-WIKI.md)
- Any information discovered via grep, ripgrep, full-text search, or global search scripts/commands due to its absence in the maps or concepts is considered a Knowledge Base gap and must be documented to close the gap before task completion.

## Steps

1. Identify the source path. Existing project docs should be under
   `kbpro-wiki/raw/`; new external documents should be placed in `raw/`.
2. Read the full source in UTF-8 when possible.
3. Create or update a source summary in `wiki/sources/`.
4. Extract claims, concepts, entities, decisions, constraints, and contradictions.
5. Update relevant pages under `wiki/concepts/`, `wiki/entities/`, `wiki/syntheses/`,
   `wiki/runbooks/`, or `wiki/decisions/`.
6. Add Obsidian wiki links between pages.
7. Update `dentistry-cow-wiki/wiki/index.md`.
8. Append an entry to `dentistry-cow-wiki/wiki/log.md`.
9. Add regression questions or failures to `evals/` when the answer should compound.
10. Document any undocumented patterns, classes, or conventions discovered via grep, ripgrep, full-text search, or global search scripts/commands in the appropriate layer (e.g., `kbpro-wiki` or `dentistry-cow-wiki`), providing clear descriptions, code symbols, and absolute file links to prevent future generic search sessions.

## Related Pages

- [[current-kbpro-ai-docs]]
- [[legacy-documents-as-raw-sources]]
