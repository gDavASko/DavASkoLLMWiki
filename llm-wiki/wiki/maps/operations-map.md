---
title: "operations-map.md"
type: map
status: draft
sources:
  - llm-wiki\wiki\maps\operations-map.md
last_updated: 2026-06-22 17:09
related: []
tags:
  - wiki
---
--
title: "Operations Map"
type: map
status: draft
source_status: derived
sources:
  - dentistry-cow-wiki/wiki/index.md
  - llm-wiki/wiki/sources/llm-rules-and-skills.md
  - system/scripts/lint-wiki.js
last_updated: 2026-05-18
related:
  - "[[raw-data-ingest-workflow]]"
  - "[[automation-scripts-and-rules]]"
  - "[[bitrix-task-import]]"
  - "[[ai-generated-code-review]]"
  - "[[ai-agent-ready-workflow]]"
  - "[[unity-ai-workflow-video-sources]]"
---

# Operations Map

**Summary**: Obsidian entry point for wiki maintenance, AI rule synchronization,
Bitrix task import, and operational guardrails.

**Sources**: dentistry-cow-wiki/wiki/index.md, llm-wiki/wiki/sources/llm-rules-and-skills.md, system/scripts/lint-wiki.js

**Last updated**: 2026-05-18

---

## Wiki Maintenance

Use [[raw-data-ingest-workflow]] when adding or processing a new raw source. (source:
dentistry-cow-wiki/wiki/index.md)

Use [[contradictions]] before trusting claims that may be stale, conflicting, missing,
or security-sensitive. (source: dentistry-cow-wiki/wiki/index.md)


## AI Operations

- [[setup-ai-project-rules]] - prepare and synchronize AI IDE rule files.
- [[ai-command-playbooks]] - Claude command templates for modules, reviews, events,
  performance, and ExecPlans.
- [[automation-scripts-and-rules]] - source summary for scripts and AI rule templates.
- [[unity-agent-skill-set]] - agent checklist and skill map for Unity work.
- [[unity-ai-skill-donor-inventory]] - downloaded candidate external donors for the
  local Unity AI skill library.
- [[unity-ai-skill-donor-analysis]] - ranking, risks, and recommended local skill
  build order for downloaded Unity AI donors.
- [[unity-ai-skill-systematization]] - taxonomy, safety model, and phased local
  skill roadmap from downloaded Unity AI donors.
- [[unity-ai-skill-coverage-audit]] - coverage audit for whether downloaded donors
  cover full Unity work from code to complex prefabs and shaders.
- [[architecture-challenge-protocol]] - safely evaluate external best practices that
  conflict with current KBPro approaches.
- [[ai-vibe-code-review-video-sources]] - source summary for AI/vibe-code review video records.
- [[unity-ai-workflow-video-sources]] - source summary for Unity AI workflow, MCP,
  prompts, Editor automation, prefabs, shaders, and VFX.
- [[ai-generated-code-review]] - diff-first review workflow for AI-generated changes.
- [[ai-code-cleaning]] - cleanup pass for AI-generated drafts.
- [[ai-agent-ready-workflow]] - scoped workflow for verifiable agent tasks.
- [[unity-ai-agent-environment-setup]] - prepare a Unity project for AI Editor work.
- [[unity-ai-agent-rules-and-prompts]] - write Unity-specific agent rules and task prompts.
- [[local-unity-ai-skill-library]] - build a project-owned Unity AI skill library
  from validated local and external sources.
- [[unity-ai-skill-validation]] - validate local or imported Unity AI skills before
  project approval.
- [[unity-editor-automation-with-ai]] - bound Unity Editor automation through MCP or bridges.
- [[unity-ai-prefab-scene-workflow]] - use AI for prefab, component, and scene setup.
- [[unity-ai-vfx-shader-workflow]] - use AI for materials, shaders, particles, and VFX.
- [[unity-shader-ai-guidelines]] - mandatory rules for AI-written or AI-edited Unity
  HLSL/Shader Graph work.
- [[unity-ai-agent-validation]] - validate AI Unity changes across code and assets.
- [[unity-skills-besty-workflow]] - **start here** before any Unity Skills / Besty REST session: prerequisites, server startup, REST call pattern, known pitfalls (IPv6, python requests, unity-skills~ folder, UNITASK_DOTWEEN_SUPPORT).
- [[ai-source-confidence]] - confidence levels for transcript/source-backed AI NewData/research.
- [[security-redaction-over-raw-immutability]] - rule for removing secrets from raw
  files when security conflicts with source immutability.

## Bitrix And Backlog

- [[decompose-task-to-backlog]] - convert feature briefs into task JSON.
- [[bitrix-task-import]] - import task JSON into Bitrix24 and avoid secret exposure.

## Quality Gates

Run `.\system/scripts/lint-wiki.js` from `Assets/KBPro/kbpro-ai-docs` after wiki changes to check
page format, wiki links, orphan pages, source citations, raw Markdown links, `.meta`
files, raw-source coverage, and hardcoded Bitrix24 REST webhook URLs. (source:
system/scripts/lint-wiki.js)

## Related Pages

- [[raw-data-ingest-workflow]]
- [[automation-scripts-and-rules]]
- [[unity-ai-skill-donor-inventory]]
- [[unity-ai-skill-donor-analysis]]
- [[unity-ai-skill-systematization]]
- [[unity-ai-skill-coverage-audit]]
- [[architecture-challenge-protocol]]
- [[bitrix-task-import]]
- [[contradictions]]
- [[security-redaction-over-raw-immutability]]
- [[ai-generated-code-review]]
- [[ai-code-cleaning]]
- [[ai-agent-ready-workflow]]
- [[unity-ai-workflow-video-sources]]
- [[unity-ai-agent-environment-setup]]
- [[unity-ai-agent-rules-and-prompts]]
- [[local-unity-ai-skill-library]]
- [[unity-ai-skill-validation]]
- [[unity-editor-automation-with-ai]]
- [[unity-ai-prefab-scene-workflow]]
- [[unity-ai-vfx-shader-workflow]]
- [[unity-shader-ai-guidelines]]
- [[unity-ai-agent-validation]]
- [[ai-source-confidence]]
