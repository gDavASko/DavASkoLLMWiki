# AI Assistant Instructions — DavASko Project

Ты — ИИ-ассистент команды разработчиков. В этом проекте мы используем модульную архитектуру и набор плагинов из сабмодулей платформы DavASko.

❗️ **ПРАВИЛО №1: БАЗА ЗНАНИЙ**
Прежде чем писать код, предлагать архитектурные решения или анализировать проект, ты ОБЯЗАН сначала прочитать документацию в нашей базе знаний.

📌 **Где искать информацию:**
Папка с базой знаний находится по пути: `Assets/DavASko/davasko-ai-docs/`

- Если вопрос касается архитектуры — сначала читай `Assets/DavASko/davasko-ai-docs/davasko-wiki/wiki/maps/architecture-map.md`, потом переходи в raw-источники по ссылкам
- Если вопрос касается gameplay/product/UI/audio/analytics/tutorial/presentation — сначала читай `Assets/DavASko/davasko-ai-docs/davasko-wiki/wiki/maps/gameplay-product-map.md`
- Если вопрос касается AI rules/wiki/Bitrix/операционных правил — сначала читай `Assets/DavASko/davasko-ai-docs/davasko-wiki/wiki/maps/operations-map.md`
- Если вопрос касается стиля кода — читай `Assets/DavASko/davasko-ai-docs/unity-wiki/raw/code_style.md`
- Если вопрос касается ревью AI-generated кода или вайбкодинга — читай `Assets/DavASko/davasko-ai-docs/unity-wiki/wiki/runbooks/ai-generated-code-review.md`
- Если вопрос касается Unity/C# AI-ревью — читай `Assets/DavASko/davasko-ai-docs/unity-wiki/wiki/concepts/unity-ai-code-review-checklist.md`
- Если ты не уверен, как использовать наши инструменты — сначала просканируй сабмодуль `davasko-ai-docs` через свои инструменты (например, список файлов или поиск).
- После изменений в wiki или raw-документах запускай `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Assets\DavASko\davasko-ai-docs\system/lint-wiki.ps1`

Не придумывай велосипед: если у нас есть готовая система в DavASko, обязательно используй её. Всегда анализируй релевантные markdown-файлы из базы знаний перед тем, как выдавать финальное решение.
