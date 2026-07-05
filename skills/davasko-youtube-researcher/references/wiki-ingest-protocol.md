# Ingestion Protocol for YouTube Research

When integrating new knowledge from YouTube videos, the AI agent must strictly follow the structured document schemas and ingestion workflow described below.

---

## 1. Research Notes Schema (Exhaustive Technical Documentation)

Each video must be documented as an exhaustive, deep technical documentation for the corporate knowledge base. The final compiled document must adhere strictly to the following structure:

```markdown
# [VIDEO TECHNOLOGY/SOLUTION NAME]

**Source URL**: [Link to the video]
**Author/Channel**: [Author Name / Channel Name]
**Date Analyzed**: YYYY-MM-DD

## 1. Context, Problem, and Stack
* **Problem Solved**: What specific engineering or business pain does the video approach solve? Why do standard solutions fail?
* **Technology Stack**: Full list of tools, languages, frameworks, and their versions.
* **Selection Criteria**: What alternatives did the author mention and why were they rejected?

## 2. Architecture and Conceptual Model
* Describe architectural patterns, data flow logic, and component interactions in detail.
* Draw an ASCII diagram or schema representing components interaction (e.g. Client -> API Gateway -> Server -> DB).
* Define all specific terms and concepts introduced by the author.

## 3. Step-by-Step Implementation Guide (Deep-Dive How-To by parts)
* Break down the implementation process into steps (`Step 1: ...`, `Step 2: ...`).
* Within each step specify:
  - Command to run in the terminal (if any).
  - Target file path and name being modified.
  - Complete, functional code or configuration file.
  - Detailed explanation: WHY this line of code/config is written and how it works under the hood.

## 4. Errors, Limitations, and Best Practices
* **Development Pitfalls**: What bugs, side effects, or non-obvious behavior did the author encounter (or warn about)? How to solve them?
* **Best Practices**: Author's recommendations for optimization, security, scaling, logging, or code style.
* **Applicability Boundaries**: In which cases does this solution work perfectly, and where should it never be used?

## 5. References
* List all links, repositories, articles, documentation, or third-party services mentioned by the author.
```

---

## 1.1 Automatic Chunking Protocol & Strict Rules

To prevent information loss and output compression when working with long videos, the AI agent MUST strictly follow these rules:

### A. Automatic Chunking Workflow (No-Pause Generation)
1. **Video Chunking Plan**: Divide the video content into logical steps/parts based on development milestones.
2. **Sequential Generation**: Document each part sequentially to the deepest level without omissions. Do NOT pause to ask for user approval between parts. Produce the complete detailed sections for all parts. If token limits are reached, stop and ask the user to type "continue" to proceed, resuming from the same character.

### B. Strict No-Compression Rules
1. **No Code Placeholders**: Do not use placeholders like `// your code here`, `// ... rest of the logic`, `/* and so on */`. Write all code, configurations, and data structures fully as described or shown by the author.
2. **No Generalization**: If the author configures a 10-line config or creates 5 endpoints, document all 10 lines and all 5 endpoints.
3. **Preserve Context**: Document all errors made and fixed, reasons for tool choices, and performance considerations.
4. **Volume & Accuracy Over Brevity**: Technical depth is the priority. If token limits are reached, stop immediately. The user will type "continue" to let you proceed from the same character.

### C. Formatting Guidelines
- Write the entire document in Markdown.
- Highlight all technical terms, libraries, methods, variables, files, CLI commands, and database names as `inline code`.
- Use syntax highlighting for code blocks (e.g. ```csharp, ```javascript, ```yaml, ```bash).

---

## 2. Ingestion Plan (Implementation Plan)

Before editing any files in the permanent layers, draft an `implementation_plan.md` in the artifacts folder (written in Russian). The plan must detail:
- Which video files are being analyzed.
- Which layers (`engine-wiki`, `davasko-wiki`, `project-a-wiki`) and directories the new files will be imported to.
- Wait for explicit user review and approval in the chat via: **«Реализуем план»**.

---

## 3. Placement in the Ingestion Buffer (`NewData`)

After the plan is approved, layout your compiled documents in the `NewData/` folder according to their target layer names. 
The ingestion script reads this folder structure to automatically route files:

```
NewData/
  ├── engine-wiki/
  │     └── transcripts/
  │           └── ai-vibe-code-review/
  │                 └── my-video-summary.md   <-- summary file
  │
  ├── davasko-wiki/
  │     └── Architecture/
  │           └── my-architecture-summary.md  <-- summary file
  │
  └── project-a-wiki/
        └── gameplay/
              └── my-gameplay-summary.md      <-- summary file
```

*Note: If you have matching Unity `.meta` files for your new documents, place them right next to the `.md` files (e.g. `my-video-summary.md.meta`). The script will import them together.*

---

## 4. Run the Ingestion Automation

After placing the files, execute the ingestion automation script:
```bash
node system/scripts/ingest-newdata.js
```

The script automatically performs the following tasks:
1. Moves the `.md` files to `<layer-name>/raw/<subfolder-path>/`. Markdown files are written as UTF-8 with BOM; all non-`.md` files (e.g. `.json`) are written as UTF-8 without BOM (see Data Standards §1).
2. Moves `.meta` files (if present) or generates a new GUID for wiki pages.
3. Generates source summaries in `<layer-name>/wiki/sources/`.
4. Appends links to local index lists `index.md`.
5. Deletes the imported files from the temporary buffer `NewData/` (leaving it clean).
6. Runs `system/scripts/lint-wiki.js` to ensure graph health.
