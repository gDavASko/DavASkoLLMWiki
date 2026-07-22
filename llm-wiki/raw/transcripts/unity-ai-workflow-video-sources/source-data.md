# Source Data: Unity AI Workflow Videos and Expert Sources

## Tier 1: Unity AI / MCP / Editor Automation

| Статус | Источник | Ссылка | Почему важен | Что извлечь |
|---|---|---|---|---|
| video-backed | Unity MCP Tutorial: How to Install & What Is It? / Monkey Software | https://www.youtube.com/watch?v=PkvZaRSM21Y | Практический вход в Unity MCP: установка, смысл, связь AI с Unity Editor. | Минимальная установка MCP, проверочный запрос, границы доверия. |
| summary-backed | Glasp page for Monkey Software Unity MCP tutorial | https://glasp.co/youtube/p/unity-mcp-tutorial-how-to-install-what-is-it | Доступна структурная выжимка по роли Unity MCP. | Использовать как быстрый индекс, не как полный transcript. |
| official-backed | Ivan Murzak Unity MCP | https://github.com/IvanMurzak/Unity-MCP | Реальный MCP-мост между AI и Unity Editor. | Какие инструменты нужны агенту: сцены, объекты, компоненты, ассеты, консоль. |
| official-backed | Funplay Unity MCP: connect Claude Code to Unity | https://gamebooom.ai/en/blog/pf3y492u | Современный MCP workflow: Claude Code подключается к Unity через локальный сервер. | Профили инструментов, smoke-test `create TestObject`, ограничения доступа. |
| official-backed | Unity MCP server by usmanbutt-dev | https://github.com/usmanbutt-dev/unity-mcp | Хорошо перечисляет tool surface: scene, prefab, component, console, compile status. | Список операций, которые стоит требовать от агента явно. |
| official-backed | Unity Scene Management Claude Code Skill | https://mcpmarket.com/tools/skills/unity-scene-management-1 | Специализация на сценах, hierarchy и компонентах. | Как описывать задачи по сценам: hierarchy, transforms, serialized fields, build settings. |
| official-backed | Unity Copilot with MCP Server / Asset Store | https://assetstore.unity.com/packages/tools/ai-ml-integration/unity-copilot-with-mcp-server-315638 | Пример продукта вокруг Unity MCP. | Какие категории операций ожидаемы: scripts, scene, runtime checks, assets. |
| video-backed | Unity MCP UnityFlow: car racing game by AI | https://unityflow.ai/videos/video-kBZw3EF1mqU | Демонстрация AI-driven Unity production loop. | Смотреть как demo-антипаттерны и как пример end-to-end orchestration. |
| summary-backed | ClaudeLab: Unity x Claude Code Game Dev Guide | https://claudelab.net/en/articles/claude-code/unity-claude-guide | Свежая структурная статья о Unity MCP, Claude Code, сценах, assets и debugging. | Использовать как карту workflow, не как transcript видео. |
| candidate | AI Game Developer / Unity MCP materials | https://www.youtube.com/results?search_query=AI+Game+Developer+Unity+MCP | Канал/набор материалов по Unity AI workflow. | Отобрать ролики, где есть реальные действия с Editor, prefab, scene, VFX. |

## Tier 2: AI Coding Workflow, Rules, Prompts

| Статус | Источник | Ссылка | Почему важен | Что извлечь |
|---|---|---|---|---|
| official-backed | Anthropic: Claude Code best practices | https://www.anthropic.com/engineering/claude-code-best-practices | Базовый источник по агентному кодингу от разработчиков инструмента. | CLAUDE.md, plan/review loop, tests, context, iteration. |
| candidate | Code w/ Claude: Claude Code best practices | https://www.youtube.com/results?search_query=Code+w%2F+Claude+Claude+Code+best+practices | Видео-формат практик Anthropic/Claude Code, точный ролик нужно открыть вручную. | Как структурировать работу агента в реальном репозитории. |
| video-backed | Matt Pocock: Commands vs MCP vs Skills (What I Use) | https://www.youtube.com/watch?v=xAIN7YHXfCY | Хорошо разделяет команды, MCP и skills. | Когда использовать rules, когда commands, когда MCP, когда отдельный skill. |
| video-backed | Nick Chapsas: MCP video | https://www.youtube.com/watch?v=DpyjAKmNwpI | Опытный .NET-инженер объясняет MCP для разработчиков. | Модель "AI не магия, а tool caller"; безопасность и границы инструментов. |
| candidate | Cursor rules and TaskMaster setup / Parker Rex | https://www.parkerrex.com/youtube/turbocharge-your-ai-coding-with-cursor-taskmaster-rules5minu | Практика persistent rules и task decomposition. | Как не держать все правила в одном промпте. Проверить на качество. |
| candidate | Claude Code rules / CLAUDE.md best practices searches | https://www.youtube.com/results?search_query=Claude+Code+CLAUDE.md+best+practices | Нужно отобрать свежие практические ролики. | Короткие операционные правила вместо длинной философии. |
| official-backed | Claude Code Advanced Patterns PDF | https://resources.anthropic.com/hubfs/Claude%20Code%20Advanced%20Patterns_%20Subagents%2C%20MCP%2C%20and%20Scaling%20to%20Real%20Codebases.pdf | Не видео, но сильный источник по scaling agents. | Subagents, MCP, context windows, large codebases. |
| candidate | IndyDevDan / Claude Code workflow videos | https://www.youtube.com/results?search_query=IndyDevDan+Claude+Code+best+practices | Практический AI coding workflow, часто с реальными репозиториями. | Проверить на применимость к правилам, prompts, task decomposition. |
| candidate | AI Engineer / coding agents talks | https://www.youtube.com/results?search_query=AI+Engineer+coding+agents+Claude+Code+MCP | Конференционные доклады часто полезнее демо "за 10 минут". | Отобрать только engineering-heavy talks. |

## Tier 3: Unity Professional Workflows for Agent Training

| Статус | Источник | Ссылка | Почему важен | Что извлечь |
|---|---|---|---|---|
| video-backed | Code Monkey: Learn Unity Beginner/Intermediate 2025 | https://unitycodemonkey.com/video.php?v=AmGSEH7QcDg | Практический Unity workflow от сильного Unity-автора. | Как описывать агенту базовые GameObject, component, prefab, scene tasks. |
| video-backed | Game Maker's Toolkit: Unity tutorial | https://gamemakerstoolkit.com/unity-tutorial | Хороший педагогический ввод в Unity mental model. | Сцены, prefabs, components как vocabulary для промптов. |
| video-backed | Imphenzia: How to make a Video Game - Getting Started | https://www.youtube.com/watch?v=pwZpJzpE2lQ | Практика быстрого прототипирования в Unity. | Как декомпозировать задачу от идеи до playable prototype. |
| video-backed | Code Monkey: Vibe Coding is the Future (?) | https://unitycodemonkey.com/video.php?v=dCET8Jx-5Ts | Unity-разработчик обсуждает AI/vibe coding. | Где AI ускоряет прототипы, где нужен инженерный контроль. |
| video-backed | Code Monkey: AI is creating illiterate programmers! | https://unitycodemonkey.com/video.php?v=2H4ouL4bCUs | Риск потери понимания кода при AI-generated work. | Требовать объяснение diff, review notes, small tasks. |
| candidate | Jason Weimann / Game Dev Show AI-assisted Unity materials | https://www.youtube.com/results?search_query=Jason+Weimann+Unity+AI+Claude+Code+MCP | Unity architecture и практический game dev background. | Отобрать только ролики с инженерным разбором. |
| candidate | Infallible Code / Unity architecture, refactoring | https://www.youtube.com/results?search_query=Infallible+Code+Unity+architecture+refactoring+SOLID | Подходит для правил качества после генерации AI. | SOLID/architecture constraints для агента. |
| candidate | Tarodev Unity architecture/refactoring | https://www.youtube.com/results?search_query=Tarodev+Unity+architecture+refactoring+prefab | Практичные Unity patterns. | Как задавать агенту компонентную структуру и boundaries. |
| candidate | Game Dev Guide Unity production workflow | https://www.youtube.com/results?search_query=Game+Dev+Guide+Unity+prefab+workflow+architecture | Сильный Unity канал про production patterns. | Prefab, scene, tooling и workflow constraints для агента. |
| candidate | Freya Holmer Unity shaders/math/tools | https://www.youtube.com/results?search_query=Freya+Holmer+Unity+shader+tools+tutorial | Сильная экспертиза по визуалу, математике и tooling. | Для prompts по shaders/VFX: параметры, визуальные constraints, readability. |

## Tier 4: Prefabs, Scenes, Shader/VFX Sources

| Статус | Источник | Ссылка | Почему важен | Что извлечь |
|---|---|---|---|---|
| official-backed | Unity Manual: Prefabs | https://docs.unity3d.com/Manual/Prefabs.html | Главный источник по prefab model. | Требовать prefab variants, overrides, nested prefab discipline. |
| candidate | Unity prefab variants / nested prefabs videos | https://www.youtube.com/results?search_query=Unity+prefab+variants+nested+prefabs+best+practices | Нужны ролики по production prefab workflow. | Префабы как контракт, overrides audit, nested prefab boundaries. |
| video-backed | Gabriel Aguiar: Get Started with Unity VFX Graph in 2024 | https://www.youtube.com/watch?v=R4XsJ645l6E | Сильный practical VFX author. | Как задавать VFX-agent tasks: graph, exposed params, material, prefab binding. |
| summary-backed | Glasp page for Gabriel Aguiar VFX Graph tutorial | https://glasp.co/youtube/p/get-started-with-unity-vfx-graph-in-2024-tutorial | Краткая структура урока по VFX Graph. | Использовать как индекс, transcript-limited. |
| video-backed | Game Dev Guide: Scriptable Render Pipeline | https://www.youtube.com/watch?v=9fa4uFm1eCE | Понимание SRP/URP как границы для шейдеров и эффектов. | Запрашивать у агента совместимость с URP, материалы, render features. |
| video-backed | Code Monkey: Unity Particle System tutorial | https://unitycodemonkey.com/video.php?v=yW89geuaEfI | Быстрый практический источник по Particle System. | Как агент должен создавать effect prefab и serialized параметры. |
| candidate | Shader Graph Unity 6 tutorials | https://www.youtube.com/results?search_query=Unity+6+Shader+Graph+tutorial+professional | Нужно отобрать свежие ролики по URP/Shader Graph. | Шейдеры как ассеты, материал-инстансы, keywords, mobile constraints. |
| candidate | Unity VFX Graph Unity 6 tutorials | https://www.youtube.com/results?search_query=Unity+6+VFX+Graph+tutorial+Gabriel+Aguiar | Нужны актуальные Unity 6 VFX практики. | Version-specific setup, package settings, exposed properties. |
| candidate | Unity official AI Assistant / MCP videos | https://www.youtube.com/results?search_query=Unity+AI+Assistant+MCP+Unity+Editor | Если есть официальный Unity материал, он должен иметь высокий приоритет. | Проверить актуальный official workflow для Unity 6. |

## Non-English Candidate Searches

| Статус | Язык | Ссылка | Зачем смотреть |
|---|---|---|---|
| candidate | Korean | https://www.youtube.com/results?search_query=%EC%9C%A0%EB%8B%88%ED%8B%B0+Claude+Code+MCP | В корейском сегменте есть свежие Unity MCP/Claude Code эксперименты; полезно для scene/prefab automation. |
| candidate | Japanese | https://www.youtube.com/results?search_query=Unity+Claude+Code+MCP+%E3%83%97%E3%83%AC%E3%83%95%E3%82%A1%E3%83%96 | Японский Unity-сегмент часто силен в editor tooling и production workflows. |
| candidate | Russian | https://www.youtube.com/results?search_query=Unity+Claude+Code+MCP+%D0%BF%D1%80%D0%B5%D1%84%D0%B0%D0%B1 | Проверить русскоязычные материалы, но не брать без демонстрации реального Editor workflow. |
| candidate | Spanish | https://www.youtube.com/results?search_query=Unity+MCP+Claude+Code+prefab+escena | Полезно как дополнительный пул, если англоязычные источники исчерпаны. |
| candidate | Portuguese | https://www.youtube.com/results?search_query=Unity+MCP+Claude+Code+prefab+cena | Дополнительный пул для Unity MCP demos. |

## Low Priority / Use Only as Lessons from Demos

| Статус | Источник | Ссылка | Почему низкий приоритет |
|---|---|---|---|
| low-priority | "I made a game in 10 minutes with AI" style videos | https://www.youtube.com/results?search_query=made+a+Unity+game+with+AI+in+10+minutes | Обычно показывают скорость, но не качество, архитектуру, тестирование и поддержку. |
| low-priority | Generic no-code AI app demos | https://www.youtube.com/results?search_query=vibe+coding+unity+game+no+code | Можно смотреть только ради анти-паттернов: большие нечитабельные диффы, отсутствие ревью, хрупкие сцены. |

## Наблюдения по полноте

- По Unity MCP и Editor automation сильных материалов меньше, чем по веб-разработке.
- Поэтому нужны не только видео, но и official/tool-backed источники: репозитории MCP,
  Unity Manual, Anthropic docs, asset/package docs.
- Для сложных prefab/scene задач видео должно быть дополнено локальными правилами проекта:
  KBPro module boundaries, prefab naming, serialized field policy, Addressables,
  lifecycle, UniTask, dispose, VFX/URP constraints.
