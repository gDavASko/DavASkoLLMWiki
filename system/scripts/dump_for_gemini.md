

=================================
QUERY [0]: Что такое Harness Protocol и как его запустить?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro.configsystem\README.md:- [Что это такое](#что-это-такое)
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro.configsystem\README.md:## Что это такое
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-uisystem\README.md:- [Что это такое](#что-это-такое)
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-uisystem\README.md:## Что это такое
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-uisystem\README.md:### 🤔 Что такое MVP 
[RAG]
﻿# Wiki Context Dump

> Query: `Что такое Harness Protocol и как его запустить?`
> Generated: 2026-07-06T07:22:02.691Z
> Documents: 2

---
## raw-HarnessProtocol-current-implementation
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.708 | **Path**: `HarnessProtocol/raw/current-implementation.md`
> **Layer**: HarnessProtocol | **Cluster**: HarnessProtocol
> **Symbols**: IDE, HarnessProtocol, ProjectSettings, ProjectVersion, INDEPENDENT, PowerShell, DoD
# Harness Protocol — Current Implementation (v2)

> Source of truth for the CURRENT Harness mechanics. Supplements and clarifies
> the historical documents (`implementation_plan.md`, `memory-protocol.md`,
> `tactical-memory-spec.md`, `Workflows/*`) — on any conflict THIS file wins.
> Kept in sync with the scripts in `../Scripts/` and the
> `davasko-harness-dispatcher` skill.

---

## 1. Script map (`HarnessProtocol/Scripts/`)

| Script | Role |
|:-------|:-----|
| `harnessPaths.js` | Single path resolver. Anc
[RLM]



=================================
QUERY [1]: Какие слои зависят от kbpro-eventbus?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro.configsystem\README.md:### 🏗️ Основные слои
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-modules\Documentation_ModuleSystem.html:            <p>Порты на нодах различаются по типу и цвету — это позволяет мгновенно понять, какие данные или сигналы проходят по каждому соединению:</p>
E:\UnityProjects\IRI\dentistry-cow\Assets\Dentistry-cow\Scripts\Scratch\Scripts\ScratchRevealTexture.cs:            // (это давало ложные попадания в "ч
[RAG]
﻿# Wiki Context Dump

> Query: `Какие слои зависят от kbpro-eventbus?`
> Generated: 2026-07-06T07:22:14.754Z
> Documents: 9

---
## event-bus
> **Source**: 🧠 Semantic | **Kind**: 📝 SUMMARY (derived — may lag the source) | **Score**: 0.711 | **Path**: `kbpro-wiki/wiki/entities/event-bus.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: Event, KBPro, EventBus, Sources, Architecture, CoreFramework, IEvent, EventBinding, OnDestroy, EventSomething
# Event Bus

**Summary**: KBPro EventBus is a typed static Pub/Sub system for decoupled
communication between modules, services, UI, audio, analytics, and gameplay systems.

**Sources**: kbpro-wiki/raw/Architecture/CoreFramework/Infrastructure/EventBus.md, kbpro-wiki/raw/principals.md, kbpro-wiki/raw/code_style.md

**Last updated**: 2026-05-18

## Key Claims

- `EventBus<T>` is a generic, strongly typed event bus used for high-performance
  Pub/Sub communication between loosely coupled modules. (source: kbpro-wiki/
[RLM]



=================================
QUERY [2]: В чем суть архитектурного принципа ModuleScope?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\plombir-buildings-wiki\raw\ModuleExamples\water_restoration\WaterRestoration_WeldingStage_reference.md:## 1. Суть модуля (Plain Language)
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\plombir-buildings-wiki\raw\ModuleExamples\water_restoration\WaterRestoration_WaterFinishStage_reference.md:## 1. Суть модуля (Plain Language)
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\plombir-buildings-wiki\raw\Modul
[RAG]
﻿# Wiki Context Dump

> Query: `В чем суть архитектурного принципа ModuleScope?`
> Generated: 2026-07-06T07:22:20.615Z
> Documents: 23

---
## kbpro-architecture-overview
> **Source**: 🎯 Exact | **Kind**: 📝 SUMMARY (derived — may lag the source) | **Score**: 0.225 | **Path**: `kbpro-wiki/wiki/concepts/kbpro-architecture-overview.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: KBPro, Architecture, Overview, Core, Framework, Presentation, CoreFramework, ServiceLocator, LogicAndModules, EventBus, ParentTimer, IDProcessors, ModuleOrchestrator, DataTree, AbstractGameModule, ModuleScope, LogicSystem, LazySrv
# KBPro Architecture Overview

**Summary**: KBPro is documented as a modular Unity platform with Core Framework,
Presentation, Gameplay, Meta, Tools, and project-specific game-module layers.

**Sources**: kbpro-wiki/raw/architecture.md, AGENTS.md, kbpro-wiki/raw/Architecture/CoreFramework/Modules/LogicAndModules.md, kbpro-wiki/raw/Architecture/CoreFramework/In
[RLM]



=================================
QUERY [3]: Как работает InjectSystems для зависимостей?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\AssetDelivery\Documentation\Documentation_WEB.html:                    <strong>Описание:</strong> Интерфейс для прехвата кликов и касаний. Работает в связке InterceptingInputModule
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\Scripts\Core\ScriptSourses\Modules\RunnerModule\Systems\WindAnimationSystem.cs:        [InjectSystems]
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\Scripts\Core\ScriptSourses\Modules\RunnerModule\Systems\WheelsMovementSys
[RAG]
﻿# Wiki Context Dump

> Query: `Как работает InjectSystems для зависимостей?`
> Generated: 2026-07-06T07:22:26.139Z
> Documents: 15

---
## raw-unity-wiki-zenject-di-basics
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.622 | **Path**: `unity-wiki/raw/transcripts/sharp-gamedev/zenject-di-basics.md`
> **Layer**: unity-wiki | **Cluster**: unity-wiki
> **Symbols**: IInput, MovementHandler, DesktopInput, AsSingle, OnMoveInput, MobileInput, FromNew, NonLazy, UpdateInput, MonoInstaller, UnityEngine, MoveCharacter, GameplaySceneInstaller, LazySrv, GetAxisRaw, IAudioService, UnityAudioService, IInputService, OnMove, UnityProjects, IRI, GetMouseButtonDown, AudioManager, SceneContext, AsTransient, GetTouch, IDisposable, ArgumentNullException, InstallBindings, BindInterfacesAndSelfTo, ServiceLocator, MovementSystem, LogicSystem
# Основы внедрения зависимостей (DI) в Unity с использованием Zenject (Extenject)

**Source URL**: https://www.youtube.com/watch?v=jVFXnDd
[RLM]



=================================
QUERY [4]: Можно ли использовать GameObject.Find в коде?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\UnityRuntimeDebugTool\TZ.md:- Ошибки уровня транспорта (парсинг Envelope, версия API, аутентификация) формируются в `DebugServer`/`CommandRouter` до попадания в главный поток, где это возможно.
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\UnityRuntimeDebugTool\test-authoring-guide.md:- Проверяй **наблюдаемое состояние**, а не внутренние детали реализации, где возможно.
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\k
[RAG]
﻿# Wiki Context Dump

> Query: `Можно ли использовать GameObject.Find в коде?`
> Generated: 2026-07-06T07:22:31.725Z
> Documents: 15

---
## raw-specialvehicles-wiki-FirefightingGame_reference
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.567 | **Path**: `specialvehicles-wiki/raw/ModuleExamples/FirefightingGame_reference.md`
> **Layer**: specialvehicles-wiki | **Cluster**: specialvehicles-wiki
> **Symbols**: FirefightingGame, INS, WaterMovableSystem, FireEngineComponent, GameObject, InstallSystem, FloorObject, WaitInput, ContactFire, RoomComponent, FireCooldown, CheckExtinguished, CheckAllClear, TrackingFireSystem, CalculateScoreSystem, WaterSound, GameComponentProvider, ActiveStateHose, ExtinguishingVoice, SpawnHouse, MoveEngine, CameraPan, TurnHoseOn, CooldownFire, FloorClean, PlayHappyAnims, AbstractGameModule, FireSound, MaxCameraBorder, FireEngine, ParticleSystem, SoundComponent, StartGame, FixedUpdate, OnUpdate, CameraBorder, FloorNotFire, LogicSys
[RLM]



=================================
QUERY [5]: В чем отличие ServiceLocator от InjectSystems?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\Dentistry-cow\Scripts\Scratch\Scripts\Editor\PlainInfoBoxAttributeDrawer.cs:    /// Drawer для <see cref="PlainInfoBoxAttribute"/>. В отличие от встроенного Odin
E:\UnityProjects\IRI\dentistry-cow\Assets\Dentistry-cow\Scripts\Scratch\Scripts\Attribute\PlainInfoBoxAttribute.cs:    /// а не decorator поверх существующего drawer'а поля. Из-за этого, в отличие от InfoBox,
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro.configsystem\Runtime\Descriptio
[RAG]
﻿# Wiki Context Dump

> Query: `В чем отличие ServiceLocator от InjectSystems?`
> Generated: 2026-07-06T07:22:36.780Z
> Documents: 20

---
## raw-kbpro-wiki-ServiceLocator
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.655 | **Path**: `kbpro-wiki/raw/Architecture/CoreFramework/Infrastructure/ServiceLocator.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: ServiceLocator, LazySrv, IService, ServiceAccessor, GetService, ITimerService, MonoBehaviour, RegisterType, RegisterService, ServiceItem, ScriptableObject, PauseService, CleanService, UnregisterService, OnDestroy, GetServices, IDisposable, InventoryService, ISoundSystem, DelayCallback, HasService, HasValue, GameObject, DontDestroyOnLoad, IInventoryService, AddGlobalServicesConfig, AddLocalServicesConfig, CombatModule, EnemyTakesDamage, PlaySound, ICameraService, EventPauseState, IsPause, ICleanable, TimerService, FixedUpdate, LateUpdate
# AI Architecture Reference: ServiceLocator


[RLM]



=================================
QUERY [6]: Как правильно писать теги (TAGS) в задачах Bitrix24?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\Scripts\AssetDelivery\Scripts\Common\Service\Commands\DownloadGoogleAssetDownloadCommand.cs:            // Вызываем callback ДО начала загрузки, чтобы подписать на события
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro_promo_module\README.md:    MarkOpened --> SaveOpened["Записать ИД промо в кэш открытых"]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro_promo_module\documentation.html:                <p>Все события имеют стандартизиро
[RAG]
﻿# Wiki Context Dump

> Query: `Как правильно писать теги (TAGS) в задачах Bitrix24?`
> Generated: 2026-07-06T07:22:42.425Z
> Documents: 2

---
## raw-llm-wiki-GEMINI
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.656 | **Path**: `llm-wiki/raw/ide-rules/GEMINI.md`
> **Layer**: llm-wiki | **Cluster**: llm-wiki
> **Symbols**: NewData, ScriptableObjects, TextMeshPro, UniTask, DavASkoLLMWiki, TryGetComponent, GameObject, FindObjectOfType, FixedUpdate, PowerShell, WriteAllText, HarnessProtocol, INTERVENTION, IDE
Gemini CLI Rules for KBPro Project (Expert Persona)

You are an expert in C#, Unity, and scalable game development. Write clear, technical responses with precise examples.

## 1. Core Principles
- **Persona:** Senior Unity Architect. Prioritize readability, performance, and modularity.
- **Architecture:** Strictly follow Unity's component-based architecture. Use ScriptableObjects for data containers and shared resources.
- **Performance:** Prior
[RLM]



=================================
QUERY [7]: Где должны храниться скрипты навыков (skills)?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-uisystem\Runtime\UIService.cs:        /// Инициализирует начальные UI компоненты, которые должны быть загружены асинхронно.
E:\UnityProjects\IRI\dentistry-cow\Assets\Dentistry-cow\Scripts\Modules\PatientSelectionMenu\TeethProblemGenerator\Generators\ExtractionImplantTeethGenerator.cs:            // Если 2 зуба на одной челюсти — они должны быть соседними
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-builder\README.md:- В `ProjectSet
[RAG]
﻿# Wiki Context Dump

> Query: `Где должны храниться скрипты навыков (skills)?`
> Generated: 2026-07-06T07:22:48.465Z
> Documents: 12

---
## raw-kbpro-wiki-SETUP_NEW_PROJECT
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.587 | **Path**: `kbpro-wiki/raw/SETUP_NEW_PROJECT.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: IDE, LiteralPath, ChildItem, ExecutionPolicy, GitHub, NoProfile, ExecPlan, UniTask, ProjectVersion, UniRx, TextFileUtf8Bom, PowerShell, ConvertFrom, HouseBuilding, BuildProjectReferences, ProjectSettings, TextMeshPro, NaughtyAttributes, RuStore, AppMetrica, ErrorActionPreference, MyInvocation, MyCommand, IsNullOrWhiteSpace, ItemType, ReadAllText, WriteAllText, GetEnumerator, ProjectName, ExecPlans, EventBus, YouTube, CancellationToken, LazySrv, ServiceLocator, NonAlloc, ParticleSystem, PlayerScoreChanged, AnimationVisualsExpert, AsyncReactiveExpert, DependencyInjectionExpert, ResourcePhysicsExpert, UnityBoilerplateGenera
[RLM]



=================================
QUERY [8]: Что делает команда node system/scripts/lint-wiki.js?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro_promo_module\README.md:    Init --> Fetch["Команда FetchPromoCampaignCommand"]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro_promo_module\README.md:    ClickBtn --> OpenWnd["Команда OpenPromoWindowCommand"]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro_promo_module\README.md:    OpenWnd --> MarkOpened["Команда MarkPromoAsOpenedCommand"]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro_promo_module\documentation.html:  
[RAG]
﻿# Wiki Context Dump

> Query: `Что делает команда node system/scripts/lint-wiki.js?`
> Generated: 2026-07-06T07:22:54.614Z
> Documents: 5

---
## raw-llm-wiki-CLAUDE
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.451 | **Path**: `llm-wiki/raw/ide-rules/CLAUDE.md`
> **Layer**: llm-wiki | **Cluster**: llm-wiki
> **Symbols**: UniTask, TextMeshPro, RuStore, NewData, FixedUpdate, BuildProjectReferences, ProjectSettings, ProjectVersion, UniRx, NaughtyAttributes, AppMetrica, ExecPlans, ExecPlan, LogicSystem, GameComponent, ModuleScope, InjectSystems, InjectComponent, LazySrv, ServiceLocator, EventBus, EventBinding, DataService, ConstSelector, IDs, IUIShowParams, ScriptableObject, PascalCase, SerializeField, TryGetComponent, GameObject, FindObjectOfType, UnityEngine, CancellationToken, CancellationTokenSource, DavASkoLLMWiki, INTERVENTION
CLAUDE.md — dentistry-cow

## Project
- **Unity Version:** 6000.0.67f1 (from ProjectSettings/ProjectVersion.txt)
- **Prim
[RLM]



=================================
QUERY [9]: Какие требования к написанию кода для физики в Unity?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\AssetDelivery\Documentation\Readme.md:## Требования и зависимости
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\AssetDelivery\Documentation\Documentation_WEB.html:                <h2>Требования и зависимости</h2>
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-modules\Documentation_ModuleSystem.html:            <p>Порты на нодах различаются по типу и цвету — это позволяет мгновенно понять, какие данные или сигналы проходят по каждому соедин
[RAG]
﻿# Wiki Context Dump

> Query: `Какие требования к написанию кода для физики в Unity?`
> Generated: 2026-07-06T07:23:00.746Z
> Documents: 5

---
## raw-unity-wiki-physics
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.610 | **Path**: `unity-wiki/raw/OptimizationDocs/physics.md`
> **Layer**: unity-wiki | **Cluster**: unity-wiki
> **Symbols**: FixedUpdate, NonAlloc, AddForce, MovePosition, SphereCast, OverlapSphere, RaycastNonAlloc, OverlapSphereNonAlloc, RaycastHit
# Оптимизация физической симуляции

## Чек-лист проверки:

- **Физика в FixedUpdate**:
  - Все манипуляции с Rigidbody (приложение силы `AddForce`, изменение скорости `velocity`, перемещение `MovePosition`) должны выполняться строго в методе `FixedUpdate()`.

- **Rigidbody Interpolation (Интерполяция)**:
  - Включать интерполяцию (`Interpolate` / `Extrapolate`) только на объектах, за которыми напрямую следует камера (например, персонаж игрока), чтобы сгладить движение.
  - Для всех оста
[RLM]



=================================
QUERY [10]: В каком методе нужно кэшировать ссылки (Awake или Start)?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\Lessionms\Lession2\skills_theory.html:                <p>Вторая проблема — игнорирование жизненного цикла асинхронных операций и отсутствие механизмов отмены. В «плохом» примере корутина запускается без привязки к уничтожению объекта. При смене сцены или удалении игрового модуля C++ объект Unity разрушается, однако управляемый C# объект корутины продолжает выполняться в памяти, что вызывает утечки ресурсов и приводит к ошибкам обращен
[RAG]
﻿# Wiki Context Dump

> Query: `В каком методе нужно кэшировать ссылки (Awake или Start)?`
> Generated: 2026-07-06T07:23:07.168Z
> Documents: 5

---
## raw-kbpro-wiki-DESIGN_ModuleStateMachine
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.534 | **Path**: `kbpro-wiki/raw/Architecture/DESIGN_ModuleStateMachine.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: ModuleGraphData, ModuleStateMachine, SourceAction, ConditionId, ExitNode, TransitionId, StateMachine, IGameModuleSetup, EndModuleTransition, StateId, GameModuleScopeService, ISuspendable, IModuleTransitionCondition, GameModuleSetup, FinalTransitionId, ScriptId, UniTask, EntryNode, TargetStateId, SuspendHidden, SuspendVisible, CancellationToken, GraphView, IsSuspended, TransitionTo, AbstractGameModule, ModuleStateNodeData, TransitionScreen, RunScriptAsync, RequireParam, UnloadHandlesOnSuspend, SetActive, CurrentStateId, EventBus, ProvideParam, EventModuleError, EventModuleTransitionR
[RLM]



=================================
QUERY [11]: Как добавить новую модель в базу Graphify?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-parallax\README.md:`Parallax Region` наследуется от `GameComponent` и может быть подключён к `LogicSystem` через `InjectComponent`. Для этого способа запуска требуется в компоненте модуля добавить к списку систем `ParallaxComponentSystem` и к списку компонентов `Parallax Region`.
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\Scripts\AssetDelivery\Scripts\Editor\AddressablePADManagerEditor.cs:            // Создаем новую группу
E:\UnityProj
[RAG]
﻿# Wiki Context Dump

> Query: `Как добавить новую модель в базу Graphify?`
> Generated: 2026-07-06T07:23:13.606Z
> Documents: 3

---
## raw-kbpro-wiki-SETUP_NEW_PROJECT
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.485 | **Path**: `kbpro-wiki/raw/SETUP_NEW_PROJECT.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: IDE, LiteralPath, ChildItem, ExecutionPolicy, GitHub, NoProfile, ExecPlan, UniTask, ProjectVersion, UniRx, TextFileUtf8Bom, PowerShell, ConvertFrom, HouseBuilding, BuildProjectReferences, ProjectSettings, TextMeshPro, NaughtyAttributes, RuStore, AppMetrica, ErrorActionPreference, MyInvocation, MyCommand, IsNullOrWhiteSpace, ItemType, ReadAllText, WriteAllText, GetEnumerator, ProjectName, ExecPlans, EventBus, YouTube, CancellationToken, LazySrv, ServiceLocator, NonAlloc, ParticleSystem, PlayerScoreChanged, AnimationVisualsExpert, AsyncReactiveExpert, DependencyInjectionExpert, ResourcePhysicsExpert, UnityBoilerplateGenerator, 
[RLM]



=================================
QUERY [12]: Что такое Graphify и для чего он нужен?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro.configsystem\README.md:- [Что это такое](#что-это-такое)
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro.configsystem\README.md:## Что это такое
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-uisystem\README.md:- [Что это такое](#что-это-такое)
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-uisystem\README.md:## Что это такое
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-uisystem\README.md:### 🤔 Что такое MVP 
[RAG]
﻿# Wiki Context Dump

> Query: `Что такое Graphify и для чего он нужен?`
> Generated: 2026-07-06T07:23:20.186Z
> Documents: 1

---
## raw-kbpro-wiki-SETUP_NEW_PROJECT
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.560 | **Path**: `kbpro-wiki/raw/SETUP_NEW_PROJECT.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: IDE, LiteralPath, ChildItem, ExecutionPolicy, GitHub, NoProfile, ExecPlan, UniTask, ProjectVersion, UniRx, TextFileUtf8Bom, PowerShell, ConvertFrom, HouseBuilding, BuildProjectReferences, ProjectSettings, TextMeshPro, NaughtyAttributes, RuStore, AppMetrica, ErrorActionPreference, MyInvocation, MyCommand, IsNullOrWhiteSpace, ItemType, ReadAllText, WriteAllText, GetEnumerator, ProjectName, ExecPlans, EventBus, YouTube, CancellationToken, LazySrv, ServiceLocator, NonAlloc, ParticleSystem, PlayerScoreChanged, AnimationVisualsExpert, AsyncReactiveExpert, DependencyInjectionExpert, ResourcePhysicsExpert, UnityBoilerplateGenerator, Uni
[RLM]



=================================
QUERY [13]: Что такое RLM (Research Language Model)?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro.configsystem\README.md:- [Что это такое](#что-это-такое)
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro.configsystem\README.md:## Что это такое
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-uisystem\README.md:- [Что это такое](#что-это-такое)
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-uisystem\README.md:## Что это такое
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-uisystem\README.md:### 🤔 Что такое MVP 
[RAG]
﻿# Wiki Context Dump

> Query: `Что такое RLM (Research Language Model)?`
> Generated: 2026-07-06T07:23:26.039Z
> Documents: 1

---
## raw-llm-wiki-rlm_research_report
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.739 | **Path**: `llm-wiki/raw/rlm_research_report.md`
> **Layer**: llm-wiki | **Cluster**: llm-wiki
> **Symbols**: ViperGPT, ReDel, AgentFold, GitHub, IMPORTANT, CodeAct, ReAct, CoT, A35B, OpenAIEngine, ICCV, CodeQA, ChatGPT, IDE, PyPI, IPython, PrimeRL, LongBenchPro, RootMessage, ChainOfThought, BrowseComp, StringIO, DockerREPL, ModalREPL, DisCIPL, ReSum, OpenCode
# Исследовательский отчёт: RLM (Recursive Language Models) — замена RAG

> **Дата:** 2026-07-06
> **Источники:** arXiv 2512.24601, GitHub alexzhang13/rlm, блогпост Alex Zhang (MIT), GitHub zhudotexe/redel, arXiv 2303.08128, и др.
> **Тема:** Подход RLM как фундаментальная альтернатива системам RAG (Retrieval-Augmented Generation)

---

## Оглавление

1. [Проблема: Context Rot — почем
[RLM]



=================================
QUERY [14]: Какие правила языка действуют для общения ИИ с пользователем?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-datasystem\README.md:Проект является частью KBPro экосистемы и распространяется согласно внутренним правилам компании.
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-builder\README.md:### Какие файлы копировать
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-constselector\README.md:#### Правила использования сгенерированных констант
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-constselector\README.md:- **Документируйт
[RAG]
﻿# Wiki Context Dump

> Query: `Какие правила языка действуют для общения ИИ с пользователем?`
> Generated: 2026-07-06T07:23:32.736Z
> Documents: 5

---
## raw-llm-wiki-AGENTS
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.594 | **Path**: `llm-wiki/raw/ide-rules/AGENTS.md`
> **Layer**: llm-wiki | **Cluster**: llm-wiki
> **Symbols**: FixedUpdate, CoreFramework, IDE, TryGetComponent, GameObject, FindObjectOfType, UnityEngine, TextMeshPro, UniTask, DavASkoLLMWiki, AbstractGameModule, NewData, HarnessProtocol, INTERVENTION
Codex Instructions - KBPro Project

You are the AI Assistant for the KBPro development team. This project uses Unity, C#, a modular architecture, and a set of plugins from the submodules of the KBPro platform.

## Core Rule: Knowledge Base

Before writing code, proposing architecture, reviewing changes, or decomposing tasks, you must first read the relevant documents from the knowledge base:

- `Assets/KBPro/kbpro-ai-docs/kbpro-wiki
[RLM]



=================================
QUERY [15]: Как правильно использовать класс LazySrv<T>?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\Scripts\Tools\Editor\BuildActionWindow.cs:                new GUIContent("  🔄 Content Update (если доступно)", "Использовать обновление контента"),
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-servicelocator\README.md:- Удобно для внедрения зависимостей в компоненты, которые могут использоваться не всегда.
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-servicelocator\README.md:**Когда использовать:**
E:\UnityProjects\IRI\dentistr
[RAG]
﻿# Wiki Context Dump

> Query: `Как правильно использовать класс LazySrv<T>?`
> Generated: 2026-07-06T07:22:40.471Z
> Documents: 24

---
## raw-plombir-buildings-wiki-WaterRestoration_WeldingStage_reference
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.576 | **Path**: `plombir-buildings-wiki/raw/ModuleExamples/water_restoration/WaterRestoration_WeldingStage_reference.md`
> **Layer**: plombir-buildings-wiki | **Cluster**: plombir-buildings-wiki
> **Symbols**: GameObject, AssemblyPipeSystem, WeldingInputComponent, ConveyorComponent, DragComponent, InjectComponent, DragLogicSystem, ConveyorDraggableSystem, WeldInput, OnComplete, LogicSystem, WeldingTutorSystem, OnDragItemComplete, GameComponent, DragToTargetsTutorSystem, SettingsProviderComponent, KbSkeletonAnimation, TutorObject, WeldingComplete, DraggableItems, LazySrv, WeldingCrackModule, UseLoadSettings, StartPoint, LinkedComponentProvider, StartPointOutside, EndPointOutside, AbstractGameModule, NexStag
[RLM]
Класс LazySrv<T> используется для отложенной загрузки и кэширования сервисов или зависимостей. Вместо мгновенной инициализации в Awake(), вы вызываете обращение к сервису через свойство Value (например, _myService.Value), что инициализирует его только при первом реальном обращении. Это помогает избежать гонок (race conditions) при старте модулей и снизить нагрузку в Awake/Start.


=================================
QUERY [16]: Разрешено ли использовать LINQ в методах Update?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\Scripts\Tools\Editor\BuildActionWindow.cs:                new GUIContent("  🔄 Content Update (если доступно)", "Использовать обновление контента"),
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\Scripts\AssetDelivery\Scripts\Common\Interception\Сommand\Interface\IInterceptor.cs:    /// Проверить разрешено ли взаимодействие с целевым объектом
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\Scripts\AssetDelivery\Scripts\Common\Interception\Сommand\I
[RAG]
﻿# Wiki Context Dump

> Query: `Разрешено ли использовать LINQ в методах Update?`
> Generated: 2026-07-06T07:22:46.562Z
> Documents: 5

---
## raw-kbpro-wiki-ModuleSystems
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.486 | **Path**: `kbpro-wiki/raw/ModuleSystems.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: LogicSystem, InjectComponent, LazySrv, AbstractGameModule, InjectSystems, MonoBehaviour, IUpdatable, DiningCarHandwashingSoapSystem, TimerService, DragLogicSystem, GameComponent, SystemInjector, ComponentInjector, IStatisticService, OnComplete, EventBus, OnSpotClicked, DiningCarHandwashingFoamSystem, DiningCarHandwashingStageComponent, DragStarted, OnUpdate, HandleSpotClicked, ServiceLocator, WaterPumpRootSystem, ISoundSystem, PlaySound, MixerType, UniTask, ResolveInjections, IFixedUpdatable, ILateUpdatable, DiningCarHandwashingStageSystem, InitializeIfNeeded, SoapDragObject, HandleSoapDragStarted, OnEvent, IsAlive, UnityEngine
[RLM]
Категорически запрещено. Согласно техническим стандартам Unity & C# проекта KBPro, использование LINQ или foreach по List<T> в 'горячих' методах (Update и FixedUpdate) запрещено из-за аллокаций памяти, которые вызывают сборку мусора (GC spikes) и падение производительности.


=================================
QUERY [17]: Как использовать UniTask вместо корутин?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\Scripts\Tools\Editor\BuildActionWindow.cs:                new GUIContent("  🔄 Content Update (если доступно)", "Использовать обновление контента"),
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro_promo_module\Runtime\Scripts\Refact\Services\PromoNetworkService.cs:        public async UniTask<string> FetchConfigJsonAsync(string baseUrl, string bundleName)
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro_promo_module\Runtime\Scripts\Refa
[RAG]
﻿# Wiki Context Dump

> Query: `Как использовать UniTask вместо корутин?`
> Generated: 2026-07-06T07:22:53.259Z
> Documents: 20

---
## raw-unity-wiki-bootstrap-runners-scriptable-objects
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.559 | **Path**: `unity-wiki/raw/transcripts/sharp-gamedev/bootstrap-runners-scriptable-objects.md`
> **Layer**: unity-wiki | **Cluster**: unity-wiki
> **Symbols**: MonoBehaviour, OnCompleted, TrapGenerator, UnityEngine, ScriptableObject, OnTimeChanged, ICoroutineRunner, TimeBar, SerializeField, StartCoroutine, TimerConfig, UniTask, GameObject, CoroutineRunner, IEnumerator, UpdateFill, UnityProjects, IRI, ScriptableObjects, IInitializable, StopCoroutine, HandleTimeChanged, HandleTimeCompleted, IsGenerated, LogError, OnTimerFinished, TrapGen, OnTick, RemainingTime, TimerRoutine, FillableBar, OnDestroy, TrapsPlaced, LazySrv, CancellationToken, UniTaskTimer, IResourceService, NullReferenceException, TextMeshPro, CreateAssetMenu,
[RLM]
В проекте предпочтительно использовать библиотеку UniTask для асинхронных операций вместо стандартных корутин (IEnumerator). Это делается через возвращаемый тип UniTask или UniTask<T> в асинхронных методах (async). Для ожидания используются await UniTask.Delay(ms) или await UniTask.Yield().


=================================
QUERY [18]: Какой слой в KBPro занимается загрузкой ассетов?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\UnityRuntimeDebugTool\TZ.md:| Симуляция ввода | инструментальный слой поверх ввода | device-level виртуальные устройства Input System (T2, см. 01) |
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\UnityRuntimeDebugTool\03-determinism-time-control.md:  каждого `step_frame`. Параметры: `timeout_frames`, `poll_frames`. Никакой
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\UnityRuntimeDebugTool\02-world-inter
[RAG]
﻿# Wiki Context Dump

> Query: `Какой слой в KBPro занимается загрузкой ассетов?`
> Generated: 2026-07-06T07:22:59.566Z
> Documents: 5

---
## raw-kbpro-wiki-architecture
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.602 | **Path**: `kbpro-wiki/raw/architecture.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: CoreFramework, EventBus, ParentTimer, ServiceLocator, LazySrv, LogicSystem, DataTree, TutorSystem, RuStoreSDK, ConstSelector, ConfigAndData, EventBinding, ModuleScope, InjectSystems, InjectComponent, LogicAndModules, IDProcessors, ScenarioGraph, IsolatedGameModuleService, ModuleOrchestrator, HowToCreateModule, HowToDescribeModule, SpineIntegration, ISoundAccessor, AudioSystem, PassengerSystem, ModifierSystem, StoreTarget, NotificationsSystem, FigmaToUnity, MyEvent, EventShowComponent, INDEX, IService, BootStrap, ComponentAccessor, DataService, IDataService, DescriptionService, TableParserToConfig, LoadFoamTable, IEvent, EventMess
[RLM]
Слой загрузки ассетов (Asset Loading) является частью CoreFramework платформы KBPro. Конкретные детали описаны в документации Architecture/CoreFramework/, но обычно для этого используются абстракции ServiceLocator или InjectSystems совместно с Addressables или модульной загрузкой ресурсов.


=================================
QUERY [19]: Как использовать namespace KBP.{CATEGORY}?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\BuildReport\VERSION.txt:- FIX: Made explicit usage of namespace for
E:\UnityProjects\IRI\dentistry-cow\Assets\BuildReport\VERSION.txt:- EDT: Created new namespace DldUtil for the utility classes BigFileReader, and TraverseDirectory.
E:\UnityProjects\IRI\dentistry-cow\Assets\BuildReport\VERSION.txt:- FIX: Moved as much code as possible into its own namespace "BuildReportTool" to minimize naming conflicts with users' codes.
E:\UnityProjects\IRI\dentistr
[RAG]
﻿# Wiki Context Dump

> Query: `Как использовать namespace KBP.{CATEGORY}?`
> Generated: 2026-07-06T07:23:05.764Z
> Documents: 1

---
## raw-kbpro-wiki-code_style
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.653 | **Path**: `kbpro-wiki/raw/code_style.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: SerializeField, OnDestroy, PascalCase, EventBus, MonoBehaviour, EventGameEnd, UniTask, DoSomething, GameObject, LazySrv, GetComponent, MakeSequence, OnEnable, PlayerController, DefaultExecutionOrder, UnityEvent, PropertyToID, TakeDamage, ConstSelector, DamageInfo, UniTaskVoid, IStatisticService, IInventoryService, MyMethod, DoSomethingElse, CallMethod, OnValidate, SafeKill, StopCoroutine, ToUniTask, OnComplete, OnDisable, GameEvents, LevelComplete, HandleLevelComplete, EventBinding, SafePlay, EventShowComponent, CancellationToken, IMPORTANT, PowerShell, WriteAllText, ExampleClass, IsAlive, FixedUpdate, OnDamaged, ProcessInput, IPlayerInput
[RLM]
Пространства имен в проекте должны следовать структуре KBP.{Category}, где Category отражает функциональный модуль (например, KBP.Core, KBP.UI, KBP.Physics). Это обеспечивает изоляцию (ModuleScope) и позволяет избежать конфликтов имен.


=================================
QUERY [20]: В каком формате и кодировке нужно сохранять JSON файлы?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-datasystem\Runtime\BinaryStoreService\BinaryStoreService.cs:    /// Сервис для сохранения и загрузки данных в бинарном формате.
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-datasystem\Runtime\BinaryStoreService\BinaryStoreService.cs:        /// Синхронно сохраняет объект в бинарном формате.
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-datasystem\Runtime\BinaryStoreService\BinaryStoreService.cs:        /// Асинхронно сохран
[RAG]
﻿# Wiki Context Dump

> Query: `В каком формате и кодировке нужно сохранять JSON файлы?`
> Generated: 2026-07-06T07:23:12.455Z
> Documents: 5

---
## raw-kbpro-wiki-code_style
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.529 | **Path**: `kbpro-wiki/raw/code_style.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: SerializeField, OnDestroy, PascalCase, EventBus, MonoBehaviour, EventGameEnd, UniTask, DoSomething, GameObject, LazySrv, GetComponent, MakeSequence, OnEnable, PlayerController, DefaultExecutionOrder, UnityEvent, PropertyToID, TakeDamage, ConstSelector, DamageInfo, UniTaskVoid, IStatisticService, IInventoryService, MyMethod, DoSomethingElse, CallMethod, OnValidate, SafeKill, StopCoroutine, ToUniTask, OnComplete, OnDisable, GameEvents, LevelComplete, HandleLevelComplete, EventBinding, SafePlay, EventShowComponent, CancellationToken, IMPORTANT, PowerShell, WriteAllText, ExampleClass, IsAlive, FixedUpdate, OnDamaged, ProcessInput,
[RLM]
Согласно правилам 'Working with Bitrix24 Tasks' и стандартам ИИ-агентов, все JSON файлы должны сохраняться строго в кодировке UTF-8 без BOM (хотя в некоторых правилах Gemini CLI Rules указано UTF-8 with BOM для Windows/Unity). Основное правило: явная кодировка UTF-8 для кроссплатформенности.


=================================
QUERY [21]: Можно ли менять .meta файлы Unity напрямую?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-builder\README.md:Если проекту нужен только Android, iOS-файлы можно не переносить только после правки
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\UnityRuntimeDebugTool\TZ.md:- Ошибки уровня транспорта (парсинг Envelope, версия API, аутентификация) формируются в `DebugServer`/`CommandRouter` до попадания в главный поток, где это возможно.
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\UnityRuntimeDebugTool\te
[RAG]
﻿# Wiki Context Dump

> Query: `Можно ли менять .meta файлы Unity напрямую?`
> Generated: 2026-07-06T07:23:18.921Z
> Documents: 4

---
## raw-unity-wiki-unity-interview-optimization-part4
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.610 | **Path**: `unity-wiki/raw/transcripts/sharp-gamedev/unity-interview-optimization-part4.md`
> **Layer**: unity-wiki | **Cluster**: unity-wiki
> **Symbols**: SetPass, MaterialPropertyBlock, TextMeshPro, UnityEngine, SerializeField, StaticBatchingUtility, IMeshModifier, VertexHelper, MonoBehaviour, RequireComponent, GetComponent, GameObject, CombineStaticEnvironment, SetVerticesDirty, ModifyMesh, InstancedColorSetter, PropertyToID, ApplyColor, GetPropertyBlock, SetColor, SetPropertyBlock, RuntimeBatcher, ExecuteInEditMode, OnEnable, OnValidate, PopulateUIVertex, SetUIVertex, ScriptReference
# Оптимизация в Unity: Рендеринг, Батчинг и Вызовы отрисовки (Часть 4)

**Source URL**: https://www.youtube.com/watch?v=OAu3jkX8dK4
[RLM]
Изменение .meta файлов напрямую запрещено, если это не вызвано крайней необходимостью. ИИ-агентам предписано 'Do not change Unity .meta files unless necessary', чтобы не сломать ссылки на ассеты в проекте.


=================================
QUERY [22]: Где должны храниться временные scratch файлы при работе ИИ?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\dentistry-cow-wiki\wiki\sources\codex-skill-frontmatter.md:**Summary**: В локальной папке `.codex/skills/` Codex-представления скиллов должны начинаться с YAML frontmatter, иначе скилл может не попасть в автоматически доступный список даже при наличии корректного тела `SKILL.md`.
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\UnityRuntimeDebugTool\test-authoring-guide.md:помечены `seam:true` и должны быть видны в отчёт
[RAG]
﻿# Wiki Context Dump

> Query: `Где должны храниться временные scratch файлы при работе ИИ?`
> Generated: 2026-07-06T07:23:25.358Z
> Documents: 5

---
## raw-kbpro-wiki-UISystem_Core
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.526 | **Path**: `kbpro-wiki/raw/Architecture/Presentation/UISystem_Core.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: MessageView, OnOkClick, ActivateAsync, EventShowComponent, IUIShowParams, PopUpMessageView, LoadStatus, ShowViewAsync, MonoBehaviour, AddLocalUIPresenterConfig, IUIComponent, IUIView, EventBus, LoadAssetAsync, SerializeField, SetMessage, PopUpMessagePresenter, UniTask, TextMeshPro, IUIPresenter, LoadViewAsync, IsShowed, ShowComponentAsync, ShopPresenter, ShopView, OnEventShowComponent, FadeIn, CancellationToken, EventHideAllComponents, ReleaseInstance, AddListener, GameObject, RemoveAllListeners, ShowAsync, ScriptableObject, PopUpMessage
# AI Architecture Reference: UISystem_Core

**Module
[RLM]
Все временные, промежуточные файлы и скрипты ИИ должны сохраняться исключительно в директории .harness/<session-or-task-id>/ в корне проекта. Категорически запрещено создавать их в Assets/ или корне репозитория. По окончании работы они должны удаляться.


=================================
QUERY [23]: Что такое архитектура UIPBase и UIVBase?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-eventbus\README.md:- [Архитектура и структура папок](#архитектура-и-структура-папок)
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-eventbus\README.md:## Архитектура и структура папок
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-eventbus\README.md:### 5. Архитектура
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-constselector\README.md:- [Архитектура и структура папок](#архитектура-и-структура-папок)
E:\UnityProject
[RAG]
﻿# Wiki Context Dump

> Query: `Что такое архитектура UIPBase и UIVBase?`
> Generated: 2026-07-06T07:23:32.449Z
> Documents: 6

---
## raw-kbpro-wiki-UISystem_Core
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.552 | **Path**: `kbpro-wiki/raw/Architecture/Presentation/UISystem_Core.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: MessageView, OnOkClick, ActivateAsync, EventShowComponent, IUIShowParams, PopUpMessageView, LoadStatus, ShowViewAsync, MonoBehaviour, AddLocalUIPresenterConfig, IUIComponent, IUIView, EventBus, LoadAssetAsync, SerializeField, SetMessage, PopUpMessagePresenter, UniTask, TextMeshPro, IUIPresenter, LoadViewAsync, IsShowed, ShowComponentAsync, ShopPresenter, ShopView, OnEventShowComponent, FadeIn, CancellationToken, EventHideAllComponents, ReleaseInstance, AddListener, GameObject, RemoveAllListeners, ShowAsync, ScriptableObject, PopUpMessage
# AI Architecture Reference: UISystem_Core

**Module Path:** `Assets/KB
[RLM]
Это часть MVP (Model-View-Presenter) архитектуры пользовательского интерфейса в KBPro. UIPBase (UI Presenter Base) отвечает за логику и обработку событий, а UIVBase (UI View Base) отвечает за визуальное отображение и связывание компонентов TextMeshPro/кнопок на сцене.


=================================
QUERY [24]: Можно ли использовать UnityEngine.UI.Text в UI коров?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\Scripts\Tools\Editor\BuildActionWindow.cs:                new GUIContent("  🔄 Content Update (если доступно)", "Использовать обновление контента"),
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro_promo_module\documentation.html:                <p>Все события имеют стандартизированную структуру. Подписаться на события можно через контекст:</p>
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro.configsystem\README.md:**Ключевые возможности
[RAG]
﻿# Wiki Context Dump

> Query: `Можно ли использовать UnityEngine.UI.Text в UI коров?`
> Generated: 2026-07-06T07:23:38.769Z
> Documents: 19

---
## raw-kbpro-wiki-UISystem_Game
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.576 | **Path**: `kbpro-wiki/raw/Architecture/Presentation/UISystem_Game.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: EventBus, MyView, EventShowComponent, OnPrimaryAction, OnExit, OnClose, EventHideComponent, LogicSystem, ShowViewAsync, OnSettings, ShowAsync, LazySrv, ExitGame, MapTrainStateHolderSystem, IsRunning, UniTask, IUIShowParams, SerializeField, AddListener, RemoveAllListeners, CutScene, ExitButton, EventScriptBreak, ShowMap, EventSelectComponent, SettingsGame, IUIViewParameters, GameModuleScopeService, SetActive, IStatisticService
# Module: UI System (Railway-Cow)

## Purpose
Слой отображения игрового интерфейса, построенный на KBPro UISystem (MVP). Содержит Presenter-ы (`UIPXxx`) и View (`UIVXxx`)
[RLM]
Запрещено. Согласно правилам, вместо старого UnityEngine.UI.Text необходимо всегда использовать TextMeshPro (TMP) для рендеринга текста.


=================================
QUERY [25]: В чем заключается протокол перекрестной валидации (CROSS-VALIDATION)?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\UnityRuntimeDebugTool\TZ.md:- Протокол обмена (JSON поверх WebSocket) с версионированием, корреляцией и кодами ошибок.
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\UnityRuntimeDebugTool\TZ.md:- Тестовый раннер/оркестратор верхнего уровня (Python/Node/Playwright) — является **клиентом** URDT и специфицируется отдельно только в части протокола.
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\UnityRuntimeDe
[RAG]
﻿# Wiki Context Dump

> Query: `В чем заключается протокол перекрестной валидации (CROSS-VALIDATION)?`
> Generated: 2026-07-06T07:23:44.661Z
> Documents: 2

---
## raw-llm-wiki-AGENTS
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.610 | **Path**: `llm-wiki/raw/ide-rules/AGENTS.md`
> **Layer**: llm-wiki | **Cluster**: llm-wiki
> **Symbols**: FixedUpdate, CoreFramework, IDE, TryGetComponent, GameObject, FindObjectOfType, UnityEngine, TextMeshPro, UniTask, DavASkoLLMWiki, AbstractGameModule, NewData, HarnessProtocol, INTERVENTION
Codex Instructions - KBPro Project

You are the AI Assistant for the KBPro development team. This project uses Unity, C#, a modular architecture, and a set of plugins from the submodules of the KBPro platform.

## Core Rule: Knowledge Base

Before writing code, proposing architecture, reviewing changes, or decomposing tasks, you must first read the relevant documents from the knowledge base:

- `Assets/KBPro/kbpro-ai-docs/kb
[RLM]
Это строжайшее универсальное правило для ИИ. ИИ запрещено оценивать и валидировать свою работу в одиночку при работе по Harness-протоколу. Он обязан запустить стороннюю LLM (через cli-judge.js) для получения жесткой и объективной оценки, и только после ее анализа ставить статус Сделано (DONE).


=================================
QUERY [26]: Зачем нужен навык davasko-harness-dispatcher?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\Dentistry-cow\Spine\Tools\UF_light.json:	"Зачем лечить зубы v3": { "audio": "Зачем лечить зубы v3.mp3" }
E:\UnityProjects\IRI\dentistry-cow\Assets\Dentistry-cow\Spine\Tools\Filling_tool.json:	"Зачем лечить зубы v3": { "audio": "Зачем лечить зубы v3.mp3" }
E:\UnityProjects\IRI\dentistry-cow\Assets\Dentistry-cow\Spine\Tools\Drill.json:	"Зачем лечить зубы v3": { "audio": "Зачем лечить зубы v3.mp3" }
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-b
[RAG]
﻿# Wiki Context Dump

> Query: `Зачем нужен навык davasko-harness-dispatcher?`
> Generated: 2026-07-06T07:23:50.495Z
> Documents: 1

---
## raw-HarnessProtocol-skill-guide
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.759 | **Path**: `HarnessProtocol/raw/skill-guide.md`
> **Layer**: HarnessProtocol | **Cluster**: HarnessProtocol
> **Symbols**: HarnessProtocol, IDE
# Harness Protocol Dispatcher Skill: description and installation

> This page describes the `davasko-harness-dispatcher` skill — what it does and how
> to deploy it. **The skill itself is not stored in the wiki**: its working copy lives
> outside the indexed layer, in `HarnessProtocol/skill/` (see "Installation").

---

## What it is

`davasko-harness-dispatcher` is a skill-contract for the IDE agent that orchestrates
task execution under the Harness Protocol: the Ralph Loop, L1/L2/L3 memory, selection
from 7 strategies, validation (auto/ai/human) via a gated state machine, and the drift-guard
[RLM]
Этот навык (skill) инициализирует и управляет стейт-машиной Harness Protocol. Он необходим для пошагового контроля (interview, planning, execution, cross-validation) и предотвращения самовольных действий агента без одобрения пользователя.


=================================
QUERY [27]: Какая версия Unity используется в текущем проекте?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\AssetDelivery\Documentation\Readme.md:**Версия документации:** 1.0
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\AssetDelivery\Documentation\Documentation_WEB.html:                    <strong>Unity версия:</strong> Unity с пакетом Addressables for Android
E:\UnityProjects\IRI\dentistry-cow\Assets\Core\AssetDelivery\Documentation\Documentation_WEB.html:            <p><strong>Версия документации:</strong> 1.0</p>
E:\UnityProjects\IRI\dentistry-cow
[RAG]
﻿# Wiki Context Dump

> Query: `Какая версия Unity используется в текущем проекте?`
> Generated: 2026-07-06T07:23:56.276Z
> Documents: 5

---
## raw-unity-wiki-unity-interview-optimization-part6
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.593 | **Path**: `unity-wiki/raw/transcripts/sharp-gamedev/unity-interview-optimization-part6.md`
> **Layer**: unity-wiki | **Cluster**: unity-wiki
> **Symbols**: UnityEngine, GraphicRaycaster, ScrollRect, SetActive, RequireComponent, MonoBehaviour, GetComponent, LayoutGroup, LayoutRebuilder, SendWillRenderCanvases, TextMeshPro, EventSystem, RectTransform, SerializeField, CanvasVisibilityController, SetVisible, HorizontalLayoutGroup, VerticalLayoutGroup, GridLayoutGroup, LayoutGroupOptimizer, RebuildLayoutOnce, ForceRebuildLayoutImmediate, GraphicRaycast, GameObjects, VirtualizedListHelper, OnValueChanged, OnScroll, AnchoredPosition, LeanTween, GitHub, LoopScrollRect
# Оптимизация в Unity: Интерфейсы и Unity UI (Часть 
[RLM]
Версия Unity явно не указана в запросе, но обычно в проектах KBPro используется Unity 2022.3 LTS или новее. Для точного ответа нужно проверить файл ProjectSettings/ProjectVersion.txt.


=================================
QUERY [28]: Как работают генераторы констант и [ConstSelector]?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\dentistry-cow-wiki\wiki\sources\codex-skill-frontmatter.md:- Донорские и кросс-агентные копии (`.claude`, `.gemini`, `.agents`, `all-skills~`) можно не менять, если их собственные адаптеры уже работают.
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-ai-docs\Lessionms\Lession2\slides.md:    <li><b>Жесткие рамки (Constraints)</b>: императивные запреты («НЕ делайте X») работают гораздо надежнее мягких советов («Желательно»).</
[RAG]
﻿# Wiki Context Dump

> Query: `Как работают генераторы констант и [ConstSelector]?`
> Generated: 2026-07-06T07:24:02.088Z
> Documents: 33

---
## raw-kbpro-wiki-ConstSelector
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.690 | **Path**: `kbpro-wiki/raw/Architecture/Tools/ConstSelector.md`
> **Layer**: kbpro-wiki | **Cluster**: kbpro-wiki
> **Symbols**: ConstSelector, ConstantsGroup, ConstSelectorAttribute, CodeGenerator, GroupName, SerializeField, PlayAudio, AudioId, ScriptableObject, ConstantsGroups, GenerateCode, GenerateConstantsFile, MainMenuWindow, SettingsWindow, SoundSystem, EventBus, AnalyticProcessor
# ConstSelector System (Магические Строки)

> **Расположение:** `Assets/KBPro/kbpro-constselector`
> **Назначение:** Полное искоренение "магических строк" (Magic Strings) в проектах на Unity. Конвертирует строковые идентификаторы (вводимые геймдизайнерами) в авто-генерированный C# код, добавляя строгую типизацию и выбор через Dropdown в инспе
[RLM]
Генераторы констант парсят ресурсы или классы для автоматического создания C# скриптов с константами (например, путями к префабам или тегами). Атрибут [ConstSelector] применяется к строковым полям в Inspector для выпадающего списка выбора этих констант.


=================================
QUERY [29]: Какие обязательные поля при создании задачи Bitrix (GROUP_ID, RESPONSIBLE_ID)?
[BASE]
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-constselector\README.md:- **Документируйте зависимости** - указывайте, какие константы используются в каждом компоненте
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-builder\README.md:### Какие файлы копировать
E:\UnityProjects\IRI\dentistry-cow\Assets\KBPro\kbpro-audiosystem\Runtime\Configs\AudioDuckingConfig.cs:    /// Определяет, какие каналы должны затихать при активации Ducking (например, при воспроизведении голоса).
E:\UnityP
[RAG]
﻿# Wiki Context Dump

> Query: `Какие обязательные поля при создании задачи Bitrix (GROUP_ID, RESPONSIBLE_ID)?`
> Generated: 2026-07-06T07:24:07.872Z
> Documents: 2

---
## raw-llm-wiki-GEMINI
> **Source**: 🧠 Semantic | **Kind**: 📄 SOURCE (ground truth) | **Score**: 0.652 | **Path**: `llm-wiki/raw/ide-rules/GEMINI.md`
> **Layer**: llm-wiki | **Cluster**: llm-wiki
> **Symbols**: NewData, ScriptableObjects, TextMeshPro, UniTask, DavASkoLLMWiki, TryGetComponent, GameObject, FindObjectOfType, FixedUpdate, PowerShell, WriteAllText, HarnessProtocol, INTERVENTION, IDE
Gemini CLI Rules for KBPro Project (Expert Persona)

You are an expert in C#, Unity, and scalable game development. Write clear, technical responses with precise examples.

## 1. Core Principles
- **Persona:** Senior Unity Architect. Prioritize readability, performance, and modularity.
- **Architecture:** Strictly follow Unity's component-based architecture. Use ScriptableObjects for data containers and shared resources.
[RLM]
При создании задачи в Bitrix24 через JSON, обязательными полями являются: GROUP_ID = 94, RESPONSIBLE_ID = 66, PRIORITY (1-3) и ALLOW_TIME_TRACKING = '1'. Также теги (TAGS) должны быть вынесены в отдельный массив, а не в текст.
