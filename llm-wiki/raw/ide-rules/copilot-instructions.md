AI Assistant Instructions — KBPro Project

You are the AI Assistant for the development team. In this project, we use a modular architecture and a set of plugins from the submodules of the KBPro platform.

❗️ **RULE #1: KNOWLEDGE BASE**
Before writing code, proposing architectural solutions, or analyzing the project, you are REQUIRED to first read the documentation in our knowledge base.

📌 **Where to find information:**
The knowledge base folder is located at: `Assets/KBPro/kbpro-ai-docs/`

- If the project is not yet configured for AI according to [SETUP_NEW_PROJECT.md](file:///Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/SETUP_NEW_PROJECT.md), complete the setup before performing other tasks.
- If the question concerns architecture — first read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/wiki/maps/architecture-map.md`, then proceed to the raw sources via links.
- If the question concerns gameplay/product/UI/audio/analytics/tutorial/presentation — first read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/wiki/maps/gameplay-product-map.md`.
- If the question concerns AI rules/wiki/Bitrix/operational rules — first read `Assets/KBPro/kbpro-ai-docs/llm-wiki/wiki/maps/operations-map.md`.
- If the question concerns code style — read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/raw/code_style.md`.
- If the question concerns AI-generated code review or vibe-coding — read `Assets/KBPro/kbpro-ai-docs/unity-wiki/wiki/runbooks/ai-generated-code-review.md`.
- If the question concerns Unity/C# AI-review — read `Assets/KBPro/kbpro-ai-docs/unity-wiki/wiki/concepts/unity-ai-code-review-checklist.md`.
- If you are not sure how to use our tools — first scan the `kbpro-ai-docs` submodule using your tools (e.g., file list or search).
- **Grep Search Gaps:** If you have to search the codebase using grep, ripgrep, or full-text search because the topic, convention, or code pattern was not directly found in the knowledge base maps or concepts, you must document your findings. Add the description, links, and code symbols/examples to either `kbpro-wiki` or `dentistry-cow-wiki` (depending on the domain). If the topic already exists in the knowledge base but lacks links or specific details, you must supplement/update it with the missing references so that future searches can be done directly via the wiki query system without needing generic grep searches.
- **Проверка модели (CRITICAL):** При первом же обращении к базе знаний (поиске, запросе или индексации) проверьте, установлена ли локально векторная модель. Если модель не установлена (отсутствует `tokenizer.json`, ошибка `local_files_only` и т.д.), ИИ-агент обязан незамедлительно сам предложить пользователю развернуть/установить модель локально с помощью скила `davasko-llm-wiki` (запустив команду `node system/scripts/setup-model.js`), сославшись на репозиторий: https://github.com/gDavASko/DavASkoLLMWiki.git.
- After making changes in the wiki or raw documents, run `node Assets/KBPro/kbpro-ai-docs/system/scripts/lint-wiki.js`.

Do not reinvent the wheel: if we have a ready-made system in KBPro, you must use it. Always analyze the relevant markdown files from the knowledge base before delivering a final solution.
- Never proceed to implement work (making code changes, running synchronizations, etc.) until the user explicitly says the phrase: "Реализуй план" (and exactly like that).

