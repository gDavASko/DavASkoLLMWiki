Perform a focused Unity performance review on the specified code.

Files or scope to review: $ARGUMENTS

## Before analyzing

1. Read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/wiki/maps/architecture-map.md`.
2. If the scope touches gameplay, product, UI, audio, analytics, tutorial, or presentation, also read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/wiki/maps/gameplay-product-map.md`.

## What to check

### Allocations in hot paths
- `Update`, `FixedUpdate`, `LateUpdate`, frequent event callbacks.
- `new` expressions that allocate heap objects: strings, arrays, lists, lambdas, closures.
- LINQ operators: `Where`, `Select`, `ToList`, `ToArray`, `FirstOrDefault`, etc.
- `string.Format`, string interpolation, `ToString()` in loops.
- Boxing: value types passed as `object`, used in non-generic collections.
- `foreach` on `List<T>` is safe; `foreach` on `Dictionary` allocates and should be flagged.

### Object lifecycle
- `Instantiate`/`Destroy` called per-frame or in gameplay loops without an object pool.
- Coroutines started per-frame.
- Missing `SafeKill()` on DOTween sequences/tweens before reassignment.
- `CancellationTokenSource` not disposed, async tasks not cancelled on object destroy.

### Physics
- Rigidbody manipulation outside `FixedUpdate`.
- `Physics.Raycast` / overlap queries without non-alloc variants.

### Rendering
- `GetComponent` / `TryGetComponent` called in `Update` instead of cached in `Awake`.
- `Camera.main` accessed repeatedly.
- Dynamic batching broken by per-frame material property changes on shared materials.

### Addressables
- Handles loaded but never released.
- `LoadAssetAsync` called every frame or inside loops.

## Output format

For each issue: file path + line number, category, severity, and a concrete fix.
End with a prioritized list: Critical first, then Warning.
