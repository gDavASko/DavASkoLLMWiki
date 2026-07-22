 Knowledge Base Regression Questions

Add questions here when an answer should remain stable over time.

Format:

```markdown
## Question

Expected answer:

Required sources:

Last checked:
```

## How should an agent ingest a new source into the KBPro LLM Wiki?

Expected answer:

The agent should place new external material in `raw/`, read the full source, create or
update a source summary in `wiki/sources/`, update relevant concept/entity/synthesis/
runbook/decision pages, add `[[wiki-links]]`, update `dentistry-cow-wiki/wiki/index.md`, append to
`dentistry-cow-wiki/wiki/log.md`, and record useful regression questions or failures in `evals/`.

Required sources:

- LLM-WIKI.md
- llm-wiki/wiki/runbooks/raw-data-ingest-workflow.md

Last checked: 2026-05-18

## How should the KBPro LLM Wiki be checked after documentation changes?

Expected answer:

Run `.\system/scripts/lint-wiki.js` from `Assets/KBPro/kbpro-ai-docs`. The lint checks wiki page
format, missing `[[wiki-links]]`, orphan pages, missing cited sources, raw Markdown
links, Unity `.meta` coverage, and whether raw project source files are mentioned by
the wiki.

Required sources:

- system/scripts/lint-wiki.js
- llm-wiki/wiki/maps/operations-map.md

Last checked: 2026-05-18

## Which knowledge-base pages should agents read first?

Expected answer:

Agents should use the map-first flow: `kbpro-wiki/wiki/maps/architecture-map.md` for architecture,
`kbpro-wiki/wiki/maps/gameplay-product-map.md` for gameplay/product/UI/audio/analytics/tutorial/
presentation, and `kbpro-wiki/wiki/maps/operations-map.md` for AI rules, wiki maintenance, Bitrix
import, and operational guardrails. Raw sources under `kbpro-wiki/raw/` are evidence
to follow after the relevant map points there.

Required sources:

- kbpro-wiki/wiki/maps/architecture-map.md
- kbpro-wiki/wiki/maps/gameplay-product-map.md
- llm-wiki/wiki/maps/operations-map.md
- llm-wiki/raw/ide-rules/GEMINI.md

Last checked: 2026-05-18

## How should Plombir Building task JSON be imported into Bitrix24?

Expected answer:

Use UTF-8 task JSON, create main fields through `tasks.task.add`, then apply tags
through `task.item.update`; keep tags in `TAGS`, use `GROUP_ID = 94`,
`RESPONSIBLE_ID = 66`, priority 1-3, and enabled time tracking.

Required sources:

- kbpro-wiki/wiki/runbooks/bitrix-task-import.md
- llm-wiki/wiki/sources/llm-rules-and-skills.md

Last checked: 2026-05-18

## What should an agent do with hardcoded Bitrix webhook URLs in raw scripts?

Expected answer:

Treat them as secrets, do not quote or copy them into derived pages, logs, commits, or
chat. Remove them from tracked files, use `KBPRO_BITRIX24_WEBHOOK_BASE` as the local
secret source, and recommend rotating any webhook that was previously committed or
shared.

Required sources:

- dentistry-cow-wiki/wiki/contradictions.md
- kbpro-wiki/wiki/runbooks/bitrix-task-import.md
- kbpro-wiki/wiki/decisions/security-redaction-over-raw-immutability.md

Last checked: 2026-05-18

## How should gameplay code send analytics?

Expected answer:

Gameplay code should raise analytics events through `EventBus<AnalyticsSendData>` or
related analytics events. It should not call AppMetrica, Amplitude, Firebase, or other
third-party SDKs directly from gameplay code.

Required sources:

- kbpro-wiki/wiki/entities/analytics-system.md
- kbpro-wiki/raw/Architecture/Meta/Analytic.md

Last checked: 2026-05-18

## How should game code start a tutorial?

Expected answer:

Game code should create parameters implementing `ITutorParameters` and raise
`EventBus<EventStartTutor>`. It should not call `TutorSystem` methods directly.

Required sources:

- kbpro-wiki/wiki/entities/tutor-system.md
- kbpro-wiki/raw/Architecture/Meta/TutorSystem.md

Last checked: 2026-05-18

## What is the safe first rollout for Scenario Graph?

Expected answer:

The safe first stage is a Linear Graph Runner: preserve legacy `GameModuleSetup[]`,
add dual-format `SOGameModuleSettings`, gate real graph assets behind
`UseScenarioGraphs`, fall back to an in-memory linear graph when no graph asset exists,
and keep old script request APIs as compatibility facades.

Required sources:

- kbpro-wiki/wiki/concepts/scenario-graph.md
- kbpro-wiki/raw/Architecture/DESIGN_ModuleStateMachine.md

Last checked: 2026-05-18

## How is the Scenario Graph test environment created?

Expected answer:

Select the scene's `SOGameModuleSettings` asset and run
`KBP/Scenario Graph Test/Create Or Refresh Test Graph In Selected Settings`; the
generator adds `ScenarioGraph_Test.asset`, enables `UseScenarioGraphs`, creates test
prefabs, and adds Addressables entries.

Required sources:

- kbpro-wiki/wiki/runbooks/scenario-graph-test-environment.md
- kbpro-wiki/raw/Architecture/ScenarioGraphTestEnvironment.md

Last checked: 2026-05-18

## How should gameplay code trigger sound variants without repeating the last sample?

Expected answer:

Raise `EventBus<EventPlaySoundByEvent>` with the sound event name. `SoundEventsService`
then finds the configured event, avoids the last played sample, selects another variant,
and delegates playback to `ISoundSystem`.

Required sources:

- kbpro-wiki/wiki/entities/audio-system.md
- kbpro-wiki/raw/Architecture/Presentation/AudioSystem.md

Last checked: 2026-05-18

## What Spine sequence limitation must be remembered?

Expected answer:

`SequenceAnimationState` can represent a sequence, but nested sequences are not
supported. Spine animation logic should be kept linear instead of putting a sequence
inside another sequence.

Required sources:

- kbpro-wiki/wiki/entities/spine-integration.md
- kbpro-wiki/raw/Architecture/Presentation/SpineIntegration.md

Last checked: 2026-05-18

## What should be used instead of hardcoded UI or audio strings?

Expected answer:

Use `ConstSelectorAttribute`, `SOConstantsContainer`, and generated/project constants
such as `Constants.UICOMPONENT` where the project provides them.

Required sources:

- kbpro-wiki/wiki/entities/const-selector.md
- kbpro-wiki/wiki/entities/ui-system.md

Last checked: 2026-05-18

## Are existing KBPro AI Docs files moved into raw?

Expected answer:

Yes. Current documentation sources were physically moved into `kbpro-wiki/raw/`,
while root wiki control files such as `LLM-WIKI.md`, `dentistry-cow-wiki/wiki/index.md`, and `dentistry-cow-wiki/wiki/log.md`
remain outside `raw/`.

Required sources:

- LLM-WIKI.md
- kbpro-wiki/wiki/decisions/legacy-documents-as-raw-sources.md

Last checked: 2026-05-18

## What must a new KBPro gameplay module include?

Expected answer:

A new module should separate Unity-facing `GameComponent` references, pure C#
`LogicSystem` behavior, module lifecycle orchestration, EventBus bindings with cleanup,
prefab `_systems` and `_componentProviders`, Addressables and `SOGameModuleSettings`
registration, and a module reference document.

Required sources:

- kbpro-wiki/wiki/runbooks/create-game-module.md
- kbpro-wiki/raw/Architecture/CoreFramework/Guides/HowToCreateModule.md

Last checked: 2026-05-18

## Can an AI hand-write Unity prefab YAML for a generated module?

Expected answer:

No. Runtime C# and temporary editor builder scripts can be generated, but Unity
prefabs, assets, and scene serialization should be created through Unity Editor APIs
or the Unity Editor itself, not hand-written YAML.

Required sources:

- kbpro-wiki/wiki/runbooks/auto-generate-module.md
- kbpro-wiki/raw/Architecture/CoreFramework/Guides/HowToAutoGenerateModule_ForAI.md

Last checked: 2026-05-18
