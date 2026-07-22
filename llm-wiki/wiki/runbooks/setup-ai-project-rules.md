---
title: "Setup AI Project Rules"
type: runbook
status: draft
source_status: source-linked
sources:
  - kbpro-wiki/raw/SETUP_NEW_PROJECT.md
last_updated: 2026-06-22 17:06
related:
  - "[[raw-data-ingest-workflow]]"
  - "[[execplans]]"
tags:
  - llm
  - ai-rules
  - runbook
---

# Setup AI Project Rules

**Summary**: SETUP_NEW_PROJECT describes how to prepare a KBPro Unity project for AI
IDE and CLI tools by creating synchronized rules, MCP config, command templates,
project-local AI skills, and safe setup checks.

**Sources**: kbpro-wiki/raw/SETUP_NEW_PROJECT.md

**Last updated**: 2026-05-18

## Key Claims

- The setup workflow should inspect the Unity project root, Unity version, packages,
  submodules, and existing AI settings before writing rules. (source: kbpro-wiki/raw/SETUP_NEW_PROJECT.md)
- Root rule files include `AGENTS.md`, `.cursorrules`, `.windsurfrules`,
  `.clinerules`, `GEMINI.md`, and `.github/copilot-instructions.md`.
  (source: kbpro-wiki/raw/SETUP_NEW_PROJECT.md)
- `sync-ai-rules.ps1` synchronizes IDE rule files from
  `Assets/KBPro/kbpro-ai-docs/llm-wiki/raw/ide-rules`. (source: kbpro-wiki/raw/SETUP_NEW_PROJECT.md)
- Project-local AI skills live under
  `Assets/KBPro/kbpro-ai-docs/all-skills~/<skill-name>/SKILL.md`
  and are synchronized into Codex, Claude Code, Gemini, Cursor, Windsurf, Cline/Roo,
  and Copilot adapter locations. (source: kbpro-wiki/raw/SETUP_NEW_PROJECT.md)
- The first local skill source is `kbpro-code-navigator`, which must be used before
  code, scene, prefab, ScriptableObject, shader, material, or asset changes that
  require understanding existing KBPro conventions. (source:
  all-skills~/kbpro-code-navigator/SKILL.md)
- The synchronized rule files should point agents to `wiki/maps/` first and use
  `kbpro-wiki/raw/` as source evidence after a map identifies relevant documents.
  (source: llm-wiki/raw/ide-rules/GEMINI.md)
- MCP config must not contain Bitrix webhooks, API keys, OAuth tokens, passwords, or
  local user secrets. (source: kbpro-wiki/raw/SETUP_NEW_PROJECT.md)
- AI-only setup should not touch gameplay code, assets, scenes, prefabs, or submodules.
  (source: kbpro-wiki/raw/SETUP_NEW_PROJECT.md)
- For documentation and planning, the canonical ExecPlan instruction path is
  `Assets/KBPro/kbpro-ai-docs/llm-wiki/raw/PLANS.md`. (source: kbpro-wiki/raw/SETUP_NEW_PROJECT.md)
- For agent navigation, the canonical first layer is
  `Assets/KBPro/kbpro-ai-docs/wiki/maps/`. (source: llm-wiki/raw/ide-rules/GEMINI.md)

## Usage Notes

Use this runbook when porting the AI documentation/rules setup to another KBPro Unity
project. In the current repository, these instructions are raw source material because
the project already has an active LLM Wiki and synchronized rule files.

When adding a new portable skill, edit only
`all-skills~/<skill-name>/SKILL.md`, then run
`sync-ai-rules.ps1`. Do not hand-edit generated files under `.agents`, `.codex`,
`.claude`, `.gemini`, `.cursor`, `.windsurf`, `.cline`, `.roo`, or `.github/instructions`.

## Related Pages

- [[raw-data-ingest-workflow]]
- [[execplans]]
- [[operations-map]]
