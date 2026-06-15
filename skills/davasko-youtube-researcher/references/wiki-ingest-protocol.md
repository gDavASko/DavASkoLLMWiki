# Ingestion Protocol for YouTube Research

When integrating new knowledge from YouTube videos, the AI agent must strictly follow the structured document schemas and ingestion workflow described below.

---

## 1. Research Notes Schema (Transcript Summary)

Each video must be documented in a separate Markdown file with the following structure:

```markdown
# Video Title (e.g. Beyond Vibe Coding — Addy Osmani)

**Source URL**: https://www.youtube.com/watch?v=...
**Author/Channel**: Channel Name / Author Name
**Date Analyzed**: YYYY-MM-DD

## Summary
A brief overview (1-2 paragraphs) explaining the video topic and its direct value to the project.

## Key Claims
- Key claim 1. (source: [timestamp, e.g., 03:15])
- Key claim 2. (source: [12:40])

## Detailed Transcript Analysis
Themed sections detailing the discussions, workflows, or technical concepts in the video.

## Architectural Recommendations
Concrete practical action items showing what and how we can apply in the Unity / KBPro codebase (e.g. "adopt TDD for LogicSystems", "write a custom prefab validator").

## Related Pages
- [link-to-other-wiki-page]
```

---

## 2. Ingestion Plan (Implementation Plan)

Before editing any files in the permanent layers, draft an `implementation_plan.md` in the artifacts folder (written in Russian). The plan must detail:
- Which video files are being analyzed.
- Which layers (`unity-wiki`, `kbpro-wiki`, `dentistry-cow-wiki`) and directories the new files will be imported to.
- Wait for explicit user review and approval in the chat via: **«Реализуем план»**.

---

## 3. Placement in the Ingestion Buffer (`NewData`)

After the plan is approved, layout your compiled documents in the `NewData/` folder according to their target layer names. 
The ingestion script reads this folder structure to automatically route files:

```
NewData/
  ├── unity-wiki/
  │     └── transcripts/
  │           └── ai-vibe-code-review/
  │                 └── my-video-summary.md   <-- summary file
  │
  ├── kbpro-wiki/
  │     └── Architecture/
  │           └── my-architecture-summary.md  <-- summary file
  │
  └── dentistry-cow-wiki/
        └── gameplay/
              └── my-gameplay-summary.md      <-- summary file
```

*Note: If you have matching Unity `.meta` files for your new documents, place them right next to the `.md` files (e.g. `my-video-summary.md.meta`). The script will import them together.*

---

## 4. Run the Ingestion Automation

After placing the files, execute the ingestion automation script:
```bash
node Assets/KBPro/kbpro-ai-docs/system/ingest-newdata.js
```

The script automatically performs the following tasks:
1. Moves the `.md` files to `Assets/KBPro/kbpro-ai-docs/<layer-name>/raw/<subfolder-path>/` and converts them to UTF-8 with BOM.
2. Moves `.meta` files (if present) or generates a new GUID for wiki pages.
3. Generates source summaries in `<layer-name>/wiki/sources/`.
4. Appends links to local index lists `index.md`, local changelogs `log.md`, and the root `log.md` file.
5. Deletes the imported files from the temporary buffer `NewData/` (leaving it clean).
6. Runs `system/lint-wiki.js` to ensure graph health.
