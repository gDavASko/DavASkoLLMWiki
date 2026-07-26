# Исследовательский отчёт: RLM (Recursive Language Models) — замена RAG

> **Дата:** 2026-07-06
> **Источники:** arXiv 2512.24601, GitHub alexzhang13/rlm, блогпост Alex Zhang (MIT), GitHub zhudotexe/redel, arXiv 2303.08128, и др.
> **Тема:** Подход RLM как фундаментальная альтернатива системам RAG (Retrieval-Augmented Generation)

---

## Оглавление

1. [Проблема: Context Rot — почему RAG и длинные контексты не работают](#1-проблема-context-rot)
2. [Что такое RLM (Recursive Language Models)](#2-что-такое-rlm)
3. [Ключевые принципы RLM](#3-ключевые-принципы-rlm)
4. [Архитектура и алгоритм RLM (детально)](#4-архитектура-и-алгоритм-rlm)
5. [RLM vs RAG — принципиальные отличия](#5-rlm-vs-rag)
6. [Существующие реализации](#6-существующие-реализации)
   - 6.1 [MIT OASYS Lab — alexzhang13/rlm (основная)](#61-mit-oasys-lab--rlm)
   - 6.2 [ReDel — Recursive Delegation Framework](#62-redel--recursive-delegation)
   - 6.3 [ViperGPT — Visual Inference via Python Execution](#63-vipergpt)
   - 6.4 [Context Folding / AgentFold](#64-context-folding--agentfold)
   - 6.5 [DSPy — программная оркестрация LLM-вызовов](#65-dspy)
7. [Результаты бенчмарков](#7-результаты-бенчмарков)
8. [Практическое руководство: как создать свой RLM](#8-практическое-руководство)
9. [Ограничения и будущее](#9-ограничения-и-будущее)
10. [Ссылки и литература](#10-ссылки)

---

## 1. Проблема: Context Rot

### Что такое Context Rot?

**Context Rot** — это явление, при котором качество ответов LLM **деградирует** по мере увеличения длины входного контекста. Это ключевая мотивация для создания RLM.

> [!IMPORTANT]
> Исследование **Kelly Hong, Anton Troynikov, Jeff Huber** из **Chroma** (2025) показало, что даже frontier-модели (GPT-4.1, Claude 4, Gemini 2.5, Qwen3) **не обрабатывают контекст равномерно** — их производительность становится всё менее надёжной по мере роста длины входных данных.

### Ключевые наблюдения:

| Аспект | Описание |
|---|---|
| **Определение** | По мере роста числа токенов в context window, способность модели точно извлекать и использовать информацию **снижается** |
| **Кто открыл** | Первоначально наблюдалось практиками (Claude Code, ChatGPT long sessions), формализовано Chroma (Hong et al., 2025) |
| **Масштаб проблемы** | На задачах типа OOLONG (линейная сложность) GPT-5 деградирует уже при 16K+ токенов, на OOLONG-Pairs (квадратичная сложность) — ещё раньше |
| **Needle-in-Haystack** | На простых NIAH-задачах модели справляются хорошо, но это **обманчивый** результат — реальные задачи требуют **плотного доступа** ко всему контексту |
| **RAG страдает** | RAG системы основаны на том, что мы вставляем найденные фрагменты **в контекст LLM** — и подвержены той же деградации |

### Почему RAG не решает проблему:

1. **RAG = retrieve + stuff into context** — извлечённые чанки всё равно попадают в context window LLM
2. При сложных задачах нужна **плотная обработка всего контекста**, а не выборочное извлечение
3. Lossy compaction (суммаризация) теряет детали, критичные для ответа
4. RAG не может обработать задачи, где ответ зависит от **каждой строки** входных данных

---

## 2. Что такое RLM (Recursive Language Models)

### Определение

**RLM (Recursive Language Model)** — это **парадигма инференса**, которая:

1. **Не запихивает** весь контекст в нейронную сеть
2. Вместо этого **помещает контекст в переменную** во внешней среде (REPL)
3. Позволяет LLM **программно** исследовать, декомпозировать и **рекурсивно вызывать себя** на фрагментах контекста
4. Возвращает финальный ответ — с точки зрения пользователя это **тот же интерфейс** что и обычный LLM API-вызов

### Формальное определение (из arXiv 2512.24601):

> Дана базовая нейронная языковая модель $\mathcal{M}$ с максимальным контекстом $K$. **RLM** — это inference-time scaffold вокруг $\mathcal{M}$, который рассматривает пользовательский prompt как часть окружения, не отказываясь от возможности плотно обрабатывать его содержимое через различные вызовы $\mathcal{M}$.

### Ключевая метафора:

```
Обычный LLM:  prompt → [NEURAL NETWORK] → ответ
                 ↑ Всё в context window

RLM:          prompt → [ПЕРЕМЕННАЯ В REPL] ← LLM пишет КОД чтобы работать с ней
                                              ↓
                                         SUB-RLM вызовы (рекурсия)
                                              ↓
                                         Final = ответ
```

### Аналогия:

> RLM — это как дать модели **файловую систему и IDE** вместо того, чтобы заставлять её запоминать всю книгу целиком. Модель может "открыть файл", "прочитать строки 100-200", "запустить подпроцесс для анализа главы 3", и собрать результат.

---

## 3. Ключевые принципы RLM

### 3 критических дизайн-решения, отличающих RLM от других подходов:

### Принцип 1: Контекст — это переменная, а не input

```python
# ❌ Обычный подход (RAG, CodeAct, компакция):
response = llm.completion(
    messages=[{"role": "user", "content": HUGE_CONTEXT + question}]
)

# ✅ RLM подход:
repl_env.set_variable("CONTEXT", HUGE_CONTEXT)
# LLM получает только: "У тебя есть переменная CONTEXT длиной 5,000,000 символов..."
# LLM сама пишет код для работы с ней
```

> [!TIP]
> Это ключевой инсайт: **prompt не попадает в neural network напрямую**. Модель получает только метаданные (длина, короткий префикс, как обращаться к частям). Сам контекст живёт **снаружи** — в REPL-переменной.

### Принцип 2: Вывод через переменную, а не autoregressive generation

```python
# ❌ Обычный подход:
# LLM генерирует ответ авторегрессивно → ограничен output window

# ✅ RLM подход:
# LLM пишет: Final = result_var  
# Ответ берётся из переменной в REPL → может быть ЛЮБОЙ длины
```

### Принцип 3: Символическая рекурсия (sub-RLM вызовы в коде)

```python
# ❌ Обычный sub-agent подход (Claude Code, ReAct):
# LLM вербализует: "Делегирую подзадачу агенту X..."
# Может создать 2-3 sub-вызова вручную

# ✅ RLM подход:
# LLM пишет:
for chunk in split_context(CONTEXT, chunk_size=1000):
    results.append(sub_rlm(f"Классифицируй: {chunk}"))
# Может программно создать Ω(|P|) или даже Ω(|P|²) вызовов!
```

> [!IMPORTANT]
> **Символическая рекурсия** — самый важный принцип. Код в REPL может **программно** вызывать sub-LLM внутри циклов. Это делает RLM экспоненциально мощнее, чем подходы с ручной делегацией (где LLM может создать лишь несколько вербализованных подзадач).

---

## 4. Архитектура и алгоритм RLM (детально)

### Полный алгоритм (Алгоритм 1 из статьи):

```
ВХОД: prompt P, нейронная модель M, max_iterations, max_depth

1. ИНИЦИАЛИЗАЦИЯ:
   env = создать_REPL_среду()
   env.set("CONTEXT", P)                    # Контекст = переменная
   env.register("sub_rlm", sub_rlm_func)    # Функция для рекурсивных вызовов
   
   hist = [системный_промпт + метаданные_о_P]
   # Метаданные: len(P), P[:500], "используй CONTEXT[start:end]..."
   
2. ЦИКЛ RLM (до max_iterations):
   a. code = M.completion(hist)              # LLM генерирует код
   b. stdout, env = env.execute(code)        # Выполнить код в REPL
   c. truncated_stdout = stdout[:MAX_LEN]    # Обрезать вывод
   d. hist.append(truncated_stdout)          # Добавить в историю
   
   e. ЕСЛИ env.has("Final"):                # LLM установила Final?
        ВЕРНУТЬ env.get("Final")             # → Ответ!
   
3. ЕСЛИ лимит итераций:
   ВЕРНУТЬ M.completion(hist + "Дай финальный ответ")
```

### Sub-RLM вызов (рекурсивная функция):

```python
def sub_rlm(prompt: str, depth: int = current_depth + 1) -> str:
    """Рекурсивный вызов RLM с новым промптом"""
    if depth > max_depth:
        # На максимальной глубине — обычный LLM вызов
        return llm.completion(prompt)
    
    # Иначе — запускаем полный RLM с новым контекстом
    return rlm_loop(prompt, model=sub_model, depth=depth)
```

### Визуальная архитектура (соответствует диаграмме из скриншота):

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ВХОД                                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ Файлы    │ │ Git      │ │ API      │ │ Логи/CSV │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│         ↓                                                       │
│   Всё → Python переменная (CONTEXT)                             │
└─────────────────┬───────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. ОБРАБОТКА (мозг)                                             │
│                                                                 │
│   ┌─────────┐                                                   │
│   │  LLM    │ ← Root LLM (GPT-5, Claude, etc.)                 │
│   └────┬────┘                                                   │
│        ↓                                                        │
│   "Сама пишет код на Python"                                    │
│        ↓                                                        │
│   ┌──────────┐                                                  │
│   │ Результат│ ← exec() в REPL                                 │
│   └────┬─────┘                                                  │
│        ↓                                                        │
│   ┌──────────┐     ДА                                          │
│   │ Понятно? │ ──────→ На выход                                │
│   └────┬─────┘                                                  │
│        │ НЕТ                                                    │
│        ↓                                                        │
│   ┌───────────┐                                                 │
│   │ sub_RLM   │ ← Новый мини-мозг на непонятном куске          │
│   └───────────┘                                                 │
│        ↓                                                        │
│   обратно к LLM (новый виток цикла)                             │
│   повторяется N раз до понимания или до лимита                  │
└─────────────────┬───────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. ВЫХОД                                                        │
│                                                                 │
│   ┌─────────────────┐                                           │
│   │ sub_RLM         │                                           │
│   │ АГРЕГАТОР       │ ← Чистая голова (без исходного контекста) │
│   │ (чистая голова) │                                           │
│   └────────┬────────┘                                           │
│            ↓                                                    │
│   Final = «текст ответа»                                       │
│   ← лежит в переменной                                         │
│            ↓                                                    │
│        К Тебе (пользователю)                                    │
│                                                                 │
│   Финальный ответ пишет НЕ root,                                │
│   а отдельный sub_RLM-агрегатор.                                │
│   У root уже забит контекст кодом +                             │
│   историей + рассуждениями.                                     │
│   Агрегатор получает свежую голову                               │
│   и готовые данные = чистый ответ.                               │
└─────────────────────────────────────────────────────────────────┘
```

### Иерархия глубин рекурсии:

```
depth=0: RLM без sub-вызовов (только REPL + код)
         → Уже лучше чем vanilla LLM на длинных контекстах
         
depth=1: RLM с sub-LLM вызовами (один уровень)
         → Основная рабочая конфигурация
         → Root = GPT-5, Sub = GPT-5-mini
         
depth=2: RLM с sub-RLM вызовами (два уровня рекурсии)
         → Sub-вызовы сами могут запускать sub-вызовы
         → Лучше для задач квадратичной сложности (OOLONG-Pairs)
         
depth=3+: Глубокая рекурсия
          → Теоретически неограниченно, но на практике 
            дороже и может порождать ошибки
```

### Управление контекстом в цикле:

```
Итерация 1: hist = [system_prompt, "CONTEXT has 5M chars, first 500: ..."]
             → LLM: code = "chunks = CONTEXT.split('\n\n'); print(len(chunks))"
             → stdout (обрезан): "2500 чанков"

Итерация 2: hist = [..., "stdout: 2500 чанков"]
             → LLM: code = """
                results = []
                for i, chunk in enumerate(chunks[:100]):
                    r = sub_rlm(f"Найди упоминание X в: {chunk}")
                    results.append(r)
                print(f"Найдено: {sum(1 for r in results if 'да' in r)}")
             """
             → stdout: "Найдено: 7"

Итерация 3: hist = [..., "stdout: Найдено: 7"]
             → LLM: code = "Final = f'X упоминается 7 раз в документах ...'"
             → ВЕРНУТЬ Final
```

> [!NOTE]
> **Ключевой момент:** stdout обрезается до константного размера при каждой итерации. Это **заставляет** модель хранить промежуточные результаты в переменных REPL, а не в своём context window. При обрезке до $c$ токенов за итерацию, мы можем иметь не более $K/c$ итераций root-уровня, каждая из которых может запустить **произвольное число** sub-вызовов.

---

## 5. RLM vs RAG — принципиальные отличия

| Аспект | RAG | RLM |
|--------|-----|-----|
| **Где хранится контекст** | В векторной БД (внешне), затем вставляется в context window | В переменной REPL (внешне), LLM работает с ней программно |
| **Как ищут** | Vectorized semantic search (embedding → cosine sim) | LLM сама пишет код для поиска, фильтрации, агрегации |
| **Потеря данных** | Да: top-K retrieval теряет нерелевантные (но нужные) чанки | Нет: LLM может обработать **весь** контекст через рекурсию |
| **Задачи плотной обработки** | Плохо: OOLONG (нужно каждую строку → RAG не поможет) | Отлично: рекурсивно обрабатывает каждый чанк |
| **Pre-processing** | Нужен: chunking, embedding, индексация | Не нужен: контекст загружается "как есть" |
| **Инфраструктура** | Векторная БД (Chroma, Pinecone, etc.) | Только Python REPL |
| **Адаптивность** | Фиксированная стратегия retrieval | LLM сама решает стратегию декомпозиции |
| **Масштаб** | Ограничен context window (даже с retrieval) | 10M+ токенов (2 порядка за пределами context window) |
| **Стоимость** | embedding + retrieval + LLM вызов | Сравнима или дешевле vanilla LLM |
| **Качество на длинных** | Деградирует из-за Context Rot | Деградирует значительно медленнее |

### Когда RAG всё ещё лучше:

- Простые вопросы по большой статичной БД знаний (FAQ, документация)
- Когда нужна **скорость** ответа (RAG = один retrieval + один LLM вызов)
- Когда данные регулярно обновляются и нужен real-time индекс
- Когда бюджет на compute строго ограничен

### Когда RLM значительно лучше:

- **Deep Research** — анализ корпуса из 1000+ документов
- **Информационная агрегация** — ответ зависит от почти каждой строки
- **Code understanding** — анализ целых репозиториев
- **Парные/квадратичные задачи** — сравнение пар элементов
- **Длинные reasoning-цепочки** — задачи с зависимыми подзадачами

---

## 6. Существующие реализации

---

### 6.1 MIT OASYS Lab — RLM (основная референсная реализация)

| Параметр | Значение |
|---|---|
| **Репозиторий** | [github.com/alexzhang13/rlm](https://github.com/alexzhang13/rlm) |
| **Минимальная версия** | [github.com/alexzhang13/rlm-minimal](https://github.com/alexzhang13/rlm-minimal) |
| **Статья** | [arXiv 2512.24601](https://arxiv.org/abs/2512.24601) |
| **Блогпост** | [alexzhang13.github.io/blog/2025/rlm](https://alexzhang13.github.io/blog/2025/rlm/) |
| **Авторы** | Alex L. Zhang, Tim Kraska, Omar Khattab (MIT CSAIL) |
| **Лицензия** | MIT |
| **Stars** | 4.4K+ |
| **Язык** | Python 3.11+ (99.7%) |
| **PyPI** | `pip install rlms` |

#### Архитектура:

```python
from rlm import RLM

rlm = RLM(
    backend="openai",                     # Поддерживает: openai, anthropic, local
    backend_kwargs={"model_name": "gpt-5-nano"},
    verbose=True,                          # Rich-вывод в консоль
)

# Drop-in замена llm.completion()
result = rlm.completion("Проанализируй этот документ на 5M токенов...")
print(result.response)
```

#### Поддерживаемые REPL-среды:

| Среда | Тип | Описание |
|---|---|---|
| `local` (default) | Non-isolated | Python `exec` на хосте |
| `ipython` | Non-isolated | IPython kernel |
| `docker` | Isolated | Docker контейнер |
| `modal` | Isolated | Modal Sandbox (облако) |
| `prime` | Isolated | Prime Intellect Sandbox |

#### Ключевые компоненты кода:

```
rlm/
├── __init__.py          # Основной класс RLM
├── rlm.py              # Логика RLM-цикла (Алгоритм 1)
├── repl/               # REPL-среды
│   ├── local.py        # exec-based REPL
│   ├── docker.py       # Docker sandbox
│   └── modal.py        # Modal sandbox
├── backends/           # LLM-бэкенды
│   ├── openai.py
│   ├── anthropic.py
│   └── local.py        # Локальные модели (vLLM, etc.)
├── sub_rlm.py          # Sub-RLM function для рекурсии
└── prompts/            # Системные промпты

training/               # Fine-tuning среда
├── verifiers/          # Верификаторы для RLVR
└── ...                 # На базе PrimeRL
```

#### Тренировка RLM-Qwen3-8B:

- **Дата-сет:** 1,000 отфильтрованных траекторий от Qwen3-Coder-480B-A35B
- **Метод:** Fine-tuning на RLM-траекториях (root + sub-вызовы)
- **Источник задач:** LongBenchPro (несвязанные с eval-задачами)
- **Результат:** +28.3% median improvement на всех 4 eval-задачах
- **Инсайт:** Тренировка на одном домене обобщается на другие

---

### 6.2 ReDel — Recursive Delegation Framework

| Параметр | Значение |
|---|---|
| **Репозиторий** | [github.com/zhudotexe/redel](https://github.com/zhudotexe/redel) |
| **Статья** | [ACL Anthology / EMNLP 2024 Demo](https://aclanthology.org/2024.emnlp-demo.17/) |
| **Язык** | Python 3.10+ |
| **Фреймворк** | На базе [kani](https://github.com/zhudotexe/kani) |
| **Тип** | Фреймворк для рекурсивной делегации LLM-агентов |

#### Ключевые особенности:

- **Модульный дизайн** — легко экспериментировать с методами делегации
- **Event-driven архитектура** — гранулярное логирование
- **Визуализация** — веб-интерфейс для интерактивной работы и replay'ов
- **Open-source, без vendor lock-in**

#### Архитектурный паттерн:

```python
from kani.engines.openai import OpenAIEngine
from redel import ReDel, events

engine = OpenAIEngine(model="gpt-4", temperature=0.8, top_p=0.95)

ai = ReDel(
    root_engine=engine,          # Root LLM
    delegate_engine=engine,      # Sub-agent LLM  
    title="Task Analysis",
    tool_configs={
        Browsing: {"always_include": True},
    },
)

async for event in ai.query("Сложный запрос..."):
    if isinstance(event, events.RootMessage):
        print(event.msg.text)
```

#### Отличия от RLM:

| Аспект | ReDel | RLM (MIT) |
|---|---|---|
| Рекурсия | Через tool-calling делегацию | Через программный код в REPL |
| Контекст | Передаётся в context window агентов | Живёт в переменной REPL |
| Sub-вызовы | Вербализованные (LLM описывает подзадачу текстом) | Программные (LLM пишет цикл с sub-вызовами в коде) |
| Масштаб | Ограничен context window каждого агента | Практически неограничен |
| Визуализация | Да, веб-UI | Через логи и visualizer |

#### Конфигурации из EMNLP экспериментов:

| System | Root Model | Delegate Model | Delegation? |
|--------|------------|----------------|-------------|
| full | gpt-4o | gpt-4o | yes |
| root-fc | gpt-4o | gpt-4o | yes + root functions |
| baseline | gpt-4o | N/A | no |

---

### 6.3 ViperGPT — Visual Inference via Python Execution

| Параметр | Значение |
|---|---|
| **Статья** | [arXiv 2303.08128](https://arxiv.org/abs/2303.08128) (ICCV 2023) |
| **Авторы** | Dídac Surís, Sachit Menon, Carl Vondrick (Columbia University) |
| **Домен** | Visual question answering, image reasoning |

#### Концепция:

ViperGPT — один из **первых** подходов, где LLM генерирует **программы** для решения задач, а не отвечает напрямую. Хотя он фокусируется на визуальных задачах, его паттерн **стал основой** для RLM:

```python
# ViperGPT паттерн:
# 1. LLM получает вопрос: "Сколько красных объектов на изображении?"
# 2. LLM генерирует Python-программу:
def execute_query(image):
    objects = detect_objects(image)
    red_objects = [o for o in objects if o.color == "red"]
    return len(red_objects)
# 3. Программа выполняется, результат возвращается
```

#### Связь с RLM:

- ViperGPT показал, что **LLM может генерировать программы** для взаимодействия с данными
- RLM расширяет эту идею: вместо vision API, модель вызывает **саму себя** (sub-LLM) внутри программы
- ViperGPT — **одношаговая** генерация кода; RLM — **итеративная** с обратной связью

> [!NOTE]
> В статье RLM (arXiv 2512.24601) ViperGPT упоминается как один из предшественников, вместе с THREAD, ReDel, и Context Folding. Все они "explored deferring the choice of sub-LM calls to the LM", но **не могут обрабатывать длинный контекст** за пределами base LM window.

---

### 6.4 Context Folding / AgentFold

| Параметр | Значение |
|---|---|
| **Подходы** | Context Folding (Sun et al., 2025), AgentFold (Ye et al., 2025) |
| **Категория** | Task decomposition через рекурсивные LM-вызовы |

#### Context Folding:

Подход, при котором **длинный контекст "складывается"** через рекурсивные вызовы LLM:

```
Документ (1M токенов)
    ↓
Разбивка на чанки (10K каждый)
    ↓
LLM: Суммаризируй чанк_1 → summary_1
LLM: Суммаризируй чанк_2 → summary_2
...
LLM: Суммаризируй чанк_100 → summary_100
    ↓
LLM: Объедини все суммари → финальный ответ
```

#### AgentFold:

Расширение Context Folding, где sub-LM вызовы организуются в **иерархическую** структуру:

```
                Root Agent
               /    |     \
          Agent_1  Agent_2  Agent_3
          /    \      |     /    \
       Sub_1  Sub_2  Sub_3  Sub_4  Sub_5
```

#### Отличия от RLM:

| Аспект | Context Folding / AgentFold | RLM |
|---|---|---|
| Стратегия | Предопределённая (chunk → summarize → merge) | LLM сама выбирает стратегию |
| Рекурсия | Фиксированной глубины | Произвольной глубины |
| Код | Нет code execution | Полноценный REPL |
| Адаптивность | Одна стратегия для всех задач | LLM адаптируется к каждой задаче |

> [!WARNING]
> Context Folding/AgentFold — это **lossy** подходы: каждый уровень суммаризации теряет информацию. RLM — **lossless**: модель может в любой момент обратиться к оригинальным данным через переменную REPL.

---

### 6.5 DSPy — Программная оркестрация LLM-вызовов

| Параметр | Значение |
|---|---|
| **Репозиторий** | [github.com/stanfordnlp/dspy](https://github.com/stanfordnlp/dspy) |
| **Автор** | Omar Khattab (Stanford → MIT) — **со-автор RLM** |
| **Назначение** | Программная (не prompt-based) оркестрация LLM pipelines |

#### Связь с RLM:

Omar Khattab — со-автор и RLM, и DSPy. DSPy заложил философскую основу:

> **"Программируй LLM, а не промпти их"** (Program, don't prompt)

DSPy демонстрирует подход, где LLM-вызовы — это **функции** в программе, которые можно:
- Компоновать (chain)
- Оптимизировать автоматически
- Тестировать и валидировать

#### DSPy как фундамент RLM:

```python
# DSPy pipeline (концептуально):
class RAGPipeline(dspy.Module):
    def __init__(self):
        self.retrieve = dspy.Retrieve()
        self.generate = dspy.ChainOfThought("context, question -> answer")
    
    def forward(self, question):
        context = self.retrieve(question)
        return self.generate(context=context, question=question)

# RLM идёт дальше: LLM сама строит pipeline в runtime
# через код в REPL, а не через предопределённые модули
```

---

## 7. Результаты бенчмарков

### Основные результаты (Таблица 1 из статьи):

#### GPT-5 (основные конфигурации):

| Метод | S-NIAH | BrowseComp+ (1K) | OOLONG | OOLONG-Pairs | CodeQA |
|---|---|---|---|---|---|
| **GPT-5 (vanilla)** | 96% | 30.0% | 52.0% | ≤0.1% | 51.1% |
| **GPT-5 + Compaction** | — | 22.0% | 46.0% | — | — |
| **GPT-5 + CodeAct+BM25** | — | 20.7% | — | — | — |
| **Claude Code (Opus 4.1)** | — | — | 54.0% | 6.8% | — |
| **RLM(GPT-5, depth=0)** | — | — | 56.0% | 2.1% | — |
| **RLM(GPT-5, depth=1)** | **98%** | **51.3%** | **80.4%** | **58.0%** | **57.8%** |
| **RLM(GPT-5, depth=2)** | — | 46.7% | 76.0% | **60.0%** | — |

#### Qwen3-Coder-480B-A35B:

| Метод | OOLONG | OOLONG-Pairs | CodeQA |
|---|---|---|---|
| **Qwen3-Coder (vanilla)** | 48.0% | ≤0.1% | 46.7% |
| **RLM(Qwen3-Coder, depth=1)** | **81.3%** | **23.1%** | 51.1% |

#### RLM-Qwen3-8B (обученная модель):

| Метод | Median improvement |
|---|---|
| **Qwen3-8B (vanilla)** | baseline |
| **RLM-Qwen3-8B** | **+28.3%** на всех 4 задачах |
| Приближается к vanilla GPT-5 на 3 из 4 задач |

### Ключевые наблюдения из экспериментов:

> [!IMPORTANT]
> 1. **RLM масштабируется до 10M+ токенов** — далеко за пределами context window любой модели
> 2. **Даже на коротких контекстах** RLM превосходит vanilla LLM (за счёт декомпозиции)
> 3. **REPL без sub-вызовов (depth=0)** уже даёт преимущество — просто вынос контекста в переменную помогает
> 4. **Sub-вызовы критичны** для information-dense задач (OOLONG: 80.4% vs 52.0%)
> 5. **Стоимость сравнима** или дешевле vanilla LLM — медианная стоимость RLM ниже медианной стоимости base model
> 6. **Тренировка обобщается** — fine-tuning на одном домене улучшает все downstream задачи

---

## 8. Практическое руководство: как создать свой RLM

### Минимальная реализация (на основе rlm-minimal):

#### Шаг 1: REPL-среда

```python
class REPLEnvironment:
    """Среда для выполнения кода LLM"""
    
    def __init__(self):
        self.globals = {}
        self.locals = {}
    
    def set_variable(self, name: str, value: any):
        """Установить переменную в REPL"""
        self.globals[name] = value
    
    def get_variable(self, name: str) -> any:
        """Получить переменную из REPL"""
        return self.globals.get(name)
    
    def has_variable(self, name: str) -> bool:
        return name in self.globals
    
    def execute(self, code: str) -> str:
        """Выполнить код и вернуть stdout"""
        import io, contextlib
        stdout_capture = io.StringIO()
        try:
            with contextlib.redirect_stdout(stdout_capture):
                exec(code, self.globals, self.locals)
            return stdout_capture.getvalue()
        except Exception as e:
            return f"ERROR: {type(e).__name__}: {e}"
```

#### Шаг 2: Sub-RLM функция

```python
def create_sub_rlm(llm_client, max_depth: int = 1):
    """Создать функцию sub_rlm для регистрации в REPL"""
    
    def sub_rlm(prompt: str, current_depth: int = 0) -> str:
        if current_depth >= max_depth:
            # На максимальной глубине — простой LLM вызов
            return llm_client.completion(prompt)
        
        # Иначе — полный RLM цикл
        return rlm_loop(
            prompt=prompt,
            llm_client=llm_client,
            max_depth=max_depth,
            current_depth=current_depth + 1
        )
    
    return sub_rlm
```

#### Шаг 3: Системный промпт

```python
SYSTEM_PROMPT = """You are a Recursive Language Model (RLM). 
You have access to a Python REPL environment.

The user's prompt is stored in the variable `CONTEXT`.
- CONTEXT length: {context_length} characters
- CONTEXT preview (first 500 chars): {context_preview}

You can:
1. Write Python code to examine CONTEXT (e.g., CONTEXT[100:200])
2. Call `sub_rlm(prompt)` to recursively query an LLM on a sub-task
3. Use `print()` to output intermediate results (stdout is truncated)
4. Store intermediate results in variables

When you have the final answer, set: Final = "your answer here"

Strategy tips:
- Split CONTEXT into chunks and process each with sub_rlm()
- Use loops for repetitive processing
- Aggregate results in variables, not in your context
- Be programmatic: write code, don't try to read everything at once
"""
```

#### Шаг 4: Основной цикл RLM

```python
def rlm_loop(
    prompt: str,
    llm_client,
    max_iterations: int = 15,
    max_depth: int = 1,
    current_depth: int = 0,
    stdout_truncate: int = 2000,
) -> str:
    """Основной цикл RLM"""
    
    # 1. Инициализация REPL
    env = REPLEnvironment()
    env.set_variable("CONTEXT", prompt)
    env.set_variable("sub_rlm", create_sub_rlm(llm_client, max_depth))
    
    # 2. Формирование системного промпта
    system_msg = SYSTEM_PROMPT.format(
        context_length=len(prompt),
        context_preview=prompt[:500],
    )
    
    history = [
        {"role": "system", "content": system_msg},
    ]
    
    # 3. Основной цикл
    for i in range(max_iterations):
        # LLM генерирует код
        response = llm_client.completion(history)
        code = extract_code(response)  # Извлечь код из ```python ... ```
        
        history.append({"role": "assistant", "content": response})
        
        if code:
            # Выполнить код
            stdout = env.execute(code)
            
            # Обрезать stdout
            truncated = stdout[:stdout_truncate]
            if len(stdout) > stdout_truncate:
                truncated += f"\n... (truncated, full length: {len(stdout)})"
            
            history.append({
                "role": "user", 
                "content": f"Code executed. stdout:\n{truncated}"
            })
        
        # Проверить, установлен ли Final
        if env.has_variable("Final"):
            return str(env.get_variable("Final"))
    
    # Fallback: попросить дать ответ
    history.append({
        "role": "user",
        "content": "Max iterations reached. Set Final = your best answer now."
    })
    response = llm_client.completion(history)
    env.execute(extract_code(response))
    
    return str(env.get_variable("Final") or response)
```

#### Шаг 5: Использование

```python
class RLM:
    """Drop-in замена LLM API"""
    
    def __init__(self, backend="openai", model="gpt-5-nano", max_depth=1):
        self.client = create_llm_client(backend, model)
        self.max_depth = max_depth
    
    def completion(self, prompt: str) -> str:
        """Главная точка входа — замена llm.completion()"""
        return rlm_loop(
            prompt=prompt,
            llm_client=self.client,
            max_depth=self.max_depth,
        )

# Использование:
rlm = RLM(backend="openai", model="gpt-4o", max_depth=1)
answer = rlm.completion(huge_document_text + "\n\nВопрос: ...")
```

### Продвинутые паттерны:

#### Паттерн: Разделение Root и Sub моделей

```python
rlm = RLM(
    root_model="gpt-5",           # Умная модель для root
    sub_model="gpt-5-mini",       # Дешёвая для sub-вызовов
    max_depth=2,
)
# Root = дорогой, решает стратегию
# Sub = дешёвый, выполняет рутину
```

#### Паттерн: Асинхронные sub-вызовы

```python
import asyncio

async def sub_rlm_async(prompt: str) -> str:
    return await llm_client.acompletion(prompt)

# В коде REPL:
results = await asyncio.gather(*[
    sub_rlm_async(f"Process chunk {i}: {chunk}")
    for i, chunk in enumerate(chunks)
])
```

#### Паттерн: Sandboxed REPL (безопасность)

```python
# Docker sandbox
env = DockerREPL(image="python:3.12-slim")

# Modal sandbox (облако)
env = ModalREPL(timeout=300)

# Для продакшена — НИКОГДА не используйте exec() на хосте!
```

#### Паттерн: In-context examples для RLM

Из статьи: добавление **примера RLM-траектории** в системный промпт значительно улучшает качество даже если пример **не связан** с задачей:

```python
SYSTEM_PROMPT += """
Here's an example of how an RLM works:

[Example trajectory for a DIFFERENT task]:
```python
# Step 1: Probe context
print(f"Context length: {len(CONTEXT)}")
print(CONTEXT[:200])
```
stdout: Context length: 50000...

```python
# Step 2: Split and process
chunks = CONTEXT.split('\\n\\n')
results = []
for chunk in chunks:
    r = sub_rlm(f"Summarize: {chunk}")
    results.append(r)
```

```python
# Step 3: Aggregate
Final = "\\n".join(results)
```
"""
```

---

## 9. Ограничения и будущее

### Текущие ограничения:

1. **Взрывающиеся sub-call costs** — LLM может запустить слишком много рекурсивных вызовов
2. **Ошибки в сгенерированном коде** — syntax errors в REPL (особенно у Qwen3-Coder)
3. **Латентность** — последовательные sub-вызовы увеличивают время ответа
4. **Безопасность** — выполнение произвольного кода требует sandboxing
5. **Первая декомпозиция критична** — если LLM начинает с неправильной стратегии, это влияет на весь результат

### Будущие направления:

1. **Асинхронные sub-вызовы** — параллельная обработка чанков (значительное ускорение)
2. **Native RLM training** — модели, обученные "мыслить рекурсивно" с нуля (не через промптинг)
3. **RLM как форма reasoning** — аналогия с CoT, но через код и рекурсию
4. **Length generalization** — тренировка на коротких, перенос на длинные (уже показано)
5. **Sandboxed REPL** — безопасные среды для продакшена

> [!TIP]
> Авторы считают, что RLM **не заменяет** RAG для всех задач, а является **новой осью масштабирования** наравне с CoT-reasoning и ReAct-агентами. В будущем может быть три "слоя":
> - **Layer 1:** CoT reasoning (внутренняя цепочка мыслей)
> - **Layer 2:** ReAct agents (внешние инструменты)
> - **Layer 3:** RLM recursion (рекурсивная самовызов + REPL)

---

## 10. Ссылки и литература

### Основные работы:

| # | Работа | Ссылка |
|---|--------|--------|
| 1 | **RLM Paper** — Zhang, Kraska, Khattab (MIT, 2025) | [arXiv:2512.24601](https://arxiv.org/abs/2512.24601) |
| 2 | **RLM GitHub (основной)** | [github.com/alexzhang13/rlm](https://github.com/alexzhang13/rlm) |
| 3 | **RLM GitHub (минимальный)** | [github.com/alexzhang13/rlm-minimal](https://github.com/alexzhang13/rlm-minimal) |
| 4 | **RLM Blogpost** | [alexzhang13.github.io/blog/2025/rlm](https://alexzhang13.github.io/blog/2025/rlm/) |
| 5 | **Context Rot** — Hong, Troynikov, Huber (Chroma, 2025) | Chroma Research Report |
| 6 | **ReDel** — Zhu et al. (EMNLP 2024 Demo) | [github.com/zhudotexe/redel](https://github.com/zhudotexe/redel) |
| 7 | **ViperGPT** — Surís, Menon, Vondrick (Columbia, ICCV 2023) | [arXiv:2303.08128](https://arxiv.org/abs/2303.08128) |
| 8 | **CodeAct** — Wang et al. (2024) | [arXiv:2402.01030](https://arxiv.org/abs/2402.01030) |
| 9 | **DSPy** — Khattab et al. (Stanford/MIT) | [github.com/stanfordnlp/dspy](https://github.com/stanfordnlp/dspy) |
| 10 | **OOLONG benchmark** — Bertsch et al. (2025) | [arXiv:2511.02817](https://arxiv.org/abs/2511.02817) |

### Связанные подходы (упомянуты в статье):

| Подход | Авторы | Описание |
|--------|--------|----------|
| **THREAD** | Schroeder et al., 2025 | Рекурсивная делегация через иерархию агентов |
| **Context Folding** | Sun et al., 2025 | Рекурсивное "сворачивание" контекста через суммаризацию |
| **AgentFold** | Ye et al., 2025 | Расширение Context Folding с деревьями агентов |
| **DisCIPL** | Grand et al., 2025 | Генерация программ с sub-LM вызовами (одношаговая) |
| **ReSum** | Wu et al., 2025 | Периодическая компрессия контекста через суммаризацию |
| **Claude Code** | Anthropic, 2025 | Coding agent с sub-agents (модульные AI workflows) |
| **OpenCode** | Anomaly, 2026 | Open-source AI coding agent |

---

> [!CAUTION]
> **Важно помнить:** RLM — это НЕ замена RAG во всех сценариях. Это **альтернативная парадигма** для задач, где RAG фундаментально ограничен (плотная обработка, многошаговые рассуждения, длинный контекст). Для простых вопросно-ответных систем по статичной базе знаний RAG остаётся эффективнее по скорости и стоимости.
