﻿# Codex Instructions - DavASko Project

Ты - AI-ассистент команды разработки DavASko. В этом проекте используется Unity, C#, модульная архитектура и набор плагинов из сабмодулей платформы DavASko.

## Главное правило: база знаний

Перед тем как писать код, предлагать архитектуру, ревьюить изменения или декомпозировать задачи, сначала изучи релевантные документы из базы знаний:

- `Assets/DavASko/davasko-ai-docs/davasko-wiki/raw/README.md` - обзор сценариев использования базы знаний.
- `Assets/DavASko/davasko-ai-docs/davasko-wiki/raw/principals.md` - основные принципы DavASko.
- `Assets/DavASko/davasko-ai-docs/davasko-wiki/raw/architecture.md` - архитектура проекта и платформы.
- `Assets/DavASko/davasko-ai-docs/davasko-wiki/raw/code_style.md` - стиль C# и Unity-кода.

Если задача касается конкретной подсистемы, сначала найди релевантные markdown-файлы в `Assets/DavASko/davasko-ai-docs/davasko-wiki/raw/Architecture/` и используй их как источник требований.

## Unity и C# стандарты

- Следуй Component pattern и модульной структуре DavASko.
- Не изобретай новую инфраструктуру, если в DavASko уже есть готовая система.
- Кэшируй ссылки в `Awake`; используй `TryGetComponent<T>(out var comp)`.
- Не используй `GameObject.Find`, `Transform.Find`, `FindObjectOfType` и `UnityEngine.UI.Text`; для текста используй TextMeshPro.
- Физику выполняй в `FixedUpdate`.
- Избегай аллокаций в `Update` и `FixedUpdate`; не используй LINQ и `foreach` по `List<T>` в горячих путях.
- Для частого создания и уничтожения объектов используй Object Pooling.
- Для асинхронных операций и задержек используй `UniTask`.
- Для I/O и сетевых операций добавляй обработку ошибок.
- Для проверок логики в разработке используй `Debug.Assert`.

## Жизненный цикл DavASko

- В модулях и системах соблюдай правила жизненного цикла из `principals.md`.
- Не пропускай обязательные вызовы `base.Initialize()` и `base.Dispose()`.
- Перед изменением инициализации, DI, загрузки ресурсов или модульных границ прочитай соответствующие документы из `Assets/DavASko/davasko-ai-docs/davasko-wiki/raw/Architecture/CoreFramework/`.

## Работа с задачами Bitrix24

- JSON-файлы сохраняй в UTF-8 без BOM.
- Теги должны находиться в поле `"TAGS": []`, а не в тексте описания.
- Для декомпозиции ТЗ используй `Assets/DavASko/davasko-ai-docs/davasko-wiki/raw/Architecture/CoreFramework/Guides/HowToDecomposeTask_ForAI.md`.

## Правила работы с базой знаний (Knowledge Base Protocol)

- **Поиск информации**: Перед выполнением любой задачи всегда используй оркестратор для поиска страниц и ключевых слов:
  - Поиск страницы по имени: `node Assets/DavASko/davasko-ai-docs/system/query-wiki.js --page <имя_страницы>`
  - Полнотекстовый поиск: `node Assets/DavASko/davasko-ai-docs/system/query-wiki.js --search "<запрос>"`
- **Импорт новых данных**: При необходимости добавить новый файл или документацию, сохрани файл в `NewData/` и выполни импорт через оркестратор:
  - Команда импорта: `node Assets/DavASko/davasko-ai-docs/system/query-wiki.js --ingest NewData/<файл> --layer <целевой_слой> [--subfolder <подпапка>]`
  - Доступные слои: `unity-wiki`, `davasko-wiki`, `dentistry-cow-wiki`.
- **Правило декомпозиции**: If an imported document contains details belonging to multiple layers (e.g. Unity patterns + DavASko APIs + project details), you MUST propose a split schema to the user. Do not ingest monolith files into a single layer without user approval.
- **Работа с заглушками (Stubs)**: Ссылки на несуществующие страницы или страницы более высоких слоев регистрируй в файле `dentistry-cow-wiki/wiki/stubs.md` соответствующего слоя для предотвращения ошибок линтера. При импорте файла, закрывающего заглушку, удаляй её из `stubs.md`.
- **Логирование изменений**: Подробные изменения записывай в локальный лог соответствующего слоя (сохраняй в UTF-8 с BOM): если код меняется в сабмодулях фреймворка (например, `Assets/DavASko/davasko-modules` и др.) — это коровая часть, лог пишется в `davasko-wiki/wiki/log.md`; если изменения в основном проекте (не в сабмодулях) — это проектная часть, лог пишется в `dentistry-cow-wiki/wiki/log.md`. В глобальный лог `Assets/DavASko/davasko-ai-docs/log.md` добавляй только краткую запись о факте изменений со ссылкой на измененный локальный лог и диапазон строк (в формате `[layer/davasko-wiki/wiki/log.md#L45-L52](../davasko-wiki/wiki/log.md#L45-L52)`).
- **Валидация базы**: После любых изменений базы знаний запускай линтер:
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Assets\DavASko\davasko-ai-docs\system/lint-wiki.ps1`

## Рабочий процесс Codex

- Начинай с чтения релевантных документов и поиска существующих паттернов в кодовой базе.
- Никогда не приступай к реализации работы (не вноси изменения в код, не запускай синхронизацию и т.д.), пока пользователь явно не скажет фразу: "Реализуем план" (и никак иначе).
- Всегда пиши планы реализации (`implementation_plan.md`, `task.md`, `walkthrough.md`) исключительно на русском языке.
- Держи изменения узко привязанными к задаче.
- Не меняй Unity `.meta` файлы без необходимости.
- Не откатывай чужие изменения в рабочем дереве.
- После правок по возможности запускай доступные проверки или объясняй, почему проверка не запускалась.
- В финальном ответе перечисляй измененные файлы и выполненные проверки.
