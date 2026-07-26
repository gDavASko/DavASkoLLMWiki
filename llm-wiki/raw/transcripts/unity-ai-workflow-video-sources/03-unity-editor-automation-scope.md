# Что AI-агент может делать в Unity Editor

## Главная идея

Через MCP или похожий bridge агент может работать с Unity как с инструментом, а не
только с файловой системой. Но каждую capability нужно считать потенциально опасной
и давать ей узкие границы.

## Источники

- Unity Scene Management skill: https://mcpmarket.com/tools/skills/unity-scene-management-1
- Unity MCP server by usmanbutt-dev: https://github.com/usmanbutt-dev/unity-mcp
- Ivan Murzak Unity MCP: https://github.com/IvanMurzak/Unity-MCP
- Funplay Unity MCP: https://gamebooom.ai/en/blog/pf3y492u
- Nick Chapsas MCP video: https://www.youtube.com/watch?v=DpyjAKmNwpI

## Полезные категории инструментов

### Scene hierarchy

- read current scene
- create GameObject
- rename, parent, reorder
- set transform
- set active state
- assign tag/layer

### Component management

- add component
- remove component
- read component fields
- set serialized fields
- connect object references
- inspect missing scripts/references

### Prefab workflow

- find prefab asset
- instantiate prefab
- apply/clear overrides
- create prefab from GameObject
- inspect prefab dependencies
- verify prefab source vs scene instance

### Asset workflow

- search assets by type/name
- create folders with `.meta`
- create material
- assign shader
- assign texture/material/VFX asset to component
- inspect Addressables labels if project uses Addressables

### Verification

- read Unity Console
- read compilation status
- enter/exit Play Mode when safe
- run editor command or test command
- capture screenshot/scene view if available

## Как формулировать задачи

Плохо:

```text
Собери мне UI сцену.
```

Лучше:

```text
Через Unity Editor/MCP создай Canvas root в сцене MainMenu.
Hierarchy:
- MainMenuCanvas
  - SafeArea
    - Header
    - Content
    - Footer

Для каждого объекта перечисли RectTransform anchors, components и serialized fields.
После настройки прочитай hierarchy обратно и проверь missing references.
```

## Границы безопасности

- Агенту нельзя массово менять все сцены.
- Агенту нельзя применять prefab overrides к source prefab без явной команды.
- Агенту нельзя менять ProjectSettings без отдельного разрешения.
- Агенту нельзя запускать destructive asset operations без списка target paths.
- Агент обязан сначала сделать read-only inspection.

## Что проверять после Editor automation

- Сцена сохранена или изменения осознанно оставлены unsaved.
- Нет missing scripts.
- Нет missing prefab references.
- Components добавлены на правильные GameObject.
- Serialized fields заполнены правильными объектами, а не случайными одноименными assets.
- Для UI нет сломанных anchors/scales.
- Для physics корректны collider/rigidbody/layer matrix assumptions.

