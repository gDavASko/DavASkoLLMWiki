# Сцены, компоненты и сложные префабы

## Цель

Научить агента делать полный Unity workflow: скрипт, компонент, prefab source,
prefab instance, scene placement, serialized references, визуальные и runtime checks.

## Источники

- Unity Manual: Prefabs: https://docs.unity3d.com/Manual/Prefabs.html
- Unity Scene Management skill: https://mcpmarket.com/tools/skills/unity-scene-management-1
- Code Monkey Learn Unity 2025: https://unitycodemonkey.com/video.php?v=AmGSEH7QcDg
- Game Maker's Toolkit Unity tutorial: https://gamemakerstoolkit.com/unity-tutorial
- Imphenzia Unity getting started: https://www.youtube.com/watch?v=pwZpJzpE2lQ

## Модель работы

1. Найти похожий prefab или scene pattern в проекте.
2. Прочитать существующие компоненты и naming conventions.
3. Создать/изменить C# скрипты.
4. Собрать проект или дождаться Unity compilation.
5. Создать prefab hierarchy.
6. Добавить компоненты.
7. Заполнить serialized fields.
8. Создать/назначить materials, VFX, audio, UI references.
9. Сохранить prefab.
10. Инстанцировать в сцену, если задача требует.
11. Прочитать prefab/scene обратно и проверить.

## Prompt-шаблон для сложного prefab

```text
Создай prefab {PrefabName}.

Назначение:
- {что делает prefab в игре}

Папки:
- Scripts: Assets/Core/...
- Prefabs: Assets/Core/...
- Materials/VFX: Assets/Core/...

Hierarchy:
- Root
  - Visual
  - Collider
  - Effects
  - UIAnchor

Components:
- Root: {MainBehaviour}, {optional KBPro component}
- Visual: MeshRenderer/Animator/Spine/etc.
- Collider: Collider + trigger settings
- Effects: ParticleSystem/VFX component

Serialized fields:
- {fieldName}: ссылка на {object/path}

Validation:
- compile status clean
- prefab has no missing scripts/references
- fields assigned
- prefab can be instantiated in target scene
```

## Что агент должен возвращать после настройки

- Путь к prefab asset.
- Полный hierarchy prefab.
- Список компонентов на каждом объекте.
- Список важных serialized fields и их target objects.
- Какие prefab overrides есть, если работал с instance.
- Какие материалы/эффекты/шейдеры назначены.
- Какие проверки прошли.

## Риски

- Агент создает сцену вместо prefab source.
- Агент настраивает prefab instance, но не применяет изменения к source prefab.
- Агент создает несколько одноименных объектов и привязывает поля не туда.
- Агент не дожидается компиляции нового MonoBehaviour.
- Агент создает хрупкие runtime lookup-и вместо serialized references.
- Агент смешивает визуальный prefab, runtime logic и config data без границ.

## Unity/C# правила для сложных prefab

- Вынести внешние ссылки в `[SerializeField] private` поля.
- Не искать зависимости глобально в runtime.
- Для одноразовой Editor setup логики использовать editor tooling, а не runtime code.
- Для повторяемой настройки создать prefab variant или authoring component.
- Для Addressables не забывать labels/groups/release strategy.
- Для lifecycle явно описать кто владеет event subscriptions, tweens, CTS, pooled objects.

## Чеклист ревью prefab от AI

- [ ] Есть исходный prefab asset, а не только объект в сцене.
- [ ] Нет missing scripts и missing references.
- [ ] Root object имеет понятное имя.
- [ ] Components находятся на ожидаемых child objects.
- [ ] Serialized fields заполнены без runtime search.
- [ ] Collider/layer/tag соответствуют gameplay rules.
- [ ] UI anchors/scales стабильны.
- [ ] Materials используют нужный render pipeline.
- [ ] Effects можно включить/выключить из кода.
- [ ] Prefab можно удалить/за-despawn-ить без утечек.

