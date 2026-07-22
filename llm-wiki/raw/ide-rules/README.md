# IDE Rules — Мастер-копии настроек ИИ-ассистентов

Этот каталог — **единственный источник правды** для настроек всех ИИ-ассистентов в проектах KBPro.

## Структура

```
ide-rules/
├── .clinerules                 ← Мастер-копия для Cline/Roo
├── .cursorrules                ← Мастер-копия для Cursor
├── .windsurfrules              ← Мастер-копия для Windsurf
├── GEMINI.md                   ← Мастер-копия для Gemini CLI/Antigravity
├── copilot-instructions.md     ← Мастер-копия для GitHub Copilot
├── mcp_config.json             ← Безопасный проектный MCP-шаблон
└── README.md                   ← Этот файл
```

## Как это работает

Файлы в этом каталоге являются мастер-копиями. Скрипт `sync-ai-rules.ps1` в корне
каждого проекта копирует их в форматы, ожидаемые каждой IDE:

| Целевой файл в корне проекта | IDE / Инструмент |
|------------------------------|-----------------|
| `.cursorrules`               | Cursor          |
| `GEMINI.md`                  | Antigravity     |
| `.windsurfrules`             | Windsurf        |
| `.clinerules`                | Cline           |
| `.github/copilot-instructions.md` | GitHub Copilot |

## Как обновить правила

1. Отредактируй нужные мастер-файлы в этом каталоге
2. Закоммить изменения в сабмодуле `kbpro-ai-docs`
3. В каждом проекте запусти из корня:
   ```powershell
   .\sync-ai-rules.ps1
   ```
4. Закоммить обновлённые файлы в репозитории проекта

Все текстовые rule-файлы синхронизируются как UTF-8 with BOM, чтобы русскоязычные
инструкции стабильно читались в Windows, Unity, Obsidian и IDE.

## Добавление нового проекта

При клонировании нового проекта с сабмодулем `kbpro-ai-docs`:
```powershell
git submodule update --init --recursive
.\sync-ai-rules.ps1
```
