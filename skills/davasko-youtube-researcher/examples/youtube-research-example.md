# YouTube Research Example

This example demonstrates how an AI agent processes a YouTube video link and structures the knowledge base updates.

---

## Initial User Request
> Analyze the video at https://www.youtube.com/watch?v=example123 on best practices for AI coding, and add the notes to the wiki.

---

## Step 1. Transcript Extraction
The agent runs a Node.js scraper script and saves the raw transcript of video ID `example123` to a temporary `transcript.txt` file.
Example transcript output fragment:
```
[00:00] Hi everyone, today we'll discuss how to use AI coding assistants pragmatically.
[01:15] The key rule: do not write code in one click. Always decompose tasks into small steps.
[03:40] Test your generated code with unit tests. AI often fails on edge cases.
```

---

## Step 2. Draft Ingestion Plan (Implementation Plan)
The agent drafts the `implementation_plan.md` in the artifacts folder (written in Russian):

```markdown
# План импорта исследования "Pragmatic AI Coding"

Внедрение конспекта видео "How to use AI pragmatically" в слой `unity-wiki` базы знаний.

## Proposed Changes

### База знаний (Слой `unity-wiki`)
#### [NEW] [pragmatic-ai-coding.md](file:///e:/UnityProjects/IRI/dentistry-cow/Assets/DavASko/davasko-ai-docs/unity-wiki/raw/transcripts/ai-vibe-code-review/pragmatic-ai-coding.md)

## Verification Plan
- Запуск `ingest-newdata.js`
- Проверка ссылок `validate-links.js`
```

The user approves the plan by writing in chat: **«Реализуем план»**.

---

## Step 3. Place Files in the `NewData` Ingest Buffer
The agent writes the research notes to `NewData/unity-wiki/transcripts/ai-vibe-code-review/pragmatic-ai-coding.md`:

```markdown
# Pragmatic AI Coding Practices

**Source URL**: https://www.youtube.com/watch?v=example123
**Author**: Tech Talks
**Date Analyzed**: 2026-06-15

## Summary
Practical recommendations on utilizing AI coding assistants with a heavy focus on decomposition and automated testing.

## Key Claims
- Always decompose target code into small pieces before prompting the AI. (source: [01:15])
- Verify generated code using robust test suites to check edge-case logic. (source: [03:40])

## Detailed Transcript Analysis
...detailed breakdown of transcript chapters...

## Architectural Recommendations
- Require agents to write tests for LogicSystems before modifying production scripts.
```

---

## Step 4. Run the Ingestion Script
The agent executes the ingestion script:
```bash
node Assets/DavASko/davasko-ai-docs/system/ingest-newdata.js
```

The script automatically:
1. Moves the file to `unity-wiki/raw/transcripts/ai-vibe-code-review/pragmatic-ai-coding.md`.
2. Generates the source summary in `unity-wiki/wiki/sources/pragmatic-ai-coding.md`.
3. Appends links to local index lists and logs.
4. Leaves the `NewData/` folder completely clean.
5. Runs validation.
