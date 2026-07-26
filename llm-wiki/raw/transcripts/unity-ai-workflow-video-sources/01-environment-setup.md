# Настройка среды для Unity AI Workflow

## Зачем это нужно

AI должен работать не только как генератор C# файлов, а как управляемый инженерный
инструмент: читать проект, создавать скрипты, подключаться к Unity Editor, смотреть
консоль, создавать объекты, настраивать компоненты и проверять результат.

## Источники

- Unity MCP Tutorial / Monkey Software: https://www.youtube.com/watch?v=PkvZaRSM21Y
- Ivan Murzak Unity MCP: https://github.com/IvanMurzak/Unity-MCP
- Funplay Unity MCP setup: https://gamebooom.ai/en/blog/pf3y492u
- Unity MCP server by usmanbutt-dev: https://github.com/usmanbutt-dev/unity-mcp
- Anthropic Claude Code best practices: https://www.anthropic.com/engineering/claude-code-best-practices

## Минимальная рабочая среда

1. Репозиторий открыт в корне Unity-проекта.
2. Unity Editor открыт на нужной версии проекта.
3. AI-агент имеет доступ к файлам проекта и правилам (`AGENTS.md`, `CLAUDE.md`,
   `.cursorrules`, `.windsurfrules`, wiki runbooks).
4. Для Unity Editor automation подключен MCP или аналогичный bridge.
5. Агент умеет читать Console/compile status и не продолжает scene work после
   ошибок компиляции.
6. Есть короткая команда проверки: `dotnet build`, `lint-wiki`, Unity tests или
   ручной Editor smoke-check.

## Что должен уметь Unity MCP слой

- Читать scene hierarchy.
- Находить GameObject по имени, пути, tag, layer, component type.
- Создавать GameObject и primitive objects.
- Добавлять, удалять и настраивать компоненты.
- Читать и менять serialized fields.
- Инстанцировать prefab в сцену.
- Создавать prefab из GameObject.
- Читать AssetDatabase, искать материалы, шейдеры, prefab assets, ScriptableObjects.
- Читать Unity Console и compile errors.
- Запускать Play Mode или хотя бы проверять compilation state.

## Правило для агента

Не проси агента "сделай сцену". Проси:

```text
Открой Unity Editor через MCP. Сначала прочитай hierarchy, assets и compile status.
Создай объектную структуру, затем перечисли измененные GameObject, компоненты,
serialized fields, prefab assets и проверки, которые ты выполнил.
```

## Unity/C# особенности

- Если задача меняет сцену или prefab, одного `dotnet build` недостаточно.
- Если задача меняет `.shadergraph`, `.vfx`, `.mat`, prefab или scene asset, нужен
  Editor-level readback: объект существует, компонент висит, поля заполнены,
  ссылки не missing.
- Если агент создает C# script и сразу вешает его на объект, он обязан дождаться
  компиляции перед настройкой serialized fields.

## Риски

- Агент создает скрипт, но не подключает его к prefab.
- Агент меняет сцену, но не сохраняет scene/prefab asset.
- Агент пишет значения в serialized fields до компиляции компонента.
- MCP имеет слишком широкий доступ и может менять нецелевые assets.
- Агент путает prefab instance override и изменение source prefab.

## Чеклист

- [ ] Unity Editor открыт и MCP подключен.
- [ ] Агент прочитал текущую сцену и AssetDatabase.
- [ ] Агент знает, какие файлы/ассеты ему разрешено менять.
- [ ] Есть команда/способ проверить compile status.
- [ ] Есть способ увидеть итог: hierarchy, prefab readback, screenshot или play mode.

