# План актуализации документации и README DavASko LLM Wiki

## Цель (Goal)
Провести глубокую актуализацию всей документации проекта (`README.md`, `README.ru.md`, `system/docs/*`, сопутствующие руководства и скрипты) в строгое соответствие с текущей реализацией кодовой базы (LangGraph Control Plane, двусторонняя структурная нарезка v4, резидентный сервер поиска, мастер настройки базы знаний, 42 юнит-теста).

---

## 1. Анализ текущего состояния и расхождения с реализацией

### 1.1. Профиль структурной нарезки (Chunking Profile v4 vs v3)
- **Текущая реализация (`system/lib/chunker.js`, `system/index-config.json`, `docs/2026-08-12-chunking-profile.md`):**
  - Реализован профиль **v4** с двусторонним контекстным перекрытием.
  - **Оверлап назад:** 32 слова (`chunk_overlap_words`) под служебной меткой `[Контекст предыдущего фрагмента]`.
  - **Оверлап вперёд:** 32 слова (`chunk_forward_overlap_words`) под служебной меткой `[Контекст следующего фрагмента]`.
  - **Хлебные крошки заголовков:** `[section.path]` добавляются к тексту каждого чанка.
  - **Иерархические крошки табов/сущностей в эмбеддинге:** в `system/build-index.js` для сущностей из фронтматтера (`parent_tab > tab_name`) формируется префикс при векторизации, предотвращающий схлопывание относительного порога.
  - **Чекпоинты индексатора каждые 20 документов:** `CHECKPOINT_INTERVAL = 20`, транзакционный сброс батча в LanceDB, статус `in_progress` -> `complete` в манифесте.
  - **Безопасный Late Chunking (`late_chunk_max_words: 6000`):** предотвращение OOM на GPU.
  - **Безлимитный размер первоисточников:** `max_raw_file_bytes: 0`.
- **Расхождение в документации:**
  - В `README.md` (п. 10.1) и `README.ru.md` (п. 10.1) до сих пор фигурирует «Профиль чанкинга v3» и описан только оверлап назад без упоминания оверлапа вперёд и крошек иерархии сущностей.

### 1.2. Оркестратор и графы поиска (LangGraph Control Plane)
- **Текущая реализация (`orchestration/graphs/query-supervisor.js`, `orchestration/graphs/research.js`):**
  - Полноценный StateGraph супервизора с многоуровневой защитой качества и отказоустойчивостью:
    1. `validate_request` (контракты и лимиты).
    2. `select_route` (Query Router: RAG, RLM, Graphify).
    3. Первичный запуск: `execute_rag_initial` / `start_research_initial` / `execute_graphify`.
    4. Оценка LLM-Judge (`judge_initial`) с порогом score >= 7.
    5. Уровень отката (Fallback Tier): `execute_rag_fallback` / `start_research_fallback`.
    6. Вторая оценка (`judge_fallback`).
    7. Компаратор ответов (`compare_answers` на узле LLM), если ни один не набрал >= 7.
    8. Уровень отката к тексту (Grep Fallback Tier): `execute_grep_search` и оценка `judge_grep`.
    9. Финальный компаратор (`compare_final`).
    10. Нормализация ответа (`normalize_response`).
  - SQLite WAL чекпоинтер (`createSqliteWalCheckpointer`).
  - Защита от Prompt Injection: оборачивание документов в строгие XML-теги `<document>` (`wrapDocumentXml`).
  - Изолированные Worker Threads (`orchestration/graphs/research-worker.js`) с таймерами Heartbeat каждые 5 секунд.
- **Расхождение в документации:**
  - `README.md` и `README.ru.md` описывают только базовую триаду (RAG, RLM, Graphify), не отражая многоуровневый консилиум (Judges + Comparators + Grep Fallback) и SQLite WAL персистентность.

### 1.3. Резидентный сервер поиска и мастер настройки
- **Текущая реализация (`system/search-server.js`, `system/scripts/setup-knowledge-base.js`, `system/lib/wiki-paths.js`):**
  - Резидентный сервер `system/search-server.js` держит LanceDB и векторизаторы в памяти, общаясь по протоколу NDJSON через stdin/stdout, снижая задержку поиска с ~8 с до ~1.5 с.
  - Мастер `setup-knowledge-base.js` интерактивно настраивает глобальную базу знаний и переменную `KBPRO_AI_CHAT_WIKI_DIR`.
  - Поддержка изолированных маркеров локальной БЗ (`.kbpro-local-kb` и `.davasko-local-kb`).
- **Расхождение в документации:**
  - В README и системной документации отсутствуют полные описания протокола NDJSON, параметров вызова и маркеров изоляции.

### 1.4. Набор тестов и CLI-параметры
- **Текущая реализация:**
  - В `system/tests/` реализовано **42 юнит-теста** ядра поиска, чанкинга, фронтматтера, идентификации документов, метрик и таргетированного поиска. Все 42 теста полностью проходят.
  - CLI `query-wiki.js` поддерживает параметры: `--query`, `--auto`, `--rlm`, `--stdout`, `--out`, `--locations`, `--top-k`.
- **Расхождение в документации:**
  - В `README.md` и `README.ru.md` указано «32 unit tests».
  - В таблицах команд не отражены параметры `--locations` и `--top-k`.
  - В `package.json` скрипт `test` жёстко перечисляет старый список тестов вместо шаблона `system/tests/*.test.js`.

### 1.5. Линтер и целостность ссылок
- **Текущее состояние:**
  - `system/scripts/lint-wiki.js` при проверке кодировок сканирует папки `hyperresearch/.venv`, где лежат тысячи питоновских пакетов без BOM, что даёт ложные ошибки.
  - `system/scripts/validate-links.js` выявляет 13 ошибок из-за устаревших абсолютных путей `file:///e:/UnityProjects/...` в `llm-wiki/wiki/index.md` и зависимых файлах.

---

## 2. Пошаговый план работ

### Этап 1. Обновление главных документов (`README.md` и `README.ru.md`)
1. **Раздел 6 & 10.1 (Чанкинг и индексация):**
   - Зафиксировать переход на **профиль v4**:
     - Описать двусторонний оверлап (назад 32 слова, вперёд 32 слова под метками `[Контекст предыдущего фрагмента]` и `[Контекст следующего фрагмента]`).
     - Описать инъекцию иерархических крошек табов/сущностей в эмбеддинг (`[parent_tab > tab_name]`).
     - Зафиксировать чекпоинты индексации (каждые 20 документов) и жизненный цикл `in_progress` -> `complete`.
     - Зафиксировать параметры безопасного Late Chunking (`late_chunk_max_words: 6000`) и безлимитный размер raw-файлов.
2. **Раздел 7 (Поисковый пайплайн и оркестрация):**
   - Дополнить диаграмму и описание графа Query Supervisor:
     - Описать цепочку верификации: Начальный поиск -> Оценка Judge (>=7) -> Запасной поиск (RAG/RLM) -> Вторая оценка Judge -> Сравнение промежуточных ответов (Comparator) -> Резервный поиск Grep -> Оценка Grep Judge -> Финальный компаратор -> Нормализация.
     - Описать защиту от Prompt Injection (XML `<document>`), изоляцию в потоках Node.js Worker Threads и Heartbeat.
     - Описать протокол и работу резидентного сервера `system/search-server.js` (NDJSON, ~1.5 с латентность).
     - Описать работу мастера `setup-knowledge-base.js` и маркеры изоляции `.kbpro-local-kb` / `.davasko-local-kb`.
3. **Раздел 10 (Шпаргалка команд и параметры CLI):**
   - Актуализировать таблицу команд, добавив `--locations` и `--top-k`.
   - Обновить количество тестов в таблице: **42 юнит-теста ядра** (вместо 32).
4. **Раздел 13 (Структура репозитория):**
   - Добавить модули папки `orchestration/` (`orchestration/graphs/`, `orchestration/tools/`, `provider.js`, `checkpointer.js`, `contracts.js`, `policy.js`).
   - Отразить актуальные модули `system/lib/` (`wiki-paths.js`, `profile-resolver.js`, `document-identity.js`, `empty-document-cache.js`, `config-manifest.js`).

### Этап 2. Обновление системной документации (`system/docs/*`)
1. **`system/docs/architecture-setup.md`:**
   - Описать архитектуру LangGraph Control Plane, разделение слоёв, механизм разрешения ссылок через `wiki-paths.js` и внешние профили (`KBPRO_AI_CHAT_WIKI_DIR`).
2. **`system/docs/scripts-templates.md`:**
   - Добавить подробные описания `search-server.js`, `setup-knowledge-base.js`, `query-target.js`, `audit-chunks.js`.
   - Обновить описание флагов `query-wiki.js` и `build-index.js`.
3. **`system/docs/data-standards.md`:**
   - Зафиксировать стандарт профиля нарезки v4, правила двустороннего контекста и запрет абсолютных путей `file:///`.
4. **`system/readme.human.md`:**
   - Актуализировать ссылки на профили v4 и правила запуска.

### Этап 3. Устранение сопутствующих дефектов кодовой базы и валидации
1. **`system/scripts/lint-wiki.js`:**
   - Добавить `.venv`, `hyperresearch`, `.tmp` в `ENCODING_DIR_BLACKLIST`, чтобы линтер не валидировал виртуальные окружения Python.
2. **`system/lib/wiki-paths.js`:**
   - Добавить проверку маркера `.davasko-local-kb` наряду с `.kbpro-local-kb` для полной совместимости с документацией.
3. **`package.json`:**
   - Обновить `"test"`: `"node --test system/tests/*.test.js"`, обеспечив прогон всех 42 тестов одной стандартной командой `npm test`.
4. **Относительные ссылки в Wiki-страницах:**
   - В `llm-wiki/wiki/index.md`, `llm-wiki/wiki/concepts/model-and-reasoning-effort-selection.md`, `llm-wiki/wiki/sources/youtube-autoresearch-karpathy.md` заменить абсолютные пути `file:///...` на переносимые относительные пути Markdown, добившись чистого прохождения `validate-links.js`.

### Этап 4. Верификация и контроль качества
1. Запуск `npm test` -> подтверждение прохождения всех 42 тестов.
2. Запуск `node system/scripts/lint-wiki.js` -> 0 ошибок.
3. Запуск `node system/scripts/validate-links.js` -> 0 ошибок.
4. Проверка кодировок: все изменённые `.md` файлы сохранены строго в UTF-8 с BOM, а скрипты и JSON — без BOM.

---

## 3. Критерии приёмки
- `README.md` и `README.ru.md` на 100% синхронизированы и отражают профиль v4, LangGraph Control Plane, резидентный сервер, мастер БЗ и 42 теста.
- Документы в `system/docs/` актуализированы и не содержат устаревших сведений.
- `npm test` успешно проходит (42 теста).
- `lint-wiki.js` и `validate-links.js` завершаются со статусом 0 (без ошибок).
- Все правила и соглашения проекта строго соблюдены без потерь контекста.

---

## 4. Статус выполнения (Все этапы завершены)

1. **Этап 1 (README.md & README.ru.md)**: Полностью синхронизированы и обновлены (разделы 6, 7, 10, 10.1, 13). Отражены профиль чанкинга v4, LangGraph Control Plane со всеми узлами консилиума, защита от prompt injection `<document>` XML, SQLite WAL чекпоинтер, изоляция Worker Thread, резидентный сервер поиска, мастер БЗ, флаги `--locations` / `--top-k` и 42 теста.
2. **Этап 2 (system/docs/*)**:
   - `architecture-setup.md`: добавлены разделы о LangGraph Control Plane, Resident Search Server и маркерах `.davasko-local-kb` / `.kbpro-local-kb`.
   - `scripts-templates.md`: обновлены описания всех скриптов ядра, CLI флагов, тестов и добавлены ссылки на исходный код.
   - `data-standards.md`: добавлен раздел 6 о стандартах профиля нарезки v4, двустороннего контекста и безопасного late chunking.
   - `system/readme.human.md`: обновлены ссылки на профиль v4, LangGraph Control Plane и 42 теста.
3. **Этап 3 (Кодовая база и валидация)**:
   - В `system/scripts/lint-wiki.js` добавлены исключения каталогов и файлов, исправлено разрешение внешних путей.
   - В `system/lib/wiki-paths.js` добавлена поддержка обоих маркеров изоляции (`.kbpro-local-kb` и `.davasko-local-kb`).
   - В `package.json` скрипт `"test"` настроен на запуск всех тестовых файлов.
   - Исправлены все абсолютные ссылки `file:///...` в `llm-wiki/wiki/index.md` и связанных файлах.
4. **Этап 4 (Верификация)**:
   - `npm test`: **42/42 pass** (0 ошибок).
   - `node system/scripts/lint-wiki.js`: **0 ошибок** (`OK: wiki lint passed successfully`).
   - `node system/scripts/validate-links.js`: **0 ошибок** (`Errors: 0. Validation passed successfully!`).
   - Все Markdown файлы проверены и сохранены строго в UTF-8 с BOM (Data Standards §1).
