# Проверка и безопасность после Unity AI действий

## Главная идея

AI-generated Unity work нельзя считать готовым после "код написан". Готовность
означает: код компилируется, assets существуют, prefab/scene настроены, ссылки
не missing, runtime lifecycle безопасен, изменения ограничены задачей.

## Источники

- Anthropic Claude Code best practices: https://www.anthropic.com/engineering/claude-code-best-practices
- Code Monkey, AI is creating illiterate programmers: https://unitycodemonkey.com/video.php?v=2H4ouL4bCUs
- Code Monkey, Vibe Coding is the Future (?): https://unitycodemonkey.com/video.php?v=dCET8Jx-5Ts
- Unity MCP sources in `source-data.md`
- Existing KB pages: `unity-wiki/wiki/runbooks/ai-generated-code-review.md`,
  `unity-wiki/wiki/runbooks/ai-code-cleaning.md`, `unity-wiki/wiki/concepts/unity-ai-code-review-checklist.md`

## Минимальный validation loop

1. `git status --short` до/после.
2. Inspect changed files/assets.
3. Compile C#.
4. Read Unity Console.
5. Readback prefab/scene hierarchy.
6. Check missing scripts/references.
7. Run targeted tests or manual smoke check.
8. Require final report with evidence.

## Что требовать от агента в финале

```text
Финальный отчет:
- Что изменено в коде.
- Что изменено в Unity assets.
- Какие GameObject/components/fields настроены.
- Какие проверки выполнены.
- Какие проверки не выполнены и почему.
- Какие риски остались.
```

## Риски для Unity

- Generated code компилируется, но prefab не настроен.
- Prefab настроен, но код не знает о lifecycle Unity/KBPro.
- Сцена работает в Editor, но ломается в build из-за Addressables/render pipeline.
- Визуальный эффект создан, но не отключается и течет.
- Агент создал скрытую зависимость через scene object name.
- Агент "починил" ошибку массовым рефакторингом.

## Safety правила

- Сначала read-only inspection.
- Затем план с target files/assets.
- Затем маленькая реализация.
- Затем проверка.
- Если проверка упала, агент объясняет причину и исправляет только в рамках задачи.
- Нельзя переписывать тесты или правила, чтобы скрыть ошибку.
- Нельзя менять ProjectSettings, packages, scenes, prefabs вне scope.

## Чеклист для человека

- [ ] Понимаю, какие assets изменил агент.
- [ ] Могу открыть prefab и увидеть ожидаемую структуру.
- [ ] Могу объяснить, какие компоненты управляют поведением.
- [ ] Нет глобальных runtime lookups.
- [ ] Нет missing references.
- [ ] Есть cleanup для async/events/tweens/timers.
- [ ] Есть понятный rollback: маленький diff, нет unrelated churn.
- [ ] Для визуала есть screenshot/play-mode проверка или явный skip.

