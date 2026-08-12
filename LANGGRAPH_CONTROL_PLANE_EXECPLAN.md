# LangGraph control plane для самостоятельного DavASko LLM Wiki

Этот ExecPlan — живой документ. При реализации обязательно поддерживать в актуальном состоянии разделы `Progress`, `Surprises & Discoveries`, `Decision Log` и `Outcomes & Retrospective`. План следует правилам `llm-wiki/raw/PLANS.md`: он должен оставаться самодостаточным, а все найденные в ходе реализации факты, отсутствующие в Wiki, необходимо добавить в подходящий слой Wiki до завершения работы.

## Purpose / Big Picture

После реализации DavASko LLM Wiki станет самостоятельным движком управляемых LLM-процессов. Он будет принимать запросы через существующий CLI и будущий программный API, запускать заранее определённые графы LangGraph, распределять исследовательские подзадачи между ролями, безопасно выполнять их параллельно и возвращать проверенный типизированный результат с трассой исполнения.

LangGraph в этой работе является только control plane: системой управления ходом работы. Он не заменяет поиск в LanceDB, Markdown AST, wikilinks, reranking, Graphify, линтер, валидацию или индексатор. Эти операции остаются обычными детерминированными инструментами. Граф определяет, какой инструмент и с какими ограничениями можно вызвать, а LLM не получает произвольный доступ к shell-командам или файловой системе.

Пользователь сможет запустить быстрый запрос, глубокое исследование или анализ графа кода теми же командами `node system/query-wiki.js`. Для исследовательского режима несколько независимых worker-задач будут выполняться параллельно с ограничением конкуренции, затем результаты пройдут через отдельный узел проверки и будут собраны в один ответ. Ошибка или тайм-аут одного worker-а не должны уничтожать успешные результаты других workers и не должны повреждать индекс.

## Progress

- [x] (2026-08-09) Исследованы текущие точки управления: `system/query-wiki.js`, `system/lib/query-router.js`, `rlm_mode/rlm_manager.js`, `rlm_mode/rlm_worker.js` и `rlm_mode/llm_client.js`.
- [x] (2026-08-09) Сформулирована граница: LangGraph управляет workflow; RAG, Graphify и операции обслуживания Wiki остаются tools.
- [ ] Зафиксировать baseline текущего CLI и добавить контрактные тесты до изменения поведения.
- [ ] Вынести provider, инструменты и контракты в изолированные ESM-модули.
- [ ] Реализовать query supervisor graph и параллельный RLM research graph.
- [ ] Добавить persistence, трассировку, policy и отдельный admin workflow.
- [ ] Перевести CLI на новый движок, сохранить обратную совместимость и удалить ручной RLM loop после миграции.
- [ ] Провести полный набор тестов, ручные CLI-проверки и обновить Wiki.

## Surprises & Discoveries

- Observation: запуск `node system/query-wiki.js --auto ...` при отсутствии `.lancedb` автоматически запускает `system/build-index.js`. Это побочный write-эффект, поэтому обычный query graph не должен самовольно выбирать rebuild как fallback.
  Evidence: ветка инициализации индекса в `system/query-wiki.js`; во время анализа был создан новый индекс.

- Observation: текущий `RLMManager.run()` вручную реализует LLM tool loop с максимумом 10 итераций, а `spawn_worker()` ожидает worker последовательно.
  Evidence: `rlm_mode/rlm_manager.js` содержит `_getTools()`, цикл `for`, `list_layer`, `spawn_worker` и `finish`.

- Observation: текущий `LLMClient` жёстко совмещает чтение конфигурации, выбор модели и HTTP-вызов OpenAI-compatible endpoint.
  Evidence: `rlm_mode/llm_client.js` читает `system/rlm-config.json` и выбирает Ollama-совместимые значения по умолчанию.

## Decision Log

- Decision: использовать LangGraph как единственный orchestration layer для новых LLM-workflow, но не превращать детерминированные алгоритмы Wiki в LLM-узлы.
  Rationale: это даёт контролируемые переходы, параллелизм, checkpointing и наблюдаемость без потери воспроизводимости поиска, индексации и валидации.
  Date/Author: 2026-08-09 / пользователь и Codex.

- Decision: обычный query workflow не получает прав на ingest, sync, deploy, rebuild-index или удаление данных.
  Rationale: запрос знаний должен быть read-only. Мутирующие операции имеют отдельные CLI entry points, явную авторизацию, preview/snapshot/confirm там, где это требуется правилами Wiki.
  Date/Author: 2026-08-09 / Codex.

- Decision: один и тот же stateful worker-subgraph не запускается параллельно в одном thread namespace. Для независимых worker-задач применяется per-invocation state, а память долгого диалога отделяется по стабильному namespace.
  Rationale: это исключает конфликт checkpoint-ов и сохраняет безопасный fan-out/fan-in.
  Date/Author: 2026-08-09 / Codex.

- Decision: сохранять CLI-команды и формат итогового context dump на первом этапе миграции.
  Rationale: это позволяет заменить control plane без поломки IDE, KBProAIChat и других существующих клиентов.
  Date/Author: 2026-08-09 / Codex.

- Decision: Запускать независимые графы в отдельных Node.js Worker Threads.
  Rationale: Это защитит главный процесс от OOM и блокировок, возникающих при сборке больших контекстов, хотя и потребует сериализации состояния.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: Использовать глобальный AbortController для отмены.
  Rationale: Прокидывание abort signal через все узлы графа и HTTP-клиенты позволит мгновенно отменять зависшие запросы к LLM (по таймауту или Ctrl+C) и экономить ресурсы.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: Встроенный Exponential Backoff + Circuit Breaker в LanguageModelPort.
  Rationale: Логика HTTP-ретраев при ошибках 429 должна быть на уровне провайдера, чтобы не перегружать LangGraph прыжками между узлами.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: WAL режим SQLite + Очередь записи в главном потоке.
  Rationale: Main Thread принимает стейты от Worker Threads и последовательно пишет их в SQLite. Это защищает от блокировок `SQLITE_BUSY` при параллельной записи чекпоинтов.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: Оценка ответа Graphify с помощью LLM-Judge.
  Rationale: Даже если Graphify отработал без технических ошибок, его ответ проходит через быструю оценку Judge-моделью для выявления галлюцинаций. Только при положительном вердикте ответ принимается; иначе fallback на RAG.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: Независимость от внешних систем идентификации (Agnostic Identity).
  Rationale: DavASko LLM Wiki — это базовый движок (engine). Он не должен знать про Mattermost или Active Directory. Оркестратор принимает типизированный объект `IdentityContext` от вызывающего клиента (например, от KBProAIChat), делегируя ответственность за авторизацию вызывающему слою.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: Использование исключительно локальных моделей (ONNX / HuggingFace / Ollama) в первом релизе.
  Rationale: Требуется жесткая гарантия приватности данных (отсутствие cloud API).
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: Запись огромных результатов воркеров во временные файлы или SQLite вместо postMessage.
  Rationale: Передача сотен килобайт markdown напрямую через structured clone блокирует Event Loop. Главный поток получает только ID файла/записи.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: Отправка Heartbeat-событий вместо стриминга текста.
  Rationale: Для информирования Mattermost/CLI о том, что процесс не завис, достаточно эмиттить статус каждые N секунд. Полноценный streaming для графа избыточен.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: Изоляция важнее дедупликации работы воркеров.
  Rationale: Разрешаем воркерам читать одни и те же файлы. Токены локальных моделей бесплатны, изоляция важнее синхронизации кэша.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: Обертывание контента Wiki в строгие XML-теги (`<document>...</document>`).
  Rationale: Это защищает LLM-узлы от Prompt Injection (команд типа "проигнорируй правила"), встроенных во внутренние документы.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: Перехват критических падений (OOM, segfault) воркеров через обёртку-адаптер.
  Rationale: При событии `error`/`exit` потока адаптер вернёт в граф ошибку `{status: 'failed', code: 'WORKER_CRASH'}`, позволяя остальным веткам графа завершиться штатно.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: Ограничение файлового доступа через Node.js Permission Model.
  Rationale: Использование флажков `--allow-fs-read` и `--allow-fs-write` защищает ОС от RCE, если злоумышленник попытается прочитать/изменить файлы вне папки Wiki.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: Отсутствие встроенного fallback для внешних API.
  Rationale: Так как движок ничего не знает о Mattermost, логика обработки отказов сторонних провайдеров (кэширование сессий/БД) ложится исключительно на вызывающий клиент (KBProAIChat). LangGraph проверяет только переданный ему готовый `IdentityContext`.
  Date/Author: 2026-08-10 / пользователь и DavASko.

- Decision: LLM-форматтер для сломанного Markdown.
  Rationale: В узел `normalize_response` добавляется вызов дешёвой локальной LLM-редактора, которая только чинит разметку перед выдачей, чтобы в UI не ехала вёрстка.
  Date/Author: 2026-08-10 / пользователь и DavASko.

## Outcomes & Retrospective

Пока выполнено только архитектурное планирование. Исходники, зависимости и интерфейс Wiki не изменялись в рамках данного ExecPlan. После реализации этот раздел должен содержать фактические версии пакетов, результаты тестов, измеренные пределы параллелизма и список удалённых legacy-компонентов.

## Context and Orientation

Репозиторий является ESM Node.js-проектом. Его package root — `package.json`; тесты запускаются командой `npm test`, которая выполняет `node --test`. Текущий публичный вход — `system/query-wiki.js`. Скрипт принимает `--query`, `--rlm`, `--auto`, `--stdout` и `--out`, а для `--auto` вручную использует `system/lib/query-router.js`, чтобы выбрать RAG, RLM или Graphify.

RAG — детерминированная цепочка: чтение индекса, символический и векторный поиск, reranking, graph lift по явным wikilinks и сборка Markdown context dump. Её функции находятся в `system/query-wiki.js` и модулях `system/lib/`. Graphify вызывается как внешний адаптер и при ошибке возвращается к RAG. Эти механизмы не должны получать LLM-логику.

RLM — текущий глубокий исследовательский режим. `rlm_mode/rlm_manager.js` создаёт `LLMClient`, предоставляет модели tools `list_layer`, `spawn_worker`, `finish` и вручную повторяет LLM-вызов. `rlm_mode/rlm_worker.js` выполняет анализ переданного контекста. Это основной кандидат для перевода в граф: planner порождает ограниченный набор задач, worker-графы выполняются параллельно, judge проверяет доказательства, aggregator выпускает ответ.

Control plane — код, который хранит состояние задачи, выбирает разрешённые переходы и инструменты, ограничивает ресурсы, объединяет результаты и записывает trace. Tool — обычная функция или адаптер с фиксированной схемой входа и выхода. Он не выбирает следующий шаг и не обладает полномочиями за пределами своей операции.

## Target Architecture

Создать новый каталог `orchestration/` в root репозитория. Он не должен импортировать CLI entry point. CLI, API и тесты используют фабрики из этого каталога.

`orchestration/contracts.js` определяет JSDoc-типы и runtime-валидацию всех boundary-объектов: `WikiRequest`, `Route`, `ToolResult`, `ResearchTask`, `WorkerResult`, `VerificationResult`, `WikiResponse`, `TraceEvent`, `WorkflowLimits` и `ModelRole`. Каждый результат обязан содержать `status` (`ok`, `degraded`, `failed`), безопасное пользовательское сообщение, источники, диагностический code и correlation id. Нельзя передавать в state необработанный shell output без ограничения размера.

`orchestration/provider.js` вводит `LanguageModelPort`: асинхронный интерфейс для структурированного выбора маршрута, планирования, worker-анализа и проверки. Новый HTTP-адаптер инкапсулирует вызовы к локальным моделям (ONNX / HuggingFace / Ollama, cloud API строго исключены в первом релизе для приватности) и чтение `system/rlm-config.json`; выбор модели задаётся конфигурацией ролей `supervisor`, `planner`, `worker`, `judge`. В `LanguageModelPort` встроен Exponential Backoff и Circuit Breaker для правильной обработки rate limits (ошибка 429) без перегрузки логики графа. Все вызовы поддерживают `AbortController` для мгновенной отмены (Ctrl+C или таймаут). Для тестов реализуется `FakeLanguageModelPort` с предопределёнными ответами.

`orchestration/tools/` содержит адаптеры без LLM: `rag-search.js`, `graphify-query.js`, `wiki-index.js`, `layer-reader.js`, `validation.js`. Каждый адаптер принимает только валидированные параметры, ограничивает размер вывода, возвращает `ToolResult` и не вызывает другие tools. В первом PR допускается делегировать в существующие функции через тонкие обёртки; после покрытия тестами эти функции постепенно выносятся из `query-wiki.js` в библиотеки.

`orchestration/graphs/` содержит четыре отдельных скомпилированных графа:

1. `query-supervisor.js`: read-only вход. Узлы: `validate_request`, `select_route`, `execute_rag` или `execute_graphify` или `start_research`, `normalize_response`, `finish`. Route, выбранный LLM, проверяется детерминированным allowlist. Ответ от `execute_graphify` перед принятием пропускается через `LLM-Judge` валидатор на предмет галлюцинаций. Невалидный ответ или пустота ведёт к безопасному RAG fallback с trace.
2. `research.js`: RLM-граф. Узлы: `create_plan`, `validate_plan`, `dispatch_workers`, `worker`, `collect_results`, `judge`, `aggregate`, `finish`. `dispatch_workers` создаёт ограниченное количество `Send`-задач (не более `limits.maxWorkers`), которые исполняются в полностью изолированных **Node.js Worker Threads**, защищая главный процесс от OOM. `collect_results` использует reducer и стабильную сортировку по task id после сериализации ответов из потоков. `judge` не имеет мутирующих tools и возвращает конкретные недостающие доказательства либо готовность результата.
3. `diagnostics.js`: безопасные read-only проверки health конфигурации, наличия модели и состояния индекса. Он не переиндексирует Wiki сам.
4. `admin.js`: отдельный, недоступный из query supervisor workflow, граф для явных административных workflow. На первой поставке он содержит только guard и typed refusal; подключение ingest/rebuild/sync допускается исключительно в последующей утверждённой работе с preview, snapshot и human confirmation.

Верхний query supervisor может добавлять скомпилированные graphs как nodes, если состояние совместимо. При несовместимых состояниях узел-обёртка преобразует только нужные поля между parent и subgraph. Глобальный `AbortController` прокидывается через все узлы для Graceful Shutdown. Общая память между разными workflow запрещена, кроме явно определённого persistent store для trace/checkpoint.

## Plan of Work

### Milestone 1 — Baseline и контракты без изменения поведения

Сначала зафиксировать observable behavior существующего CLI. Создать `test/query-wiki-cli.test.js` с временной тестовой Wiki и mock-адаптерами, чтобы не требовать модели, Graphify или настоящей LanceDB в unit tests. Добавить fixture-запросы для RAG, неуспешного Graphify fallback и RLM, а также golden-проверку заголовка и источников context dump. До переноса функций разделить код `system/query-wiki.js` на экспортируемые чистые функции: парсинг запроса, сборка dump, RAG execution и запуск внешнего Graphify adapter. Entry point остаётся тонким вызовом этих функций.

Добавить `orchestration/contracts.js`, `orchestration/provider.js` и `orchestration/tools/`. В этом milestone tools только вызываются прямыми тестами; LangGraph ещё не участвует в CLI. Добавить зависимость `@langchain/langgraph` версии 1.x, совместимой с текущей версией Node.js, и зафиксировать точную разрешённую версию в `package-lock.json`. Перед добавлением production checkpointer выполнить отдельный spike: проверить совместимость выбранного SQLite checkpointer-пакета с LangGraph JS и ESM. Если она не доказана автоматическим тестом, использовать in-memory checkpointer только в тестах и не объявлять durable resume готовым.

Acceptance: `npm test` проходит без сети; текущая команда `node system/query-wiki.js --query "<fixture query>" --stdout` формирует совместимый dump.

### Milestone 2 — Query supervisor graph и совместимый CLI

Создать `orchestration/graphs/query-supervisor.js` c `StateGraph`. Состояние содержит неизменяемый исходный запрос, mode (`rag`, `rlm`, `auto`), выбранный route, лимиты, `WikiResponse`, массив trace events и correlation id. Узел `validate_request` нормализует параметры. `select_route` при `--auto` вызывает provider только для выбора одного из трёх значений, затем проверяет его allowlist. Явные `--query` и `--rlm` остаются детерминированными и обходят LLM router.

Узлы RAG и Graphify обращаются только к tool adapters. Ошибка Graphify превращается в trace event и направляется к RAG, но не падает процесс. Во время долгих операций граф периодически эмиттит **Heartbeat-события** (раз в 5 секунд), чтобы CLI или вызывающий клиент могли обновить UI/статус, не дожидаясь финала. Полноценный стриминг текста ответа не используется. Результат приводится к прежнему Markdown dump узлом `normalize_response`, который использует **дешёвую локальную LLM-редактор** для исправления битой разметки (незакрытых таблиц, тегов). Изменить `system/query-wiki.js`, чтобы после parseArgs он создавал graph через `createQuerySupervisorGraph(dependencies)` и вызывал `graph.invoke`. Не менять имена аргументов, код успешного завершения и поведение `--stdout`/`--out`.

Добавить тесты на route allowlist, RAG fallback, ограничение размера tool output и сохранение CLI-полей. Тесты не должны вызывать реальную модель.

Acceptance: существующие RAG и Graphify сценарии проходят через StateGraph, но их текстовый результат и CLI-contract не меняются. Trace можно вывести через новый opt-in флаг `--trace-json <path>`; по умолчанию секреты и trace не печатаются.

### Milestone 3 — Parallel RLM research graph

Заменить ручной цикл `RLMManager.run()` graph-реализацией из `orchestration/graphs/research.js`. Не переносить старый manager целиком: вынести `list_layer` и чтение файлов в `layer-reader` tool, а вызов worker-модели в worker node через `LanguageModelPort`.

Planner обязан вернуть структурированный список максимум `limits.maxWorkers` задач с явными `taskId`, целью, разрешёнными file ids и ожидаемым видом доказательства. `validate_plan` отвергает неизвестные layer/file id, пустые или слишком широкие задачи. Если двум задачам нужны одни и те же файлы, дублирование работы **разрешается** ради независимости воркеров (токены локальных моделей бесплатны). `dispatch_workers` использует LangGraph `Send` для fan-out. Выполнение worker-графов переносится в **отдельные Worker Threads**. Каждый worker оборачивается в адаптер: если поток аварийно умирает (OOM/segfault), адаптер перехватывает событие и возвращает `{status: 'failed', code: 'WORKER_CRASH'}`.

Reducer на `workerResults` добавляет только валидированные результаты. Чтобы **избежать фризов Event Loop**, воркеры не передают мегабайты текста через `postMessage`; текст пишется во временный файл (или SQLite), а в главный поток передаётся только ID. Затем `collect_results` читает данные и сортирует их по `taskId`. Judge использует отдельную model role и проверяет: есть ли достаточные источники, есть ли противоречия, не превышен ли лимит. `aggregate` возвращает один `WikiResponse`.

Ограничить `max_concurrency` при invoke, чтобы не превысить provider quota и ресурсы процессора. Сохранить успешные результаты при падении одного worker-а (включая падение его Worker Thread), отразить отказ в `degraded` response, а повторять только ошибочную ветку по RetryPolicy. Зависания прерываются глобальным `AbortSignal`.

Acceptance: fixture, требующая трёх независимых файлов, показывает concurrent start трёх workers в пуле потоков, deterministic aggregation и один вызов judge. Fixture с отказом одного worker-а возвращает `degraded` результат с двумя успешными доказательствами; зависший процесс успешно прерывается по `Ctrl+C`.

### Milestone 4 — Persistence, наблюдаемость и security policy

После успешного spike выбрать и подключить SQLite persistent checkpointer. Для исключения ошибок блокировки базы (`SQLITE_BUSY`) при параллельной записи стейтов из Worker Threads, необходимо настроить SQLite в режим `WAL` и организовать **очередь записи в главном потоке** (Main Thread принимает события от потоков и пишет их последовательно). Ключи checkpoints включают `threadId`, correlation id, graph name и namespace. Добавить retention policy и явную очистку старых checkpoints. Не смешивать checkpoint store с LanceDB index.

Создать `orchestration/policy.js`. В нём зафиксировать capability matrix: query и research имеют только read-only tools; diagnostics — read-only health checks; admin — отдельные declared operations. Любое мутирующее действие требует отдельного public entry point и явного подтверждения. Ошибки tools нормализуются. Для **защиты от Prompt Injection** из внутренних Wiki-документов, `policy.js` обязует оборачивать весь извлечённый контент в строгие XML-теги (`<document>...</document>`), а системные промпты (особенно для Judge/Aggregate) настраиваются на полное игнорирование команд внутри этих тегов. На уровне запуска (в CLI/package.json) внедрить **Node.js Permission Model** (флаги `--allow-fs-read`, `--allow-fs-write`), чтобы заблокировать доступ к файлам вне директории Wiki и папки `Tmp`.

Добавить структурированные trace events: graph/node, route, role, model identifier, duration, attempts, tool id, result status и correlation id. Не хранить prompts/документы целиком без включённого безопасного debug режима. Добавить `--trace-json` и `--resume <thread-id>` только после тестов durable execution.

Acceptance: остановленный test workflow возобновляется с checkpoint и не повторяет успешные tool calls; trace показывает fan-out, retries и финальный статус без секрета или содержимого `RLM_API_KEY`.

### Milestone 5 — Admin boundaries, migration и удаление legacy loop

Не подключать `build-index`, ingest, sync или deploy к обычному query graph. Добавить отдельные чистые adapters и unit tests только если уже существуют утверждённые безопасные CLI-контракты. Для каждого mutating workflow сначала реализовать dry-run/preview, затем snapshot, затем `interrupt()`/human confirmation с nonce; только после этого возможна реальная операция. Операции удаления Wiki-данных не добавлять в scope этого плана.

Когда query supervisor и research graph полностью покрыты тестами, удалить или превратить в compatibility facade ручной loop из `rlm_mode/rlm_manager.js`. Сохранять старый путь за feature flag `DAVASKO_WIKI_LEGACY_RLM=1` ровно один релиз. В выпуске с удалением flag обновить README, package scripts и Wiki с миграционной заметкой.

Acceptance: legacy и graph paths дают одинаковый contract на shared fixtures. После одного релиза flag удаляется, а `query-wiki.js --auto` использует только LangGraph control plane.

### Milestone 6 — Документация и релизная проверка

Добавить Wiki-страницы в `llm-wiki/wiki/`: architecture decision о control plane, runbook по model roles и лимитам, runbook по trace/resume и страницы сущностей графов/tools. Ссылки между страницами должны использовать разрешённые layer dependencies. После обновления Wiki выполнить `npm run lint` и `npm run validate`; не публиковать изменения автоматически.

Обновить `README.md`: standalone engine, CLI examples, граница control/data plane, способы конфигурации provider roles и предупреждение о concurrency. Обновить `.env.example` либо эквивалентный пример без секретов. Зафиксировать migration notes и версии в changelog, если он есть.

Acceptance: новый пользователь запускает mock/demo workflow по README, понимает как ограничить workers и получает предсказуемый trace; документация и links validation проходят.

## Concrete Steps

Все команды выполнять из `E:\Projects\DavASkoLLMWiki`.

1. Зафиксировать baseline:

    npm test
    node system/query-wiki.js --query "проверочный запрос" --stdout

   Ожидание: тесты проходят; команда печатает `# Wiki Context Dump` или понятный диагностический ответ, но не совершает административных операций.

2. После Milestone 1 установить зафиксированные зависимости и проверить lockfile:

    npm install @langchain/langgraph@<approved-1.x-version>
    npm test

   Ожидание: `package.json` и `package-lock.json` содержат только одобренные зависимости, unit tests не используют сеть.

3. После Milestone 2 проверить совместимость CLI:

    node system/query-wiki.js --query "проверочный запрос" --stdout
    node system/query-wiki.js --auto "архитектурный вопрос" --trace-json .tmp/query-trace.json

   Ожидание: первый вызов совместим с baseline; второй создаёт trace только в явно указанной временной папке, а ответ не раскрывает секретов.

4. После Milestone 3 выполнить параллельный fixture test и полный suite:

    node --test test/research-graph.test.js
    npm test

   Ожидание: тест доказывает fan-out/fan-in, deterministic result ordering, max concurrency и graceful degradation.

5. После изменения Wiki:

    npm run lint
    npm run validate
    npm test

   Ожидание: lint, проверка ссылок и тесты успешны. Коммит и публикация выполняются только по отдельной человеческой команде.

## Validation and Acceptance

Готовая система принимается только при выполнении всех условий ниже.

- `npm test` проходит локально без настоящего LLM provider; все LLM-вызовы в unit tests заменены fake provider-ом.
- Старые CLI параметры работают, а `--auto` направляет задачу через query supervisor graph.
- Один research запрос может породить несколько независимых worker-задач параллельно, не превышая заданный limit, и итоговый порядок результатов стабилен между прогонами.
- Недоступность Graphify и одного research worker-а не останавливает успешные read-only ветки и выдаёт `degraded` typed response.
- LLM не может вызвать shell, ingest, sync, deploy, rebuild-index, удаление или запись Wiki через query/research graph.
- Перезапуск workflow после checkpoint не повторяет уже завершённые tool calls и не смешивает state разных worker tasks.
- Trace и логи содержат correlation id и статусы, но не API keys, Authorization headers, неограниченный документный контент или приватные пути.
- `npm run lint` и `npm run validate` проходят после документирования новой архитектуры.

## Idempotence and Recovery

Создание графов, unit tests и read-only tools должны быть безопасны при повторном запуске. Checkpoint storage создаётся миграцией, которая проверяет версию схемы и не уничтожает существующие записи. При неудачном tool call workflow сохраняет trace, помечает только ошибочную ветку и допускает ограниченный retry; успешные ветки не выполняются повторно.

Нельзя автоматически делать full rebuild индекса в ответ на query workflow failure. Если индекс отсутствует или повреждён, query graph возвращает typed diagnostic, а оператор отдельно запускает существующую команду build-index после проверки причины. Перед любой будущей mutating admin-операцией требуются preview, snapshot и явное подтверждение; удаление Wiki-данных отсутствует из scope.

При временной миграции `DAVASKO_WIKI_LEGACY_RLM=1` возвращает старый ручной loop. Откат с нового control plane выполняется отключением feature flag и анализом trace; не требуется reset индекса или удаление checkpoints. Все временные trace/demo файлы создаются только в `.tmp/` и удаляются после проверки.

## Artifacts and Notes

Целевой trace одного research workflow должен выглядеть по смыслу так:

    {"correlationId":"q-123","node":"create_plan","status":"ok"}
    {"correlationId":"q-123","node":"worker","taskId":"t-1","status":"ok"}
    {"correlationId":"q-123","node":"worker","taskId":"t-2","status":"degraded","code":"PROVIDER_TIMEOUT"}
    {"correlationId":"q-123","node":"judge","status":"ok"}
    {"correlationId":"q-123","node":"aggregate","status":"degraded"}

Этот пример показывает, что одна ошибка не скрывается, но и не уничтожает доказательства других веток.

## Interfaces and Dependencies

В `orchestration/contracts.js` зафиксировать следующие внешние формы. Реализация может использовать JSDoc и собственную runtime-проверку или Zod, но одна схема должна быть единственным источником истины для CLI, tools и graphs.

    WikiRequest = {
      query: string,
      mode: "rag" | "rlm" | "auto",
      output: "stdout" | "file",
      threadId?: string,
      limits: { maxWorkers: number, maxConcurrency: number, maxIterations: number, maxToolOutputBytes: number }
    }

    LanguageModelPort = {
      selectRoute(input): Promise<{ route: "RAG" | "RLM" | "GRAPHIFY" }>,
      planResearch(input): Promise<{ tasks: ResearchTask[] }>,
      analyzeTask(input): Promise<WorkerResult>,
      judgeEvidence(input): Promise<VerificationResult>
    }

    ToolResult = {
      status: "ok" | "degraded" | "failed",
      content: string,
      sources: string[],
      code?: string,
      trace: TraceEvent[]
    }

    WikiResponse = ToolResult & {
      route: "RAG" | "RLM" | "GRAPHIFY",
      correlationId: string
    }

Скомпилированные graph factories обязаны иметь имена `createQuerySupervisorGraph`, `createResearchGraph`, `createDiagnosticsGraph` и `createAdminGraph`. Они принимают dependencies явно, а не читают глобальные singleton-конфиги. `createQuerySupervisorGraph` зависит от `LanguageModelPort` и read-only tools; `createResearchGraph` зависит от planner/worker/judge model roles и `layer-reader`; `createAdminGraph` не импортируется query graph.

Любой graph invocation передаёт `max_concurrency`, correlation id и thread id через config. Состояние не использует `any`-подобные неописанные поля. Parallel branches возвращают обновления только reducer-полей; aggregation сортирует результаты по `taskId`, поэтому порядок не зависит от того, какой provider ответил раньше.

## Revision History

- 2026-08-09: создан первоначальный план. Причина: пользователь утвердил необходимость самостоятельного LangGraph control plane для DavASko LLM Wiki и запросил план до реализации.

## Корпоративные требования, подтверждённые до интервью

Целевая система — корпоративная база знаний, а не персональное локальное хранилище. Поэтому приоритетами являются достоверный поиск, изоляция доступа, контролируемые операции, воспроизводимость и восстановление после сбоев, а не только правдоподобный ответ LLM.

LangGraph остаётся только плоскостью управления. Плоскость данных поиска сохраняет детерминированные компоненты: разбор документов, версионированное чанкирование, извлечение метаданных, ACL-фильтрацию, keyword/symbolic retrieval, векторный поиск, fusion, reranking, сбор цитат, проверку ссылок и индексирование. LLM может планировать и маршрутизировать в allowlist-графе, но не может обходить фильтры, выдумывать источник, выбирать произвольный путь файловой системы или исполнять необъявленные команды.

Модели эмбеддингов являются конфигурируемой сущностью первого класса. Реализовать `EmbeddingModelRegistry` и сохраняемый рядом с каждым индексом `EmbeddingProfile`: стабильный id профиля, тип provider, идентификатор и revision модели, размерность вектора, нормализацию, версию совместимости tokenizer/chunking, device/precision, batch limits, время создания и версию схемы индекса. Учётные данные и endpoints хранятся вне git.

Изменение embedding profile не является заменой настройки на месте: в одном активном индексе нельзя смешивать векторы разных моделей или размерностей. Миграция создаёт новое неизменяемое поколение индекса, запускает оценку на утверждённом retrieval corpus и только после явного одобрения оператора атомарно переключает alias `active`. Старое поколение остаётся читаемым для rollback до истечения согласованного retention period. Ответ и trace обязаны указывать поколение индекса и embedding profile.

Качество корпоративного поиска измеряется, а не предполагается. Создать версионированный безопасный evaluation corpus с репрезентативными вопросами, ожидаемыми документами/фрагментами, exact-identifier cases, многоязычными запросами, negative/denial cases и adversarial prompt-injection в документах. Любое изменение embedding profile, chunking, fusion, reranker или retrieval policy проходит offline retrieval evaluation до promotion. Численные пороги recall, ranking quality, citation correctness, latency и cost задаются после интервью.

**Идентификация и развёртывание:** DavASko LLM Wiki является **самостоятельным абстрактным движком**. Он принципиально не привязан к Mattermost, LDAP или SSO. Вызывающая система (например, бот KBProAIChat) обязана сама авторизовать пользователя, обработать падения своих API и передать в LangGraph абстрактный типизированный `IdentityContext` (`userId`, `roles`, разрешённые `layers`).

Безопасность применяется до retrieval, а не после генерации. Typed request context включает role, классификацию документа, версию source ACL и абстрактный `userId`. Retrieval tools фильтруют кандидатов до vector fusion и до передачи текста LLM. Trace содержит source identifiers и policy decisions, но не неавторизованный контент, credentials или неограниченные prompts. Эти правила одинаково обязательны для изолированных Worker Threads.

Параллельная работа ограничена и справедлива. Supervisor распределяет global request budget, per-tenant quota, per-provider concurrency limit, per-graph iteration limit, tool output limit, deadline, retry policy и circuit breaker. Workers получают immutable least-privilege task inputs. Fan-out результаты собираются детерминированными reducers, сортируются по task id и валидируются до aggregation. Backpressure обязан явно отклонять или ставить в очередь избыточную работу, а не перегружать embedding model, vector store, local GPU или LLM provider.

Система имеет состояния `healthy`, `degraded`, `blocked` и `failed`. Отсутствие или несовместимость индекса, embedding model, provider, ACL policy или checkpoint store возвращает typed diagnostic и никогда не запускает автоматический destructive repair. Rebuild, migration, ingestion, изменение access policy, retention purge и удаление данных остаются отдельными административными операциями с preview, snapshot, audit-confirmation и rollback plan.

## Grill Me — восемь решений, ожидающих ответа

Каждый ответ пользователя добавляется под соответствующим пунктом с датой, решением, обоснованием, затронутыми разделами плана, рисками и acceptance evidence. Ранее зафиксированные решения не удаляются: при изменении они помечаются как superseded со ссылкой на более новое решение.

1. **Развёртывание и tenancy.** Первый релиз обслуживает одну организацию в защищённой сети или сразу несколько компаний/подразделений? Какие identity sources авторитетны: Mattermost, Active Directory/LDAP, SSO/OIDC или их комбинация?
   - **Решение (2026-08-10):** Движок agnostic к tenant'ам и identity. Обслуживает абстрактные запросы.
   - **Обоснование:** Внешняя авторизация (например, Mattermost в KBProAIChat) — это проблема вызывающего клиента, а не движка DavASko LLM Wiki. 

2. **Чувствительность и residency.** Какие классификации документов нужны: public/internal/confidential/restricted? Может ли текст, embedding, trace или prompt покидать корпоративную сеть? Что обязательно шифруется at rest и каков срок хранения audit trail?
   - **Решение (2026-08-10):** Строгая классификация каждого файла в V1 не требуется (доступ регулируется на уровне папок/слоёв). Система работает Air-gapped (никаких логов за периметр). Шифрование стандартное на уровне диска.
   - **Обоснование:** Упрощение V1; безопасность гарантируется закрытой сетью и отсутствием cloud API.

3. **Политика embedding models.** Какие providers обязательны в первом релизе: local ONNX/HuggingFace, Ollama, OpenAI-compatible HTTP, cloud API или несколько? Нужен ли отдельный embedding profile для каждой Wiki/layer и кто утверждает migration после evaluation?
   - **Решение (2026-08-10):** В первом релизе используются исключительно локальные модели (ONNX / HuggingFace / Ollama).
   - **Обоснование:** Строгое обеспечение приватности данных, никаких cloud API.

4. **Масштаб и service objectives.** Сколько ожидается документов, chunks, пользователей, одновременных запросов, максимальный размер документа и объём ingestion в первый год? Какой p95 latency нужен? Что важнее при конфликте: качество, задержка, стоимость или полностью локальная работа?
   - **Решение (2026-08-10):** Масштаб V1 — десятки тысяч чанков (50-100 тыс). Главный приоритет — **Качество (Quality) и Локальность (Local)**. Задержка (Latency) в 30-60 секунд для RLM-режима является приемлемой нормой.
   - **Обоснование:** Локальные модели на корпоративном железе работают медленнее облачных, но гарантия качества и изоляции для внутренней Wiki перевешивает моментальный ответ.

5. **Контракт retrieval.** Нужны ли в каждом ответе точная цитата и секция источника? Должна ли система отказываться от ответа при недостаточных доказательствах? Какие языки, форматы документов и exact-identifier сценарии обязательны, и нужен ли hybrid search с metadata/ACL filters с первого релиза?
   - **Решение (2026-08-10):** Hybrid Search (Vector + Text) и точные цитаты обязательны. При нехватке доказательств сухой отказ (Typed Refusal) не используется. Вместо него система **обязана** явно сообщить, что точного ответа не найдено, а затем предоставить наиболее близко подходящие под запрос фрагменты.
   - **Обоснование:** Сухой отказ без контекста ухудшает UX. Предоставление "best effort" результата с явным disclaimer'ом позволяет пользователю самому изучить смежные документы.

6. **Полномочия агентов и human control.** Что агентам разрешено автономно: только read/search, создать draft, создать index generation, опубликовать проверенную Wiki page или ничего из этого? Кто утверждает interrupt и требуется ли two-person approval для чувствительных knowledge bases?
   - **Решение (2026-08-10):** Разрешено всё (чтение, поиск, создание новых статей и черновиков), **КРОМЕ** удаления и модификации существующих данных. Удаление и изменение строго заблокированы на уровне агентов и требуют явного разрешения от человека.
   - **Обоснование:** Обеспечивает баланс автономности (агент сам пишет новые знания) и безопасности (защита от потери или порчи золотого фонда базы знаний).

7. **Роли моделей и quality gates.** Какие configured model roles обязательны в первом релизе: supervisor, planner, researcher, worker, judge, answer writer, reranker? Может ли одна физическая модель выполнять несколько ролей и что происходит при недоступности judge или основного provider?
   - **Решение (2026-08-10):** Стратегия максимального делегирования. Роли (Planner, Worker, Judge) распределяются на разных субагентов/специализированные модели. Только если нет возможности использовать субагентов (например, нехватка ресурсов), системе разрешается использовать одну мощную физическую модель для всех ролей.
   - **Обоснование:** Делегирование соответствует правилу "Teamwork with subagents", снижая затраты токенов мощной модели и повышая параллелизм. Одиночная модель работает как Fallback.

8. **Operations и recovery.** Где будут размещены checkpoints, audit events, raw documents, metadata и vector indexes: один Windows host, Linux server, Docker/Kubernetes или managed DB? Какие RPO/RTO приемлемы и кто отвечает за alerts, rollback и promotion нового индекса?
   - **Решение (2026-08-10):** Локальная файловая система (Windows/Linux). Векторный индекс — LanceDB, стейты LangGraph — SQLite. Резервное копирование (Backup) и обеспечение RPO/RTO полностью ложится на плечи ОС/Виртуальной машины (Снапшоты), а не движка.
   - **Обоснование:** Движок остаётся максимально легковесным. Отсутствие внешних зависимостей (PostgreSQL, Redis) радикально упрощает Enterprise-развёртывание.

### Revision entry — 2026-08-09

Аддитивно добавлены корпоративные требования и восьмивопросное Grill Me интервью. Причина: пользователь требует конфигурируемые embedding models, высококачественный детерминированный поиск, безопасный параллелизм и системное выявление отказов до реализации.

### Revision entry — 2026-08-10

Добавлены инженерные решения (Worker Threads, AbortController, SQLite WAL, LLM-Judge) и частичные ответы на бизнес-вопросы (Single-tenant Mattermost auth, Local Models only). Причина: проведена сессия Grill Me для устранения "слепых зон" в отказоустойчивости и архитектуре управления памятью.
