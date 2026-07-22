reate a new KBPro gameplay module for the `iri_plombir_building` Unity project.

Module name / description: $ARGUMENTS

## Steps

1. Read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/wiki/maps/architecture-map.md`.
2. Read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/wiki/syntheses/module-creation-workflow.md`.
3. Read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/Architecture/CoreFramework/Guides/HowToCreateModule.md` in full.
4. Read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/Architecture/CoreFramework/Guides/HowToDescribeModule.md` in full.
5. Browse `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/Architecture/CoreFramework/ModuleExamples/` to find the closest existing example.
6. Read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/code_style.md` and apply all naming and formatting rules.

## What to generate

Produce all files required by HowToCreateModule.md. At minimum:

- `Assets/Core/Scripts/Modules/{ModuleName}/{ModuleName}Module.cs`: `GameComponent` subclass, entry point.
- `Assets/Core/Scripts/Modules/{ModuleName}/Systems/`: one or more `LogicSystem` subclasses.
- Config `ScriptableObject` if the module needs data.
- Register `[InjectSystems]` and `[InjectComponent]` exactly as shown in examples.

Namespace: `KBP.{CATEGORY}` matching the surrounding code.

## After generating

- Show the full directory tree of created files.
- Explain how to wire the module into the game: registration, constants, prefab setup.
- List any ScriptableObject assets that need to be created in Unity Editor.
- Update or add the relevant docs under `Assets/KBPro/kbpro-ai-docs/wiki/`.
- Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Assets\KBPro\kbpro-ai-docs\system/scripts/lint-wiki.js` if docs changed.
- Run `git status --short` and report new files.
