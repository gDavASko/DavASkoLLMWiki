# Шейдеры, материалы и VFX в AI Workflow

## Главная идея

Визуальная задача для AI должна быть описана как набор assets и bindings:
shader/material/VFX graph/particle system/prefab/component/serialized exposed params.
Иначе агент сгенерирует "что-то похожее", но не интегрирует это в игру.

## Источники

- Gabriel Aguiar VFX Graph 2024: https://www.youtube.com/watch?v=R4XsJ645l6E
- Glasp summary for VFX Graph tutorial: https://glasp.co/youtube/p/get-started-with-unity-vfx-graph-in-2024-tutorial
- Game Dev Guide Scriptable Render Pipeline: https://www.youtube.com/watch?v=9fa4uFm1eCE
- Code Monkey Particle System tutorial: https://unitycodemonkey.com/video.php?v=yW89geuaEfI
- Unity Manual: Prefabs: https://docs.unity3d.com/Manual/Prefabs.html

## Что указывать в запросе

- Target render pipeline: URP/HDRP/Built-in.
- Unity version.
- Цель эффекта: gameplay readability, feedback, mood, UI effect.
- Где эффект живет: prefab child, scene object, UI overlay, pooled object.
- Какие параметры должны быть exposed.
- Кто управляет эффектом из кода.
- Как эффект выключается, уничтожается или возвращается в pool.

## Prompt-шаблон

```text
Создай эффект {EffectName} для Unity URP.

Нужно:
- prefab effect root в {path}
- material в {path}
- particle/VFX setup
- exposed parameters: color, intensity, duration
- component wrapper {EffectController} с Play/Stop

Интеграция:
- эффект должен быть child объекта {PrefabName}/Effects
- ссылки назначить через serialized fields
- не использовать runtime global lookup

Проверка:
- material использует URP-compatible shader
- prefab has no missing references
- Play/Stop безопасны при повторном вызове
- cleanup не оставляет tweens/tasks/events
```

## Практические правила

- Для gameplay feedback лучше сначала сделать простой ParticleSystem или VFX prefab,
  а не сложный shader-only эффект.
- Для повторяемого визуального поведения нужен controller component с явным API.
- Exposed параметры должны иметь игровые имена: `HitColor`, `PulseDuration`,
  `EmissionRate`, `DissolveAmount`.
- Если агент меняет shader graph, нужно проверить material binding и render pipeline.
- Если эффект будет часто spawn/despawn, сразу думать о pooling и allocations.

## Риски

- Shader выглядит в Scene View, но не работает в URP build.
- Material создан, но prefab использует старый material.
- VFX Graph имеет exposed property, но script пишет не то имя.
- ParticleSystem самоуничтожается через Destroy вместо pool/lifecycle.
- Эффект не останавливается при Disable/Dispose.
- Агент меняет global render settings ради одного эффекта.

## Unity/C# проверка

- [ ] Material shader совместим с текущим render pipeline.
- [ ] Все texture/material/VFX references назначены.
- [ ] Exposed property names совпадают с кодом.
- [ ] Effect prefab не зависит от scene-only objects.
- [ ] Нет Instantiate/Destroy в hot path без причины.
- [ ] Controller component переживает повторный Play/Stop.
- [ ] Визуальный результат проверен screenshot/play mode, если доступно.

