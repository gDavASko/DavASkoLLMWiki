# Rules & Skill Synchronizer

To guide AI agents (like Cursor, Windsurf, Claude Code, Cline, Roo, Gemini, and Copilot) according to the project's architecture, we distribute master rules and skills into IDE-specific paths.

---

## 1. IDE Rule Destinations

The synchronizer script takes master files from `llm-wiki/raw/ide-rules/` and copies them to the workspace root:

| Source File | Destination Path | Target Tool |
|-------------|------------------|-------------|
| `.cursorrules` | `.cursorrules` | Cursor IDE |
| `GEMINI.md` | `GEMINI.md` | Gemini CLI / Antigravity |
| `.windsurfrules` | `.windsurfrules` | Windsurf IDE |
| `.clinerules` | `.clinerules` | Cline |
| `AGENTS.md` | `AGENTS.md` | All AI Agents (Instructions) |
| `CLAUDE.md` | `CLAUDE.md` | Claude Code CLI |
| `copilot-instructions.md` | `.github/copilot-instructions.md` | GitHub Copilot |

---

## 2. Skill Synchronization and Formatting

The synchronizer scans `raw/ai-skills~/` folders across all layers, extracts their `SKILL.md` manifests, and generates IDE adapters:

- **Folders copy**: Copies the skill folder recursively (excluding `.meta` files) to `.agents/skills/<skill-name>/`, `.codex/skills/...`, `.claude/skills/...`, and `.gemini/skills/...`.
- **Cursor Rules**: Copies the `SKILL.md` content to `.cursor/rules/<skill-name>.mdc`.
- **Windsurf Rules**: Copies the `SKILL.md` content to `.windsurf/rules/<skill-name>.md`.
- **Cline Rules**: Copies the `SKILL.md` content to `.cline/rules/<skill-name>.md`.
- **Roo Rules**: Copies the `SKILL.md` content to `.roo/rules/<skill-name>.md`.
- **GitHub Instructions**: Copies the `SKILL.md` content to `.github/instructions/<skill-name>.instructions.md`.

Obsolete files are automatically deleted to prevent orphaned instructions.

---

## 3. Synchronizer PowerShell Script

The script `sync-ai-rules.ps1` runs in the project root. The full source code is available in the repository at:
- **`sync-ai-rules.ps1` template**: [sync-ai-rules.ps1](file://../../templates/sync-ai-rules.ps1)

When initializing a new workspace, copy this script to the root directory, configure the paths to your wiki layers in the script, and run it:
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\sync-ai-rules.ps1
```
This keeps your local agent context and rules fully aligned with the knowledge base.
