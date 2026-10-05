# Исследование: конвейер ИИ-агентов для команд

Продуктовая линия `agent-pipeline`: командная разработка с ИИ-агентами по строгому
процессу — ростер ролей, у каждой производящей роли есть проверяющая, записанная
планка качества, проверки контрактов в коде, handoff-записи. Возможные формы: открытый
набор (kit), платное внедрение для команд, обучение/воркшопы, инструмент, который
соблюдение процесса обеспечивает.

Handoff: `handoffs/BP-20260929-01/step-01-market-researcher-agent-pipeline.json`, REQ-005.

Пометки у фактов:
- **[мир]** / **[Казахстан]** / **[Россия]** — к какому рынку относится факт.
- **[вендор]** — данные производителя или продавца инструмента/услуги (маркетинг
  возможен); **[независимый]** — исследовательская организация, академическая работа
  или опрос платформы, которая не продаёт ИИ-инструменты для кода; **[аналитик]** —
  платный отчёт аналитической фирмы (открыт только пресс-релиз или страница-анонс);
  **[вторичный]** — пересказ в СМИ или энциклопедии, первоисточник не открыт.
- Цена «на странице» — то, что было на странице в день проверки.

## Что нашли (проверено 2026-09-29)

### 1. Инструменты для работы с агентами и их цены [мир]

Все строки — официальные страницы цен или документации производителя [вендор].

| Инструмент | Что это | Бесплатно | Платно (на странице) | Источник |
|---|---|---|---|---|
| Claude Code (Anthropic) | Агент для кода в терминале/IDE; подагенты, хуки, навыки | Нет (в Free не входит) | Pro $17/мес при оплате за год ($200 сразу) или $20 помесячно; Max «From $100 per month» (5x или 20x к Pro); Team: стандартное место $20/мес за год или $25 помесячно, премиум-место $100 / $125, от 2 до 150 мест; Enterprise $20 за место в месяц за год + использование по ценам API | [claude.com/pricing](https://claude.com/pricing) |
| Claude Code — фактические расходы | Средние траты в корпоративных внедрениях | — | «around $13 per developer per active day and $150-250 per developer per month», у 90% пользователей ниже $30 в активный день | [code.claude.com/docs/en/costs](https://code.claude.com/docs/en/costs) |
| Подагенты Claude Code | Роли агентов как Markdown-файлы с YAML-заголовком в `.claude/agents/` | Входят в Claude Code без доплаты, тратят токены обычного лимита | — | [code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents) |
| Code Review (Anthropic) | Проверка PR «флотом» специализированных агентов с шагом верификации находок; research preview | Локально — команда `/code-review` | Только Team и Enterprise; оплата по токенам, «Each review averages $15-25», отдельно от лимита плана | [code.claude.com/docs/en/code-review](https://code.claude.com/docs/en/code-review) |
| Cursor | IDE с агентами, облачные агенты, Bugbot для ревью | Hobby: ограниченные запросы к агенту | Individual от $20/мес (уровни Pro, Pro+, Ultra — цены старших уровней в тексте страницы не отображаются); Teams от $40 за пользователя в месяц (Standard/Premium); ревью Bugbot в Teams; Enterprise — по запросу | [cursor.com/pricing](https://cursor.com/pricing) |
| GitHub Copilot | Автодополнение, агент для кода, ревью | Free: ограниченный чат и агент | Pro $10/мес, Pro+ $39/мес, Max $100/мес; Business $19 за место в месяц (1 900 AI Credits), Enterprise $39 (3 900 AI Credits) | [github.com/features/copilot/plans](https://github.com/features/copilot/plans), [docs.github.com — планы](https://docs.github.com/en/copilot/get-started/plans) |
| OpenAI Codex | Агент для кода в составе планов ChatGPT | Free: «quick coding tasks» | Go $8/мес, Plus $20/мес, Pro от $100/мес; Business $20 за пользователя в месяц (за год); Enterprise — по запросу | [learn.chatgpt.com/docs/pricing](https://learn.chatgpt.com/docs/pricing) |
| Devin (Cognition) | Автономный агент-разработчик | Free: «Light quota» | Pro $20/мес, Max $200/мес; Team $80/мес за команду + $40/мес за место разработчика, до 200 пользователей; Enterprise — «Let's talk» | [devin.ai/pricing](https://devin.ai/pricing) |
| Factory (Droids) | Агенты для разработки | — | Pro $20/мес, Plus $100/мес (~5x), Max $200/мес (~10x); Teams $60/мес за команду + $40/мес за место, до 10 мест; Business (до 150 мест) и Enterprise — по запросу | [factory.com/pricing](https://factory.com/pricing) |
| Kiro (AWS) | IDE с агентами | Free: 50 кредитов | Pro $20 (1 000 кредитов), Pro+ $40 (2 000), Pro Max $100 (5 000), Power $200 (10 000) за пользователя в месяц; сверх лимита $0.04 за кредит; Enterprise — по запросу | [kiro.dev/pricing](https://kiro.dev/pricing/) |
| OpenHands | Открытая платформа агентов для кода | Open Source (MIT) локально; облако Individual бесплатно, до 10 разговоров в день, модели «at cost» | Enterprise (SaaS или в своём VPC) — по запросу | [openhands.dev/pricing](https://www.openhands.dev/pricing) |
| CrewAI | Фреймворк мультиагентных систем | Фреймворк MIT (59.2k звёзд); облако Basic: 50 запусков в месяц | Enterprise — по запросу, «45-day onboarding» | [crewai.com/pricing](https://www.crewai.com/pricing), [github.com/crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) |
| LangSmith (LangChain) | Трассировка/развёртывание агентов (LangGraph) | Developer: 1 место, до 5k трасс/мес | Plus $39 за место в месяц, до 10k трасс/мес; развёртывания по потреблению ($1.50/LCU); Enterprise — по запросу | [langchain.com/pricing](https://www.langchain.com/pricing) |
| CodeRabbit | ИИ-ревью PR | Бесплатно для публичных репозиториев; пробный период 14 дней | Essentials $24 (за год) / $30 (помесячно) за разработчика; Team $48 / $60; Advanced $72 (за год); Enterprise — по запросу | [coderabbit.ai/pricing](https://www.coderabbit.ai/pricing) |
| Greptile | ИИ-ревью PR | Starter: 1 разработчик, 50 кредитов/мес | Pro $30 за место в месяц, 50 кредитов на место, $1 за доп. кредит (обычное ревью = 1 кредит); Enterprise — по запросу | [greptile.com/pricing](https://www.greptile.com/pricing) |
| Qodo | ИИ-ревью PR и правила | Пробный период 14 дней; open source — по заявке | Pro Team $30/мес базово (до 30 пользователей) + пакеты кредитов ($0.012/кредит; 2 500 кредитов ≈ 18 ревью); Enterprise — по запросу | [qodo.ai/pricing](https://www.qodo.ai/pricing/) |

### 2. Бесплатные открытые наборы «роли + проверки + процесс» [мир]

Открытые наборы, которые задают роли агентов, спецификации и проверки:

| Набор | Что задаёт | Лицензия и популярность | Источник |
|---|---|---|---|
| BMAD-METHOD | Agile-процесс с ИИ-агентами: перспективы продукта, архитектуры, UX, разработки, тестирования; «free and open source, with no paywalled workflows or gated community»; упомянуто корпоративное спонсорство | MIT, 53.6k звёзд, 6.0k форков | [github.com/bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) |
| GitHub Spec Kit | Spec-Driven Development: Constitution → Specify → Plan → Tasks → Implement → Converge | MIT, 139.3k звёзд | [github.com/github/spec-kit](https://github.com/github/spec-kit) |
| Superpowers | Методология для агентов: план, TDD («write failing test, watch it fail…»), ревью между задачами, разработка подагентами с двухэтапным ревью | MIT, 292.6k звёзд, 26.2k форков | [github.com/obra/superpowers](https://github.com/obra/superpowers) |
| wshobson/agents | Маркетплейс плагинов для Claude Code, Codex, Cursor, Copilot и др.: 94 плагина, 202 агента, 184 навыка | MIT, 40.1k звёзд | [github.com/wshobson/agents](https://github.com/wshobson/agents) |

Официальная документация Anthropic бесплатно описывает те же приёмы [вендор]
([code.claude.com/docs/en/best-practices](https://code.claude.com/docs/en/best-practices)):
- «Claude stops when the work looks done. Without a check it can run, "looks done" is
  the only signal available»;
- проверка «вторым мнением»: «a verification subagent … so the agent doing the work
  isn't the one grading it»; детерминированный гейт через Stop hook;
- шаблон Writer/Reviewer: отдельная сессия-ревьюер со свежим контекстом;
- «Unlike CLAUDE.md instructions which are advisory, hooks are deterministic»;
- типовой сбой «trust-then-verify gap»: правдоподобная реализация без граничных случаев.

### 3. Размер рынка и выручка игроков [мир]

| Факт | Тип | Источник |
|---|---|---|
| Рынок ИИ-инструментов для кода: $7.37 млрд в 2025, $9.35 млрд в 2026, $29.96 млрд к 2031, CAGR 26.23% (2026–2031); Северная Америка — 41.89% выручки 2025; самый быстрый регион — Азиатско-Тихоокеанский (CAGR 26.68%) | [аналитик] Mordor Intelligence | [mordorintelligence.com](https://www.mordorintelligence.com/industry-reports/artificial-intelligence-code-tools-market) |
| Тот же рынок: $4.3 млрд в 2023 → $12.6 млрд в 2028, CAGR 24.0% | [аналитик] MarketsandMarkets | [marketsandmarkets.com](https://www.marketsandmarkets.com/Market-Reports/ai-code-tools-market-239940941.html) |
| Прогноз Gartner (апрель 2024): к 2028 году 75% корпоративных инженеров-программистов будут пользоваться ИИ-ассистентами для кода, против менее 10% в начале 2023 | [аналитик], [вторичный] — пресс-релиз Gartner не открылся (403) | [theregister.com](https://www.theregister.com/software/2024/04/13/gartner-75-of-enterprise-software-devs-will-use-ai-in-2028/723526) |
| Cursor (Anysphere): ARR $100 млн (январь 2025) → $500 млн (июнь 2025) → более $1 млрд (ноябрь 2025) → $3 млрд (май 2026); сделка о покупке SpaceX закрыта 14 августа 2026 | [вторичный] | [en.wikipedia.org/wiki/Anysphere](https://en.wikipedia.org/wiki/Anysphere) |
| Anthropic: run-rate выручки $30 млрд (апрель 2026); Claude Code — $1 млрд за полгода после запуска, более $2.5 млрд run-rate в феврале 2026; бизнес-подписки на Claude Code выросли в 4 раза с начала 2026 | [вендор] через СМИ | [venturebeat.com](https://venturebeat.com/technology/anthropic-says-it-hit-a-30-billion-revenue-run-rate-after-crazy-80x-growth) |
| Опрос JetBrains AI Pulse (январь 2026, более 10 000 профессиональных разработчиков): 90% регулярно используют хотя бы один ИИ-инструмент на работе; на работе: GitHub Copilot 29%, Cursor 18%, Claude Code 18%, OpenAI Codex 3%; Claude Code в США и Канаде — 24% | [вендор] (JetBrains продаёт свои ИИ-инструменты) | [blog.jetbrains.com](https://blog.jetbrains.com/research/2026/04/which-ai-coding-tools-do-developers-actually-use-at-work/) |
| Claude Partner Network запущена 12 марта 2026 с обязательством $100 млн на 2026 год; партнёры — Accenture, Deloitte, Cognizant, Infosys; стартовый набор Code Modernization; сертификация «Claude Certified Architect, Foundations» | [вендор] | [anthropic.com/news/claude-partner-network](https://anthropic.com/news/claude-partner-network) |

### 4. Главная боль: ненадёжный вывод агентов, нагрузка на проверку [мир]

**Независимые источники**

- **Stack Overflow Developer Survey 2025** (более 49 000 ответов, 177 стран, опубликован
  29 июля 2025) [независимый]
  ([survey.stackoverflow.co/2025/ai](https://survey.stackoverflow.co/2025/ai),
  [пресс-релиз](https://stackoverflow.co/company/press/archive/stack-overflow-2025-developer-survey/),
  [раздел про агентов](https://stackoverflow.co/teams/resources/2025-stack-overflow-developer-survey-for-leaders/ai-agents/)):
  - 84% используют или планируют использовать ИИ-инструменты; 51% профессионалов — ежедневно;
  - 45.7% не доверяют точности ИИ; «Highly trust» — 3.1%;
  - главная претензия — «AI solutions that are almost right, but not quite» (66%);
    «Debugging AI-generated code is more time-consuming» — 45.2%;
  - агентами пользуются 30.9% всех респондентов: ежедневно 14.1%, еженедельно 9%,
    ежемесячно или реже («monthly or infrequently») 7.8%; среди профессиональных
    разработчиков — 31.8%; не планируют — 37.9%;
  - 87% обеспокоены точностью ИИ-агентов, 81% — безопасностью и приватностью данных.
- **METR, рандомизированное исследование** (июль 2025) [независимый]
  ([metr.org, 2025](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)):
  16 опытных разработчиков, 246 задач в своих репозиториях; с ИИ задачи заняли на 19%
  дольше; до опыта ожидали ускорения на 24%, после — считали, что ускорились на 20%.
- **METR, обновление** (24 февраля 2026) [независимый]
  ([metr.org, 2026](https://metr.org/blog/2026-02-24-uplift-update/)): 57 разработчиков,
  143 репозитория, более 800 задач; оценка для прежних участников −18% времени
  (ДИ −38%…+9%), для новых −4% (ДИ −15%…+9%); 30–50% разработчиков не отправляли часть
  задач, потому что не хотели делать их без ИИ; METR называет данные «only very weak
  evidence» и меняет дизайн исследования.
- **«Why Do Multi-Agent LLM Systems Fail?»** (UC Berkeley, arXiv, март 2025, ред.
  октябрь 2025) [независимый]
  ([arxiv.org/abs/2503.13657](https://arxiv.org/abs/2503.13657)): более 1 600 размеченных
  трасс из 7 мультиагентных фреймворков; 14 видов сбоев в трёх группах — проблемы
  устройства системы, рассогласование между агентами, проверка результата (task
  verification).

**Исследовательская программа, связанная с вендором**

- **DORA 2025** (Google Cloud; около 5 000 специалистов) [вендор-исследование]
  ([cloud.google.com](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report)):
  90% используют ИИ на работе; более 80% считают, что производительность выросла; 30%
  мало или совсем не доверяют коду от ИИ; внедрение ИИ положительно связано с пропускной
  способностью поставки и отрицательно — со стабильностью поставки.

**Данные вендоров (продают проверку/аналитику кода)**

- **Faros AI** (23 июля 2025; более 10 000 разработчиков, 1 255 команд) [вендор]
  ([faros.ai](https://www.faros.ai/blog/ai-software-engineering)): в командах с высоким
  использованием ИИ +21% задач, +98% слитых PR, **+91% времени ревью PR**, +154% размер
  PR, +9% багов на разработчика; на уровне компании связь с ключевыми метриками
  «evaporates».
- **Sonar, State of Code** (8 января 2026; более 1 100 разработчиков) [вендор]
  ([sonarsource.com](https://www.sonarsource.com/company/press-releases/sonar-data-reveals-critical-verification-gap-in-ai-coding/)):
  ИИ — 42% закоммиченного кода, ожидают 65% к 2027; 96% не вполне доверяют
  функциональной правильности кода от ИИ; только 48% всегда проверяют его перед
  коммитом; 38% говорят, что ревью кода от ИИ требует больше усилий, чем кода коллег.
- **CodeRabbit** (17 декабря 2025; 470 открытых PR: 320 с участием ИИ, 150 только
  людей) [вендор]
  ([coderabbit.ai](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report)):
  10.83 против 6.45 замечаний на PR (~1.7x); логика и корректность — на 75% чаще;
  безопасность — до 2.74x; критичных и крупных находок ~1.4–1.7x больше.
- **Veracode** (30 июля 2025; более 100 моделей, Java/Python/C#/JavaScript) [вендор]
  ([veracode.com](https://www.veracode.com/blog/genai-code-security-report/)): 45% образцов
  не прошли проверки безопасности (OWASP Top 10); Java — 72%; XSS не защищён в 86%
  случаев; безопасность не улучшалась с ростом размера модели.
- **GitClear** (февраль 2025; 211 млн изменённых строк за 2020–2024) [вендор],
  [вторичный] — сам отчёт не открылся (403)
  ([leaddev.com](https://leaddev.com/technical-direction/how-ai-generated-code-accelerates-technical-debt)):
  восьмикратный рост частоты дублирующихся блоков кода в 2024; скопированных строк
  стало больше, чем перенесённых (рефакторинг).

### 5. Услуги внедрения и обучения: цены [мир], [Россия], [Казахстан]

**Мир [мир]**

| Предложение | Цена | Формат | Тип | Источник |
|---|---|---|---|---|
| Kriv AI — Discovery Workshop | $5 000 | 4 часа, 5–20 человек, онлайн | [вендор] | [kriv.ai](https://www.kriv.ai/solutions/claude-code-training/pricing) |
| Kriv AI — Team Enablement | $15 000–40 000 | 1–3 дня, 8–30 человек, на коде клиента, плейбук команды, 90 дней поддержки | [вендор] | там же |
| Kriv AI — Enterprise Transformation | $75 000–250 000 | 2–6 месяцев, внедрение, governance, чемпионы, ежемесячный коучинг | [вендор] | там же |
| Kriv AI на AWS Marketplace — воркшоп Claude Code для команд здравоохранения | от $15 000 за 2–3 инженеров (3 дня); 5 дней для 4–10 инженеров — частное предложение | очно/приватно | [вендор] | [aws.amazon.com/marketplace](https://aws.amazon.com/marketplace/pp/prodview-dwujnuepx5gqy) |
| Claude Workshop (Амстердам, Harness Institute) | около $1 000 за человека (командная программа); около $100 за человека за учебный час; пример: 10 человек × 3 часа ≈ $3 000 без НДС | 2 дня, 10–20 инженеров, в репозитории клиента | [вендор] | [claudeworkshop.com/training](https://www.claudeworkshop.com/training) |
| Крупные консультанты (Accenture, Deloitte, Cognizant, Infosys) | цены не публикуются | партнёры Anthropic | [вендор] | [anthropic.com/news/claude-partner-network](https://anthropic.com/news/claude-partner-network) |

**Россия [Россия]**

| Предложение | Цена | Формат | Тип | Источник |
|---|---|---|---|---|
| Product University, «Claude Code. ИИ-программирование и агенты» | 78 000 ₽ (рассрочка 3 250 ₽/мес на 24 мес.) | когорта, 8 недель, 8 занятий по 2 часа; для продактов, предпринимателей, разработчиков | [вендор] | [productuniversity.ru](https://productuniversity.ru/schedule/claude-code-avgust-2026) |
| Корпоративное ИИ-обучение (ориентиры редакции, 19 мая 2026) | вебинар 80–250 тыс. ₽; практический воркшоп 2–4 часа 180–600 тыс. ₽; ролевой трек 2–6 недель 600 тыс.–2.5 млн ₽; ИИ-академия 2–8 млн ₽ и выше | не только разработчики; «точная цена зависит от кастомизации» | [вендор] (редакционная оценка, не опрос) | [ai-rate.ru](https://ai-rate.ru/research/stoimost-korporativnogo-ai-obucheniya) |
| Затраты бизнеса на внедрение ИИ-агентов (Axenix и Центр ИИ МГУ, 2 апреля 2026) | малый бизнес 5–15 млн ₽; средний 30–60 млн ₽; крупный 200–300 млн ₽; корпорации — более 950 млн ₽ | агенты для бизнес-процессов вообще, не для разработки | [вендор] через СМИ: Axenix продаёт внедрение генеративного ИИ и свою платформу для создания ИИ-агентов Numira 2.0 ([axenix.pro](https://axenix.pro/generative-ai)); соавтор — Центр ИИ МГУ | [habr.com/ru/news/1018454](https://habr.com/ru/news/1018454/) |

**Казахстан [Казахстан]**

| Предложение | Цена | Формат | Тип | Источник |
|---|---|---|---|---|
| МОЛ АЙ ТИ, курс «Вайбкодинг» (Cursor, Claude Code) | 98 000 ₸ за курс, рассрочка Kaspi 0% | 1 месяц, группы до 10 человек, очно в Астане и Алматы | [вендор] | [molit.kz](https://molit.kz/blog/claude-code-i-cursor/) |
| OSN.KZ (Астана), ИИ-агенты для бизнеса (9 мая 2026) | 500 000 ₸ / 1 200 000 ₸ / 3 000 000 ₸ | чат-агенты для продаж и поддержки, срок от 2 недель; не для команд разработки | [вендор] | [osn.kz](https://osn.kz/blog/ai-agenty-dlya-biznesa-kz-2026) |
| AST IT Garant — перепродажа Claude и услуги | Claude Pro от 15 000 ₸/мес; Team от 18 000 ₸/мес; настройка API от 45 000 ₸; интеграция от 120 000 ₸; ИИ-ассистент от 250 000 ₸; поддержка от 60 000 ₸/мес | оплата в тенге для ТОО/АО, ЭСФ, с НДС или без, участие в госзакупках (на странице названы модели Claude 3.5 Sonnet и Claude 3 Opus) | [вендор] | [ast-it.kz](https://ast-it.kz/kz/shop/claude-anthropic-i-api-dostup-kz/) |
| AI Camp (Алматы) | цена в тексте страницы не отображается | 3 дня, для собственников и руководителей, результат — план внедрения ИИ | [вендор] | [aicamp.kz](https://aicamp.kz/) |
| Tech Orda (Astana Hub, Минцифры ИИ) | госваучер до 500 000 ₸ (очно) и до 400 000 ₸ (онлайн) на человека | для жителей 18–45 лет, смена профессии, в т. ч. направление ИИ; с 2021 года обучено более 12 500 человек | [независимый] (госпрограмма) через СМИ, 17 августа 2026 | [kapital.kz](https://kapital.kz/tehnology/151722/kazahstancy-mogut-poluchit-vauchery-do-500-tysyach-tenge-na-obuchenie-v-it.html) |

Не найдено: публичные цены казахстанских компаний на внедрение процесса разработки с
ИИ-агентами для команд (роли, проверки, CI) и на корпоративное обучение разработчиков
именно агентной разработке — ни на hh.kz, ни в поиске по сайтам с доменом `.kz`.

### 6. Спрос: вакансии [Казахстан], [Россия]

Поиск hh.kz по всему Казахстану, полнотекстовый (в выдачу попадают и нерелевантные
вакансии — маркетинг, HR), 2026-09-29:

| Запрос | Найдено вакансий | Ссылка |
|---|---|---|
| `Claude Code` | 37 | [hh.kz](https://hh.kz/search/vacancy?text=Claude+Code&area=40) |
| `AI engineer` | 99 | [hh.kz](https://hh.kz/search/vacancy?text=AI+engineer&area=40) |
| `LLM` | 67 | [hh.kz](https://hh.kz/search/vacancy?text=LLM&area=40) |
| `внедрение ИИ` | 62 | [hh.kz](https://hh.kz/search/vacancy?text=%D0%B2%D0%BD%D0%B5%D0%B4%D1%80%D0%B5%D0%BD%D0%B8%D0%B5+%D0%98%D0%98&area=40) |
| `AI-агент` | 36 | [hh.kz](https://hh.kz/search/vacancy?text=AI-%D0%B0%D0%B3%D0%B5%D0%BD%D1%82&area=40) |
| `Cursor` | 26 | [hh.kz](https://hh.kz/search/vacancy?text=Cursor&area=40) |
| для сравнения: `Claude Code` по России (hh.ru) | 341 | [hh.ru](https://hh.ru/search/vacancy?text=Claude+Code&area=113) |

Примеры вакансий [Казахстан]:
- **ТОО IT Холдинг Kazdream, Frontend Product Engineer**, Астана, опубликована 28 сентября
  2026 ([hh.kz/vacancy/137855873](https://hh.kz/vacancy/137855873)): «Реальный опыт
  ежедневной разработки через Claude Code, Codex, Cursor или аналогичные инструменты»;
  «Опыт работы с MCP, tool calling, AI agents»; «Умение проводить review, исправлять
  архитектурные ошибки и не принимать AI-решения вслепую».
- **ИП ARC TEACH, Fullstack-разработчик AI first**, Алматы, 26 сентября 2026
  ([hh.kz/vacancy/137812456](https://hh.kz/vacancy/137812456)): «ИИ-инструменты
  (в частности Claude) — основной рабочий инструмент в разработке».
- **ТОО PanDev, Java-разработчик**, Алматы, 22 сентября 2026, до $2 000/мес до налогов
  ([hh.kz/vacancy/137649740](https://hh.kz/vacancy/137649740)): «Предоставление подписки
  Claude Code MAX x20».
- Работодатели в выдаче по запросам выше (названия вакансий из выдачи): Kaspi.kz; АО Банк
  ЦентрКредит («AI/ML Engineer», «Senior AI engineer»); АО Народный банк Казахстана
  («Middle AI Engineer»); АО ForteBank («AI Engineer (Senior)»); АО Bereke Bank
  («Full-stack Engineer в AI-продукт»); АО Home Credit Bank («QA AI specialist»);
  Andersen («AI Engineer (Agentic Systems)»); Itransition («AI Agent Developer»);
  ТОО BTS Digital («AI-Officer»); ТОО Freedom Telecom Operations («AI Engineer»).

Пример [Россия]: ООО Кей Групп, «Главный ИИ программист GetRentacar (Lead Claude Code
Developer)», 100 000–300 000 ₽/мес до налогов, в архиве с 14 мая 2026
([hh.ru/vacancy/132109616](https://hh.ru/vacancy/132109616)).

Не подтверждено: блог казахстанской доски вакансий Taylor (14 мая 2026) пишет, что 78%
казахстанских компаний используют ИИ в разработке, в 85% вакансий middle+ в Алматы и
Астане требуется опыт с ИИ-инструментами, а разработчики с ИИ-навыками получают на
25–40% больше; у Chocofamily, Kaspi.kz и Freedom Finance якобы есть отдельные грейды
для разработки с ИИ. Источник цифр и методика не указаны
([taylor.kz](https://taylor.kz/blog/ai-instrumenty-dlia-razrabotcikov-v-2026-cursor-claude-code-copilot-i-cto-vybrat-v-kazaxstane)).

### 7. Контекст Казахстана [Казахстан]

- **Доступность Claude:** в списке поддерживаемых стран Anthropic (API и Claude.ai) есть
  Казахстан, Узбекистан, Кыргызстан; России и Беларуси в списке нет
  ([anthropic.com/supported-countries](https://www.anthropic.com/supported-countries)).
- **Курс НБ РК на 29.09.2026:** 1 USD = 441.77 ₸; 1 RUB = 5.23 ₸
  ([nationalbank.kz](https://nationalbank.kz/ru/exchangerates/ezhednevnye-oficialnye-rynochnye-kursy-valyut)).
  Пересчёт фактов выше по этому курсу: $150–250 на разработчика в месяц (Claude Code) ≈
  66 000–110 000 ₸; воркшоп $5 000 ≈ 2.21 млн ₸; $15 000–40 000 ≈ 6.6–17.7 млн ₸;
  $1 000 за человека ≈ 442 000 ₸; 78 000 ₽ ≈ 408 000 ₸; воркшоп 180–600 тыс. ₽ ≈
  0.94–3.14 млн ₸.
- **Экспорт ИТ-услуг:** $1.142 млрд в 2025 году (данные Нацбанка, по сообщению
  Министерства ИИ и цифрового развития), из них резиденты Astana Hub — $633 млн
  ([kaztag.kz](https://kaztag.kz/en/news/kazakhstan-s-it-services-exports-exceeded-1-1-bn-in-2025),
  13 апреля 2026). В I квартале 2026: выручка компаний Astana Hub $907 млн, экспорт
  ИТ-услуг $241.2 млн, более 2 500 компаний-участников
  ([trend.az](https://www.trend.az/casia/kazakhstan/4223104.html), 11 сентября 2026).
- **Зарплаты разработчиков:** опрос Kolesa Group (643 респондента, опубликован 7 февраля
  2025): средняя 1 220 000 ₸, медианная 960 000 ₸; данных об использовании ИИ в опросе
  нет ([kolesa.group](https://kolesa.group/media/posts/issledovaniya/issledovanie-rynka-razrabotchikov-v-kazahstane-trendy-motivaciya-i-zarplatnye-ozhidaniya)).

## Где искали

Дата всех проверок — 2026-09-29. Открыто и использовано 71 страница (ссылки — в разделах
выше).

Поисковые запросы (WebSearch):
- `Claude Code pricing plans Pro Max Team Enterprise 2026`; `Cursor pricing Pro Ultra Teams per user 2026`;
  `Devin pricing Core Team Enterprise ACU 2026`; `GitHub Copilot plans pricing Business Enterprise coding agent premium requests 2026`;
  `Factory.ai droids pricing plans per month tokens`; `CodeRabbit pricing Pro per developer month`;
  `OpenHands cloud pricing open source MIT agents`; `CrewAI pricing plans enterprise AMP executions per month`;
  `Kiro AWS pricing spec-driven development Pro Pro+ credits`; `Greptile pricing per seat code review 2026`;
  `Qodo pricing Teams per user month code review`;
  `Anthropic Claude Code Review multi-agent pull request review pricing per review 2026`.
- `BMAD-METHOD agile AI driven development agents analyst architect QA GitHub stars`;
  `Anthropic Claude Code best practices enterprise "writer" "reviewer" …`.
- `Stack Overflow Developer Survey 2025 AI trust accuracy "almost right" results`; `Stack Overflow Developer Survey 2026 AI agents results`
  (опрос 2026 года открыт 23 июня 2026, результатов не нашли); `METR study experienced open-source developers AI tools 19% slower`;
  `METR 2026 update …`; `CodeRabbit report AI-generated pull requests 1.7x more issues than human`;
  `DORA 2025 State of AI-assisted Software Development report …`; `Veracode 2025 GenAI code security report 45% security flaws`;
  `Sonar State of Code developer survey 2026 verification …`; `Faros AI "productivity paradox" report 2025 …`;
  `GitClear 2025 AI copilot code quality research …`; `JetBrains State of Developer Ecosystem 2025 AI agents usage percent developers`.
- `Gartner AI code assistants 90% enterprise software engineers 2028 press release`;
  `AI code tools market size 2025 2030 CAGR report …`; `Cursor annualized revenue 2026 billion Anysphere valuation`;
  `Claude Code run-rate revenue billion 2026 Anthropic`; `anthropic.com news Series G Claude Code run-rate revenue …`.
- `AI coding agent adoption consulting for engineering teams workshop price Claude Code training enterprise`;
  `Claude Code workshop for teams pricing per day consultant …`; `Upwork AI agent developer hourly rate 2026`;
  `Anthropic Claude partner network consulting partners Claude Code implementation services`.
- `курс Claude Code Cursor для разработчиков стоимость обучения 2026`;
  `корпоративное обучение ИИ-агенты для разработчиков внедрение AI coding цена`;
  `внедрение AI-агентов в разработку консалтинг агентство стоимость услуг`;
  `kwork настройка Claude Code агенты для разработки цена услуги`;
  `hh.ru вакансии "AI-агент" разработчик Claude Code …`.
- `Казахстан обучение ИИ для разработчиков курс AI агенты тенге Astana Hub`;
  `Казахстан компании внедряют ИИ-агентов в разработку Kaspi Claude Code Cursor разработчики 2026`;
  `зарплата разработчиков Казахстан 2026 медиана senior middle тенге исследование`;
  `Kazakhstan IT market size 2026 IT services exports Astana Hub residents revenue`;
  `Tech Orda 2026 ваучер до 500 тысяч тенге обучение ИТ Astana Hub`;
  `корпоративный тренинг ИИ для сотрудников Казахстан стоимость тенге 2026 Алматы`.

Сайты, открытые напрямую: страницы цен и документации производителей (claude.com,
code.claude.com, cursor.com, github.com, docs.github.com, learn.chatgpt.com, devin.ai,
factory.com, kiro.dev, openhands.dev, crewai.com, langchain.com, coderabbit.ai,
greptile.com, qodo.ai), репозитории GitHub, survey.stackoverflow.co, stackoverflow.co,
metr.org, arxiv.org, cloud.google.com, dora.dev (страница-анонс без цифр), faros.ai,
sonarsource.com, veracode.com, leaddev.com, mordorintelligence.com, marketsandmarkets.com,
theregister.com, en.wikipedia.org, venturebeat.com, anthropic.com, kriv.ai,
aws.amazon.com/marketplace, claudeworkshop.com, productuniversity.ru, ai-rate.ru, habr.com,
hh.kz (поиск и карточки вакансий), hh.ru, axenix.pro, molit.kz, osn.kz, ast-it.kz, aicamp.kz,
taylor.kz, kolesa.group, kaztag.kz, trend.az, kapital.kz, nationalbank.kz.

Не удалось открыть (факты из них не использованы):
- grandviewresearch.com (пресс-релиз о рынке ИИ-инструментов для кода) — 403;
- gartner.com (пресс-релиз 2024-04-11) — 403, использован пересказ The Register;
- api.hh.ru (API вакансий) — 403, использован поиск на сайте hh.kz;
- upwork.com/hire/ai-agent-developers — 403: ставки фрилансеров Upwork не проверены;
- gitclear.com (отчёт 2025) — 403, PDF не распарсился, использован пересказ LeadDev;
- kwork.ru (карточка услуги «настройка Claude Code» за 2 500 ₽ из выдачи поиска) — 404:
  фрилансерские цены на настройку в СНГ не проверены.

<!-- conclusion:start -->
## Выводы исследователя

Это выводы исследователя по фактам выше, а не факты. Цифры цен ниже — ориентиры,
выведенные из найденных цен; пометка «допущение» означает, что прямого источника нет.

**Что уже коммодитизировано (бесплатно или дёшево):**
- Сама идея «роли + отдельный проверяющий агент + спецификация + тесты как гейт»
  раздаётся бесплатно. BMAD-METHOD, GitHub Spec Kit, Superpowers, wshobson/agents —
  прямые аналоги открытой формы линии: все под MIT, от 40k до 293k звёзд; Anthropic
  сама описывает Writer/Reviewer, проверяющий подагент и Stop hook как
  детерминированный гейт в официальной документации. Открытый набор (kit) сам по себе денег не приносит — он конкурирует с очень популярными
  бесплатными аналогами. Он годится как витрина и способ привлечь клиентов на платные
  формы.
- ИИ-ревью PR — массовый SaaS: $24–72 за разработчика в месяц (CodeRabbit), $30 за место
  (Greptile), $15–25 за ревью (Anthropic Code Review), встроенный Bugbot в Cursor Teams.
  Инструмент, который «проверяет вывод агента», пришлось бы продавать в конкуренции с
  производителями платформ, которые выпускают такие функции каждый месяц. Для небольшой
  команды это самая рискованная форма.
- Кто покупает инструменты: у большинства инструментов из таблицы раздела 1 есть
  бесплатный или индивидуальный план за $0–20 в месяц, кроме Qodo (только пробный
  период, командный Pro Team и Enterprise) и Code Review от Anthropic (только Team и
  Enterprise). Командные и корпоративные планы есть у всех; корпоративные условия
  у большинства — по запросу. То есть инструменты покупают и сами разработчики, и
  компании за места.

**Что не коммодитизировано и за что платят:**
- Внедрение процесса на кодовой базе и в CI конкретной команды: адаптация ролей,
  записанная планка качества, проверки контрактов, дисциплина handoff-записей, обучение
  тимлидов. Найденные мировые предложения (Kriv AI, Claude Workshop) берут за это
  $5 000 (полудневный воркшоп) — $15 000–40 000 (1–3 дня на коде клиента) —
  $75 000–250 000 (трансформация на 2–6 месяцев) или около $1 000 за человека. В России — 180–600 тыс. ₽ за практический воркшоп и 0.6–2.5 млн ₽ за
  ролевой трек.
- Боль, на которую это отвечает, подтверждена независимыми данными: 66% разработчиков
  жалуются на «почти правильные» ответы ИИ, 87% обеспокоены точностью агентов (Stack
  Overflow). Данные вендоров показывают, где эта боль «сидит»: время ревью PR +91%
  (Faros), 38% тратят на ревью ИИ-кода больше усилий (Sonar), при этом в DORA внедрение
  ИИ связано с падением стабильности поставки. Процесс с обязательной независимой
  проверкой бьёт ровно в эту точку. Но то, что процесс владельца «произвёл реальные
  системы», пока подтверждено только словами владельца: для продаж нужен кейс с
  измеренными цифрами (доля PR, прошедших гейты, найденные дефекты, время цикла).

**Кто платил бы в Казахстане:**
- Компании, у которых разработка с агентами уже стала требованием в вакансиях, и там
  прямо написано «не принимать AI-решения вслепую»: Kazdream, банки (ЦентрКредит,
  Народный, ForteBank, Bereke, Home Credit), Kaspi.kz, BTS Digital, аутсорсеры и
  экспортёры (Andersen, Itransition, PanDev — последний уже оплачивает сотрудникам Max
  x20). Покупатель — CTO или руководитель разработки. Экспорт ИТ-услуг ($1.142 млрд в
  2025) даёт аутсорсерам мотив поднять производительность без потери качества.
- Рынок в абсолютных числах маленький: Claude Code упоминается в 37 вакансиях на hh.kz
  против 341 на hh.ru. Значит, в Казахстане реалистичны десятки клиентов, а не сотни.
  Для роста придётся продавать удалённо в СНГ (Узбекистан и Кыргызстан, где Claude
  официально доступен; в России Claude недоступен официально, но спрос на Claude Code в
  вакансиях там большой) и, возможно, на мировом рынке.

**Форма и цена (допущение, проверять в разговорах с покупателями):**
- Основная форма — платное внедрение с пилотом на одной команде (2–4 недели: роли и
  планка под стек клиента, гейты в CI, handoff-журнал, воркшоп на их репозитории) плюс
  абонентское сопровождение. Открытый набор — вход в воронку. Обучение — часть
  внедрения, а не отдельный массовый курс: массовые курсы в Казахстане стоят около
  98 000 ₸, частных людей учат по госваучерам Tech Orda до 500 000 ₸, и этот сегмент
  уже занят.
- Ориентир цены пилота для команды в Казахстане — 1–3 млн ₸ (допущение). Мировой
  полудневный воркшоп ($5 000 ≈ 2.2 млн ₸) попадает внутрь этой вилки: нижняя часть
  вилки дешевле его, верхняя — дороже. Вилка почти совпадает с российским диапазоном
  практического воркшопа (≈ 0.94–3.14 млн ₸). Для
  сравнения, сами инструменты стоят 66 000–110 000 ₸ на разработчика в месяц (по
  среднему расходу Claude Code), а медианная зарплата разработчика — 960 000 ₸.
- Цены казахстанских конкурентов именно на внедрение агентной разработки для команд не
  найдены. Это либо свободная ниша, либо отсутствие спроса — различить можно только
  через прямые разговоры с 5–10 компаниями из списка выше.
<!-- conclusion:end -->
