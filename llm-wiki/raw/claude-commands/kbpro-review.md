Review the specified code for compliance with KBPro architecture and project standards.

Files or scope to review: $ARGUMENTS

## Before reviewing

1. Read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/wiki/maps/architecture-map.md`.
2. If the scope touches gameplay, product, UI, audio, analytics, tutorial, or presentation, also read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/wiki/maps/gameplay-product-map.md`.
3. Follow map links into raw sources only for the systems touched by the review.

## What to check

### Architecture
- Module boundaries respected: no cross-module direct field/method access without EventBus or ServiceLocator.
- Services accessed via `LazySrv<T>`, not `FindObjectOfType` or static singletons.
- Events use `EventBus<T>` and `EventBinding<T>`; every `Register` has a matching `Unregister` in `Dispose`.
- `base.Initialize()` and `base.Dispose()` called where base type requires it.
- No magic strings: `[ConstSelector]` or generated constants used instead.
- ScriptableObject configs not mutated at runtime.

### Code style
- Namespace `KBP.{CATEGORY}`, one type per file, file name matches type name.
- Member ordering: constants, static, serialized/public fields, private fields, properties, ctors/init, lifecycle, public, protected, private, cleanup.
- `_camelCase` private fields, `PascalCase` methods/properties, `UPPER_SNAKE_CASE` constants.
- `[SerializeField] private` for Unity references.
- No `GameObject.Find`, `Transform.Find`, `FindObjectOfType`, `UnityEngine.UI.Text`.
- UniTask with `CancellationToken`; `CancellationTokenSource` disposed and nulled out.
- DOTween: `SafeKill()` used; Addressables handles released.

### Performance
- No allocations in `Update`, `FixedUpdate`, or hot-path event handlers.
- No LINQ, boxing, string formatting, temporary collections in hot paths.
- Physics in `FixedUpdate` only.
- No runtime `Instantiate`/`Destroy` without an object pool.

## Output format

For each issue found: file path + line number, rule violated, and a concrete fix.
Finish with a summary: blocking issues / warnings / passed checks.
