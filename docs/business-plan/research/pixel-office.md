# Исследование: Pixel Office — видеть, что делают ИИ-агенты

Продуктовая линия: `pixel-office`. Шаг WF-07 / 1, handoff
`handoffs/BP-20260929-01/step-01-market-researcher-pixel-office.json`, REQ-005.
Роль: MARKET-RESEARCHER. Все ссылки ниже открыты при проверке; цифры приведены так, как
они написаны на открытой странице.

Метки:
- **«мир»** или **«Казахстан/СНГ»** — к какому рынку относится факт;
- **[вендор]** — утверждение компании о себе (маркетинг, цены на собственной странице);
- **[аналитик]** — платный отчёт исследовательской компании; методика в открытой части не раскрыта;
- **[СМИ]** — пересказ в прессе или блоге третьей стороны;
- **[независимо]** — опрос или документ, не продающий описываемый продукт;
- **[США]** — данные только по США.

В таблицах метка стоит в колонке «Тип источника» или рядом с утверждением.

## Что нашли (проверено 2026-09-29)

### 1. Платформы наблюдаемости и трассировки агентов: цены и покупатели («мир»)

Цены — с официальных страниц цен [вендор].

| Продукт | Бесплатно | Платно | Кому, по словам вендора | Источник |
|---|---|---|---|---|
| LangSmith (LangChain) | Developer: $0, 1 место, до 5 тыс. базовых трасс в месяц; базовые трассы хранятся 14 дней | Plus: $39 за место в месяц, 10 тыс. базовых трасс; дальше оплата по объёму. На любом плане базовую трассу можно за доплату перевести в расширенную, с хранением 400 дней. Enterprise — по договору, срок хранения на странице не указан; стартапам — до $10 000 кредитов | Plus — «для команд, которые строят и запускают агентов» | https://www.langchain.com/pricing |
| Langfuse | Hobby: $0, 50 тыс. единиц в месяц, 2 пользователя, 30 дней; self-hosted бесплатно (open source) | Core $29/мес (100 тыс. единиц, пользователи без ограничений, 90 дней); Pro $199/мес (3 года); дополнение Teams $300/мес; Enterprise $2 499/мес; сверх лимита $8 за 100 тыс. единиц, дальше по убывающей шкале до $6 | Явно не указано; в Enterprise — выделенный инженер поддержки | https://langfuse.com/pricing |
| Helicone | Hobby: 10 тыс. запросов, 1 место, 7 дней | Pro $79/мес; Team $799/мес; Enterprise — по договору; стартапам −50% на первый год, студентам бесплатно | Hobby — индивидуальные разработчики; Team — «растущие компании» | https://www.helicone.ai/pricing |
| AgentOps | Basic: $0, до 5 000 событий | Pro от $40/мес, оплата по объёму; Enterprise — по договору (SSO, on-prem) | Явно не указано; поддерживает OpenAI, CrewAI, Autogen | https://www.agentops.ai/ |
| Arize (Phoenix / AX) | Phoenix — open source, бесплатно; AX Free: 25 тыс. спанов, 15 дней, пользователи без ограничений | AX Pro $50/мес (50 тыс. спанов, 30 дней); AX Enterprise — по договору, есть self-hosted | AX Free — отдельные разработчики; AX Pro — «AI-native teams» | https://arize.com/pricing/ |
| W&B Weave | Free: 1 ГБ данных в месяц | Pro от $60/мес (1,5 ГБ, до 10 мест, компании до 50 сотрудников); сверх — $0,10 за МБ; Enterprise — по договору | Pro — профессионалы и небольшие компании | https://wandb.ai/site/pricing/ |
| Braintrust | Starter: $0, 1 ГБ данных, 10 тыс. оценок, 14 дней, пользователи без ограничений | Pro $249/мес; Enterprise — по договору; стартапам 6–12 месяцев бесплатно | Pro — «AI native teams» | https://www.braintrust.dev/pricing |
| Opik (Comet) | Open source — бесплатно; Free Cloud: 25 тыс. спанов, до 10 человек, 60 дней | Pro Cloud $19/мес (100 тыс. спанов, до 50 человек), сверх — $5 за 100 тыс.; Enterprise — по договору | Явно не указано; Free — до 10 человек, Pro — до 50 | https://www.comet.com/site/pricing/ |
| Datadog LLM Observability | До 40 тыс. LLM-спанов в месяц, 15 дней | Pro от $160/мес за 100 тыс. LLM-спанов; счёт только за вызовы модели, спаны инструментов и агентов бесплатны | Явно не указано | https://www.datadoghq.com/products/ai/agent-observability/ |

**Деньги и сделки в категории («мир»)**

- LangChain (продаёт LangSmith) привлёк $125 млн при оценке $1,25 млрд, 20.10.2025;
  годовая выручка по состоянию на середину 2025 — $12–16 млн (со ссылкой на TechCrunch) [СМИ]:
  https://siliconangle.com/2025/10/20/ai-agent-tooling-provider-langchain-raises-125m-1-25b-valuation/
- Braintrust привлёк $80 млн при оценке $800 млн, 17.02.2026; клиенты — Notion, Replit,
  Cloudflare, Ramp, Dropbox [СМИ]:
  https://siliconangle.com/2026/02/17/braintrust-lands-80m-series-b-funding-round-become-observability-layer-ai/
- ClickHouse купил Langfuse, 16.01.2026. О Langfuse: более 20 тыс. звёзд на GitHub, 23,1 млн
  установок SDK в месяц, используют 19 из Fortune 50 и 63 из Fortune 500; ядро остаётся open
  source под MIT [вендор]:
  https://clickhouse.com/blog/clickhouse-acquires-langfuse-open-source-llm-observability
- Mintlify купил Helicone, объявлено 03.03.2026; Helicone переходит в режим поддержки; по словам
  компании, обновления безопасности, новые модели, исправления ошибок и производительности
  продолжают выходить. О себе: 16 000 организаций, 14,2 трлн токенов [вендор]:
  https://www.helicone.ai/blog/joining-mintlify
- Humanloop объявил, что присоединяется к Anthropic, и закрывает платформу [вендор]:
  https://humanloop.com/
- Сводка сделок на 22.05.2026 (суммы — оценки сайта, не раскрытые цифры) [СМИ]: CoreWeave —
  Weights & Biases (март 2025), Arize — Velvet (март 2025), Anthropic — Humanloop (август 2025),
  OpenAI — Statsig (сентябрь 2025), ClickHouse — Langfuse (январь 2026), OpenAI — Promptfoo
  (март 2026), Mintlify — Helicone (март 2026), Cisco — Galileo (май 2026):
  https://ai-evals.tools/editorial/llm-evals-observability-company-acquisitions
- Разбор той же волны: «самостоятельная категория LLM-наблюдаемости консолидируется», крупные
  инфраструктурные компании видят в ней функцию, а не отдельный бизнес [СМИ]:
  https://agentping.io/blog/helicone-acquisition-what-it-means

**Кто на самом деле пользуется («мир», [независимо])**

- Stack Overflow Developer Survey 2025 (49 тыс. ответов): ИИ-агентами на работе пользуются 31%
  разработчиков, 37,9% не планируют. На вопрос об инструментах наблюдения, мониторинга и защиты
  агентов ответили 2 689 человек (5,5% всех): Grafana + Prometheus — 43%, Sentry — 31,8%,
  Snyk — 18,2%, New Relic — 13%, LangSmith — 12,5%, Honeycomb — 8,8%, Langfuse — 8,8%,
  Galileo — 6,2%: https://survey.stackoverflow.co/2025/ai

### 2. Командные панели для агентов-программистов (Claude Code, Cursor, Copilot, Codex) («мир»)

| Продукт | Что показывает | Цена | Покупатель | Источник |
|---|---|---|---|---|
| Dash0 AI Coding Insights | Расходы, внедрение, время от ветки до мержа, качество; 26 типов событий, включая субагентов и запросы разрешений. Запуск 07.07.2026, пробный период 14 дней | $10 за отслеживаемого разработчика в месяц (на сравнительной странице самого Dash0, 19.08.2026) [вендор] | «Руководители разработки» | https://www.dash0.com/blog/introducing-ai-coding-insights-stop-guessing-what-your-coding-agents-deliver ; https://www.dash0.com/comparisons/claude-code-monitoring-tools |
| Datadog Agent Console (preview, 09.06.2026) | Расходы, активные пользователи, сессии, медианное время до мержа по Copilot, Claude Code, Cursor, Codex | Не указана | Руководители платформы и разработки [вендор] | https://www.datadoghq.com/blog/datadog-agent-console/ |
| Amazon CloudWatch Coding Agent Insights (20.07.2026) | Внедрение, ROI, расходы по командам; Claude Code, Codex, GitHub Copilot | Стандартная цена приёма метрик CloudWatch | Руководители разработки [вендор] | https://aws.amazon.com/about-aws/whats-new/2026/07/cloudwatch-coding-agent-insights/ |
| Jellyfish | Панель Claude Code, связь использования с циклом поставки, сравнение с Copilot и Cursor | По запросу демо | Руководство разработки, финансы (статья самого Jellyfish, 17.04.2026) [вендор] | https://jellyfish.co/library/claude-code-monitoring/ |
| Torii | Расходы на места и токены по сотрудникам, «теневые» регистрации Claude Code | Не указана | Администраторы предприятий (статья самого Torii, 12.06.2026, обновлена 19.08.2026) [вендор] | https://www.toriihq.com/articles/five-claude-code-usage-dashboards-and-monitoring-tools |
| Omnara | Управление Claude Code и Codex с телефона: прогресс, диффы, подтверждения | $0 при своих моделях и машинах (Apache 2.0); оплата по факту за их машины ($0,0414 за ГиБ памяти в час); Enterprise — по договору | Разработчики и команды [вендор] | https://www.omnara.com/pricing |

### 3. Визуализаторы агентов-программистов: Pixel Agents, claude-office и другие («мир»)

Описания — со страниц самих проектов [вендор]; звёзды, форки и установки — счётчики GitHub,
VS Code Marketplace и App Store.

| Проект | Что делает и как получает события | Цена | Сигналы внимания | Источник |
|---|---|---|---|---|
| Pixel Agents (автор — Pablo De Lucca, репозиторий `pixel-agents-hq`) | Пиксельный офис: один персонаж на сессию Claude Code, анимация по действиям, «пузырь», когда агент ждёт разрешения. События — через хуки Claude Code (`SessionStart`, `PreToolUse`, `PermissionRequest`, `Stop`), запасной режим — чтение JSONL-журналов. Есть VS Code-расширение и CLI `npx pixel-agents`. В планах — Codex, Gemini, Cursor и оркестрация | Бесплатно, MIT; платной версии нет | 9,4 тыс. звёзд, 1,6 тыс. форков на GitHub; 86 755 установок в VS Code Marketplace, оценка 4/5 (5 отзывов) | https://github.com/pixel-agents-hq/pixel-agents ; https://marketplace.visualstudio.com/items?itemName=pablodelucca.pixel-agents |
| То же, обзор | «Платных планов и подписок нет» (обзор от 04.05.2026) [СМИ] | — | — | https://ai-deck.app/blog/pixel-agents/ |
| paulrobello/claude-office | Пиксельный офис: «босс» — главный агент, «сотрудники» — субагенты; хуки → FastAPI → WebSocket; многоэтажное здание, 12 режимов доски. Версия 0.24.1 (июль 2026) | Бесплатно, MIT | 531 звезда, 116 форков | https://github.com/paulrobello/claude-office |
| W17ant/Claude-Office | Изометрический пиксельный офис; хуки `PreToolUse`/`PostToolUse` → Express + WebSocket → React; режим в стиле сериала The Office | Бесплатно, MIT | 167 звёзд, 39 форков | https://github.com/W17ant/Claude-Office |
| KbWen/agent-virtual-office | Пиксельные «коллеги» для Claude Code, Codex, Gemini CLI; HTTP POST с реальными сигналами сессии | Бесплатно, MIT | 28 звёзд | https://github.com/KbWen/agent-virtual-office |
| PixelHQ (iOS, разработчик Chun-Wei Hsu) | Сессии Claude Code как пиксельный офис на телефоне; работает локально, связь с компьютером через Bonjour | Бесплатно | Оценок недостаточно для показа | https://apps.apple.com/ph/app/pixelhq/id6758467298 |

Панели без пиксельной графики (все бесплатные, open source):

- disler/claude-code-hooks-multi-agent-observability — хуки → Bun → SQLite → WebSocket → Vue,
  12 типов событий; 1,5 тыс. звёзд, 384 форка:
  https://github.com/disler/claude-code-hooks-multi-agent-observability
- hoangsonww/Claude-Code-Agent-Monitor — сессии, инструменты, субагенты, канбан-доска, есть
  приложения для macOS и Windows; 1,0 тыс. звёзд, 240 форков, MIT:
  https://github.com/hoangsonww/Claude-Code-Agent-Monitor
- simple10/agents-observe — живая лента событий Claude Code и Codex, иерархия агентов,
  повтор сессий, токены; 684 звезды, MIT: https://github.com/simple10/agents-observe
- phuryn/claude-usage — токены, стоимость, история сессий Claude Code; 2,2 тыс. звёзд, MIT:
  https://github.com/phuryn/claude-usage

Для масштаба: у официального расширения Claude Code для VS Code 26 583 727 установок:
https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code

Техническая основа — документация Claude Code; на хуки опираются Pixel Agents, оба
claude-office, agent-virtual-office и панель disler (см. строки выше):

- Хуки Claude Code: на странице документации перечислено более 30 событий, среди них
  `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `SubagentStart`,
  `SubagentStop`, `TaskCreated`, `TaskCompleted`, `Stop`, `SessionEnd`. Есть тип хука `http`:
  JSON события отправляется POST-запросом на указанный адрес [вендор]: https://code.claude.com/docs/en/hooks
- Экспорт OpenTelemetry из Claude Code: метрики, события и трассы (трассы — бета, нужно явно
  включить). Текст запросов пользователя и ответов модели по умолчанию заменяется на
  `<REDACTED>`, включается переменными `OTEL_LOG_USER_PROMPTS` и `OTEL_LOG_ASSISTANT_RESPONSES`
  [вендор]: https://code.claude.com/docs/en/monitoring-usage

### 4. Размер рынка и рост («мир»)

Все оценки ниже — платные отчёты [аналитик]; в открытой части методика не раскрыта. Отчёты
считают разные рынки (см. колонку «Что считают»).

| Что считают | Оценка | Кто | Источник |
|---|---|---|---|
| Инструменты мониторинга, аналитики и наблюдаемости агентного ИИ | $0,55 млрд (2025) → $2,05 млрд (2030), CAGR 30,1%. Доля LLM/агентной наблюдаемости — 40,1%; крупные компании — 74,8%; МСБ растут быстрее всех, 32,4% в год; Северная Америка — 39,4%; Азиатско-Тихоокеанский регион растёт быстрее всех, 34,1% в год; финансы — 34,6% | Mordor Intelligence | https://www.mordorintelligence.com/industry-reports/agentic-artificial-intelligence-monitoring-analytics-and-observability-tools-market |
| Наблюдаемость ИИ-агентов | $0,9 млрд (2026) → $14,0 млрд (2035), CAGR 35,6%; Северная Америка — 44,3%; крупные компании — 74,6% | Globe Market Research | https://www.globemarketresearch.com/reports/ai-agent-observability-market |
| ПО для LLMOps | $5,88 млрд (2025) → $7,14 млрд (2026) → $15,59 млрд (2030), CAGR 21,6% | The Business Research Company (пресс-релиз) | https://natlawreview.com/press-releases/llmops-software-market-reach-1559-billion-2030-growing-216-cagr |
| Прогноз | К 2028 году 40% организаций, внедряющих ИИ, будут использовать специализированные инструменты наблюдаемости ИИ | Gartner [аналитик] в пересказе APMdigest [СМИ], 15.05.2026; сайт gartner.com вернул 403 | https://www.apmdigest.com/gartner-40-organizations-deploying-ai-will-use-ai-observability-monitor-model-performance-2028 |

Отдельной оценки для сегмента «визуализация агентов для отдельного разработчика или
непрограммиста» — **не найдено** (искали в отчётах выше и в поиске по «agent visualization
market»).

### 5. Непрограммисты: понимать и контролировать ИИ, коучинг запросов, «профиль», который строит ИИ («мир»; опрос Pew — только США)

**Сигналы спроса на понимание и контроль [независимо]**

- [США] Pew Research, 17.09.2025, опрос взрослых жителей США: 61% американцев хотели бы больше контроля над тем, как ИИ
  используется в их жизни (+6 п. п. к 2024). Считают, что контроля у них много, — 13%; мало
  или нет — 57%:
  https://www.pewresearch.org/science/2025/09/17/ai-in-americans-lives-awareness-experiences-and-attitudes/
- KPMG и Мельбурнский университет, опрос ноябрь 2024 — январь 2025, 48 тыс. человек в 47
  странах: регулярно пользуются ИИ 66%, готовы доверять 46%, полагаются на ответ без проверки
  66%, ошибались в работе из-за ИИ 56%, проходили обучение ИИ 47%. В развивающихся экономиках
  доверие 60% против 40% в развитых, обучение 50% против 32%:
  https://kpmg.com/xx/en/media/press-releases/2025/04/trust-of-ai-remains-a-critical-challenge.html
- Stack Overflow 2025: точности ИИ не доверяют 46%, доверяют 33%; 87% обеспокоены точностью
  агентов: https://survey.stackoverflow.co/2025/ai

**Платформы сами показывают ход работы агента непрограммисту**

- Anthropic Cowork, 12.01.2026: агент для непрограммистов (файлы, отчёты, документы), строит
  план, выполняет шаги, проверяет себя, спрашивает при неясности; на старте — только Claude
  Max ($100–200/мес), macOS [СМИ]:
  https://venturebeat.com/technology/anthropic-launches-cowork-a-claude-desktop-agent-that-works-in-your-files-no

**Коучинг запросов: продукты и цены**

| Продукт | Цена | Примечание | Источник |
|---|---|---|---|
| Pretty Prompt | Free: 5 улучшенных запросов в неделю; Pro $8,25/мес ($99/год); Team $12,99 за место в месяц (от 2 мест, оплата за год); Enterprise — по договору | О себе: 50 000+ пользователей, 4,9 звезды по 139 отзывам [вендор] | https://www.pretty-prompt.com/pricing |
| Microsoft Prompt Coach | Входит в подписку Microsoft Copilot | Агент «built by Microsoft»: учит структуре запроса, разбирает и исправляет запросы [вендор] | https://support.microsoft.com/en-us/microsoft-365-copilot/agents-built-by-microsoft ; https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/agent-template-prompt-coach |
| То же | По посту участника сообщества (05.12.2025): доступен и в бесплатном Copilot Chat, недоступен в личных подписках Microsoft [СМИ, неофициально] | — | https://techcommunity.microsoft.com/discussions/microsoft365copilot/a-guide-to-prompt-coach/4475537 |
| Anthropic prompt improver | Цена на странице не указана | Запущен в Anthropic Console 14.11.2024 [СМИ] | https://www.maginative.com/article/anthropic-launches-tool-to-help-you-write-better-prompts-for-claude/ |
| OpenAI prompt optimizer | Цена не указана | OpenAI сворачивает инструмент: Evals — только чтение с 31.10.2026, закрытие платформы 30.11.2026 [вендор] | https://developers.openai.com/api/docs/guides/prompt-optimizer |
| PromptCoach (prompt-coach.pro) | **Не найдено**: содержимое страницы не извлеклось, видно только название | — | https://prompt-coach.pro/en |

**«Профиль», который ИИ строит о пользователе**

- Память Claude: Settings > Memory, всё сохранённое разбито по темам, каждую можно прочитать,
  исправить, удалить. По умолчанию включена на Free, Pro, Max; на Team и Enterprise выключена,
  пока её не включит владелец. Чувствительные темы (здоровье, религия, политика, гендерная
  идентичность) по умолчанию исключены [вендор]:
  https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context
- Tomedes «What AI knows about me» — бесплатно, собирает то, что несколько моделей находят о
  человеке в открытых данных; закрытые аккаунты не видит [вендор]:
  https://www.tomedes.com/tools/what-ai-knows-about-me
- Mozilla Foundation (2021): выведенные данные — «самые ценные для компаний», а человек не
  может ни контролировать, ни даже узнать, что о нём «думают» машины [независимо]:
  https://www.mozillafoundation.org/en/blog/mozilla-explains-what-does-ai-know-about-me/
- Память ChatGPT (просмотр и удаление) — **не проверено**: страницы help.openai.com вернули 403.

**Контекст «слежки»**

- Панель аналитики Claude Code, 16.07.2025: руководитель команды Claude Code Адам Вольф
  подчеркнул, что панель содержит метаданные («сколько используют»), а не то, что люди делают
  [СМИ]:
  https://venturebeat.com/ai/anthropic-adds-usage-tracking-to-claude-code-as-enterprise-ai-spending-surges
- В той же панели для Team и Enterprise сейчас есть рейтинг топ-10 пользователей по вкладу и
  выгрузка данных по всем пользователям в CSV; видят её администраторы и владельцы [вендор]:
  https://code.claude.com/docs/en/analytics
- Meta, программа Model Capability Initiative (объявлена в апреле 2026): запись нажатий клавиш
  и экрана сотрудников для обучения агентов; сотрудники собирали петицию; программу
  приостановили после утечки данных в июне 2026 [СМИ]:
  https://futurism.com/artificial-intelligence/meta-program-spies-employees-backfires

### 6. Казахстан/СНГ

**Доступ и регулирование («Казахстан/СНГ»)**

- Казахстан, Кыргызстан, Узбекистан, Таджикистан, Армения, Грузия и Азербайджан есть в
  официальном списке стран Anthropic (API и Claude.ai). России и Беларуси в списке нет
  [вендор]:
  https://www.anthropic.com/supported-countries
- Закон РК «Об искусственном интеллекте» № 230-VIII подписан 17.11.2025, действует с
  18.01.2026. Три уровня риска; принципы прозрачности и объяснимости; обязанность сообщать
  пользователю о взаимодействии с ИИ и маркировать синтетический контент; право граждан
  запрашивать сведения о решении, принятом ИИ; запрет манипулятивных методов, социального
  скоринга и распознавания эмоций без согласия; штрафы примерно от 65 тыс. до 865 тыс. ₸.
  Пересказ закона консультантом EY и новостным сайтом zakon.kz [СМИ]:
  https://www.ey.com/ru_kz/technical/tax-alerts/2025/12/law-on-artificial-intelligence-kazakhstan ;
  https://www.zakon.kz/sobytiia/6498039-tokaev-podpisal-zakon-ob-iskusstvennom-intellekte.html
- Персональные данные граждан РК: основная база должна физически находиться в Казахстане;
  штраф до 500 МРП. Источник — казахстанский дата-центр, то есть заинтересованная сторона
  [вендор]: https://akashi.cloud/ru/resources/guide/data-protection-law-kazakhstan/
- НДС с услуг нерезидентов в 2026 году — 16%; платит казахстанский покупатель,
  зарегистрированный по НДС, включая программное обеспечение и его обновления. Пересказ
  бухгалтерского портала [СМИ]:
  https://mybuh.kz/useful/nds-za-nerezidenta-kak-nachislyat-i-kogda-oplachivat.html

**Спрос и внедрение ИИ («Казахстан/СНГ»)**

- Опрос KPMG «на основе опроса более 70 компаний и 2 500 технологических руководителей по всему
  миру» (формулировка статьи; публикация 27.05.2026) [независимо; пересказ СМИ]: 53% компаний
  Центральной Азии и Кавказа вывели ИИ в промышленную эксплуатацию. В Казахстане 86% компаний опираются на
  рекомендации ИИ в бизнес-решениях. У 57% руководство ограничивает сотрудникам использование
  ИИ-инструментов. Около 50% компаний не отслеживают системно эффективность ИТ-инициатив:
  https://kapital.kz/tehnology/148539/v-kazahstane-86percent-kompanij-doveryayut-ii-pri-prinyatii-biznes-reshenij-opros.html
- Государство, 11.02.2026: рабочая встреча о внедрении ИИ-агентов в госорганах и нацкомпаниях,
  обучение под руководством Кай-Фу Ли. Механизмы контроля и мониторинга агентов в статье не
  упомянуты [СМИ]: https://digitalbusiness.kz/2026-02-11/v-kazahstane-obsudili-vnedrenie-ii-agentov-v-gosupravlenie/
- Национальная модель AlemLLM (13.02.2026): более 480 тыс. запросов, из них 420 тыс. от
  частного бизнеса и 60 тыс. от госсектора; 42 ИИ-продукта в разработке; «Самрук-Казына»
  запустил три ИИ-агента; модель работает на государственном суперкомпьютере в закрытой сети.
  Данные министерства в пересказе СМИ [СМИ]:
  https://kz.kursiv.media/2026-02-13/fvfv-v-minii-rasskazali-gde-uzhe-seychas-rabotaet-kazahstanskiy-ii/
- Kazakhstan Growth Forum K26, 16.09.2026, Алматы [СМИ]: на сессии «Agents Versus Humans»
  топ-менеджеры и владельцы бизнеса, разбившись на команды, два часа обсуждали, заменят ли
  агенты людей и в каких профессиях будут наибольшие изменения. Представители Kaspi,
  «Казахтелекома», Bank RBK и RG Brands упоминаются в статье в панельных дискуссиях и
  наградах форума, не в этой сессии:
  https://profit.kz/news/74875/Agenti-vmesto-ludej-K26-ustroil-bitvu
  - «мир»: на том же форуме аналитик Gartner Аруп Рой привёл мировую статистику: «80% CEO
    понимают, что ИИ кардинально трансформирует их отрасли, но лишь 29% считают свои компании
    готовыми к конкуренции». Это слова Gartner в пересказе СМИ [СМИ], не данные по
    Казахстану; источник тот же.
- Цены местных интеграторов на внедрение ИИ-агента: MVP от 500 тыс. до 1,5 млн ₸, стандартное
  решение от 1,5 до 5 млн ₸, корпоративное — от 5 до 20 млн ₸ и выше; «агент требует
  мониторинга»; цены поддержки не указаны. Автор — интегратор [вендор]:
  https://osn.kz/blog/ai-agenty-dlya-biznesa-v-kazakhstane-2026
- Курсы по нейросетям в Казахстане (13.03.2026): Skillbox — 23 703–25 303 ₸ в месяц,
  GeekBrains — 28 588 ₸ в месяц. Цены школ в подборке СМИ [СМИ]:
  https://digitalbusiness.kz/2026-03-13/v-kazahstane-rastet-spros-na-obuchenie-ii-vot-kakie-kursi-uzhe-dostupni/

**Размер ИТ-рынка («Казахстан/СНГ»)**

- На июнь 2025 официально числятся 19 500 программистов, разработчиков и ИИ-специалистов, без
  штатных ИТ-сотрудников отраслевых компаний. Средняя зарплата в программировании и
  консалтинге — 1,2 млн ₸ (≈ $2 200) во II квартале 2025. Источник: Ranking.kz и Бюро
  национальной статистики, в пересказе [СМИ]:
  https://timesca.com/kazakhstans-it-market-post-pandemic-growth-skills-gap-and-17-resumes-per-vacancy/
- Astana Hub: более 2 500 компаний; выручка участников в I квартале 2026 — $907 млн; экспорт
  ИТ-услуг РК за квартал — $241,2 млн (11.09.2026). Правительственные данные в пересказе СМИ
  [СМИ]: https://www.trend.az/casia/kazakhstan/4223104.html

**Местные и русскоязычные игроки в наблюдаемости агентов («Казахстан/СНГ»)**

- Казахстанских продуктов для наблюдения за ИИ-агентами или их визуализации — **не найдено**
  (поиск по Astana Hub, казахстанским СМИ, русско- и англоязычным запросам).
- Yandex Monium (Россия): принимает трассы агентов, встроен в отладку Yandex AI Studio; цена в
  статье не указана [вендор]: https://infra.yandex.ru/blog/llm-observability
- Cloud.ru Evolution AI Agents (Россия): мониторинг агентов на Arize Phoenix и OpenTelemetry;
  цены и доступность в Казахстане на странице не указаны [вендор]:
  https://cloud.ru/products/evolution-ai-agents
- Российский посредник provod.AI: для B2B с требованиями 152-ФЗ советует self-hosted Langfuse
  на Yandex Cloud, около 1 500–2 500 ₽ в месяц [вендор]:
  https://vc.ru/provod/2959142-logirovanie-i-nablyudaemost-llm-prilozheniy
- Статья на Хабре (22.01.2026): автор использует Langfuse для наблюдения за LLM-агентами;
  проблем с доступом из СНГ не упоминает. Блог третьей стороны [СМИ]:
  https://habr.com/ru/articles/987230/

**Как команды в Казахстане покупают инструменты разработки** — отдельного исследования или
опроса **не найдено**. Нашлись только налоговые (НДС 16% с услуг нерезидентов) и
регуляторные (локализация персональных данных) условия, перечисленные выше. Опросов
казахстанских разработчиков об ИИ-инструментах тоже **не найдено**. В опросе JetBrains 2026
отдельно разобраны Китай и Индия, Казахстана нет. Опрос проводил сам JetBrains, который
продаёт ИИ-инструменты [вендор]:
https://blog.jetbrains.com/research/2026/08/ai-coding-agent-adoption-2026/

### 7. Риск платформы: встроенные панели и трассы у Anthropic, OpenAI, GitHub и других («мир»)

| Дата | Кто | Что выпустил | Тип источника | Источник |
|---|---|---|---|---|
| 11.03.2025 | OpenAI | Agents SDK со встроенной трассировкой и панелью трасс | [СМИ] | https://www.latent.space/p/openai-agents-platform |
| — | OpenAI | Трассировка в Agents SDK включена по умолчанию и бесплатна в OpenAI Traces; недоступна при Zero Data Retention; поддерживает экспорт в 30+ внешних систем (Langfuse, LangSmith, AgentOps и др.) | [вендор], документация | https://openai.github.io/openai-agents-python/tracing/ |
| 16.07.2025 | Anthropic | Панель аналитики Claude Code для руководителей: принятые строки, расходы, активность по пользователям | [СМИ] | https://venturebeat.com/ai/anthropic-adds-usage-tracking-to-claude-code-as-enterprise-ai-spending-surges |
| 28.10.2025 | GitHub | Agent HQ и mission control: единая панель, чтобы раздавать задачи агентам (Copilot, а также Anthropic, OpenAI, Google, Cognition, xAI) и следить за ними в GitHub, VS Code, на телефоне и в CLI; метрики Copilot — в публичном превью; в платной подписке Copilot | [вендор] | https://github.blog/news-insights/company-news/welcome-home-agents/ |
| 29.10.2025 | Cursor | Cursor 2.0: боковая панель агентов и планов, до 8 агентов параллельно | [вендор] | https://cursor.com/changelog/2-0 |
| 12.01.2026 | Anthropic | Cowork — агент для непрограммистов с видимым планом и шагами | [СМИ] | https://venturebeat.com/technology/anthropic-launches-cowork-a-claude-desktop-agent-that-works-in-your-files-no |
| 08.04.2026 | Anthropic | Claude Managed Agents (публичная бета) с трассировкой сессий в Claude Console; $0,08 за час сессии сверх токенов | [СМИ]; документация — [вендор] | https://www.helpnetsecurity.com/2026/04/09/claude-managed-agents-bring-execution-and-control-to-ai-agent-workflows/ ; https://platform.claude.com/docs/en/managed-agents/observability |
| 11.05.2026 | Anthropic | Agent view в Claude Code (research preview): список всех сессий; в каждой строке — что сессия делает, ждёт ли ответа, её последний ответ, время последнего действия; отвечать можно прямо из списка; планы Pro, Max, Team, Enterprise, API | [вендор] | https://claude.com/blog/agent-view-in-claude-code |
| 09.06.2026 | Datadog | Agent Console (preview) для агентов-программистов | [вендор] | https://www.datadoghq.com/blog/datadog-agent-console/ |
| 20.07.2026 | AWS | CloudWatch Coding Agent Insights | [вендор] | https://aws.amazon.com/about-aws/whats-new/2026/07/cloudwatch-coding-agent-insights/ |
| сентябрь 2026 | OpenAI | Codex CLI 0.156.0: «центр управления агентами» с фильтром задач по статусу и панель `/usage` | [вендор] | https://learn.chatgpt.com/docs/changelog |
| дата не указана | Anthropic | Экспорт трасс OpenTelemetry из Claude Code (бета) | [вендор], документация | https://code.claude.com/docs/en/monitoring-usage |

Сделки лабораторий моделей из сводки в разделе 1: Anthropic — Humanloop (август 2025),
OpenAI — Statsig и Promptfoo [СМИ]:
https://ai-evals.tools/editorial/llm-evals-observability-company-acquisitions

## Где искали

Поисковые запросы (WebSearch), 2026-09-29:
- «LangSmith pricing plans», «Langfuse pricing», «AgentOps pricing», «Opik Comet pricing»,
  «Datadog LLM Observability pricing», «Braintrust raises», «LangChain Series B valuation»,
  «Langfuse acquired ClickHouse», «Helicone joins Mintlify», «Humanloop joins Anthropic»,
  «Helicone alternatives after acquisition consolidation»;
- «Pixel Agents Claude Code VS Code pixel art office», «claude-office github», «pixel-agents-hq»,
  «pixel art AI agents office Codex Cursor virtual office», «claude code hooks multi-agent
  observability», «Claude Code usage dashboard monitoring», «Omnara pricing», «Dash0 AI Coding
  Insights», «Datadog Agent Console», «CloudWatch Coding Agent Insights», «Product Hunt AI agent
  visualizer»;
- «AI agent observability market size 2030», «LLMOps market size», «Gartner AI observability 2028»;
- «Pew control over AI», «KPMG Melbourne trust in AI 2025», «Stack Overflow 2025 AI agents»,
  «JetBrains AI Pulse 2026», «Pragmatic Engineer AI tooling 2026», «prompt coaching tool pricing»,
  «Microsoft Prompt Coach», «Anthropic prompt improver», «OpenAI prompt optimizer», «ChatGPT
  memory manage», «Claude memory view edit», «what AI knows about me», «Claude Cowork launch»,
  «employee monitoring AI backlash Meta»;
- «Казахстан ИИ-агенты внедрение 2026 опрос», «Astana Hub AI observability», «Yandex AI
  Studio трассировка», «Cloud.ru Evolution AI Agents», «НДС электронные услуги нерезидент
  Казахстан 2026», «Хабр Карьера ИИ-ассистенты Казахстан», «Kazakhstan developers survey AI
  tools», «Claude supported countries Kazakhstan», «Казахстан закон об ИИ», «локализация
  персональных данных Казахстан 2026», «KazLLM AlemLLM», «курсы промптов Казахстан стоимость»,
  «Kazakhstan software developers number», «российский аналог Langfuse»;
- «OpenAI Agents SDK tracing March 2025», «GitHub Agent HQ mission control», «Claude Code
  analytics dashboard launch», «Claude Managed Agents Console tracing», «Claude Code agent view»,
  «Codex app agent progress», «Cursor 2.0 agents», «Claude Code OpenTelemetry», «Claude Code hooks».

Открыты и использованы (WebFetch): официальные страницы цен langchain.com, langfuse.com,
helicone.ai, agentops.ai, arize.com, wandb.ai, braintrust.dev, comet.com, datadoghq.com,
omnara.com, pretty-prompt.com; репозитории GitHub (pixel-agents-hq, paulrobello, W17ant, KbWen,
disler, hoangsonww, simple10, phuryn); VS Code Marketplace; App Store; документация
code.claude.com, platform.claude.com, support.claude.com, openai.github.io,
developers.openai.com, learn.chatgpt.com, learn.microsoft.com, support.microsoft.com; блоги
вендоров (clickhouse.com, helicone.ai, humanloop.com, github.blog, claude.com, dash0.com,
datadoghq.com, aws.amazon.com, jellyfish.co, toriihq.com, cursor.com); опросы и отчёты
(survey.stackoverflow.co, pewresearch.org, kpmg.com, blog.jetbrains.com,
newsletter.pragmaticengineer.com, mordorintelligence.com, globemarketresearch.com,
natlawreview.com, apmdigest.com); СМИ (siliconangle.com, venturebeat.com, infoworld.com,
helpnetsecurity.com, latent.space, futurism.com, maginative.com, ai-deck.app, ai-evals.tools,
agentping.io); Казахстан и СНГ (anthropic.com/supported-countries, kapital.kz,
digitalbusiness.kz, kz.kursiv.media, profit.kz, zakon.kz, ey.com/ru_kz, mybuh.kz, akashi.cloud,
osn.kz, timesca.com, trend.az, infra.yandex.ru, cloud.ru, vc.ru, habr.com); прочее
(mozillafoundation.org, tomedes.com, techcommunity.microsoft.com). В файле процитировано 84
открытые страницы; у prompt-coach.pro из них извлёкся только заголовок.

Открыты, но в файл не вошли: dsebastien.net (дата agent view — 18.05.2026 по вторичной статье;
заменена датой публикации в самом посте claude.com, 11.05.2026); infoworld.com (о Managed Agents; вместо неё цитируется
helpnetsecurity.com, где есть цена); newsletter.pragmaticengineer.com (опрос 906 инженеров, Claude
Code — самый используемый инструмент; к визуализации агентов прямого отношения нет);
astanahub.com (статьи о тендерах и итогах экосистемы — текст статей не извлёкся);
gratanet.com (НДС на электронные услуги — статья 2019 года, устарела);
developers.openai.com/blog (точных дат запуска нет).

Не удалось открыть: fastcompany.com и inc.com (статья о Pixel Agents, 403); openai.com/index/new-tools-for-building-agents
(403); gartner.com (два пресс-релиза, 403; прогноз об инвестициях в LLM-наблюдаемость к 2028 не
проверен и в файл не вошёл); demandgenreport.com (403); help.openai.com (память ChatGPT, 403);
mckinsey.com (State of AI trust 2026, тайм-аут); hrgrapevine.com и knowablemagazine.org (403);
boingboing.net (403); agentops.ai/pricing (404); tadviser.ru (404); shipmint.kz (домен не
найден); akorda.kz (ошибка сертификата); pasqualepillitteri.it (обрыв соединения); PDF статьи
CHI 2024 о выводах ИИ о пользователях (не удалось извлечь текст).

<!-- conclusion:start -->
## Выводы исследователя

Ниже — моя интерпретация фактов выше, а не проверенные факты.

**Что уже бесплатно.** Прототип владельца — живая панель на хуках Claude Code плюс
пиксельный офис — по функциям совпадает с тем, что уже раздаётся даром:

- Pixel Agents: 9,4 тыс. звёзд, ~87 тыс. установок, MIT, те же хуки;
- claude-office и ещё несколько пиксельных офисов;
- не меньше четырёх открытых панелей для Claude Code, от 684 до 2,2 тыс. звёзд.

Платного пиксельного визуализатора я не нашёл ни одного. К тому же Anthropic сама встроила
в Claude Code agent view: список сессий со статусом, ожиданием ответа и последним ответом —
это почти ровно «живая панель». Трассы OpenAI бесплатны. Langfuse, Phoenix и Opik можно
бесплатно развернуть у себя. Правдивый журнал из реальных хуков (планка R2) у конкурентов
тоже есть, поэтому сам по себе он не отличие. Pixel Agents набрал около 0,3% от числа установок
Claude Code в VS Code: игровая подача собирает внимание, но свидетельств, что за неё платят,
нет.

**Кто платит и сколько.** Я вижу три группы покупателей.

1. **Команды, которые строят агентные продукты.** Платят LangSmith, Langfuse, Braintrust и
   другим: вход от $19 до $249 в месяц на команду (или $39 за место), корпоративный уровень —
   от ~$2 500 в месяц. Рынок плотный и быстро консолидируется: Langfuse, Helicone, Galileo,
   Humanloop и W&B за полтора года ушли к крупным покупателям. Helicone с 16 тыс. организаций
   оказался в режиме поддержки, то есть даже заметному самостоятельному игроку там тяжело.
   Pixel Office в этот сегмент не целит.
2. **Руководители разработки.** Платят за внедрение агентов-программистов и контроль расходов:
   $10 за разработчика в месяц у Dash0, по объёму у Datadog и AWS, по запросу у Jellyfish.
   По технике это ближайший к прототипу платящий сегмент. Но продукт там — рейтинги
   сотрудников, расходы на человека, отчёты для начальства, то есть ровно «инструмент для
   начальника», который владелец исключил. Опыт Meta показывает, что подача «слежки» вызывает
   сопротивление сотрудников, поэтому отказ от этого сегмента можно превратить в позицию. Но
   тогда деньги этого сегмента недоступны.
3. **Отдельные люди, в том числе непрограммисты.** Коучинг запросов стоит около $8–13 в месяц
   (Pretty Prompt). При этом Microsoft даёт Prompt Coach внутри подписки Copilot, а у
   Anthropic и OpenAI есть свои улучшатели запросов (цена на страницах не указана; OpenAI
   свой закрывает 30.11.2026). Просмотр
   «профиля» у Claude уже встроен и бесплатен: память по темам, с правкой и удалением. Спрос
   на контроль есть: 61% американцев хотят больше контроля, в развивающихся экономиках
   доверяют ИИ и учатся ему чаще. Но прямых доказательств, что за визуализацию или разбор
   профиля платят, я не нашёл. Реалистичный ориентир по аналогам — от бесплатного до
   ~$10 в месяц на человека.

**Размер рынка.** Оценки аналитиков для наблюдаемости агентов — $0,55–0,9 млрд в 2025–2026
годах, рост 30–36% в год. Около 75% приходится на крупные компании. Сегмент «визуализация для
человека» нигде не измерен, поэтому к нему эти цифры применять нельзя.

**Казахстан.** Условия и сигналы:

- Claude официально доступен, так что инструмент на хуках Claude Code работает легально.
- Рынок разработчиков мал: 19,5 тыс. зарегистрированных специалистов. Для B2B к цене
  зарубежной подписки добавляется НДС 16%, который платит покупатель.
- Требование держать персональные данные в РК и закон об ИИ (прозрачность, объяснимость,
  право гражданина знать о решении ИИ) говорят в пользу инструмента, который работает
  локально и объясняет, что сделал агент.
- Главные заказчики ИИ-агентов сейчас — госорганы, нацкомпании и крупный бизнес: AlemLLM,
  «Самрук-Казына», интеграторы с проектами от 0,5 до 20 млн ₸. Это корпоративные закупки
  через интеграторов, а не покупка подписки разработчиком.
- Местных конкурентов в наблюдаемости агентов не найдено. Не найдено и прямого спроса.
- Сигнал KPMG: около половины компаний не отслеживают эффективность ИТ-инициатив, а у 57%
  руководство ограничивает сотрудникам использование ИИ. Это спрос на «покажите, что агенты
  делают» со стороны руководства, то есть снова со стороны начальника.

**Риск платформы — высокий.** За 2025–2026 годы свои панели агентов выпустили все владельцы
платформ:

- Anthropic: аналитика, agent view, трассы Managed Agents, OpenTelemetry;
- OpenAI: Traces, командный центр Codex;
- GitHub: mission control;
- Cursor: боковая панель агентов;
- Datadog и AWS: панели для руководителей.

Каждая новая версия Claude Code может поглотить функцию живой панели. Сама Anthropic
подчёркивает, что её аналитика — метаданные, а не содержание, но при этом показывает рейтинг
сотрудников. Ниша «не для начальника» остаётся свободной, однако платить в ней, судя по
найденному, пока некому, кроме самого пользователя, и по низкой цене.
<!-- conclusion:end -->
