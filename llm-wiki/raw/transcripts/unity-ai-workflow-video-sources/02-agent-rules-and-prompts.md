# Правила агента и промпты для Unity

## Главная идея

Хороший AI workflow держится не на одном большом промпте, а на трех слоях:

1. Постоянные правила проекта.
2. Специализированные runbook-и для типа работы.
3. Короткий task prompt с конкретным результатом, границами и проверкой.

## Источники

- Anthropic Claude Code best practices: https://www.anthropic.com/engineering/claude-code-best-practices
- Matt Pocock, Commands vs MCP vs Skills: https://www.youtube.com/watch?v=xAIN7YHXfCY
- Claude Code Advanced Patterns: https://resources.anthropic.com/hubfs/Claude%20Code%20Advanced%20Patterns_%20Subagents%2C%20MCP%2C%20and%20Scaling%20to%20Real%20Codebases.pdf
- Code Monkey, AI is creating illiterate programmers: https://unitycodemonkey.com/video.php?v=2H4ouL4bCUs
- Code Monkey, Vibe Coding is the Future (?): https://unitycodemonkey.com/video.php?v=dCET8Jx-5Ts

## Что писать в постоянных правилах

- Версия Unity и основные зависимости.
- Где живет runtime code.
- Архитектурные boundaries.
- Что нельзя делать без разрешения.
- Как проверять C#.
- Как проверять Unity assets.
- Какие wiki/runbooks читать перед типовыми задачами.
- Формат финального отчета: измененные файлы, измененные assets, проверки,
  skipped validation, риски.

## Что не писать в постоянных правилах

- Длинные лекции о паттернах.
- Универсальные "best practices" без связи с проектом.
- Списки всех возможных файлов проекта.
- Противоречивые правила для разных IDE.
- Правила, которые нельзя проверить.

## Хороший task prompt для Unity

```text
Задача: создать интерактивный prefab "RewardChest" для сцены Lobby.

Контекст:
- Проект Unity 6000.0.67f1.
- Используй существующие KBPro UI/audio/event patterns.
- Runtime код только в Assets/Core/...
- Префаб должен быть сохранен в указанной папке.

Разрешено:
- Создать 1-3 C# файла.
- Создать/изменить prefab RewardChest.
- Создать material/VFX assets только если нужны для результата.

Запрещено:
- Менять глобальные настройки проекта.
- Править vendor/KBPro submodules без отдельного согласования.
- Использовать GameObject.Find.

Процесс:
1. Сначала прочитай похожие existing prefabs/scripts.
2. Предложи короткий план.
3. Реализуй скрипты.
4. Дождись компиляции.
5. Настрой prefab через Unity Editor/MCP.
6. Проверь Console, prefab fields, missing references.

Отчет:
- C# files changed.
- Unity assets changed.
- Components on prefab.
- Serialized fields.
- Checks run.
- Что не удалось проверить.
```

## Практические инструкции

- Давай агенту noun vocabulary Unity: scene, hierarchy path, prefab source,
  prefab instance, component type, serialized field, material slot, shader, VFX
  exposed property.
- Проси readback после действий: "покажи итоговую структуру prefab".
- Проси маленькие шаги: script -> compile -> prefab binding -> scene placement.
- Указывай, где агент может создавать assets.
- Для визуальных задач прикладывай reference screenshot или точные параметры.

## Unity/C# правила, которые стоит закрепить

- Не использовать `GameObject.Find`, `FindObjectOfType`, `Transform.Find` как
  runtime-зависимость.
- Использовать `[SerializeField] private` для Inspector references.
- Не мутировать ScriptableObject config at runtime.
- Не создавать hidden singleton, если в проекте уже есть KBPro ServiceLocator.
- Всегда отписываться от events, dispose timers/tweens/CTS.
- Для UniTask принимать `CancellationToken`.

## Антипаттерны промптов

- "Сделай красиво" без reference и критериев.
- "Настрой префаб" без папки, имени, компонентов и проверки.
- "Исправь все ошибки" без границы diff.
- "Оптимизируй" без profiler evidence.
- "Используй лучшие практики" вместо конкретных правил проекта.

