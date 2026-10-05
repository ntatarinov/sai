# Исследование: отдельные продукты для разбора сессии агента и запросов к нему

Продуктовая линия: `session-review-tools`. Шаг WF-07 / 1, прогон BP-20260930-01, handoff
`handoffs/BP-20260930-01/step-01-market-researcher-session-review-tools.json`, REQ-006.
Роль: MARKET-RESEARCHER. Доработка после FAIL шага 1b — handoff
`handoffs/BP-20260930-01/step-01-market-researcher-session-review-tools-r2.json` (замечания —
`handoffs/BP-20260930-01/step-01b-plan-validator-session-review-tools.json`).

Вопрос: какие отдельные продукты — не сами агентные платформы — разбирают сессию агента или
запросы к нему по шести элементам: постановка задачи → действия агента → вмешательства
пользователя → ошибки → потерянное время → советы на следующий запуск (элементы — из второго
отзыва рецензента, `docs/business-plan/reviews/2026-09-30-external-review.md`, раздел 3)? Кто
и сколько за это платит, и чем подтверждена оплата?

Ссылки первого прохода открыты 2026-09-30, ссылки доработки — 2026-10-01; 2026-10-01 ответ каждой
ссылки файла проверен повторно, а цитаты сверены с текстом страниц (что именно проверено и что не
открылось — в «Где искали», абзац «Открыты и использованы»). Цифры приведены так, как они написаны
на открытой странице; счётчики (звёзды, установки, оценки) — на момент проверки.

Встроенные функции самих агентных платформ (Claude Code, Copilot, Cursor, Codex, Claude) в таблицу
не входят — это предмет параллельного исследования `session-review-platforms.md`. Отдельные
инструменты владельцев платформ для работы с запросами (Microsoft Prompt Coach, улучшатели запросов
Anthropic и OpenAI) в таблицу входят.

Метки:
- рынок: **[мир]** — продукт для всех стран; **[Россия]**, **[Узбекистан]**, **[СНГ]**,
  **[Казахстан]** — к какому рынку относится факт;
- **[вендор]** — утверждение компании или автора о своём продукте (сайт, документация, README,
  страница цен);
- **[СМИ]** — пресса или блог третьей стороны;
- **[сообщество]** — пост участника сообщества, неофициально;
- **[счётчик]** — число от площадки, которая не продаёт продукт: звёзды GitHub, установки VS
  Code Marketplace и Chrome Web Store, оценки App Store;
- **[оценка третьей стороны]** — расчёт сайта-агрегатора, методика не раскрыта;
- **[площадка-продавец]** — магазин, который сам продавал продукт (AppSumo).

## Что нашли (проверено 2026-10-01)

### Покрытие разбора всей сессии

Как читать ячейки шести элементов:

- **Постановка задачи.** «да» — продукт оценивает или улучшает сам текст запроса: находит
  неясности, переписывает, ставит оценку, задаёт уточняющие вопросы. «частично» — показывает
  или записывает запрос без оценки.
- **Действия агента.** «да» — продукт сам разбирает шаги агента: находит неудачные действия,
  объясняет, где и почему пошло не так, оценивает выбор инструмента. «частично» — показывает
  или записывает шаги (трасса, лента событий, анимация) без разбора.
- **Вмешательства пользователя.** «да» — продукт сам находит и разбирает вмешательства:
  исправления, перенаправления, отказы в разрешении, недовольство пользователя. «частично» —
  показывает сообщения пользователя по ходу сессии, ожидание ответа или запросы разрешений без
  разбора.
- **Ошибки.** «да» — продукт сам находит ошибки, которые не помечены как сбой, или группирует
  сбои и называет их тип или причину. «частично» — показывает сбои, пришедшие вместе с
  событием (упавший вызов, код ошибки), или их число.
- **Потерянное время.** «да» — продукт сам находит потери: петли и повторы, лишние перечитывания,
  зависания, долгие ожидания — и показывает, где они. «частично» — показывает длительности,
  задержки, число попыток или живой сигнал «застрял» без выделения потерь.
- **Советы на следующий запуск.** «да» — продукт по итогам разбора сессий или трасс предлагает
  конкретное изменение: правку промпта, правило в CLAUDE.md или AGENTS.md, хук, навык.
  «частично» — переписывает текущий запрос (в том числе по оценкам тестовых ответов), даёт общие
  советы по составлению запросов, уроки без конкретного изменения или ручной список «что
  искать» в документации.
- **«нет»** — по описанию на открытой странице продукт этот элемент не получает: работает
  только с текстом запроса (у улучшателей Anthropic и OpenAI — ещё с оценками тестовых ответов)
  и хода сессии агента не видит; или страница прямо помечает нужную функцию как ещё недоступную
  («Скоро»).
- **«не найдено»** — на открытых страницах сведений нет ни в ту, ни в другую сторону; где
  искали — в разделе «Где искали».
- «да» ставится, если разбор есть хотя бы для одного вида агентных сессий. Для каких агентов
  он описан — свои агенты компании или агенты-программисты (Claude Code, Codex, Cursor), —
  сказано в фактах по строке ниже.
- Какие продукты входят в таблицу, а какие нет, решает одно правило включения — оно записано в
  разделе «Где искали» вместе с границей поиска и причинами исключения каждого проверенного
  продукта.

| Продукт | Постановка задачи | Действия агента | Вмешательства пользователя | Ошибки | Потерянное время | Советы на следующий запуск | Цена | Кто платит | Рынок | Источники |
|---|---|---|---|---|---|---|---|---|---|---|
| Pretty Prompt (расширение браузера и MCP-сервер, улучшает запрос) | да | нет | нет | нет | нет | частично | Free $0 (5 улучшенных запросов в неделю); Pro $8,25/мес при оплате за год ($99/год); Team $12,99 за место в месяц (от 2 мест, за год); Enterprise — по договору [вендор] | Отдельные пользователи (Pro) и команды (Team) [вендор] | [мир] | https://www.pretty-prompt.com/pricing ; https://www.pretty-prompt.com/chrome-extension ; https://github.com/charliemday/pretty-mcp |
| Microsoft Prompt Coach (агент в Microsoft 365 Copilot) | да | нет | нет | нет | нет | частично | Отдельно не продаётся, входит в подписку Copilot; Microsoft 365 Copilot — $30 за пользователя в месяц при оплате за год [вендор]; по посту участника сообщества — есть и в бесплатном Copilot Chat [сообщество] | Организации с подпиской Copilot | [мир] | https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/agent-template-prompt-coach ; https://support.microsoft.com/en-us/microsoft-365-copilot/agents-built-by-microsoft ; https://www.microsoft.com/en-us/microsoft-365-copilot/enterprise |
| LangSmith (LangChain) | частично | да | частично | да | частично | частично | Developer $0 (1 место, 5 тыс. трасс в месяц); Plus $39 за место в месяц (10 тыс. трасс), дальше по объёму; Enterprise — по договору; Insights — на Plus и Enterprise, модель для него оплачивается отдельно [вендор] | Команды, которые строят и запускают агентов [вендор] | [мир] | https://www.langchain.com/pricing ; https://docs.langchain.com/langsmith/insights ; https://www.langchain.com/blog/polly-langsmith-ga ; https://www.langchain.com/blog/your-coding-agents-are-a-black-box-heres-how-to-crack-them-open |
| Langfuse | частично | частично | да | частично | частично | частично | Hobby $0 (50 тыс. единиц в месяц, 2 пользователя, 30 дней); Core $29/мес; Pro $199/мес; дополнение Teams $300/мес; Enterprise $2 499/мес; сверх лимита $8 за 100 тыс. единиц [вендор] | Команды с агентами в продакшене [вендор] | [мир] | https://langfuse.com/pricing ; https://langfuse.com/integrations/developer-tools/claude-code ; https://langfuse.com/blog/2026-09-23-catching-conversation-signals-in-langfuse ; https://langfuse.com/changelog/2026-06-19-langfuse-assistant-public-beta |
| Helicone | частично | частично | не найдено | не найдено | частично | не найдено | Hobby бесплатно (10 тыс. запросов, 1 место, 7 дней); Pro $79/мес; Team $799/мес; Enterprise — по договору; с 03.03.2026 в режиме поддержки [вендор] | «Growing teams», «scaling companies» [вендор] | [мир] | https://www.helicone.ai/pricing ; https://docs.helicone.ai/features/sessions ; https://www.helicone.ai/blog/joining-mintlify |
| AgentOps | не найдено | частично | не найдено | частично | частично | не найдено | Basic $0 (до 5 000 событий); Pro от $40/мес, дальше по объёму; Enterprise — по договору [вендор] | Команды, которые строят агентов [вендор] | [мир] | https://www.agentops.ai/ ; https://github.com/agentops-ai/agentops |
| Arize (Phoenix, AX) | частично | да | частично | да | частично | да | Phoenix — open source; AX Free $0 (25 тыс. спанов в месяц, 15 дней, Signal — 10 проблем в месяц); AX Pro $50/мес (50 тыс. спанов, 30 дней, 25 проблем); Enterprise — по договору [вендор] | «Builders» (Free), «AI-native teams» (Pro) [вендор] | [мир] | https://arize.com/pricing/ ; https://arize.com/docs/ax/observe/signal ; https://arize.com/docs/ax/alyx ; https://github.com/Arize-ai/arize-claude-code-plugin |
| W&B Weave (CoreWeave) | частично | частично | частично | да | частично | не найдено | Free $0 (1 ГБ в месяц); Pro от $60/мес (1,5 ГБ), сверх $0,10 за МБ; Enterprise — по договору [вендор] | Команды, выпускающие агентов в продакшен [вендор] | [мир] | https://coreweave.com/forge-pricing ; https://docs.coreweave.com/weave/guides/integrations/claude_code ; https://wandb.ai/site/weave/ |
| Braintrust | частично | да | частично | да | частично | да | Starter $0 (1 ГБ, 10 тыс. оценок, 14 дней); Pro $249/мес; Enterprise — по договору; ИИ-помощник Loop — только Pro и Enterprise [вендор] | «AI native teams» [вендор]; клиенты — Notion, Replit, Cloudflare, Ramp, Dropbox [СМИ] | [мир] | https://www.braintrust.dev/pricing ; https://www.braintrust.dev/docs/integrations/developer-tools/claude-code ; https://www.braintrust.dev/docs/cookbook/recipes/Loop |
| Opik (Comet) | частично | да | частично | да | да | да | Open source — бесплатно; Free Cloud $0 (25 тыс. спанов в месяц, до 10 человек, 60 дней); Pro Cloud $19/мес (100 тыс. спанов, до 50 человек); Enterprise — по договору; Diagnostics расходует токены Ollie [вендор] | Команды [вендор] | [мир] | https://www.comet.com/site/pricing/ ; https://www.comet.com/docs/opik/integrations/claude-code ; https://www.comet.com/docs/opik/tracing/diagnostics |
| Datadog LLM Observability | частично | частично | не найдено | да | частично | не найдено | Free — до 40 тыс. LLM-спанов в месяц, 15 дней; Pro от $160/мес (100 тыс. LLM-спанов); оплачиваются только вызовы модели [вендор] | «Individuals and small teams» (Free), «teams running at scale» (Pro) [вендор] | [мир] | https://www.datadoghq.com/products/ai/agent-observability/ |
| Sentry (AI agent monitoring) | частично | частично | частично | частично | частично | не найдено | Developer $0 (1 пользователь); Team $26/мес и Business $80/мес при оплате за год; Enterprise — по договору; ИИ-отладчик Seer — по отдельной подписке [вендор] | Команды разработки [вендор] | [мир] | https://docs.sentry.io/product/agents/ ; https://sentry.io/pricing/ |
| New Relic (AI monitoring: агенты) | частично | частично | частично | частично | частично | не найдено | Free — 100 ГБ данных в месяц и 1 полный пользователь; сверх 100 ГБ — $0,40 за ГБ; цена пользователей зависит от редакции (Standard до 5 пользователей, Pro, Enterprise — по запросу) [вендор] | Команды и компании [вендор] | [мир] | https://docs.newrelic.com/docs/ai-monitoring/explore-ai-data/view-ai-agents/ ; https://docs.newrelic.com/docs/ai-monitoring/intro-to-ai-monitoring/ ; https://newrelic.com/pricing |
| Grafana Cloud Agent Observability | частично | частично | частично | частично | частично | не найдено | Free — 30 тыс. генераций и 25 млн токенов на оценки и проверки в месяц; Pro — $19/мес платформа, дальше от $1,50 за 1 000 генераций и от $2 за 1 млн токенов [вендор] | Команды на Grafana Cloud [вендор] | [мир] | https://grafana.com/docs/grafana-cloud/machine-learning/ai-observability/guides/instrument-coding-agents/ ; https://grafana.com/docs/grafana-cloud/observe-and-act/agent-observability/guides/conversations/ ; https://grafana.com/pricing/ |
| Invariant Explorer (Invariant Labs, с 2025 — Snyk) | не найдено | частично | не найдено | не найдено | не найдено | не найдено | Open source (Apache 2.0), только самостоятельный запуск: размещённая версия закрыта в январе 2026 [вендор] | Никто | [мир] | https://invariantlabs.ai/ ; https://explorer.invariantlabs.ai/ |
| Dash0 AI Coding Insights | частично | частично | частично | частично | частично | не найдено | $10 за отслеживаемого разработчика в месяц; пробный период 14 дней [вендор] | Руководители разработки [вендор] | [мир] | https://www.dash0.com/blog/introducing-ai-coding-insights-stop-guessing-what-your-coding-agents-deliver ; https://www.dash0.com/comparisons/claude-code-monitoring-tools |
| Datadog Agent Console (preview) | не найдено | да | не найдено | да | да | да | Цена не указана; preview; пробный период Datadog 14 дней [вендор] | Руководители платформы и разработки [вендор] | [мир] | https://www.datadoghq.com/blog/datadog-agent-console/ |
| Amazon CloudWatch Coding Agent Insights | не найдено | не найдено | не найдено | не найдено | не найдено | не найдено | Стандартная цена приёма метрик OpenTelemetry в CloudWatch [вендор] | Руководители разработки [вендор] | [мир] | https://aws.amazon.com/about-aws/whats-new/2026/07/cloudwatch-coding-agent-insights/ |
| Jellyfish (Claude Code в панели AI Impact) | не найдено | не найдено | не найдено | не найдено | не найдено | не найдено | Цена по числу мест и выбранным модулям, по запросу у продаж; на странице статьи — только «Request a Demo» [вендор] | Руководители разработки [вендор] | [мир] | https://jellyfish.co/library/claude-code-monitoring/ ; https://jellyfish.co/pricing/ |
| Torii | не найдено | не найдено | не найдено | не найдено | не найдено | не найдено | Цена в статье не указана; о себе: «Pricing reflects enterprise coverage, not entry-level point pricing» [вендор] | Администраторы предприятий [вендор] | [мир] | https://www.toriihq.com/articles/five-claude-code-usage-dashboards-and-monitoring-tools |
| Omnara | не найдено | частично | частично | не найдено | не найдено | не найдено | Self-host бесплатно (Apache 2.0); машины Omnara — $0,0414 за ГиБ памяти в час; Enterprise — по договору; приложение iOS бесплатно [вендор] | Команды и компании [вендор] | [мир] | https://www.omnara.com/pricing ; https://apps.apple.com/app/id6748426727 |
| Pixel Agents | не найдено | частично | частично | не найдено | частично | не найдено | Бесплатно, MIT | Никто: платной версии нет | [мир] | https://github.com/pixel-agents-hq/pixel-agents ; https://marketplace.visualstudio.com/items?itemName=pablodelucca.pixel-agents |
| claude-office (paulrobello) | не найдено | частично | частично | не найдено | не найдено | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/paulrobello/claude-office |
| Claude-Office (W17ant) | не найдено | частично | не найдено | не найдено | не найдено | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/W17ant/Claude-Office |
| agent-virtual-office (KbWen) | не найдено | частично | частично | частично | частично | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/KbWen/agent-virtual-office |
| PixelHQ (iOS) | не найдено | частично | не найдено | не найдено | не найдено | не найдено | Бесплатно | Никто | [мир] | https://apps.apple.com/ph/app/pixelhq/id6758467298 |
| claude-code-hooks-multi-agent-observability (disler) | частично | частично | частично | частично | не найдено | не найдено | Бесплатно; лицензия GitHub не распознана | Никто | [мир] | https://github.com/disler/claude-code-hooks-multi-agent-observability |
| Claude-Code-Agent-Monitor (hoangsonww) | частично | частично | частично | частично | частично | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/hoangsonww/Claude-Code-Agent-Monitor |
| agents-observe (simple10) | частично | частично | частично | не найдено | частично | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/simple10/agents-observe |
| claude-usage (phuryn) | не найдено | не найдено | не найдено | не найдено | не найдено | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/phuryn/claude-usage |
| Anthropic prompt improver (Anthropic Console) | да | нет | нет | нет | нет | частично | Цена не указана; доступен всем пользователям Console [вендор] | Разработчики на API Anthropic | [мир] | https://claude.com/blog/prompt-improver |
| OpenAI prompt optimizer | да | нет | нет | нет | нет | частично | Цена не указана; сворачивается: Evals — только чтение с 31.10.2026, закрытие 30.11.2026 [вендор] | Разработчики на платформе OpenAI | [мир] | https://developers.openai.com/api/docs/guides/prompt-optimizer |
| PromptCoach (Slivaro GmbH) | да | нет | нет | нет | нет | частично | Цена на странице не указана | Не найдено | [мир] | https://prompt-coach.pro/en |
| Promptfoo | да | не найдено | не найдено | не найдено | не найдено | частично | Community — бесплатно, open source (10 тыс. проб red teaming в месяц); Enterprise и On-Premise — по договору [вендор] | Команды и компании; о себе — «156 of the Fortune 500» [вендор] | [мир] | https://www.promptfoo.dev/ ; https://www.promptfoo.dev/pricing/ |
| Promptly (расширение Chrome) | да | частично | частично | не найдено | не найдено | частично | Цена на странице не указана; бесплатная библиотека запросов сообщества [вендор] | Не найдено | [мир] | https://chromewebstore.google.com/detail/promptly-%E2%80%93-ai-prompt-enha/jjfoaldlbbcfgkhbfmadjjelphbgmngg?hl=en |
| PromptJolt (расширение Chrome) | да | нет | нет | нет | нет | частично | Бесплатные ежедневные улучшения; премиум-тариф с большими лимитами, цена на странице не указана [вендор] | Не найдено | [мир] | https://chromewebstore.google.com/detail/promptjolt-%E2%80%93-ai-prompt-en/egfkoabnngmnlkpofjihcpbilfbnldnb?hl=en |
| Prompt Perfect: AI Prompt Helper (расширение Chrome) | да | нет | нет | нет | нет | частично | Платный тариф для автоматической переписки запросов, встроенные покупки; цена на странице не указана [вендор] | Не найдено | [мир] | https://chromewebstore.google.com/detail/prompt-perfect-ai-prompt/kigfbkddbfgbdbdekajodpggpkpfdjfp?hl=en |
| Prompt Fixer (расширение Chrome, KAJ Analytics) | да | нет | нет | нет | нет | частично | Free: 3 запроса в день; Premium $7 в месяц (безлимит запросов, все шаблоны, вся история); встроенные покупки в магазине [вендор] | Не найдено | [мир] | https://chromewebstore.google.com/detail/prompt-fixer/mehggppbjbmblkfgpjecjphonnplbahd?hl=en ; https://kaj-prompt-fixer.kaj-analytics.com/ |
| Promptu (расширение Chrome) | да | нет | нет | нет | нет | частично | Ограниченное число бесплатных улучшений; безлимит — со своим API-ключом [вендор] | Не найдено | [мир] | https://chromewebstore.google.com/detail/promptu/gaafidhicjnpkdpcacfgehiafmliajah?hl=en |
| Prompt Neat (promptneat.com) | да | нет | нет | нет | нет | частично | Бесплатно, без регистрации; кнопка «buy us coffee» [вендор] | Никто | [мир] | https://promptneat.com/ |
| vibe-log | да | частично | не найдено | не найдено | частично | частично | Бесплатно: open source (MIT) и облако «Free Forever» (до 5000 сессий в месяц) [вендор] | Пока никто | [мир] | https://vibe-log.dev/ ; https://github.com/vibe-log/vibe-log-cli ; https://vibe-log.dev/example-daily-report |
| Sniffly | частично | частично | частично | да | не найдено | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/chiphuyen/sniffly ; https://aiengineerguide.com/blog/claude-code-analytics-sniffly/ |
| Prompt Coach — навык Claude Code (hancengiz) | да | частично | частично | да | да | да | Бесплатно; лицензия GitHub не распознана | Никто | [мир] | https://github.com/hancengiz/claude-code-prompt-coach-skill |
| agent-retro (giannimassi) | частично | да | да | да | частично | да | Бесплатно, MIT | Никто | [мир] | https://github.com/giannimassi/agent-retro ; https://raw.githubusercontent.com/giannimassi/agent-retro/main/examples/sample-retro.md |
| retro (netresearch/retro-skill) | частично | да | да | да | да | да | Бесплатно (значок README: MIT и CC-BY-SA-4.0) | Никто | [мир] | https://github.com/netresearch/retro-skill |
| claude-retro-skill (robertantolin) | частично | частично | да | да | частично | да | Бесплатно, MIT | Никто | [мир] | https://github.com/robertantolin/claude-retro-skill |
| session-retrospective (accidentalrebel) | частично | частично | частично | да | не найдено | частично | Бесплатно (MIT по README) | Никто | [мир] | https://github.com/accidentalrebel/claude-skill-session-retrospective |
| claude-lessons-learned (aplaceforallmystuff) | не найдено | да | частично | да | частично | да | Бесплатно, MIT | Никто | [мир] | https://github.com/aplaceforallmystuff/claude-lessons-learned |
| claude-reflect (BayramAnnakov) | частично | не найдено | да | не найдено | не найдено | да | Бесплатно, MIT | Никто | [мир] | https://github.com/BayramAnnakov/claude-reflect |
| claude-global-skills (BryceEWatson): transcript-analysis, global-review-loop | не найдено | не найдено | не найдено | не найдено | не найдено | да | Бесплатно, MIT | Никто | [мир] | https://github.com/BryceEWatson/claude-global-skills |
| SpecStory (расширения, CLI, SpecStory Cloud) | да | частично | частично | не найдено | не найдено | да | Расширение VS Code бесплатно; Analytics и генерация навыков — на тарифе Pro; цена Pro не найдена [вендор] | Не найдено | [мир] | https://docs.specstory.com/cloud/analytics ; https://marketplace.visualstudio.com/items?itemName=SpecStory.specstory-vscode |
| Entire (Checkpoints) | частично | частично | частично | не найдено | не найдено | не найдено | CLI — open source (MIT); цена не найдена [вендор] | Не найдено | [мир] | https://entire.io/ ; https://entire.io/news/former-github-ceo-thomas-dohmke-raises-60-million-seed-round |
| Mantra (настольное приложение) | частично | частично | частично | не найдено | не найдено | не найдено | Ядро бесплатно; Sync $4/мес за год ($5 помесячно); Publish $8 за сайт в месяц за год ($10 помесячно); Pioneer $49 разово; Commercial $50 за человека в год — по желанию [вендор] | Отдельные пользователи — за синхронизацию и публикацию; организациям предлагают Commercial [вендор] | [мир] | https://github.com/mantra-hq/mantra-releases ; https://docs.mantra.gonewx.com/ ; https://docs.mantra.gonewx.com/en/about/pricing.html ; https://docs.mantra.gonewx.com/about/pricing.html |
| claude-insights (yahav10, CLI) | не найдено | не найдено | не найдено | частично | не найдено | да | Бесплатно, MIT | Никто | [мир] | https://dev.to/yahav10/i-built-a-cli-that-turns-claude-codes-insights-report-into-actionable-skills-rules-and-workflows-377 ; https://github.com/yahav10/claude-insights |
| insight-extractor (навык в сборнике glebis/claude-skills) | не найдено | не найдено | не найдено | не найдено | не найдено | частично | Бесплатно, MIT | Никто | [мир] | https://github.com/glebis/claude-skills |
| claude-code-templates (davila7): Analytics и Conversation Monitor | не найдено | частично | не найдено | не найдено | не найдено | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/davila7/claude-code-templates ; https://docs.aitmpl.com/ |
| Continuous-Claude-v3 (parcadei) | не найдено | частично | не найдено | частично | не найдено | да | Бесплатно, MIT | Никто | [мир] | https://github.com/parcadei/Continuous-Claude-v3 |
| reflect (dstreefkerk, плагин Claude Code) | не найдено | да | не найдено | да | не найдено | да | Бесплатно, MIT | Никто | [мир] | https://www.claudepluginhub.com/plugins/dstreefkerk-reflect-plugins-reflect |
| reflect (shfc, плагин Claude Code) | не найдено | не найдено | да | не найдено | не найдено | да | Бесплатно | Никто | [мир] | https://www.claudepluginhub.com/plugins/shfc-reflect-plugins-reflect |
| Retrospective Process (FrancisVarga, навык) | не найдено | частично | не найдено | да | не найдено | да | Бесплатно | Никто | [мир] | https://skills.rest/skill/retrospective-process ; https://github.com/FrancisVarga/coconut-claude-code-plugins |
| claude-smart (ReflexioAI) | не найдено | частично | да | не найдено | не найдено | да | Бесплатно, Apache 2.0 | Никто | [мир] | https://github.com/ReflexioAI/claude-smart |
| Raindrop | частично | да | да | да | да | частично | Hobby $0 (1 000 событий в месяц); Pro $299/мес + $0,003–0,002 за событие; Enterprise — по договору [вендор] | Команды, выпускающие агентов; клиенты — Vercel, Speak, Clay, Framer, AngelList, Tolan [вендор] | [мир] | https://www.raindrop.ai/ ; https://www.raindrop.ai/docs/platform/signals/ |
| Percival (Patronus AI) | не найдено | да | не найдено | да | не найдено | да | Developer — бесплатно, $10 кредитов; Enterprise — по договору; вызовы оценщиков через API — $10–20 за 1 000 [вендор]; цена самого Percival не указана | Не найдено | [мир] | https://www.patronus.ai/percival ; https://www.patronus.ai/pricing |
| Galileo (с 22.05.2026 — часть Cisco) | не найдено | да | частично | да | да | да | Free $0 (5 000 трасс в месяц); Pro $100/мес (50 000 трасс); Enterprise — по запросу [вендор] | Команды; в блоге цитируется Twilio [вендор] | [мир] | https://galileo.ai/blog/introducing-galileo-s-insights-engine-intelligence-that-adapts-to-your-agent ; https://galileo.ai/pricing ; https://blogs.cisco.com/news/cisco-announces-the-intent-to-acquire-galileo |
| Laminar | частично | да | частично | да | да | не найдено | Free $0 (1 ГБ, 7 дней, 1 место); Starter $30/мес (3 ГБ); Pro $150/мес (10 ГБ); Enterprise — по договору [вендор] | Не найдено | [мир] | https://laminar.sh/pricing ; https://laminar.sh/docs/tracing/integrations/claude-code ; https://laminar.sh/docs/signals/quickstart |
| Honeycomb | не найдено | частично | частично | частично | частично | не найдено | Free $0 (до 20 млн событий в месяц); Pro от $150/мес; Enterprise — по договору [вендор] | Не найдено | [мир] | https://docs.honeycomb.io/integrations/mcp/use-cases ; https://www.honeycomb.io/pricing |
| Maple | частично | частично | частично | частично | частично | не найдено | Startup $39/мес (по 100 ГБ логов, трасс и метрик, дальше $0,30 за ГБ); Enterprise от $2 000; self-host бесплатно (FSL-1.1) [вендор] | Не найдено | [мир] | https://maple.dev/changelog/2026-09-24-claude-code-sessions/ ; https://maple.dev/pricing/ |
| PromptLayer | частично | частично | не найдено | частично | частично | не найдено | Free $0; Pro $49/мес; Team $500/мес; Enterprise — по договору [вендор] | Команды; клиенты — Accenture, DocuSign, Gorgias, NoRedInk [вендор] | [мир] | https://www.promptlayer.com/ ; https://www.promptlayer.com/pricing |
| Docent (Transluce) | не найдено | да | не найдено | да | не найдено | не найдено | Open source (Apache 2.0); размещённая версия — цена не указана [вендор] | Не найдено | [мир] | https://transluce.org/docent ; https://transluce.org/docent/blog/open-source |
| Maxim AI (Agent observability) | частично | частично | частично | частично | частично | не найдено | Не найдено: страница цен показывает только тарифы шлюза Bifrost той же компании [вендор] | Не найдено | [мир] | https://www.getmaxim.ai/products/agent-observability ; https://www.getmaxim.ai/pricing |
| Future AGI | частично | да | не найдено | да | да | да | Free — 50 ГБ трассировки, 2 тыс. кредитов на оценки и др. в месяц; дальше оплата по объёму (хранение от $2 за ГБ, ИИ-кредиты от $10 за 1 тыс.); open source (Apache 2.0) [вендор] | Команды; о себе — «Most teams pay nothing», «2,400+ teams» [вендор] | [мир] | https://futureagi.com/ ; https://futureagi.com/pricing |
| Failproof AI | частично | да | частично | да | да | да | Free Forever + open source (MIT; 5 000 запусков и 3 разбора сбоев в месяц, один пользователь); Team $99/мес; Scale $599/мес; Enterprise — по договору [вендор] | Команды; бесплатно — один пользователь [вендор] | [мир] | https://befailproof.ai/ ; https://befailproof.ai/pricing |
| SigNoz (мониторинг Claude Code) | частично | частично | частично | частично | частично | не найдено | Teams — от $49/мес с $49 использования; трассы и логи $0,30 за ГБ; self-host — бесплатно [вендор] | Команды [вендор] | [мир] | https://signoz.io/docs/claude-code-monitoring/ ; https://signoz.io/pricing/ |
| AgentsView (kenn-io; приложение, CLI и MCP-сервер) | частично | да | частично | да | да | частично | Бесплатно, MIT; платных тарифов на открытых страницах нет | Никто | [мир] | https://www.agentsview.io/ ; https://www.agentsview.io/guide/ ; https://www.agentsview.io/docs/session-intelligence/ ; https://www.agentsview.io/docs/quality/ ; https://www.agentsview.io/docs/recall/ ; https://github.com/kenn-io/agentsview |
| Claude Code Trace (delexw; просмотр и разбор через Jev) | частично | да | частично | да | да | не найдено | Бесплатно, MIT; необязательный разбор через Jev требует ключа API TypeSafe AI: «Input tokens: $0.042 / MTok», выходные токены бесплатно [вендор Jev] | За просмотр — никто; за разбор — владелец ключа Jev (оплата по токенам) | [мир] | https://github.com/delexw/claude-code-trace ; https://typesafe.ai/blog/introducing-system-one-models-and-jev |
| Claude Trace Replay (harrylettering; просмотр трасс Claude Code) | да | да | частично | частично | частично | частично | Бесплатно, MIT | Никто | [мир] | https://github.com/harrylettering/claude-trace-replay |
| Agent Sessions (jazzyalex; приложение для macOS) | частично | частично | частично | частично | не найдено | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/jazzyalex/agent-sessions ; https://jazzyalex.github.io/agent-sessions/ |
| Claude Code and Codex Assist (расширение VS Code, A. G. Software Technologies) | частично | частично | частично | не найдено | не найдено | не найдено | Бесплатно «for everyday use»; «A few advanced features require Pro», цена Pro на странице не указана; код закрыт [вендор] | Не найдено: на странице нет данных о числе платящих | [мир] | https://marketplace.visualstudio.com/items?itemName=agsoft.claude-history-viewer |
| Session Analyzer (Yijia-Zhou; просмотр истории сессий) | частично | частично | частично | частично | не найдено | не найдено | Бесплатно, BSD-3-Clause | Никто | [мир] | https://github.com/Yijia-Zhou/session-analyzer |
| Claude Code Transcript Viewer (ly4096x) | частично | частично | частично | не найдено | не найдено | не найдено | Бесплатно, GPL-3.0 | Никто | [мир] | https://github.com/ly4096x/ClaudeCodeTranscriptViewer |
| JsonlViewer (sourceit) | частично | частично | частично | не найдено | не найдено | не найдено | Бесплатно; лицензия GitHub не указана | Никто | [мир] | https://github.com/sourceit/jsonlViewer |
| agent-replay (репозиторий claude-replay, tanghong123) | частично | частично | частично | не найдено | не найдено | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/tanghong123/claude-replay |
| Claude Session Viewer (xlvlxn; страница GitHub Pages) | частично | частично | частично | не найдено | не найдено | не найдено | Бесплатно; лицензия GitHub не указана | Никто | [мир] | https://github.com/xlvlxn/claude-session-viewer |
| claude-code-transcripts (Simon Willison) | частично | частично | частично | не найдено | не найдено | не найдено | Бесплатно, Apache-2.0 | Никто | [мир] | https://github.com/simonw/claude-code-transcripts |
| Claude Viewer (maxturazzini; просмотр и аналитика для нескольких пользователей) | частично | частично | частично | не найдено | не найдено | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/maxturazzini/claude-viewer |
| ah — Agent History (nihen; командная утилита) | частично | частично | частично | не найдено | не найдено | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/nihen/ah |
| AI Agent Session Center (coding-by-feng; панель с 3D-роботами) | частично | частично | частично | не найдено | частично | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/coding-by-feng/ai-agent-session-center |
| AgentPulse (jstuart0; самостоятельно размещаемая панель) | частично | частично | частично | частично | частично | частично | Бесплатно, MIT (самостоятельная установка) | Никто | [мир] | https://github.com/jstuart0/agentpulse |
| burnboard (sondeinc; расход токенов и аудит потерь) | частично | частично | не найдено | не найдено | да | частично | Бесплатно, MIT | Никто | [мир] | https://github.com/sondeinc/burnboard |
| Agent Dashboard (dustinblack) | не найдено | частично | частично | не найдено | не найдено | не найдено | Бесплатно, Apache-2.0 | Никто | [мир] | https://github.com/dustinblack/agent-dashboard |
| Agent View (Frayo44; терминальный менеджер сессий) | не найдено | частично | частично | частично | не найдено | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/Frayo44/agent-view |
| AgentCenter (панель для агентов OpenClaw) | частично | частично | частично | частично | частично | не найдено | 7 дней бесплатно; Starter от $14 в месяц ($140 в год), Pro $290 в год, Scale $790 в год; лимиты 5, 15 и 50 агентов; на своём сервере — от $99 в месяц; нужна своя подписка или ключ ИИ-провайдера [вендор] | Один пользователь, который управляет своими агентами OpenClaw; командный доступ «on the roadmap» [вендор] | [мир] | https://www.agentcenter.cloud/ ; https://www.agentcenter.cloud/pricing ; https://www.agentcenter.cloud/ai-agent-dashboard ; https://www.agentcenter.cloud/blogs/agentcenter-vs-prometheus |
| OpenClawHQ — Mission Control (платный сервис для агентов OpenClaw) | не найдено | частично | не найдено | да | частично | не найдено | $49 в месяц фиксированно, Mission Control входит в тариф [вендор] | Владельцы агентов OpenClaw | [мир] | https://openclawhq.io/blog/openclaw-mission-control |
| TenacitOS (carlosazaustre; панель OpenClaw с 3D-офисом) | не найдено | частично | не найдено | не найдено | не найдено | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/carlosazaustre/tenacitOS |
| Mission Control (manish-raana; панель задач агентов OpenClaw) | частично | частично | не найдено | частично | частично | не найдено | Бесплатно, Apache-2.0 | Никто | [мир] | https://github.com/manish-raana/openclaw-mission-control |
| Mission Control (navjotdhanawat; панель задач агентов OpenClaw) | не найдено | частично | не найдено | не найдено | частично | не найдено | Бесплатно; лицензия GitHub не указана | Никто | [мир] | https://github.com/navjotdhanawat/openclaw-mission-control |
| Mission Control (Jzineldin; панель для macOS) | частично | частично | не найдено | не найдено | не найдено | не найдено | Бесплатно; лицензия GitHub не распознана | Никто | [мир] | https://github.com/Jzineldin/mission-control |
| ClawController (mdonan90; панель агентов OpenClaw) | не найдено | частично | не найдено | не найдено | не найдено | не найдено | Бесплатно, MIT | Никто | [мир] | https://github.com/mdonan90/ClawController ; https://www.clawcontroller.com/ |
| AI Beacon (manusa; панель сессий кодовых агентов на нескольких машинах) | не найдено | частично | частично | не найдено | частично | не найдено | Бесплатно; лицензия GitHub — Apache-2.0, исходный код по README будет опубликован после этапа проверки | Никто | [мир] | https://github.com/manusa/ai-beacon ; https://blog.marcnuri.com/ai-coding-agent-dashboard |
| session-audit (навык в наборе ai-builder-team, плагин munawar) | не найдено | да | да | да | да | да | Бесплатно; лицензия GitHub не указана | Никто | [мир] | https://raw.githubusercontent.com/ai-builder-team/ai-builder-plugin-marketplace/6013afd952cd663eb62babd113ae6ece974001c4/plugins/munawar/skills/session-audit/SKILL.md ; https://mcpmarket.com/tools/skills/claude-session-auditor |
| analyze-sessions (навык в наборе aoshimash/skills) | не найдено | да | да | не найдено | да | да | Бесплатно, MIT | Никто | [мир] | https://raw.githubusercontent.com/aoshimash/skills/f5117316e7ff07cfba1f69541806220916a82590/plugins/aoshimash-skills/skills/analyze-sessions/SKILL.md ; https://mcpmarket.com/tools/skills/claude-code-session-analyzer |
| session-analysis (Git-Fg/meta-plugin-manager; по карточке каталога skills.lc) | не найдено | да | не найдено | да | да | да | Бесплатно; лицензия навыка не указана, репозиторий недоступен | Никто | [мир] | https://skills.lc/Git-Fg/meta-plugin-manager/git-fg-meta-plugin-manager-claude-skills-session-analysis-skill-md |
| session-analysis (набор outfitter-dev/outfitter, плагин fieldguides) | частично | частично | да | не найдено | не найдено | частично | Бесплатно; лицензия GitHub не указана | Никто | [мир] | https://raw.githubusercontent.com/outfitter-dev/outfitter/6901aaff7175d890ec311f992d4f9b9e5d8c1f64/plugins/fieldguides/skills/session-analysis/SKILL.md ; https://mcpmarket.com/tools/skills/conversation-session-analysis |
| ConKeeper — context-keeper (swannysec; навыки memory-reflect и memory-insights) | не найдено | не найдено | да | частично | не найдено | частично | Бесплатно; лицензия GitHub не распознана | Никто | [мир] | https://github.com/swannysec/context-keeper ; https://skills.rest/skill/memory-insights |
| my-insights (навык в dotfiles yulonglin; разбор через Gemini) | частично | не найдено | не найдено | не найдено | не найдено | не найдено | Бесплатно; лицензия GitHub не указана | Никто | [мир] | https://raw.githubusercontent.com/yulonglin/dotfiles/899e27452c37d7c6d13ced1be5fba68f022e132c/claude/skills/.migrated/my-insights/SKILL.md ; https://mcpmarket.com/tools/skills/claude-code-usage-insights |
| MetaPrompt (расширение Chrome, justgoextension) | да | нет | нет | нет | нет | частично | Free: 20 улучшений в месяц; MetaPrompt Pro $5,99 в месяц: 5 000 улучшений в месяц и более мощные модели; встроенные покупки [вендор] | Отдельные пользователи: студенты, специалисты, писатели, разработчики, исследователи [вендор] | [мир] | https://chromewebstore.google.com/detail/metaprompt-ai-prompt-engi/glkfhecdpcmaclfkhkibmoijipnnjkbf?hl=en |
| Prompt Reviewer (расширение VS Code, Musawir Hussain) | да | нет | нет | нет | нет | частично | Бесплатно | Никто | [мир] | https://marketplace.visualstudio.com/items?itemName=MusawirHussain.prompt-reviewer |
| AI Prompt Checker (веб-студия Parix; бесплатный инструмент на сайте) | да | нет | нет | нет | нет | частично | Бесплатно, без регистрации | Никто | [мир] | https://parix.ai/free-ai-tools/ai-prompt-checker/ |
| Prompt Analyzer (PromptPrepare) | да | нет | нет | нет | нет | частично | Бесплатно, без регистрации; страница цен /pricing вернула 404 [вендор] | Никто | [мир] | https://promptprepare.com/tools/prompt-analyzer |
| Prompt Evaluator и менеджер запросов SpacePrompts | да | нет | нет | нет | нет | частично | Оценщик бесплатно, общий лимит «100 evaluations» в день на всех; менеджер запросов: Free $0 (3 улучшения в день), Pro $5 в месяц ($60 за год), Team $9 в месяц ($108 за год) [вендор] | Отдельные пользователи (Pro) и команды до 5 человек (Team) [вендор] | [мир] | https://www.spaceprompts.com/ai-tools/prompt-evaluator ; https://www.spaceprompts.com/pricing |
| Prompt Coach (Peak15 AI; coach.p15.ai) | да | нет | нет | нет | нет | частично | Бесплатно, бета, без регистрации | Никто | [мир] | https://coach.p15.ai/ |
| Prompt Redesigner (custom GPT компании craai) | да | нет | нет | нет | нет | частично | Бесплатно для подписчиков ChatGPT Plus; инструкции для других моделей приведены в сноске [вендор] | Никто (подписчики ChatGPT Plus используют бесплатно) | [мир] | https://craai.substack.com/p/improving-your-prompts-and-a-prompt |
| cursor-doctor (nedcodes; проверка файлов правил Cursor) | частично | нет | нет | нет | нет | частично | Бесплатно, MIT | Никто | [мир] | https://github.com/nedcodes-ok/cursor-doctor |
| Latitude (разбор трасс агентов и исправление через кодового агента) | не найдено | да | да | да | да | да | Starter бесплатно (20 тыс. кредитов в месяц, 30 дней, без лимита мест); Pro $99 в месяц (100 тыс. кредитов, 90 дней; ещё 10 тыс. кредитов — $20); Enterprise — по договору [вендор] | Команды, которые вместе строят ИИ-продукты («teams building AI products collaboratively at scale») [вендор] | [мир] | https://latitude.so/ ; https://latitude.so/pricing |
| Confident AI (создатели DeepEval) | частично | частично | не найдено | не найдено | частично | не найдено | Free $0 (2 места, 1 проект, 5 прогонов тестов в неделю, 1 ГБ-месяц трасс); Starter $200 в месяц; Team $2 000 в месяц; Enterprise — по договору [вендор] | Инженерные, QA- и продуктовые команды [вендор] | [мир] | https://www.confident-ai.com/ ; https://www.confident-ai.com/pricing |
| OpenObserve (мониторинг LLM-приложений в общей платформе наблюдаемости) | частично | не найдено | не найдено | частично | не найдено | не найдено | Открытое ПО (AGPL-3.0), самостоятельная установка бесплатно; цены облака и Enterprise на главной не указаны («Get Started Free») [вендор] | Не найдено | [мир] | https://openobserve.ai/ ; https://github.com/OpenObserve/openobserve |
| Pydantic Logfire | частично | частично | не найдено | не найдено | не найдено | не найдено | Personal бесплатно (10 млн записей в месяц, 3 проекта, 30 дней, 1 место); Team $49 в месяц (5 мест, сверх 10 млн записей — $2 за млн); Growth $249 в месяц; Enterprise — по договору [вендор] | Разработчики-одиночки («solo devs») и команды [вендор] | [мир] | https://pydantic.dev/pricing ; https://pydantic.dev/logfire |
| Traceloop (OpenLLMetry; на сайте объявлено присоединение к ServiceNow) | частично | не найдено | не найдено | не найдено | частично | не найдено | Free $0 (до 50 тыс. спанов в месяц, до 5 мест, 24 часа хранения); Enterprise — по договору [вендор]; OpenLLMetry — Apache-2.0 | Команды от стартапов до предприятий [вендор] | [мир] | https://www.traceloop.com/ ; https://www.traceloop.com/pricing ; https://github.com/traceloop/openllmetry |
| MLflow (трассировка агентов и LLM-приложений) | частично | частично | не найдено | не найдено | частично | не найдено | Открытое ПО, Apache-2.0; цены на открытой странице не указаны | Не найдено | [мир] | https://mlflow.org/genai/observability ; https://github.com/mlflow/mlflow |
| OpenLIT | не найдено | частично | не найдено | не найдено | частично | не найдено | Открытое ПО, бесплатно для самостоятельной установки (Apache-2.0); платных тарифов на главной нет [вендор] | Никто | [мир] | https://openlit.io/ ; https://github.com/openlit/openlit |
| «Лаборатория промптов» (PromptLab, promptslab.ru) | да | нет | нет | нет | нет | частично | Бесплатно 3 попытки в день; пакеты 99 ₽ (50 кредитов), 290 ₽ (200), 990 ₽ (1000); PRO 590 ₽/мес, безлимитные генерации [вендор] | Отдельные пользователи | [Россия] | https://promptslab.ru/enhancer/ |
| «Улучшатель промтов» в агрегаторе Vlex AI | да | нет | нет | нет | нет | частично | Тарифы агрегатора: Бесплатный 0 ₽ (50 токенов); Базовый 499 ₽/мес (600 токенов); Продвинутый 2 499 ₽/мес (3000 токенов) [вендор] | Отдельные пользователи | [СНГ] | https://vlex-ai.io/ru/ii-assistenty/uluchshatel-promtov/ ; https://vlex-ai.io/ru/ |
| «Улучшение промпта» в агрегаторе FICHI.AI | да | нет | нет | нет | нет | частично | Тарифы агрегатора: бесплатный старт; Базовый 790 ₽/мес (500 токенов); Профессиональный 1 890 ₽/мес (1 500 токенов); «Гибкий» — оплата по факту [вендор] | Отдельные пользователи | [Россия] | https://fichi.ai/bot/uluchshenie-prompta |
| «Генератор промптов» PR-CY | да | нет | нет | нет | нет | частично | Подписка на тарифы PR-CY, цифры на странице тарифов не отобразились; у генератора — «Сгенерировать от 0,03» без единицы [вендор] | Отдельные пользователи и компании | [Россия] | https://pr-cy.ru/app/prompt-generator/ ; https://a.pr-cy.ru/prices/ |
| Promptchi (promptchi.uz) | да | нет | нет | нет | нет | частично | Бесплатно: 5 улучшений в неделю без регистрации; платных тарифов на сайте нет [вендор] | Никто | [Узбекистан] | https://promptchi.uz/ ; https://chromewebstore.google.com/detail/prompt-optimizer-ai-promp/liofcdbejdpknkcapefbjcgjlamppghm?hl=en |
| HiveTrace | не найдено | нет | не найдено | не найдено | не найдено | не найдено | Цена не указана, демо по запросу [вендор] | Компании: финансы, e-commerce, промышленность, телеком [вендор] | [Россия] | https://hivetrace.ru/ |
| Yandex Monium | частично | частично | частично | не найдено | не найдено | не найдено | Цена в статье не указана | Не найдено | [Россия] | https://infra.yandex.ru/blog/llm-observability |

### Факты по строкам таблицы

#### 1. Коучи запросов: Pretty Prompt и Microsoft Prompt Coach (research/pixel-office.md, строки 167–169)

**Pretty Prompt**

- [мир] [вендор] Слоган: «Grammarly for Prompting. Turn any text into better prompts for
  ChatGPT, Claude, Gemini, and more — right where you already work». Тарифы: Free $0 — «5
  Improved Prompts/week», история — последние 3 запроса; Pro — «$8.25 / month … $99 billed
  annually», безлимит, режим Refine — «follow up questions to refine your thinking»; Team —
  «$12.99 / seat / month», «Minimum 2 seats - Billed yearly», в нём «Basic Usage Analytics»;
  Enterprise — по договору. На странице: «4.9 stars from 139+ ratings. 50,000+ users»:
  https://www.pretty-prompt.com/pricing
- [мир] [вендор] Как работает расширение: «Improve any prompt in one click, right inside
  ChatGPT, Claude, Gemini, Perplexity and more» — кнопка в окне чата превращает набранный
  черновик в улучшенный запрос; среди языков запросов — русский:
  https://www.pretty-prompt.com/chrome-extension
- [мир] [вендор] На главной: «Use Pretty Prompt inside Claude, Cursor and other Agents»,
  «Connect the new MCP server»; «50k+ installs · 750k+ prompts improved»:
  https://www.pretty-prompt.com/
- [мир] [вендор] MCP-сервер в репозитории charliemday/pretty-mcp: «MCP server that exposes your
  Pretty Prompt library and prompt improver to Cursor, Claude Desktop, and other MCP clients»;
  инструмент `improve_prompt` «uses your Pretty Prompt credits» и возвращает улучшенный запрос,
  объяснение и уточняющие вопросы. [счётчик] 0 звёзд на GitHub:
  https://github.com/charliemday/pretty-mcp
- [мир] Почему такие оценки: вход продукта по всем этим описаниям — текст запроса, выход —
  улучшенный запрос; ход работы агента, вмешательства, ошибки и время на страницах продукта не
  упоминаются. Отсюда «нет» в четырёх столбцах и «частично» в советах (переписывает текущий
  запрос, а не выводит советы из хода сессии).

**Microsoft Prompt Coach**

- [мир] [вендор] Шаблон агента: «help new Copilot users create effective prompts… guide users
  through prompt generation, analysis, and improvement»; возможности — «Interactive prompt
  guidance… clarify user goals, context, and expectations», «Detailed prompt analysis that
  evaluates and helps refine user prompts»; задача «Prompt analysis» — «Evaluates user prompts and offers detailed suggestions for improvement»; ограничение — «designed to answer one question
  at time». Страница обновлена 29.07.2026:
  https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/agent-template-prompt-coach
- [мир] [вендор] «Prompt Coach teaches you how to structure queries effectively, helping you get
  more precise and useful responses from Copilot and other AI-powered agents». Доступ: «With
  your Microsoft Copilot subscription, you have access to multiple agents from Microsoft»; если
  агента не видно — «you don't have a Microsoft Copilot license or your administrator has not
  enabled the agent»:
  https://support.microsoft.com/en-us/microsoft-365-copilot/agents-built-by-microsoft
- [мир] [сообщество, неофициально] Пост участника сообщества sohnash (05.12.2025): Prompt Coach
  «included with free Copilot (Copilot Chat) and Microsoft 365 Copilot subscriptions», «not
  available with Microsoft personal subscriptions»; «Reviews existing prompts and suggests
  improvements»:
  https://techcommunity.microsoft.com/discussions/microsoft365copilot/a-guide-to-prompt-coach/4475537
- [мир] [вендор] Microsoft 365 Copilot для предприятий — «$30.00 user/month, paid yearly» или
  «$31.50 paid monthly (Annual commitment)»; «Copilot Chat is available at no additional cost for
  all Microsoft Entra account users»:
  https://www.microsoft.com/en-us/microsoft-365-copilot/enterprise
- [мир] [вендор] Надстройка Microsoft 365 Copilot Business — $18 за пользователя в месяц по акции
  до 31.12.2026, обычная цена $21; нужна отдельная подписка Microsoft 365:
  https://www.microsoft.com/en-us/microsoft-365-copilot/pricing
- [мир] Почему такие оценки: все описанные задачи агента — про текст запроса; ход работы Copilot
  или других агентов на страницах не упоминается. Отсюда «нет» в четырёх столбцах и «частично» в
  советах.

#### 2. Платформы наблюдаемости и трассировки (research/pixel-office.md, раздел 1)

**LangSmith (LangChain)**

- [мир] [вендор] Developer — «$0 / seat per month», до 5 тыс. базовых трасс; Plus — «For teams
  building and deploying agents. $39 / seat per month», до 10 тыс. трасс, дальше по объёму;
  Enterprise — по договору. Базовые трассы хранятся 14 дней, расширенные — 180 дней за доплату:
  https://www.langchain.com/pricing
- [мир] [вендор] Insights: «automatically analyzes your traces to detect usage patterns, common
  agent behaviors, and failure modes»; для проектов с тредами анализирует разговоры целиком;
  «available for LangSmith Plus and Enterprise plans»; «Generating insights over 1,000 threads
  typically costs $1.00-$2.00 with OpenAI models and $3.00-$4.00 with current Anthropic models»:
  https://docs.langchain.com/langsmith/insights
- [мир] [вендор] Помощник Polly (общий доступ с 18.03.2026) — «can read a 300-step trace, spot
  the failure, and tell you exactly what happened»; в тредах — «user sentiment, conversation
  outcomes, and interaction patterns»: https://www.langchain.com/blog/polly-langsmith-ga
- [мир] [вендор] Запуск Polly (10.12.2025): «Spot when the agent lost track of important
  context»; «Just describe the behavior you want in natural language, and Polly will update your
  prompt accordingly»: https://www.langchain.com/blog/introducing-polly-your-ai-agent-engineer
- [мир] [вендор] Трассировка агентов-программистов (14.07.2026): Claude Code, Codex, Cursor,
  GitHub Copilot Chat, Pi, OpenCode, DeepAgents Code; в трассе — «User and assistant turns … Tool
  calls, Shell commands, MCP activity, Subagent invocations, Errors and retries, Timing and
  metadata»; «Filter by thread_id to see the whole run in order»; упавшие сессии предлагается
  сохранять для оценок:
  https://www.langchain.com/blog/your-coding-agents-are-a-black-box-heres-how-to-crack-them-open
- [мир] [вендор] Плагин для Claude Code: «Each trace includes user messages, tool calls,
  compaction, subagent runs, and assistant responses»; системные промпты не передаются:
  https://docs.langchain.com/langsmith/trace-claude-code
- [мир] Почему советы — «частично»: Polly правит промпт по описанию пользователя; автоматических
  советов по итогам разбора на открытых страницах нет (документация Insights говорит только о
  находках).

**Langfuse**

- [мир] [вендор] Hobby — бесплатно, 50 тыс. единиц в месяц, 30 дней, 2 пользователя; Core — «$29
  / month»; Pro — «$199 / month»; дополнение Teams — $300/мес; Enterprise — «$2499 / month»;
  сверх лимита $8 за 100 тыс. единиц, дальше дешевле; во всех тарифах — отслеживание сессий,
  оценщики LLM-as-a-judge, ручная разметка: https://langfuse.com/pricing
- [мир] [вендор] Интеграция с Claude Code: «User inputs: Capture every prompt and message you send
  to Claude Code», вызовы инструментов с входом и выходом, сессии, «Timing information:
  Understand how long operations take». В разделе «What to look for» документация сама
  перечисляет, что искать глазами: повторное чтение одного файла (→ добавить CLAUDE.md), повторные
  вызовы с почти одинаковым входом: https://langfuse.com/integrations/developer-tools/claude-code
- [мир] [вендор] Агенты-программисты (июль 2026): Claude Code, Codex, GitHub Copilot, Cursor, Kiro,
  OpenCode, Augment Code; «Which tools dominate, which fail, and which precede session abandonment
  are all queryable»; «The trace timeline preserves the full sequence, including retries»:
  https://langfuse.com/resources/engineering/coding-agent-tracing
- [мир] [вендор] Шаблон «сигналов разговора» (23.09.2026) оценивает каждый разговор на
  «frustration, corrections, follow-ups, and resolution» и несогласие пользователя с агентом;
  шаблон есть в галерее Langfuse; написан для чат-агентов:
  https://langfuse.com/blog/2026-09-23-catching-conversation-signals-in-langfuse
- [мир] [вендор] Assistant (публичная бета с 19.06.2026, только облако, бесплатно на время
  беты): вопросы вроде «Which traces had the highest latency yesterday?», «Show me failed
  generations in the last hour»:
  https://langfuse.com/changelog/2026-06-19-langfuse-assistant-public-beta
- [мир] [вендор] Pulse (28.07.2026): полоса графиков над таблицей наблюдений — всплески числа,
  стоимости и задержки: https://langfuse.com/changelog/2026-07-28-langfuse-pulse
- [мир] [вендор] ClickHouse купил Langfuse (16.01.2026); о Langfuse: «Trusted by 19 of the
  Fortune 50 and 63 of the Fortune 500»; ядро — MIT, можно разворачивать у себя:
  https://clickhouse.com/blog/clickhouse-acquires-langfuse-open-source-llm-observability

**Helicone**

- [мир] [вендор] Hobby — бесплатно, 10 000 запросов, 1 место, 7 дней; Pro — «$79 per month»,
  «For growing teams»; Team — «$799 per month», «For scaling companies»; Enterprise — по
  договору: https://www.helicone.ai/pricing
- [мир] [вендор] Сессии: «Sessions group these related requests together»; «trace the entire
  agent flow from initial user input to final response in one unified view»; видно, когда шаги
  происходят и «how long they take»: https://docs.helicone.ai/features/sessions
- [мир] [вендор] 03.03.2026 Helicone перешёл к Mintlify; сервис работает «in maintenance mode»;
  о себе — 16 000 организаций, 14,2 трлн токенов: https://www.helicone.ai/blog/joining-mintlify

**AgentOps**

- [мир] [вендор] «Agent observability for OpenAI, CrewAI, Autogen, and 400+ LLMs and frameworks»;
  визуализация вызовов LLM, инструментов и взаимодействия агентов; «Time Travel Debugging» — «Rewind and replay agent runs»; «Keep a full data trail of logs, errors, and prompt injection
  attacks». Basic — $0 до 5 000 событий; Pro — «starts at $40 per month»; Enterprise — по
  договору. На сайте: «raises $2.6M»: https://www.agentops.ai/
- [мир] [вендор] Таблица возможностей в README: «Event latency analysis» помечен ✅ (есть);
  «Infinite loops and recursive thought detection» — 🚧 (в работе); «Faulty reasoning detection» —
  🔜 (в планах). [счётчик] 5,9 тыс. звёзд, MIT: https://github.com/agentops-ai/agentops

**Arize (Phoenix, AX)**

- [мир] [вендор] AX Free — бесплатно, 25 тыс. спанов в месяц, 15 дней, Signal — 10 проблем в
  месяц; AX Pro — «$50 per month», 50 тыс. спанов, 30 дней, 25 проблем; Enterprise — по договору;
  Phoenix — open source: https://arize.com/pricing/
- [мир] [вендор] Signal: «a built-in worker that scans a tracing project's traces on a schedule,
  groups recurring failure patterns into issues, and writes an investigation for each one
  (overview, trace evidence, suggested fix)»; по умолчанию раз в 6 часов:
  https://arize.com/docs/ax/observe/signal
- [мир] [вендор] Помощник Alyx: «categorize recurring failures or user requests»; пример —
  «Find traces where the search tool failed, then group the error messages»; считает задержку,
  стоимость и токены; может «refine the prompt» по итогам экспериментов:
  https://arize.com/docs/ax/alyx
- [мир] [вендор] Рецепт для Claude Code, Codex и Cursor: трассы сессий, оценщик LLM-as-a-judge для
  выбора инструмента, у сбоев — «error.type and error.message»; «Turn what you found into a rule.
  Your CLAUDE.md, AGENTS.md, Cursor rules, or system prompt are prompts like any other»:
  https://arize.com/docs/ax/cookbooks/improve/observe-and-optimize-coding-agent-workflows
- [мир] [вендор] Плагин Claude Code ловит хуки SessionStart, UserPromptSubmit, PreToolUse,
  PostToolUse, Stop, SubagentStop, Notification, PermissionRequest, SessionEnd; отправляет в AX
  или Phoenix. [счётчик] 24 звезды, MIT: https://github.com/Arize-ai/arize-claude-code-plugin

**W&B Weave (CoreWeave)**

- [мир] [вендор] Страница цен W&B переадресует на CoreWeave: Free — «$0/mo», 1 ГБ в месяц; Pro —
  «Starts at $60/month», 1,5 ГБ, сверх — $0,10 за МБ; Enterprise — по договору:
  https://coreweave.com/forge-pricing
- [мир] [вендор] Плагин Claude Code: «every turn, tool call, and subagent»; данные — «user
  prompts, Claude responses, tool inputs and outputs … shell commands and output»; назначение —
  «debug sessions, audit tool usage, and monitor cost and latency across runs»:
  https://docs.coreweave.com/weave/guides/integrations/claude_code
- [мир] [вендор] «Observability and continuous improvement for production agents»; «Weave provides
  end-to-end observability to monitor agent behavior, out-of-the-box signals to surface failure
  modes, and a flexible evaluation framework»; сессии и ходы плюс аналитика помогают «pinpoint root
  cases for failure modes». Кодовые агенты вроде Claude Code через навыки W&B и MCP могут «read
  live production data, run evaluations, and execute automatic iteration loops» — это рецепт для
  разработчика агента, а не готовые советы продукта: https://wandb.ai/site/weave/

**Braintrust**

- [мир] [вендор] Starter — $0 (1 ГБ данных, 10 тыс. оценок, 14 дней); Pro — «$249 / month»;
  Enterprise — по договору; ИИ-помощник Loop — «Braintrust's built-in AI agent that can run
  evaluations, generate test cases, and iterate on prompts», только Pro и Enterprise:
  https://www.braintrust.dev/pricing
- [мир] [вендор] Трассировка Claude Code: «Turn spans with prompts, final responses, and the
  permission mode», «Model call spans with prompts, completions, token metrics, and errors»,
  «Tool spans with inputs, outputs, approval state»; в OpenTelemetry-варианте — «time to first
  token»: https://www.braintrust.dev/docs/integrations/developer-tools/claude-code
- [мир] [вендор] Loop по результатам эксперимента: «Loop will provide specific, actionable
  suggestions based on where the agent failed», в примере — раздел «Recommendations» с правками
  системного промпта: https://www.braintrust.dev/docs/cookbook/recipes/Loop
- [мир] [СМИ] Раунд $80 млн при оценке $800 млн (17.02.2026); клиенты — Notion, Replit,
  Cloudflare, Ramp, Dropbox; трассы собирают «prompts, tool calls, retrieved context and metadata
  on latency and cost»:
  https://siliconangle.com/2026/02/17/braintrust-lands-80m-series-b-funding-round-become-observability-layer-ai/

**Opik (Comet)**

- [мир] [вендор] Open source — бесплатно; Free Cloud — $0, до 10 человек, 25 тыс. спанов, 60
  дней; Pro Cloud — «$19 Per month», до 50 человек, 100 тыс. спанов; Enterprise — по договору:
  https://www.comet.com/site/pricing/
- [мир] [вендор] Claude Code: каждый ход — трасса, вызовы инструментов — спаны, «the user prompt
  is the trace input»; вкладка Threads собирает ходы одной сессии:
  https://www.comet.com/docs/opik/integrations/claude-code
- [мир] [вендор] Diagnostics: «scans your project's traces on a schedule, groups repeated failures
  into a single issue, and surfaces a root cause, a suggested fix»; ищет «tool-call loops,
  malformed API calls, hallucinated outputs, or latency regressions»; «Scans run on your Ollie
  tokens»: https://www.comet.com/docs/opik/tracing/diagnostics
- [мир] [вендор] Помощник Ollie читает дерево спанов «including inputs, outputs, latencies» и
  предлагает изменение в виде diff: https://www.comet.com/docs/opik/tracing/debug-agents

**Datadog LLM Observability**

- [мир] [вендор] «Follow every request across prompts, retrieval steps, tool calls, and agent
  decisions»; «Monitor latency, token usage, retries, and errors at every step. Spot the slow or
  heavy calls»; «Catch hallucinations, prompt injection attempts, and PII exposure as they
  happen». Free — «Up to 40k LLM spans», 15 дней; Pro — «$160 per month», до 100 тыс. LLM-спанов;
  «An LLM span is a single call to an LLM provider. It's the only span we bill on»:
  https://www.datadoghq.com/products/ai/agent-observability/

#### 3. Командные панели для агентов-программистов (research/pixel-office.md, раздел 2)

**Dash0 AI Coding Insights**

- [мир] [вендор] Запуск 07.07.2026, для Claude Code и Cursor, «It gives engineering leaders the
  same visibility…»; плагин ловит «26 event types across 11 categories, including subagents, MCP
  tool calls, and permission requests»; можно «sort every session by cost or error count, and
  read the full conversation … every prompt, every tool call, every subagent, every denied
  permission»; «Sort by cost to find the sessions that ran in circles»; метрика качества — «How
  many attempts it takes to reach a useful result»; пробный период 14 дней:
  https://www.dash0.com/blog/introducing-ai-coding-insights-stop-guessing-what-your-coding-agents-deliver
- [мир] [вендор] Цена — «$10 per monitored developer per month» (сравнительная страница Dash0,
  19.08.2026): https://www.dash0.com/comparisons/claude-code-monitoring-tools

**Datadog Agent Console (preview)**

- [мир] [вендор] Preview с 09.06.2026; метрики — «total spend across coding agents, total active
  users, total sessions, and median time to merge». Раздел «Detect and fix common waste
  patterns»: «Agent Console surfaces patterns such as skipped checks, retry loops, and file
  rereads» (коммит без тестов, повтор одной и той же упавшей операции, лишние перечитывания
  файла), с оценкой, сколько расходов можно сэкономить; «Fix Library includes vetted
  remediations, such as a “Verify before git” PreToolUse hook». Цена не указана, есть пробный
  период Datadog: https://www.datadoghq.com/blog/datadog-agent-console/

**Amazon CloudWatch Coding Agent Insights**

- [мир] [вендор] Запуск 20.07.2026; «built on OpenTelemetry metrics emitted by your coding
  agents»; Claude Code, Codex, GitHub Copilot; вопросы — кому расширить доступ, где агенты
  ускоряют поставку, как распределить бюджеты токенов; «Standard CloudWatch OpenTelemetry metric
  ingestion pricing applies»:
  https://aws.amazon.com/about-aws/whats-new/2026/07/cloudwatch-coding-agent-insights/

**Jellyfish**

- [мир] [вендор] Статья Jellyfish (17.04.2026): «connects Claude Code usage to cycle time, PR
  throughput, and merge velocity at the team level»; сессии Claude Code привязываются к PR —
  «from a 21-day window before the PR merge and up to 2 days after»; цена не указана:
  https://jellyfish.co/library/claude-code-monitoring/

**Torii**

- [мир] [вендор] Статья Torii (12.06.2026, обновлена 19.08.2026), раздел о самом Torii: «Torii
  treats Claude Code as a governed asset before it shows up as an API line item»; платформа
  находит все аккаунты Anthropic и установки Claude Code по журналам SSO, OAuth, браузеру и
  финансовым данным; Torii AI Management Platform (запуск — май 2026) «breaks seat and token spend
  down per employee and per model, then forecasts overages»; находит пересечение подписок Claude
  Code, Copilot и Cursor; «This is the only entry here built for org-wide AI adoption and
  governance rather than per-session token math». Среди минусов: «Pricing reflects enterprise
  coverage, not entry-level point pricing». О ходе сессий агента в разделе о Torii ничего нет,
  поэтому все шесть ячеек — «не найдено»:
  https://www.toriihq.com/articles/five-claude-code-usage-dashboards-and-monitoring-tools
- [мир] [вендор] Во вступлении той же статьи фраза «Track Claude Code usage, costs, and tool
  activity across your organization by exporting telemetry data through OpenTelemetry (OTel)» —
  это пересказ документации Anthropic («per its docs»), а не описание Torii; к строке Torii она не
  относится: https://www.toriihq.com/articles/five-claude-code-usage-dashboards-and-monitoring-tools

**Omnara**

- [мир] [вендор] Self-host — «The full platform is free», Apache 2.0; машины Omnara — «$0.0414 per
  GiB of memory per hour online»; Enterprise — по договору: https://www.omnara.com/pricing
- [мир] [вендор] Приложение App Store: «Monitor progress, review diffs, and approve next steps
  from your phone so your coding agent never stalls»; «Works with Claude Code and OpenAI Codex
  sessions». Цена — Free; [счётчик] оценка 4,4 из 5 (36 оценок):
  https://apps.apple.com/app/id6748426727

#### 4. Визуализаторы и открытые панели (research/pixel-office.md, раздел 3)

Описания — из README самих проектов [вендор]; звёзды и форки — [счётчик] GitHub на 2026-09-30.

- [мир] Pixel Agents: персонажи анимируются по действиям агента; «Speech bubbles — visual
  indicators when an agent is waiting for input or awaiting permission»; персонажи «flag you
  visually when they're stuck waiting for input»; события — из хуков Claude Code или из
  JSONL-журналов; MIT; 9 463 звезды, 1 558 форков:
  https://github.com/pixel-agents-hq/pixel-agents
- [мир] Pixel Agents в VS Code Marketplace: 87 050 установок при последней проверке (счётчик живой,
  при первой проверке в тот же день было 87 045), оценка 4 из 5 (5 отзывов), Free:
  https://marketplace.visualstudio.com/items?itemName=pablodelucca.pixel-agents
- [мир] claude-office (paulrobello): «visualizes Claude Code operations»; «Visual State
  Indicators: Working, delegating, waiting states»; «Command Center … status columns (Needs-you,
  Working, Done, Ended)»; доска с «tool usage pie chart»; при токене Claude — «task summaries»
  вместо имён инструментов; MIT; 533 звезды: https://github.com/paulrobello/claude-office
- [мир] Claude-Office (W17ant): изометрический офис, хуки `PreToolUse`/`PostToolUse`, чат с
  Claude внутри офиса; MIT; 172 звезды: https://github.com/W17ant/Claude-Office
- [мир] agent-virtual-office (KbWen): Claude Code, Codex, Gemini CLI; «When one gets stuck you see
  why — 🧪 test run, 🔨 build, 📦 install, or just ❔ unknown — with a ↻ when the same thing keeps
  failing»; `PermissionDenied` ставит агенту статус blocked «permission-denied»; `StopFailure` —
  «api-rate-limit» или «api-auth-failed»; открытка-итог дня в PNG; MIT; 32 звезды:
  https://github.com/KbWen/agent-virtual-office
- [мир] PixelHQ (iOS, разработчик Chun-Wei Hsu): «PixelHQ transforms your Claude Code sessions
  into a real-time pixel art office. Every file read, every terminal command, every search —
  animated as tiny characters»; Free, встроенные покупки на странице не указаны, оценок
  недостаточно для показа: https://apps.apple.com/ph/app/pixelhq/id6758467298
- [мир] claude-code-hooks-multi-agent-observability (disler): 12 типов хуков; `UserPromptSubmit`
  показывает текст запроса; `PostToolUseFailure` — «Error details & interrupt status»;
  `PermissionRequest`, `Notification` — «User interactions»; лента событий и просмотр переписки;
  лицензия GitHub не распознана; 1 544 звезды:
  https://github.com/disler/claude-code-hooks-multi-agent-observability
- [мир] Claude-Code-Agent-Monitor (hoangsonww): Claude Code, Cursor, Codex; колонка Waiting —
  «sessions blocked on user input (permission prompts, end-of-turn…)»; колонки Error и Abandoned;
  извлекает ошибки API и длительности ходов (`TurnDuration`); правила оповещений, в том числе
  «stuck agent»; история последних запросов человека на карточке; MIT; 1 028 звёзд:
  https://github.com/hoangsonww/Claude-Code-Agent-Monitor
- [мир] agents-observe (simple10): живая лента хуков Claude Code и Codex, «full replay»; «you can
  see how agents behave over time, which tools they favor, and where they get stuck»; MIT; 688
  звёзд: https://github.com/simple10/agents-observe
- [мир] claude-usage (phuryn): читает локальные журналы Claude Code — «token counts, models,
  sessions, projects» — и строит графики и оценку стоимости; MIT; 2 240 звёзд:
  https://github.com/phuryn/claude-usage

#### 5. Другие найденные: инструменты для запросов у владельцев моделей и отдельные коучи

- [мир] [вендор] Anthropic prompt improver (14.10.2024): переписывает шаблон промпта — цепочка
  рассуждений, XML-примеры, «Rewrites the prompt to clarify structure»; в оценщике промптов
  пользователь ставит ответам модели оценку по 5-балльной шкале («ideal output») и может
  написать улучшателю, «what’s still not working»; «available to all users in the Anthropic
  Console»; цена не указана. Работает с шаблоном промпта и тестовыми ответами, а не с сессией
  агента, поэтому «Ошибки» — «нет», как и остальные элементы хода сессии:
  https://claude.com/blog/prompt-improver
- [мир] [вендор] OpenAI prompt optimizer: «you enter a prompt, and we optimize it according to
  current best practices»; учитывает разметку датасета — «Annotations (Good/Bad …)», текстовые
  критики и «Results from graders»; «OpenAI is deprecating the dataset-backed prompt optimizer»:
  Evals — только чтение с 31.10.2026, закрытие платформы 30.11.2026; цена не указана. Как и у
  Anthropic, это правка промпта по оценкам тестовых ответов, а не разбор сессии агента, поэтому
  «Ошибки» — «нет»: https://developers.openai.com/api/docs/guides/prompt-optimizer
- [мир] [вендор] PromptCoach (Slivaro GmbH): «turns everyday prompts into guided practice—so people
  understand what to improve, try again, and build capability that lasts»; обратная связь о
  качестве запроса; цены на странице нет: https://prompt-coach.pro/en

#### 6. Другие найденные: разбор сессий агентов-программистов (CLI, навыки, облака)

- [мир] [вендор] vibe-log: «See where you spent your time across Claude Code and Codex… Build
  better prompting habits»; «Used by 500+ developers»; «Both local and cloud versions are
  completely free»; облачный тариф «Indie Founders» — «Free Forever», до 5000 сессий в месяц;
  «Pattern Recognition» — «Identifies recurring issues blocking your flow»:
  https://vibe-log.dev/
- [мир] [вендор] vibe-log-cli: статусная строка Claude Code — «Your prompts are analyzed locally
  … to provide actionable guidance», на схеме README Claude SDK «analyzes prompt quality», затем «Generate score» и совет по каждому запросу; отчёты
  о продуктивности по сессиям Claude Code и Codex; MIT; [счётчик] 340 звёзд:
  https://github.com/vibe-log/vibe-log-cli
- [мир] [вендор] Пример отчёта vibe-log: время по проектам и сессиям, «Key Accomplishments»,
  «Overall Session Quality» 78/100, доли разработки, планирования, отладки; разделов об ошибках,
  потерях времени и советах на следующую сессию в примере нет:
  https://vibe-log.dev/example-daily-report
- [мир] [вендор] Sniffly (Chip Huyen): «Analyze Claude Code logs to help you use Claude Code
  better»; «Error breakdown» — «See where Claude Code makes mistakes»; «Message history analysis» — «Walk through all your instructions»; MIT; [счётчик] 1 273 звезды, последний пуш 08.08.2025:
  https://github.com/chiphuyen/sniffly
- [мир] [СМИ] Обзор Sniffly (17.07.2025): «Error distribution», «Interruption rate», «Tool
  usages», стоимость по проектам: https://aiengineerguide.com/blog/claude-code-analytics-sniffly/
- [мир] [вендор] Prompt Coach — навык Claude Code (hancengiz): читает журналы
  `~/.claude/projects/*.jsonl`; «Improve prompt quality», «Calculate time savings — Understand
  the cost of unclear prompts (time + iterations)», «Error & Recovery Analysis — Common errors and
  how long they take to fix», «Tool Usage Patterns», «Get actionable templates»; пример вывода в
  README (иллюстративный): «Needed clarification: 51 (35%)», «Total time lost to vague prompts:
  ~2.4 hours», «Apply these templates to your next 10 prompts»; [счётчик] 149 звёзд, лицензия
  GitHub не распознана: https://github.com/hancengiz/claude-code-prompt-coach-skill
- [мир] [вендор] agent-retro (giannimassi): запуск `/agent-retro` в конце сессии; «Friction
  analysis — identifies user corrections, redirects, and abandoned approaches, then traces each
  to a root cause»; «Tool result waste detection»; разбивка стоимости токенов; «Actionable
  proposals — specific edits to skills, rules, or config»; только Claude Code; MIT; [счётчик] 10
  звёзд: https://github.com/giannimassi/agent-retro
- [мир] [вендор] Пример ретро agent-retro: разделы «What Happened», «Tool Result Waste» («wasted
  dispatch ($0.38)»), «What Worked» («User correction respected immediately»), «What Didn't Work»
  с причинами, «Actions»:
  https://raw.githubusercontent.com/giannimassi/agent-retro/main/examples/sample-retro.md
- [мир] [вендор] retro (netresearch/retro-skill): `/retro` читает транскрипт сессии Claude Code;
  механический проход ищет 20 сигналов — «tool errors, retry clusters … tool-call inefficiency …
  user-correction phrases, prompt/prompt-sequence/tool-sequence repetition … wrong-tool choice,
  re-read-same-file, skipped verification … permission re-approval, repeated command shapes, and
  wait-loop polling»; LLM добавляет ещё 20 (галлюцинация, повторная ошибка и др.); выдаёт до 10
  предложений с адресом: CLAUDE.md, AGENTS.md, PR в навык, хук; значок лицензии README — «MIT
  AND CC-BY-SA-4.0»; [счётчик] 8 звёзд: https://github.com/netresearch/retro-skill
- [мир] [вендор] claude-retro-skill (robertantolin): «your assistant tells you where it went wrong
  today, suggests what it should learn»; разбор — «Attempted», «Corrected by you», «Rework»,
  таблица находок; не больше трёх изменений памяти, инструкций или автоматизации, только с
  согласия; MIT; [счётчик] 3 звезды: https://github.com/robertantolin/claude-retro-skill
- [мир] [вендор] session-retrospective (accidentalrebel): итог сессии — «Initial goal/problem»,
  «The journey (challenges and how they were solved)», «Mistakes made and lessons learned», «Key
  takeaways»; Claude разбирает «messages, tool uses, and corrections»; MIT по README;
  [счётчик] 13 звёзд: https://github.com/accidentalrebel/claude-skill-session-retrospective
- [мир] [вендор] claude-lessons-learned (aplaceforallmystuff): разбор инцидента в 7 фазах —
  хронология, «5 Whys», факторы, тип исправления; правило «Implement, Don't Recommend» — правка
  навыка, CLAUDE.md, хука; в примере хронология с действиями Claude и пользователя; MIT;
  [счётчик] 13 звёзд: https://github.com/aplaceforallmystuff/claude-lessons-learned
- [мир] [вендор] claude-reflect (BayramAnnakov): «When you correct Claude … it remembers forever»
  — хук ловит исправления, `/reflect` переносит их в CLAUDE.md; `/reflect-skills` ищет повторяющиеся
  задачи в истории и предлагает команды; MIT; [счётчик] 1 705 звёзд:
  https://github.com/BayramAnnakov/claude-reflect
- [мир] [вендор] claude-global-skills (BryceEWatson): `transcript-analysis` «proposes that
  project's CLAUDE.md candidates»; `global-review-loop` ищет «friction that recurs across projects,
  then propose global ~/.claude changes»; MIT; [счётчик] 0 звёзд:
  https://github.com/BryceEWatson/claude-global-skills
- [мир] [вендор] SpecStory Cloud Analytics: «Every session you sync — from Claude Code, Codex CLI,
  Antigravity CLI, Cursor, and more — feeds a single dashboard»; «Messages: total user↔agent
  exchanges in the window and the average per session»; «Spec Score, which grades the first prompt
  of each session» — оценка качества первого запроса с распределением оценок; «Analytics is
  available on Pro plans»: https://docs.specstory.com/cloud/analytics
- [мир] [вендор] Расширение SpecStory: «Save, export, search and share AI chat history»; облако
  собирает сессии Cursor, VS Code, Claude Code, Codex, Gemini; «Skills generation: review,
  approve, install, and uninstall reusable skills mined from your synced sessions» — с пометкой
  «(Pro)»; «Insights — a free client-aggregated view of how your agent work breaks down, plus a Pro
  analytics overview». [счётчик] 24 534 установки, 9 оценок, Free:
  https://marketplace.visualstudio.com/items?itemName=SpecStory.specstory-vscode
- [мир] [вендор] Entire: «Entire stores all your code, together with sessions, prompts, and tool
  calls»; «Every commit an agent makes becomes a checkpoint: the code change paired with the
  conversation behind it»; «Conversations are captured and linked to your git history»; CLI —
  «Open source · MIT licensed»; цен на сайте нет: https://entire.io/
- [мир] [вендор] Entire (10.02.2026): чекпоинт хранит «the full session context, including
  transcripts, prompts»; на старте — Claude Code и Gemini CLI; посевной раунд $60 млн при оценке
  $300 млн:
  https://entire.io/news/former-github-ceo-thomas-dohmke-raises-60-million-seed-round

#### 7. Другие найденные: платформы с ИИ-разбором трасс

- [мир] [вендор] Raindrop: «Follow every message and tool call. See exactly where a run went
  wrong»; среди находок — «Agent retry loops»; «Get to the root cause, with the original traces as
  evidence»; «From silent failures to a proven fix». Hobby — $0, 1 000 событий в месяц; Pro — $299
  в месяц плюс $0,003–0,002 за событие; Enterprise — по договору; клиенты — Vercel, Speak, Clay,
  Framer, AngelList, Tolan: https://www.raindrop.ai/
- [мир] [вендор] Готовые сигналы Raindrop: «User Frustration» — «user expressing frustration at the agent», «Task Failure» — «agent failing to complete its task», «Forgetting» и другие; сигнал —
  классификатор по описанию: https://www.raindrop.ai/docs/platform/signals/
- [мир] [вендор] Percival (Patronus AI): «detecting 20+ failure modes in agentic traces and
  suggesting optimizations»; интеграции — smolagents, Pydantic AI, OpenAI Agents SDK, LangGraph,
  crewAI; цены на странице нет: https://www.patronus.ai/percival
- [мир] [вендор] Цены Patronus: Developer — «$10 in free credits»; Enterprise — по договору;
  вызовы оценщиков — $10 и $20 за 1 000, пояснения — $10 за 1 000: https://www.patronus.ai/pricing
- [мир] [вендор] Galileo Insights Engine (10.07.2025): «analyzes your agent logs using advanced
  reasoning models for instant failure mode identification»; «Tool usage optimization: Identify
  inefficient tool selection», «Conversation flow analysis: Track intent changes and conversation
  drift», «Performance optimization: Surface latency bottlenecks»; «provides specific
  recommendations for improvement»; «available now for all Galileo users»:
  https://galileo.ai/blog/introducing-galileo-s-insights-engine-intelligence-that-adapts-to-your-agent
- [мир] [вендор] Цены Galileo: Free — $0, 5 000 трасс; Pro — $100/мес, 50 000 трасс, «Advanced
  analytics & insights»; Enterprise — по запросу: https://galileo.ai/pricing
- [мир] [вендор] Cisco объявил покупку Galileo 09.04.2026, «May 22, 2026 Update: We are pleased to
  have completed the acquisition»; Galileo усиливает Splunk Observability; сумма не раскрыта:
  https://blogs.cisco.com/news/cisco-announces-the-intent-to-acquire-galileo
- [мир] [вендор] Laminar: «Trace every Claude Code session with a plugin: each prompt becomes a
  trace with its LLM calls and tool calls, grouped as a Laminar session»; также Codex CLI,
  OpenCode, Pi: https://laminar.sh/docs/tracing/integrations/claude-code
- [мир] [вендор] Сигналы Laminar: промпт и JSON-схема по каждой трассе; готовый Failure Detector
  делит проблемы на «tool_error, api_error, logic_error, looping, wrong_tool, timeout, or other»:
  https://laminar.sh/docs/signals/quickstart
- [мир] [вендор] Цены Laminar: Free — $0 (1 ГБ, 7 дней, 1 место); Starter — $30/мес (3 ГБ); Pro —
  $150/мес (10 ГБ); Enterprise — по договору; в каждый тариф входят кредиты на сигналы:
  https://laminar.sh/pricing
- [мир] [вендор] Honeycomb для Claude Code: «token spend, tool failures, hook activity, session
  errors, and compaction triggers»; долгие и падающие сессии, блокировки на запросах разрешений и
  время ожидания; «you can ask the Honeycomb agent natural-language questions about specific
  sessions»: https://docs.honeycomb.io/integrations/mcp/use-cases
- [мир] [вендор] Цены Honeycomb: Free — до 20 млн событий в месяц; Pro — «Starting at $150 per
  month»; Enterprise — по договору: https://www.honeycomb.io/pricing
- [мир] [вендор] Maple (24.09.2026): «Each turn opens with the user's prompt, when Claude Code is
  set to export prompts»; «Each tool call counts once, with its arguments and result»; «A failed
  run marks its tool call as failed, with the error»; у вызова модели — «time to first token»:
  https://maple.dev/changelog/2026-09-24-claude-code-sessions/
- [мир] [вендор] Цены Maple: Startup — $39/мес, по 100 ГБ логов, трасс и метрик, дальше $0,30 за
  ГБ; Enterprise — от $2 000; бесплатный self-host под FSL-1.1: https://maple.dev/pricing/
- [мир] [вендор] PromptLayer: «Connect production traces to prompt versions, inspect failures, and
  track cost, latency, and token usage»; «Build, trace, and improve agent workflows with prompts,
  tool calls, evaluations, and logs»; клиенты — Accenture, DocuSign, Gorgias, NoRedInk:
  https://www.promptlayer.com/
- [мир] [вендор] Цены PromptLayer: Free — $0; Pro — $49/мес; Team — $500/мес; Enterprise — по
  договору: https://www.promptlayer.com/pricing
- [мир] [вендор] Docent (Transluce, некоммерческая лаборатория 501(c)(3)): «Ask any question about
  your agent, such as "where is it reward hacking?" or "why did it fail?"» — вопрос превращается в
  рубрику, затем «Docent then searches for agent behaviors that match your rubric» и объясняет,
  почему найденное подошло; есть графики по найденному поведению: https://transluce.org/docent
- [мир] [вендор] Docent открыт под Apache 2.0 (24.09.2025); «the hosted version remains available
  on our servers»;
  назначение — «explore large collections of transcripts for interesting or unwanted behaviors»:
  https://transluce.org/docent/blog/open-source

#### 8. Доработка: остальные продукты из раздела 1 research/pixel-office.md

В разделе 1 pixel-office.md (строки 64–69) опрос Stack Overflow называет инструменты наблюдения,
мониторинга и защиты агентов: Grafana + Prometheus, Sentry, Snyk, New Relic, LangSmith, Honeycomb,
Langfuse, Galileo; в сводке сделок (строки 52–58) — ещё Humanloop, Velvet, Statsig, Promptfoo.
LangSmith, Honeycomb, Langfuse, Galileo уже в таблице. Ниже — остальные; решения по Snyk,
Prometheus, Humanloop, Velvet и Statsig — в «Где искали».

**Sentry**

- [мир] [вендор] «Use AI observability in Sentry to trace and debug agent workflows and
  conversations. Monitor agent runs, tool calls, model interactions, token usage, and errors»;
  «Agent tracing automatically collects information about agent runs, tool calls, model
  interactions, and errors across your entire AI pipeline, from user interaction to final
  response. You can also replay past conversations»; вкладка Conversations — «replay a user's
  multi-turn interaction, inspect its transcript and timeline, and find where a response or tool
  call went wrong»; Traces — «investigate latency and errors in context»; LLM Calls — «compare
  models, prompts, token usage, cost»: https://docs.sentry.io/product/agents/
- [мир] [вендор] Цены: Developer — «Free $0 Limited to one user», «Error Monitoring and Tracing»;
  Team — «$26/mo When billed annually», «Seer: AI debugging agent (subscription required)»;
  Business — «$80/mo When billed annually»; Enterprise — по договору: https://sentry.io/pricing/
- [мир] Почему такие оценки: страница агентов показывает разговоры, вызовы, ошибки и задержки, но
  сам вывод о причине не описывает — отсюда «частично»; Seer назван на странице цен, но его
  работа с разговорами агентов на странице агентов не описана — советы «не найдено».

**New Relic**

- [мир] [вендор] «New Relic captures the full execution, every agent invocation, every tool call,
  every handoff, so you can understand what happened, where it slowed down, and where something
  went wrong»; фреймворки — LangGraph, Strands, AutoGen; «Pinpoint latency across individual agents
  and tools so you know exactly where time is being spent. Catch errors early by surfacing which
  agent or tool in the chain caused a failure»; «Error rate: The frequency at which a given agent or
  tool returns an error»; «Long-running spans are visually obvious from the waterfall width»:
  https://docs.newrelic.com/docs/ai-monitoring/explore-ai-data/view-ai-agents/
- [мир] [вендор] «When your AI assistant receives a prompt and returns a response, the agent
  captures metric and event data»; «Correlate negative or positive feedback about a response from
  your end users»; «Identify errors in specific prompt and response interactions»:
  https://docs.newrelic.com/docs/ai-monitoring/intro-to-ai-monitoring/
- [мир] [вендор] Цены: «100 GB of free data ingest per month and $0.40/GB ingested beyond»; Free —
  «One free full platform user»; Standard — «Limited to 5 full platform users»; цены пользователей
  по редакциям — по запросу: https://newrelic.com/pricing

**Grafana Cloud Agent Observability**

- [мир] [вендор] «Coding-agent integrations forward sessions from the coding agent you already use
  into Agent Observability. Each session shows up there as generations, tool calls, and metrics»;
  по умолчанию отправляются только «model, token usage, tool names, and timing. Prompts, responses,
  and tool I/O stay on your machine», в режиме full — ещё запросы и ответы; «Guards run synchronous
  checks on tool calls before they execute»:
  https://grafana.com/docs/grafana-cloud/machine-learning/ai-observability/guides/instrument-coding-agents/
- [мир] [вендор] Разговоры ищутся по «Error status», «Evaluation results», «Feedback ratings»;
  «Conversations display a summary showing the agent, model, token count, cost, duration, and any
  evaluation scores»; «Select the error badge in the metrics bar to jump directly to the first
  errored generation»; «Use trace drilldown to identify latency bottlenecks, understand tool call
  sequences, and diagnose timeout or error scenarios»:
  https://grafana.com/docs/grafana-cloud/observe-and-act/agent-observability/guides/conversations/
- [мир] [вендор] «Online evaluation lets you score your agents’ live production traffic
  automatically»; оценщики — «LLM judge scores responses against natural-language criteria», JSON
  schema, Regex, Heuristic; критерии задаёт пользователь:
  https://grafana.com/docs/grafana-cloud/observe-and-act/agent-observability/guides/evaluation/
- [мир] [вендор] Цены Agent Observability: Free — «Limited to 30k generations per month & 25M tokens
  per month for system-initiated usage (Evals & Guards)»; Pro — «Starts at $1.50 / 1k
  generations», «Starts at $2 / 1M tokens (for Evals & Guards)», «Platform fee of $19 per month»:
  https://grafana.com/pricing/
- [мир] Почему такие оценки: в pixel-office.md Grafana стоит в паре с Prometheus; строка дана по
  собственной документации Grafana Cloud Agent Observability. «Ошибки» — «частично»: ошибки
  показываются, а оценщики LLM judge с критериями пользователь настраивает сам.

**Invariant Explorer и Snyk**

- [мир] [вендор] Snyk купил Invariant Labs 24.06.2025; «Invariant Labs has built Guardrails, a
  transparent security layer at the LLM and agent level»:
  https://snyk.io/news/snyk-acquires-invariant-labs-to-accelerate-agentic-ai-security-innovation/
- [мир] [вендор] Продукты Invariant Labs: «Explorer» — «Inspect and observe agent behavior»,
  «Guardrails» — «Contextual security layer for AI agents», «MCP Scan»: https://invariantlabs.ai/
- [мир] [вендор] Адрес Explorer переадресует на GitHub: «A tool for visualizing and exploring agent
  traces»; «The hosted version of Invariant Explorer has been shut down in January 2026»;
  Apache-2.0; [счётчик] 63 звезды: https://explorer.invariantlabs.ai/
- [мир] [вендор] Сам Snyk (блог 23.03.2026): «Agent Guard (Private Preview) enforces policies in
  real time, monitoring agent behavior and blocking unsafe or unauthorized actions as they
  happen» — защита в реальном времени, функция в закрытом превью; разбора хода сессии на странице
  нет, поэтому строки Snyk в таблице нет: https://snyk.io/blog/introducing-agent-security/

**Promptfoo**

- [мир] [вендор] «Evaluations» — «Test and evaluate your prompts, models, and RAG pipelines»;
  «Automated red teaming for agents & RAGs»; «Guardrails» — «Real-time protection against jailbreaks»; «156 of the Fortune 500 use Promptfoo in their AI development lifecycle»:
  https://www.promptfoo.dev/
- [мир] [вендор] Community — «Free Forever», «Our open-source tool», «Red teaming (10k
  probes/month)»; Enterprise — «Custom», «Continuous monitoring»; раздел «Issue Tracking & Guided
  Remediation»: «Track remediation progress and get suggested steps for each issue»:
  https://www.promptfoo.dev/pricing/
- [мир] Почему такие оценки: Promptfoo оценивает запросы на тестах — «Постановка задачи» «да»;
  разбора реальных сессий агента на открытых страницах нет — «не найдено»; советы — шаги
  исправления уязвимостей, не выведенные из хода сессии, — «частично». О сделке с OpenAI из сводки
  pixel-office.md на открытых страницах Promptfoo ничего не сказано.

#### 9. Доработка: улучшатели запросов, найденные в поиске первого прохода

Описания — со страниц самих расширений в Chrome Web Store [вендор]; пользователи, оценки и
версии — [счётчик] магазина.

- [мир] Promptly: «Optimize, save & reuse AI prompts for ChatGPT, Claude, Gemini & more. Prompt
  library, one-click enhancer & conversation exporter»; «Promptly rewrites your input into a
  well-structured, context-rich prompt»; «Free community prompt library»; среди языков — русский;
  70,000 users, 4,8 (367 оценок), версия 0.6.0 от 31.07.2026:
  https://chromewebstore.google.com/detail/promptly-%E2%80%93-ai-prompt-enha/jjfoaldlbbcfgkhbfmadjjelphbgmngg?hl=en
- [мир] PromptJolt: «PromptJolt analyzes your draft and rewrites it into a clear, context-rich
  prompt»; «Free daily enhancements are included with every account»; «premium tier is available
  for power users who need higher daily limits»; 725 users, 4,6 (10), версия 0.2.0 от 10.07.2026:
  https://chromewebstore.google.com/detail/promptjolt-%E2%80%93-ai-prompt-en/egfkoabnngmnlkpofjihcpbilfbnldnb?hl=en
- [мир] Prompt Perfect: AI Prompt Helper: «Your prompt copilot with one-click rewrites, tailored
  feedback, and savable prompts»; «Tailored Feedback: Receive personalized suggestions to improve
  your prompt-writing skills»; «Opt for a paid plan for expertly rewritten prompts»; «Offers in-app
  purchases»; 10,000 users, 3,6 (35), версия 1.6.9 от 27.09.2026:
  https://chromewebstore.google.com/detail/prompt-perfect-ai-prompt/kigfbkddbfgbdbdekajodpggpkpfdjfp?hl=en
- [мир] Prompt Fixer: «Prompt Scoring & Feedback – Receive a detailed numeric score and
  recommendations to improve structure, tone, and results»; «Offers in-app purchases»; 130 users,
  4,0 (3), версия 2.0.4 от 21.07.2026:
  https://chromewebstore.google.com/detail/prompt-fixer/mehggppbjbmblkfgpjecjphonnplbahd?hl=en .
  Сайт разработчика (найден поиском 2026-10-01): «The free tier includes 3 prompts per day; Premium
  ($7/month) adds unlimited prompts, full templates, and unlimited history»; «Prompt Fixer is made by
  KAJ Analytics and is available on the Chrome Web Store»: https://kaj-prompt-fixer.kaj-analytics.com/
- [мир] Promptu: «Get 3 polished versions with one click»; «Start immediately with a limited number
  of free enhancements»; «Connect your own API key for unlimited use»; 9 users, 5,0 (2), версия
  1.3.4 от 23.04.2026:
  https://chromewebstore.google.com/detail/promptu/gaafidhicjnpkdpcacfgehiafmliajah?hl=en
- [мир] [вендор] Prompt Neat: «Turn rough prompts into clear, model-ready instructions for ChatGPT,
  Claude, Gemini, Cursor and Midjourney. Free. No sign-in»; «Makes assumptions explicit so you can
  correct them»; «Shows you exactly what changed, and why»; «no sign-in · prompts not stored · free
  buy us coffee»: https://promptneat.com/
- [мир] Почему такие оценки: все шесть работают с текстом запроса в поле ввода — «нет» по ходу
  сессии. У Promptly есть экспорт переписки, поэтому «Действия» и «Вмешательства» — «частично»
  (запись разговора без разбора). Советы — «частично»: переписывают текущий запрос.

#### 10. Доработка: разбор сессий агентов-программистов, найденный в поиске первого прохода

- [мир] [вендор] Mantra: «Mantra is a desktop app that turns your AI coding sessions into navigable,
  replayable timelines»; «At each turn, see the full state of every file, highlighted diffs, tool
  calls, and the file tree»; Claude Code, Codex, Gemini CLI, Cursor; [счётчик] 10 звёзд у
  репозитория выпусков: https://github.com/mantra-hq/mantra-releases
- [мир] [вендор] Документация Mantra (на китайском): «让 AI 编程「可回放、可复盘」的本地时光机» —
  локальная «машина времени», чтобы сессии ИИ-программирования можно было воспроизвести и
  разобрать; «核心功能永久免费 · 无需注册» — ядро бесплатно навсегда, без регистрации:
  https://docs.mantra.gonewx.com/
- [мир] [вендор] Цены Mantra: «Core features are $0 forever, no sign-up required»; Sync — $4/мес при
  оплате за год, $5 помесячно; Publish — $8 за сайт в месяц за год, $10 помесячно; Pioneer — $49
  разово, 1 000 мест; «Mantra is built by an independent developer. No investors, no ads, no
  tracking»: https://docs.mantra.gonewx.com/en/about/pricing.html . Китайская версия той же
  страницы добавляет Commercial — $50 за человека в год, покупка не обязательна:
  https://docs.mantra.gonewx.com/about/pricing.html
- [мир] [вендор] claude-insights (статья автора, 16.02.2026): «claude-insights is an open-source CLI
  tool that parses your /insight report HTML and generates production-ready output files» —
  «insights-todo.md» с задачами, «CLAUDE.md-additions.md» — «Ready-to-paste rules»,
  «.claude/settings-insights.json» — «Hook configurations», «.claude/skills/*.SKILL.md» — «Custom skill files» — «one per friction pattern»; MIT:
  https://dev.to/yahav10/i-built-a-cli-that-turns-claude-codes-insights-report-into-actionable-skills-rules-and-workflows-377
  ; [счётчик] 17 звёзд: https://github.com/yahav10/claude-insights . Сессии сам не разбирает —
  берёт находки отчёта `/insights` самого Claude Code; отсюда «Ошибки» — «частично».
- [мир] [вендор] insight-extractor в сборнике glebis/claude-skills (около 100 навыков, MIT): «Parse
  `/insights` output into trackable markdown action items»; [счётчик] 385 звёзд у сборника:
  https://github.com/glebis/claude-skills
- [мир] [вендор] claude-code-templates: «Claude Code Analytics» — «Monitor your AI-powered development sessions in real-time with live state detection and performance metrics»; «Conversation Monitor» — «Mobile-optimized interface to view Claude responses in real-time»; MIT; [счётчик] 32 241
  звезда: https://github.com/davila7/claude-code-templates . Документация добавляет «Token usage
  tracking», «Conversation analysis» без подробностей: https://docs.aitmpl.com/
- [мир] [вендор] Continuous-Claude-v3: «Session ends → … Daemon spawns headless Claude (Sonnet) →
  Analyzes thinking blocks from session → Extracts learnings to archival_memory → Next session
  recalls relevant learnings»; навык «braintrust-analyze: Session analysis, replay, and debugging
  failed sessions»; MIT; [счётчик] 3 943 звезды: https://github.com/parcadei/Continuous-Claude-v3
- [мир] [вендор] reflect (dstreefkerk, v1.0.0, MIT): «Reviews your current Claude Code session to
  identify mistakes, friction points, and unclear outputs, then proposes actionable improvements
  and audits installed skills for optimization opportunities»; ключевые слова — session-review,
  mistake-detection, friction-analysis; [счётчик] 5 звёзд по каталогу:
  https://www.claudepluginhub.com/plugins/dstreefkerk-reflect-plugins-reflect
- [мир] [вендор] reflect (shfc, v0.1.1): «Enables Claude Code to learn from your sessions and
  continuously improve its skills based on your corrections and preferences»; «/reflect Command —
  Analyze session and propose skill improvements based on learnings»; [счётчик] 16 звёзд по
  каталогу: https://www.claudepluginhub.com/plugins/shfc-reflect-plugins-reflect
- [мир] [вендор] Retrospective Process (FrancisVarga): «structured retrospectives to extract
  learnings from development sessions, turning experience into reusable rules, KG entries»;
  категории — «Mistakes, Good Decisions, Patterns, Debugging Insights, Architectural Decisions»;
  «After completing a session, run the retrospective to capture learnings and propose rules or KG
  updates»: https://skills.rest/skill/retrospective-process ; [счётчик] 1 звезда у репозитория:
  https://github.com/FrancisVarga/coconut-claude-code-plugins
- [мир] [вендор] claude-smart (ReflexioAI): «A self-improvement plugin for Claude Code, Codex, and
  OpenCode that turns interactions into durable skills they follow in future sessions»; «Every user
  turn, tool call, and assistant response is captured via lifecycle hooks and extracted into
  rules»; «hooks watch your turns, tool calls, and assistant replies, auto-flagging corrections»;
  «Records and optimizes the steps that worked so Claude can reuse them»; панель «for browsing
  session histories»; Apache-2.0; [счётчик] 781 звезда: https://github.com/ReflexioAI/claude-smart .
  Название встретилось во втором проходе — в блоке «Similar plugins» на странице reflect (shfc) —
  и открыто (см. границу поиска в «Где искали»).
- [мир] [вендор] Копия навыка Prompt Coach (hancengiz): те же Skill.md и файлы docs лежат в сборнике
  bear2u/my-skills (описание на корейском — «Claude Code 세션 로그 분석으로 프롬프트 품질 향상»);
  отдельной строкой не учтена: https://github.com/bear2u/my-skills . Каталог skills.rest
  показывает Prompt Coach под автором hancengiz: https://skills.rest/skill/prompt-coach

#### 11. Доработка: платформы с разбором трасс, найденные в поиске первого прохода

- [мир] [вендор] Maxim AI: «Visual trace view» — «See how agents interact step-by-step to spot and debug issues»; «Online evaluations» — «Continuous quality monitoring» — «Measure quality of real-world interactions at a granular level: from session to spans»; очереди ручной разметки «using either
  automated logic (e.g., 👎🏼 user feedback or low Faithfulness score) or based on manual filters»;
  оповещения по «latency, cost, and online evaluator scores»; «Sessions: Track entire multi-turn
  conversations from start to finish»: https://www.getmaxim.ai/products/agent-observability .
  Страница цен показывает только шлюз Bifrost той же компании: https://www.getmaxim.ai/pricing
- [мир] [вендор] Future AGI: «AI Agents hallucinate, fix it faster. Build self-improving agents.
  Catch what breaks. Know why. Fix it»; «Error Feed» — «Track, capture, and resolve errors from one place» с именованными ошибками («Incomplete Answer», «Repetitive Response» и др.); в примере
  разбора — «failed to diversify its reassurance approach, resulting in a repetitive loop»; оценки
  «Instruction Adherence», «Optimal Plan Execution»; пример совета — «Agent relies on general
  knowledge. Add retrieval step for KB articles»; open source, Apache 2.0. Примеры — демонстрация
  интерфейса на главной: https://futureagi.com/
- [мир] [вендор] Цены Future AGI: «Usage-based pricing across 6 dimensions. Generous free tiers on
  every product. Most teams pay nothing. Starting at $0 /month»; бесплатно — 50 ГБ трассировки, 2
  тыс. кредитов на оценки и др.; дальше — хранение от $2 за ГБ, ИИ-кредиты от $10 за 1 тыс.; «2,400+
  teams use Future AGI»: https://futureagi.com/pricing
- [мир] [вендор] Failproof AI: «see every run, find where agents fail, and ship a policy that stops
  it, enforced in realtime»; «every prompt, tool call and result from every agent, traced live and
  replayable step by step»; «failures cluster themselves into named modes like loops, hallucinated
  calls and drift»; политики — для петель «break the loop, summarize where it got to, start fresh»,
  для галлюцинаций «the agent called a tool or file that doesn't exist», для ухода от цели «the
  agent has wandered away from the original goal», для опасных действий — «ask a human first»;
  работает с «claude code and codex to cursor, copilot, gemini and more»; «5,235 developers» при первой проверке и «5,240 developers» при повторной 2026-10-01 (живой счётчик на главной):
  https://befailproof.ai/
- [мир] [вендор] Цены Failproof AI: «Free Forever + Open Source $0 forever» — «5,000 runs / month
  hard cap», «3 failure audits / month», «Single user, unlimited agents», «Open source MIT,
  self-hosted», «39 built-in policies», «All harnesses supported (Claude Code, Cursor, Codex, Gemini
  CLI, and more)»; Team — «$99 / month» (50 000 запусков, разбор сбоев раз в день, 5 пользователей);
  Scale — «$599 / month» («Auto policy authoring»); Enterprise — по договору:
  https://befailproof.ai/pricing
- [мир] [вендор] SigNoz для Claude Code: «Session & request activity», «Performance — monitor API
  latency, cache hit rates, and tool execution times», «Tool decisions — see accept/reject rates
  across Edit, Write, and other tools», «Errors & retries — detect API failures and retry
  exhaustion»; событие `claude_code.user_prompt` — текст запроса по умолчанию скрыт
  (`OTEL_LOG_USER_PROMPTS`): https://signoz.io/docs/claude-code-monitoring/
- [мир] [вендор] Цены SigNoz: Teams — «starts from $199 $49 /month», «including $49 of usage»;
  «Traces $0.30 /GB Logs $0.30 /GB Metrics $0.10 /mn samples»; самостоятельная установка
  (Community): https://signoz.io/pricing/

#### 12. Доработка: просмотр и разбор сессий агентов-программистов, найденные в запросах 2026-10-01

Описания — из README и страниц самих продуктов [вендор]; звёзды, форки, лицензии и даты последнего
пуша — [счётчик] GitHub (команда `gh api`, 2026-10-01). Список запросов, по выдаче которых найдены
продукты, — в «Где искали».

**AgentsView (kenn-io; приложение, CLI и MCP-сервер)**

- [мир] [вендор] AgentsView: «Local-first · MIT · Single Go binary · Desktop · Web · CLI · MCP ·
  SQLite / PostgreSQL / DuckDB / ClickHouse»; «AgentsView brings your AI coding sessions into one
  searchable archive. Browse recorded conversations from more than 60 agent formats, compare
  activity and costs, and reuse lessons from past work»; фоновый сервер «discovers the session
  directories behind more than 60 agent formats, including Claude Code, Codex, Cursor, Copilot, and
  Gemini, and syncs them into one local SQLite archive»: https://www.agentsview.io/ ;
  https://www.agentsview.io/guide/
- [мир] [вендор] Session Intelligence: «Use session health scores to find stalled sessions, repeated
  tool failures, and patterns across projects»; оценка — 100 минус штрафы: ошибочный исход 30,
  брошенная сессия 15, сбой инструмента 3 за каждый (не больше 30), повтор вызова 5 за каждый (не
  больше 25), «edit churn» 4 за каждый (не больше 20), серия из 3 и более сбоев подряд 10, сжатия
  контекста; повтор — «repeated identical tool calls when the same tool name and identical input are
  invoked 3 or more times in a row»; «Edit churn — counts files that were edited or written 3 or
  more times within a tight ordinal window, which usually signals rework»; вид Session Vitals
  «separates measured tool time from unattributed time»; «These signals are heuristics, not ground
  truth»: https://www.agentsview.io/docs/session-intelligence/
- [мир] [вендор] Quality: «every score, count, and recommendation on this page is computed directly
  from stored session data; the page does not call a model»; «The first section translates measured
  patterns into rule-based next actions» (примеры рекомендаций на странице не приведены):
  https://www.agentsview.io/docs/quality/ . Recall (экспериментальная функция): «helps you reuse
  facts, procedures, preferences, and warnings from past agent sessions»; Generated insights —
  «longer reports over an explicit session scope», их пишет модель по выбору пользователя:
  https://www.agentsview.io/docs/recall/
- [мир] [счётчик] GitHub kenn-io/agentsview на 2026-10-01: 6 034 звезды, 684 форка, MIT, последний
  пуш 2026-10-01: https://github.com/kenn-io/agentsview

**Claude Code Trace (delexw; просмотр и разбор через Jev)**

- [мир] [вендор] README: «Claude Code Trace is a Claude Code session log viewer and Jev-powered AI
  agent efficiency analyzer for local JSONL files stored in ~/.claude/projects/»; просмотр —
  «readable conversations with expandable tool calls, token counts, timestamps, MCP tool call
  detection, and live log tailing»; MIT; [счётчик] 373 звезды, 23 форка, последний пуш 2026-09-30:
  https://github.com/delexw/claude-code-trace
- [мир] [вендор] Разбор через Jev: «The resulting session efficiency dashboard helps identify
  repeated work, thrashing, excessive exploration, failed retries, effective recovery, useful
  subagent work, and inefficient token usage»; оценки — «progress, tool use, focus, exploration,
  recovery, and token efficiency with trace-linked findings»; перед отправкой «shows the exact
  redacted payload and requires confirmation before sending it»; «this open-source project is
  independent and is not an official TypeSafe AI integration»; советов в описании нет:
  https://github.com/delexw/claude-code-trace
- [мир] [вендор] Jev (TypeSafe AI): «Our first public model is Jev, available today in early
  access»; «Think of Jev as a frontier-intelligence function call: unstructured state in, typed
  probabilistic decisions out»; цена — «Input tokens: $0.042 / MTok ($42 per billion tokens). Output
  tokens: FREE (too cheap to meter)»: https://typesafe.ai/blog/introducing-system-one-models-and-jev

**Claude Trace Replay (harrylettering; просмотр трасс Claude Code)**

- [мир] [вендор] README: «Open-source trace viewer and observability workspace for Claude Code»;
  «Replay Claude Code .jsonl sessions, inspect agent flows and tool calls, spot token spikes,
  compare runs, and understand what actually happened»; Timeline — «tool calls, thoughts, diffs,
  file reads, terminal commands, and results, with filters for entry type, tool, time range and
  token range»; Agent Flow Trace — циклы «on real elapsed time»; Session Compare — «diff two runs
  across messages, tokens, tools, and models»: https://github.com/harrylettering/claude-trace-replay
- [мир] [вендор] в таблице модулей Retrospective — «AI retrospective and prompt-quality review,
  produced by your local Claude CLI»; «AI Retrospective: surface strengths, weaknesses, and
  next-step improvements by handing a compressed trace to your local Claude CLI»; в планах —
  «Surface failure, retry and repeat-command signals as findings rather than leaving them to be
  spotted by eye» (сбои и повторы пока ищет человек); хуки: «Failures are called out because nothing
  else reports them: a hook that exits non-zero is still logged as hook_success». [счётчик] 265
  звёзд, 26 форков, MIT, последний пуш 2026-09-16:
  https://github.com/harrylettering/claude-trace-replay

**Agent Sessions (jazzyalex; приложение для macOS)**

- [мир] [вендор] «Local-first macOS app to browse, search, analyze, and resume supported AI
  coding-agent session history across Codex, Claude Code, OpenCode, Cursor Agent, Antigravity,
  Hermes, OpenClaw, Copilot CLI, and more» (описание репозитория); README: «Search prompts,
  responses, tool calls, command output, errors, file paths, and supported image references across
  local agent histories»; «Session Info shows a session's API-equivalent price, token mix, model and
  thinking effort, and turn counts beside its transcript»; «role-less Cursor turn failures appear as
  visible errors»; [счётчик] 889 звёзд, 65 форков, MIT, последний пуш 2026-09-30:
  https://github.com/jazzyalex/agent-sessions . Сайт приложения: «Search Codex, Claude Code, Cursor
  and 13 other coding-agent histories on your Mac. Resume supported CLI sessions and track Codex and
  Claude quota burn»: https://jazzyalex.github.io/agent-sessions/

**Claude Code and Codex Assist (расширение VS Code, A. G. Software Technologies)**

- [мир] [вендор] «Chat history for Claude Code, Codex, OpenCode, Grok & Copilot — browse, search,
  diff & resume sessions; track usage, cost & quota. MCP server shares context across your AI CLIs.
  Free, with optional Pro»; «The File Timeline is git blame for AI edits: pick a file, see every
  session and prompt that touched it, and open the exact diff»; «Rendered transcript with per-turn
  Turn changes cards, a context-window graph, cache hit rate, and cost»; «Free for everyday use. A
  few advanced features require Pro»; в Pro — ветвление разговора, конвертер форматов Claude и
  Codex, архив сессий, экспорт в Markdown, массовые действия, часть инструментов MCP; «Proprietary —
  see LICENSE for terms. The extension is free to use but the source code is not open source».
  [счётчик] 11 151 установка, 13 оценок:
  https://marketplace.visualstudio.com/items?itemName=agsoft.claude-history-viewer

**Session Analyzer (Yijia-Zhou; просмотр истории сессий)**

- [мир] [вендор] «Local session history viewer for Codex, Claude Code, and DeepSeek Harness. Review
  agent work, inspect tool calls and results, and search sessions by project»; «Session Analyzer
  keeps messages and tool activity readable together, with commands, file changes, and results you
  can open in context»; в примере агент «encounters a failed test, applies a follow-up patch, and
  reruns the test», а упавшую команду можно раскрыть в ленте Timeline. [счётчик] 0 звёзд,
  BSD-3-Clause, последний пуш 2026-09-30: https://github.com/Yijia-Zhou/session-analyzer

**Claude Code Transcript Viewer (ly4096x)**

- [мир] [вендор] «A zero-dependency web UI that renders Claude Code .jsonl session transcripts with
  Claude Code's own look and feel»; «Prompt sidebar — indexes only the prompts you typed»; «Rich
  tool rendering — full (multi-line) Bash commands, Read/Glob/Grep, and green/red unified diffs for
  Edit/Write». [счётчик] 1 звезда, GPL-3.0, последний пуш 2026-09-15:
  https://github.com/ly4096x/ClaudeCodeTranscriptViewer

**JsonlViewer (sourceit)**

- [мир] [вендор] «Replays Claude Code session transcripts (the .jsonl files under
  ~/.claude/projects) turn by turn: prompts, replies, tool calls and results, thinking, compactions,
  and questions asked with AskUserQuestion drawn the way the terminal showed them»; в списке ходов
  «Significant only keeps the prompts that set a rule, a brief, a direction or a decision, plus the
  heavy turns». [счётчик] 1 звезда, последний пуш 2026-09-30:
  https://github.com/sourceit/jsonlViewer

**agent-replay (репозиторий claude-replay, tanghong123)**

- [мир] [вендор] «An interactive, read-only viewer for AI coding-agent session transcripts»; читает
  журналы и Claude Code, и Codex («auto-detecting each»); «renders a session the way the agent does
  (assistant text, thinking, tool calls, +/- diffs, markdown, syntect-highlighted code)». [счётчик]
  2 звезды, MIT, последний пуш 2026-10-01: https://github.com/tanghong123/claude-replay

**Claude Session Viewer (xlvlxn; страница GitHub Pages)**

- [мир] [вендор] «A static web page that renders a Claude Code session .jsonl file as a chat
  transcript — similar to the UI in the Claude app / Claude desktop»; «Drop your .jsonl file into
  the page. Everything runs client-side; the file never leaves your browser»; «User / assistant
  turns rendered in a Claude-app style chat feed»; вызовы инструментов показаны с разметкой по виду
  инструмента (Write, Edit, Read, Bash и др.). [счётчик] 0 звёзд, последний пуш 2026-04-19:
  https://github.com/xlvlxn/claude-session-viewer

**claude-code-transcripts (Simon Willison)**

- [мир] [вендор] «Convert Claude Code session files (JSON or JSONL) to clean, mobile-friendly HTML
  pages with pagination»; в выходных файлах — «index.html - an index page with a timeline of prompts
  and commits»; предупреждение README: команды `web` сейчас сломаны из-за изменений
  недокументированных API. [счётчик] 1 694 звезды, 206 форков, Apache-2.0, последний пуш 2026-02-12:
  https://github.com/simonw/claude-code-transcripts

**Claude Viewer (maxturazzini; просмотр и аналитика для нескольких пользователей)**

- [мир] [вендор] «Claude Viewer is an admin tool web application for visualizing Claude Code
  conversation history from all Windows/macOS users on a single machine. It provides rich analytics,
  full conversation details, token usage tracking, and model/tool insights»; «Full Conversation
  Viewer - View complete user/assistant message threads in modal»; «Tool Analytics - Top 10
  most-used tools»; есть MCP-сервер с запросами к данным разговоров. [счётчик] 0 звёзд, MIT,
  последний пуш 2026-02-22: https://github.com/maxturazzini/claude-viewer

**ah — Agent History (nihen; командная утилита)**

- [мир] [вендор] «Agent History — search and browse AI coding agent sessions (Claude, Codex, Gemini,
  Copilot, Cursor) from a single CLI»; поиск — «user and assistant messages plus tool calls
  (commands, arguments, file paths) and tool output»; есть режим «Search only user prompts».
  [счётчик] 3 звезды, MIT, последний пуш 2026-09-28: https://github.com/nihen/ah

#### 13. Доработка: панели для парка агентов — агенты-программисты и агенты OpenClaw

Описания — из README и страниц самих продуктов [вендор]; звёзды и лицензии — [счётчик] GitHub на
2026-10-01. Панели OpenClaw управляют задачами и состоянием агентов; в таблицу они входят по пункту
(1) правила включения: показывают ход работы агента.

**AI Agent Session Center (coding-by-feng; панель с 3D-роботами)**

- [мир] [вендор] «Monitor, drive, queue, and resume every Claude Code and Codex session from one
  localhost dashboard — each rendered as a live 3D robot you can click into»; статусы сессии: Idle,
  Prompting («You just sent a prompt»), Waiting («Agent finished, your turn»), Approval («Tool
  blocked, needs yes/no»), Input («Waiting for your answer»); во введении README — вопросы «Which
  one is stuck waiting for approval? Which one finished and needs your next prompt?»; есть очередь
  запросов к сессиям. [счётчик] 82 звезды, 9 форков, MIT, последний пуш 2026-10-01:
  https://github.com/coding-by-feng/ai-agent-session-center

**AgentPulse (jstuart0; самостоятельно размещаемая панель)**

- [мир] [вендор] «Self-hosted command center for AI coding agents (Claude Code, Codex CLI, GitHub
  Copilot CLI)»; карточка сессии — «a chat-style timeline with your prompts as blue bubbles and tool
  usage inline»; «Session intelligence classifier -- deterministic heuristic flags sessions as
  healthy / blocked / stuck / risky / complete_candidate with a one-sentence reason»; «Inbox --
  single /inbox view that aggregates every open approval (HITL, Ask-driven actions, alert-rule
  firings), stuck / risky session warnings, and recent failures»; правила оповещений —
  `status_failed`, `status_stuck`, `no_activity_minutes`; необязательный слой AI Labs «watches
  sessions, classifies health, proposes next steps with human-in-the-loop approval». [счётчик] 18
  звёзд, 7 форков, MIT, последний пуш 2026-10-01: https://github.com/jstuart0/agentpulse

**burnboard (sondeinc; расход токенов и аудит потерь)**

- [мир] [вендор] «A live and historical monitor for AI coding agent usage — OpenAI Codex CLI and
  Claude Code, side by side»; История — «every past session, sortable, with prompt, model, effort,
  git branch, billed tokens and command count»; раздел Economy — «a token-waste audit: which
  commands dump the most output back into context, truncation hits, polling/wait round-trips, and
  commands re-run unchanged — plus ranked findings on what to change, grounded in the tooling you
  actually have»; необязательный режим «Dive deeper» запускает агента, чтобы разобрать
  доказательства находки (отключается `--no-ai`). [счётчик] 0 звёзд, MIT, последний пуш 2026-09-24:
  https://github.com/sondeinc/burnboard

**Agent Dashboard (dustinblack)**

- [мир] [вендор] «A multi-host orchestration platform for AI coding agents — spawn, monitor, and
  interact with Claude Code, Pi, Antigravity, OpenCode, Codex, and Bash sessions across multiple
  machines from a single web dashboard»; «Agent status — Working, idle, and permission-waiting
  states»; «Session history replay — Close and re-attach to a terminal window; recent output is
  automatically replayed»; расход — «Real session cost from Claude Code's OTLP metrics». [счётчик]
  12 звёзд, Apache-2.0, последний пуш 2026-09-29: https://github.com/dustinblack/agent-dashboard

**Agent View (Frayo44; терминальный менеджер сессий)**

- [мир] [вендор] «A lightweight terminal-based agent orchestrator for managing multiple AI coding
  assistants»; «monitor agent status in real-time, get notifications when agents finish or need
  input»; статусы: Waiting («Needs your input»), Idle («Ready for commands»), Error («Something went
  wrong»). [счётчик] 368 звёзд, 44 форка, MIT, последний пуш 2026-07-27:
  https://github.com/Frayo44/agent-view

**AgentCenter (панель для агентов OpenClaw)**

- [мир] [вендор] «Mission Control dashboard for your OpenClaw agents. Assign tasks, monitor
  progress, review deliverables, and coordinate your AI team — all from one place»; «Agent Status
  Grid — See which agents are online, working, idle, or blocked»; «Live Activity Feed — A real-time
  stream of agent actions: files edited, tasks moved, deliverables submitted, messages sent»; на
  карточке задачи — исполнитель, приоритет и «last update»; чат по задаче («Communicate with agents
  in task threads»); проверка результата — «The lead agent verifies deliverables»:
  https://www.agentcenter.cloud/ai-agent-dashboard ; https://www.agentcenter.cloud/
- [мир] [вендор] Блог AgentCenter (05.07.2026), сравнение с Prometheus: в таблице сравнения у
  AgentCenter: статус агента в реальном времени — «Built-in (online, working, idle, blocked)»,
  оповещения — «Yes, built-in notifications», стоимость по задачам — «Yes, per-task attribution»:
  https://www.agentcenter.cloud/blogs/agentcenter-vs-prometheus . Цены: «all monthly plans include a
  7-day free trial»; «Starter drops to $140/yr, Pro to $290/yr, and Scale to $790/yr»; «AgentCenter
  is currently designed for a single user managing their AI agents»; «Your own AI provider
  subscription is also required»; для своего сервера — «Same features, your infrastructure» от $99 в
  месяц: https://www.agentcenter.cloud/pricing

**OpenClawHQ — Mission Control (платный сервис для агентов OpenClaw)**

- [мир] [вендор] Блог OpenClawHQ: «OpenClaw Mission Control is a centralized operations dashboard
  that lets you orchestrate, monitor, and manage all your OpenClaw agents in one place»; показатели
  — «Messages processed per agent», «Response time per agent (average and 95th percentile)», «Queue
  depth», «Error rate and error type breakdown»; «The trace view shows exactly which step failed and
  why. Failure explanations are presented in plain English — not raw stack traces»; цена —
  «$49/month flat with unlimited usage», «Mission Control is a core feature of OpenClawHQ, included
  at no extra cost in the $49/month flat plan»: https://openclawhq.io/blog/openclaw-mission-control

**TenacitOS (carlosazaustre; панель OpenClaw с 3D-офисом)**

- [мир] [вендор] «A real-time dashboard and control center for OpenClaw AI agent instances»; «Agent
  Dashboard — All agents, their sessions, token usage, model, and activity status»; «Activity Feed —
  Real-time log of agent actions with heatmap and charts»; «Office 3D — Interactive 3D office with
  one desk per agent (React Three Fiber)». [счётчик] 1 254 звезды, 239 форков, MIT, последний пуш
  2026-02-21: https://github.com/carlosazaustre/tenacitOS

**Mission Control (manish-raana; панель задач агентов OpenClaw)**

- [мир] [вендор] «Mission Control is a simple, real-time web UI for monitoring agents and task
  workflows»; в таблице возможностей: Prompt Capture — «User prompts become task titles and
  descriptions», Duration Tracking — «Shows how long each agent run took»; при ошибке задача уходит
  в колонку Review «with error details». [счётчик] 272 звезды, 54 форка, Apache-2.0, последний пуш
  2026-02-09: https://github.com/manish-raana/openclaw-mission-control

**Mission Control (navjotdhanawat; панель задач агентов OpenClaw)**

- [мир] [вендор] «An open-source, real-time command-center dashboard for OpenClaw»; «Task cards show
  assigned agent, priority badge, and time elapsed»; «Real-time agent status (Online / Offline /
  Busy)»; «Real-time activity feed with color-coded entries» с отметками времени. [счётчик] 34
  звезды, 14 форков, последний пуш 2026-02-21:
  https://github.com/navjotdhanawat/openclaw-mission-control

**Mission Control (Jzineldin; панель для macOS)**

- [мир] [вендор] «Monitor your agent's activity, manage cron jobs, discover opportunities, chat in
  real-time, and keep costs under control»; страницы — Dashboard («Agent status, quick actions
  (email/calendar/heartbeat), activity feed, channel status, token counter») и Conversations
  («Browse all agent sessions with filters, view history, continue conversations»). [счётчик] 67
  звёзд, 9 форков, последний пуш 2026-04-26: https://github.com/Jzineldin/mission-control

**ClawController (mdonan90; панель агентов OpenClaw)**

- [мир] [вендор] «ClawController gives you visibility into what your OpenClaw agents are doing,
  assigns them structured work, and tracks their progress»; в таблице возможностей Agent Status —
  «See which OpenClaw agents are online, working, or idle»; на сайте — «activity logging for audit
  trails»: https://github.com/mdonan90/ClawController ; https://www.clawcontroller.com/ . [счётчик]
  64 звезды, 8 форков, MIT, последний пуш 2026-04-29.

**AI Beacon (manusa; панель сессий кодовых агентов на нескольких машинах)**

- [мир] [вендор] README: «Watch every coding agent on every machine — and step in the moment one
  needs you»; «Catch the moment an agent needs you. Permission prompts, idle sessions, finished runs
  — paged to you instead of buried across terminals you forgot to check»; «Status detection —
  working / idle / awaiting permission, surfaced as the session state»; «Real-time multi-machine
  dashboard — model, context, cost, branch, PR status per session»; поддержаны Claude Code и
  OpenCode. [счётчик] 37 звёзд, Apache-2.0, последний пуш 2026-09-30:
  https://github.com/manusa/ai-beacon . Найден через статью автора о том, как он собрал панель для
  агентов-программистов: https://blog.marcnuri.com/ai-coding-agent-dashboard

#### 14. Доработка: навыки и плагины для разбора сессий Claude Code, найденные в запросах 2026-10-01

Описания — из текста SKILL.md и README, открытых 2026-10-01 [вендор]; звёзды и лицензии — [счётчик]
GitHub. Это инструкции для самой модели: разбор делает модель по описанному порядку, готового отчёта
«из коробки» нет.

**session-audit (навык в наборе ai-builder-team, плагин munawar)**

- [мир] [вендор] SKILL.md: «Audit a Claude Code session by its ID. Parses the JSONL transcript to
  show conversation flow, tool usage stats, errors, retries, and subagent activity»; скрипты stats,
  errors, conversation и др.; разбор («lessons-learned audit») ищет «Points where the user had to
  clarify direction or redirect the agent», «Places where the agent floundered, retried, or took a
  wrong path before finding the right approach», «Tool/script errors and how they were resolved (or
  not)»; итог — «concise, actionable lessons — generic rules that could be baked into the relevant
  skill, agent, or system prompt so future sessions arrive at the right outcome more directly»; «If
  no meaningful lessons exist, say so — do not fabricate improvements». [счётчик] 2 звезды у
  репозитория, последний пуш 2026-04-17:
  https://raw.githubusercontent.com/ai-builder-team/ai-builder-plugin-marketplace/6013afd952cd663eb62babd113ae6ece974001c4/plugins/munawar/skills/session-audit/SKILL.md
  ; карточка каталога: https://mcpmarket.com/tools/skills/claude-session-auditor

**analyze-sessions (навык в наборе aoshimash/skills)**

- [мир] [вендор] SKILL.md: «Analyze Claude Code's built-in conversation history to detect recurring
  patterns in skill executions and propose concrete improvements to skill definitions and
  settings.json configuration»; шаблоны: Rejection («User explicitly rejects a proposal or asks to
  change something»), Retry («A step fails and must be re-done»), Friction, Abandonment, Permission
  Friction («Repeated tool permission prompts slow down the workflow»), Hook Opportunity; для
  каждого — «Proposed fix»: правка SKILL.md, добавление инструмента в `permissions.allow`, «a
  specific hook configuration with the event type and command»; шаблон считается при повторе в 2 и
  более сессиях. Охват узкий: ищет сессии, где вызывались навыки именно этого набора (метка
  `aoshimash-skills:`), не больше 20 последних за 30 дней. [счётчик] 1 звезда, MIT, последний пуш
  2026-09-05:
  https://raw.githubusercontent.com/aoshimash/skills/f5117316e7ff07cfba1f69541806220916a82590/plugins/aoshimash-skills/skills/analyze-sessions/SKILL.md
  ; карточка каталога: https://mcpmarket.com/tools/skills/claude-code-session-analyzer

**session-analysis (Git-Fg/meta-plugin-manager; по карточке каталога skills.lc)**

- [мир] [вендор] Карточка каталога skills.lc: «Analyze session transcripts for patterns, mistakes,
  and improvements. Use when reviewing past work, identifying recurring issues, or summarizing
  completed sessions. Includes transcript parsing, pattern detection, improvement suggestions, and
  metrics extraction. Not for live session work»; в тексте SKILL.md на карточке — шаблоны (Error
  loops — «Same error repeated»; Iteration — «Multiple attempts at same goal»; «Tool chaining»;
  «Context switching»), категории ошибок («Skill gap», «Context miss», «Over-engineering», «Tool
  misuse», «Validation skip»), для каждой — причина и «How to prevent it», в отчёте —
  «Recommendations»: «Skill to invoke», «Rule to add». Репозиторий
  https://github.com/Git-Fg/meta-plugin-manager 2026-10-01 отвечает 404, поэтому описание взято
  только с карточки:
  https://skills.lc/Git-Fg/meta-plugin-manager/git-fg-meta-plugin-manager-claude-skills-session-analysis-skill-md

**session-analysis (набор outfitter-dev/outfitter, плагин fieldguides)**

- [мир] [вендор] SKILL.md: «Signal extraction → pattern detection → behavioral insights»; таксономия
  сигналов — успех (похвала, продолжение, принятие), «Frustration» (Correction: «No, I meant...»,
  Reversion: «Go back», Repetition: «Same request 2+ times», Explicit), рабочий процесс (Tool Chain
  — «Recurring tool usage patterns (Read → Edit → Bash)») и просьбы пользователя (запреты,
  требования, предпочтения); у каждого сигнала уровень уверенности; в отчёте у шаблона поле
  «recommendation»: «actionable next step» и список «action_items». [счётчик] 6 звёзд у репозитория,
  последний пуш 2026-09-30:
  https://raw.githubusercontent.com/outfitter-dev/outfitter/6901aaff7175d890ec311f992d4f9b9e5d8c1f64/plugins/fieldguides/skills/session-analysis/SKILL.md
  ; карточка каталога: https://mcpmarket.com/tools/skills/conversation-session-analysis

**ConKeeper — context-keeper (swannysec; навыки memory-reflect и memory-insights)**

- [мир] [вендор] README: «A file-based agent memory system for AI coding assistants that provides
  structured context management using plain Markdown files»; «Correction detection - Real-time
  detection of user corrections and friction signals»; «Session retrospection - After Action Review
  workflow via /memory-reflect»; «Facets integration - Claude Code session analytics for friction
  and satisfaction trends»; «memory-reflect - Session retrospection and improvement analysis»,
  «memory-insights - Session friction trends and success pattern analysis». [счётчик] 3 звезды,
  последний пуш 2026-08-10: https://github.com/swannysec/context-keeper
- [мир] [вендор] Карточка memory-insights на skills.rest: «read-only analysis of per-session facets
  data to surface friction patterns and satisfaction signals»; «quick dashboards describing outcome
  distributions, top friction types, and correlation with goals»; данные берутся из каталога «~/.claude/usage-data/facets/» — по карточке, «per-session analytics»:
  https://skills.rest/skill/memory-insights

**my-insights (навык в dotfiles yulonglin; разбор через Gemini)**

- [мир] [вендор] SKILL.md: «Run deep analytics across all Claude Code sessions (not just the last
  6)»; «Analyzes each session via Gemini (goal categories, outcomes, friction, etc.)»; «Generates an
  HTML report with charts and per-project breakdowns». Что именно входит в «friction», в тексте
  навыка не сказано. [счётчик] 13 звёзд у репозитория dotfiles, последний пуш 2026-10-01:
  https://raw.githubusercontent.com/yulonglin/dotfiles/899e27452c37d7c6d13ced1be5fba68f022e132c/claude/skills/.migrated/my-insights/SKILL.md
  ; карточка каталога: https://mcpmarket.com/tools/skills/claude-code-usage-insights

#### 15. Доработка: оценка запросов — расширения, сайты и пользовательские GPT, найденные в запросах 2026-10-01

Описания — со страниц самих продуктов [вендор]; установки и оценки магазинов — [счётчик]. Все
работают с текстом запроса (или файла правил), хода сессии не видят.

**MetaPrompt (расширение Chrome, justgoextension)**

- [мир] [вендор] «Transform unclear questions into expert prompts. Get better AI responses from
  ChatGPT and Claude with one click»; «Free Plan — 20 monthly prompt enhancements»; «MetaPrompt Pro
  ($5.99/month)» с «5000 monthly prompt enhancements» и «Access to larger, more powerful models for
  even better results»; «Offers in-app purchases». [счётчик] 100,000 users, 4,7 (107 оценок), версия
  1.4 от 09.02.2026:
  https://chromewebstore.google.com/detail/metaprompt-ai-prompt-engi/glkfhecdpcmaclfkhkibmoijipnnjkbf?hl=en

**Prompt Reviewer (расширение VS Code, Musawir Hussain)**

- [мир] [вендор] «AI Prompt Quality Analyzer — reviews, scores, and improves your prompts before
  sending them to AI models»; «Prompt Reviewer works like Grammarly — but for AI prompts. It scores
  your prompt from 0–100, detects missing elements, lints for common mistakes, and generates an
  improved version». [счётчик] 26 установок, оценок нет, Free:
  https://marketplace.visualstudio.com/items?itemName=MusawirHussain.prompt-reviewer

**AI Prompt Checker (веб-студия Parix; бесплатный инструмент на сайте)**

- [мир] [вендор] «Paste your AI prompt below and get an instant quality score with actionable
  suggestions to make it better»; «100% private — runs in your browser»; «No sign-up required»;
  страница стоит в разделе «Free AI Tools» сайта студии разработки Parix:
  https://parix.ai/free-ai-tools/ai-prompt-checker/

**Prompt Analyzer (PromptPrepare)**

- [мир] [вендор] «Paste any AI prompt and get an instant structural analysis using the CRISP
  framework — score your context, role, instructions, specifics, and purpose, then get an optimized
  rewrite in seconds»; пометки на странице — «Free Tool», «No Signup Required», «84,000+ Analyzed»
  (счётчик самого сайта): https://promptprepare.com/tools/prompt-analyzer

**Prompt Evaluator и менеджер запросов SpacePrompts**

- [мир] [вендор] «Rate and score your AI prompts instantly. Get detailed feedback on how to improve
  prompt quality and get better AI responses»; оценка «out of 10 with specific feedback on what to
  improve»; «Is the AI prompt evaluator tool free? Yes. There's a shared daily limit of 100
  evaluations across all users, which resets each day»:
  https://www.spaceprompts.com/ai-tools/prompt-evaluator
- [мир] [вендор] Тарифы менеджера запросов: Free — «3 free AI prompt enhancements/day»; Pro — «$ 5
  /month», «$60 billed annually», «300 AI prompt enhancements/month»; Team — «$ 9 /month», «$108
  billed annually», «Invite up to 5 members»: https://www.spaceprompts.com/pricing

**Prompt Coach (Peak15 AI; coach.p15.ai)**

- [мир] [вендор] «Paste a prompt. Get a score and concrete fixes. No sign‑up»; «The tool will
  analyze it across 7 criteria and provide actionable feedback»; «This is a beta version»; «Built by
  Peak15 AI with Claude Code and ChatGPT. Hosted on Vercel»; «No prompts stored unless you opt in»:
  https://coach.p15.ai/

**Prompt Redesigner (custom GPT компании craai)**

- [мир] [вендор] «we've developed a custom GPT tool that serves as both a coach and a collaborator:
  the Prompt Redesigner. This tool evaluates, redesigns, and tests prompts»; «Those with a GPT Plus
  account are welcome to use it»; для остальных — «we've posted the custom instructions for the GPT
  in the footnotes»: https://craai.substack.com/p/improving-your-prompts-and-a-prompt . Сам GPT
  (ссылка в статье) не открывался: описание дано по статье.

**cursor-doctor (nedcodes; проверка файлов правил Cursor)**

- [мир] [вендор] «Cursor rules linter and auto-fixer. Find out why Cursor ignores your rules. 100+
  checks, zero dependencies»; «Your Cursor rules have bugs. This finds them»; проверки — «Token
  budget — rules burning context window, dead rules, excessive alwaysApply» и «Prompt quality —
  vague instructions, first person, politeness tokens, negation-only rules». Работает с файлами
  правил (.mdc), а не с запросами пользователя и не с сессией; исправляет текст правил
  автоматически. [счётчик] 9 звёзд, MIT, последний пуш 2026-03-08:
  https://github.com/nedcodes-ok/cursor-doctor

#### 16. Доработка: платформы наблюдаемости, названные в выдаче запроса 2026-10-01

Описания и цены — со страниц самих продуктов [вендор]; звёзды GitHub — [счётчик] на 2026-10-01.
Подборки-сравнения на сайтах вендоров (Latitude, Maxim, OpenObserve и др.) как источник не
использованы, кроме собственных слов продукта о себе.

**Latitude (разбор трасс агентов и исправление через кодового агента)**

- [мир] [вендор] «Make your AI agents self-healing»; «Latitude traces your agent in production,
  finds the failures, and dispatches your coding agent to fix them»; ищет «Escalations, resolutions,
  abandonments, trust breaks, retries, tool failures, and other “please look at this” moments»;
  «Recurring failures are grouped and prioritized automatically, with trend and failing traces
  attached»; «dispatches Claude Code or Cursor with the full context»; «It implements the smallest
  correct fix, and opens a PR». Это разбор агентов компании в продакшене, а не личных сессий
  разработчика: https://latitude.so/
- [мир] [вендор] Тарифы: Starter — «20K credits/month», «30d data retention», «Unlimited seats»; Pro
  — «$99 /month», «100K credits/month», «90d data retention», «Extra credits: $20 per 10K»;
  Enterprise — «Custom»: https://latitude.so/pricing

**Confident AI (создатели DeepEval)**

- [мир] [вендор] «Confident AI is the AI quality platform built by the creators of DeepEval. It
  gives engineering, QA, and product teams a single place to evaluate, observe, and improve LLM
  applications — from prototyping through production»; «Every LLM call is captured as a trace with
  full context — inputs, outputs, tool calls, latency, token cost, and metadata. You can drill into
  any production request, set up alerts on quality degradation, and monitor trends over time»:
  https://www.confident-ai.com/
- [мир] [вендор] Free — «Forever $0», «Limited to 2 user seats», «Limited to 1 project», «5 test
  runs per week», «1 GB-month of trace spans»; Starter — «$200 / month» (в нём «Online evals and
  classifications on live traffic»); Team — «$2,000 / month»; Enterprise — «Custom pricing»:
  https://www.confident-ai.com/pricing

**OpenObserve (мониторинг LLM-приложений в общей платформе наблюдаемости)**

- [мир] [вендор] «Open-Source, Unified Observability for the AI Era»; в слое «AI & LLM» — «Trace
  prompts, completions, token usage and cost across your LLM applications to debug quality and
  spend»; в демонстрации интерфейса — «Token spend up 18% - 1 failed completion». [счётчик] 22,2
  тыс. звёзд (22 215 по GitHub API на 2026-10-01), AGPL-3.0: https://openobserve.ai/ ;
  https://github.com/OpenObserve/openobserve

**Pydantic Logfire**

- [мир] [вендор] в блоке «Monitor your agents» — «Trace agent runs from prompt through tool calls»
  (Pydantic AI, LangChain, OpenAI SDK и всё, что размечено OpenTelemetry); Personal — «Free,
  forever», «10M telemetry records/month — hard-capped at $0», «1 seat + 2 read-only guests»; Team —
  «$49/mo», «10M records included · $2/M after», «5 seats included»; Growth — «$249/mo»; Enterprise:
  https://pydantic.dev/pricing . Страница https://pydantic.dev/logfire при разных запросах отдаёт
  два разных варианта текста (оба открыты 2026-10-01); общее для них — бесплатные 10 млн записей в
  месяц и платные тарифы от $49 и $249 в месяц.

**Traceloop (OpenLLMetry; на сайте объявлено присоединение к ServiceNow)**

- [мир] [вендор] На главной и на странице цен: «Traceloop is joining ServiceNow!» (в тексте «Service
  now»); «Just one line of code gets you live visibility into prompts, responses, latency, and
  more»; «Traceloop monitors what your model says, how fast it responds, and when things start to
  slip — so you can debug faster and deploy safely»; «Traceloop is built on OpenTelemetry and ships
  with OpenLLMetry, our open-source SDK»: https://www.traceloop.com/
- [мир] [вендор] Цены: «Free Forever» — «$0 / mo», «Up to 50K spans / month», «Up to 5 Seats», «24
  Hours Data Retention»; Enterprise — «>50K spans / month», «Unlimited Seats», «Custom Data
  Retention», «SOC 2 Compliance», «On-prem deployment option»; «OpenLLMetry is Apache-2.0 licensed
  and you can use it for free»: https://www.traceloop.com/pricing . [счётчик] OpenLLMetry — 7 463
  звезды, Apache-2.0, последний пуш 2026-09-29: https://github.com/traceloop/openllmetry

**MLflow (трассировка агентов и LLM-приложений)**

- [мир] [вендор] «Capture your agent or LLM application's inputs, outputs, and step-by-step
  execution: prompts, retrievals, tool calls, and more»; «Deep dive into your agent or LLM
  application's logic and latency with a comprehensive and intuitive UI for effective debugging»;
  «Auto-trace 50+ LLM providers and agent frameworks with a single line of code»:
  https://mlflow.org/genai/observability . [счётчик] 28 205 звёзд, Apache-2.0, последний пуш
  2026-10-01: https://github.com/mlflow/mlflow

**OpenLIT**

- [мир] [вендор] «OpenTelemetry LLM tracing for every call, tool, and retrieval. Filter by user,
  session, cost, latency, or metadata»; «AI agent monitoring for coding agents and tool loops. See
  tools, cost, and outcomes in one view»; «Free to self-host under Apache 2.0»: https://openlit.io/
  . [счётчик] 2 809 звёзд, Apache-2.0, последний пуш 2026-10-01: https://github.com/openlit/openlit

### Свидетельства оплаты

Платный тариф на странице цен — это предложение продавца [вендор], а не доказательство, что
кто-то платит. Ниже — что нашлось сверх страниц цен.

- [мир] Pretty Prompt:
  - [мир] [счётчик] Chrome Web Store: «50,000 users», 4,9 (142 оценки), версия 1.38.0 от 18.09.2026,
    «Offers in-app purchases». Это установки, не оплаты:
    https://chromewebstore.google.com/detail/prettyprompt/opjebobgkipcdimgofkboimilnchghpd
  - [мир] [площадка-продавец] AppSumo (11.06.2026): пожизненная лицензия — «5,200+ purchases and 170
    reviews (4.86 out of five stars average)»; после кампании «the subscriptions kept coming»;
    число подписчиков не раскрыто: https://appsumo.com/blog/prettyprompt
  - [мир] [оценка третьей стороны] Latka: «estimated $220K in annual revenue in 2025»; «We have not
    recorded a podcast or interview with Pretty Prompt's management; the revenue shown is a
    GetLatka estimate»; обновлено 02.09.2026: https://getlatka.com/companies/pretty-prompt.com
  - [мир] [вендор] Основатель Ilai Szpiezak (06.04.2026): «40,000 users, up from 15,000 at the time of
    recording», «2%+ conversion rate at the time of recording», «25-30% of users on annual plans
    at the time of recording», запуск 31.05.2025, без внешних инвестиций:
    https://prettypromptai.substack.com/p/a-big-one-we-did-a-podcast-with-google
  - [мир] [вендор] Он же на Product Hunt: «grew Pretty Prompt to 40,000 users, 25% on annual plans, with
    ~7% weekly growth»:
    https://www.producthunt.com/p/pretty-prompt/we-did-a-podcast-with-google-what-we-shared-about-monetizing-a-chrome-extension
- [мир] Microsoft Prompt Coach: отдельной оплаты нет. [вендор, отчёт в SEC] Microsoft 365 Copilot
  «reached over 30 million paid seats» (пресс-релиз от 29.07.2026 за квартал до 30.06.2026):
  https://www.sec.gov/Archives/edgar/data/0000789019/000119312526323632/msft-ex99_1.htm . Сколько
  из них пользуются Prompt Coach — не найдено.
- [мир] LangSmith: [СМИ] годовая регулярная выручка LangChain — «between $12 million and $16
  million» (TechCrunch, июль 2025, в пересказе SiliconANGLE от 20.10.2025); раунд $125 млн при
  оценке $1,25 млрд; компания «is not yet profitable»; LangSmith назван платным продуктом:
  https://siliconangle.com/2025/10/20/ai-agent-tooling-provider-langchain-raises-125m-1-25b-valuation/
- [мир] Braintrust: [СМИ] клиенты — Notion, Replit, Cloudflare, Ramp, Dropbox; раунд $80 млн
  (17.02.2026); выручка — не найдено:
  https://siliconangle.com/2026/02/17/braintrust-lands-80m-series-b-funding-round-become-observability-layer-ai/
- [мир] Langfuse: [вендор] «Trusted by 19 of the Fortune 50 and 63 of the Fortune 500» (ClickHouse,
  16.01.2026); выручка и сумма сделки — не найдено:
  https://clickhouse.com/blog/clickhouse-acquires-langfuse-open-source-llm-observability
- [мир] Helicone: [вендор] 16 000 организаций — не сказано, сколько платят; с 03.03.2026 режим
  поддержки: https://www.helicone.ai/blog/joining-mintlify
- [мир] Raindrop, PromptLayer: [вендор] названы клиенты (https://www.raindrop.ai/ ; https://www.promptlayer.com/); число платящих и выручка — не найдено.
- [мир] Galileo: [вендор] куплен Cisco (сделка закрыта 22.05.2026), сумма не раскрыта:
  https://blogs.cisco.com/news/cisco-announces-the-intent-to-acquire-galileo
- [мир] AgentOps — [вендор] «raises $2.6M» (https://www.agentops.ai/); Entire — [вендор]
  посевные $60 млн (https://entire.io/news/former-github-ceo-thomas-dohmke-raises-60-million-seed-round).
  Инвестиции — не оплата клиентов; число платящих — не найдено.
- [мир] Есть платные тарифы или оплата по объёму [вендор] (цены и ссылки — в таблице): Arize, W&B
  Weave, Opik, Datadog LLM Observability, Dash0, Amazon CloudWatch (стандартная цена метрик
  CloudWatch), Omnara (машины по часам), Laminar, Honeycomb, Maple, Sentry, New Relic, Grafana
  Cloud, SigNoz, Failproof AI, Future AGI, Mantra (платные дополнения Sync и Publish), Percival
  (платные вызовы оценщиков платформы Patronus; цена самого Percival не указана), PromptJolt
  (премиум-тариф), Prompt Perfect и Prompt Fixer (встроенные покупки в Chrome Web Store; на сайте Prompt Fixer — Premium $7 в месяц); из
  найденных 2026-10-01 — Latitude ($99 в месяц), Confident AI ($200 и $2 000 в месяц), Pydantic
  Logfire ($49 и $249 в месяц), AgentCenter (от $14 в месяц), OpenClawHQ ($49 в месяц), MetaPrompt
  ($5,99 в месяц), SpacePrompts ($5 и $9 в месяц). Число платящих и выручка по этим продуктам — не
  найдено.
- [мир] Платный доступ назван, цена не указана [вендор]: Jellyfish — «Jellyfish pricing is based on
  number of seats and specific modules selected. Talk to a sales person today to get a quote»
  (https://jellyfish.co/pricing/); Torii — «Pricing reflects enterprise coverage, not entry-level
  point pricing»
  (https://www.toriihq.com/articles/five-claude-code-usage-dashboards-and-monitoring-tools);
  SpecStory — Analytics «available on Pro plans», цена Pro не найдена; Promptfoo — Enterprise и
  On-Premise «Custom»; Claude Code and Codex Assist (расширение VS Code) — «A few advanced features
  require Pro», цена Pro не найдена
  (https://marketplace.visualstudio.com/items?itemName=agsoft.claude-history-viewer); Traceloop —
  Enterprise («Let's chat») без цены (https://www.traceloop.com/pricing).
- [мир] Цена и платность на открытых страницах не указаны: Datadog Agent Console — «available in
  Preview», а 14-дневный пробный период относится к аккаунту Datadog
  (https://www.datadoghq.com/blog/datadog-agent-console/); Maxim AI — страница цен показывает
  только шлюз Bifrost (https://www.getmaxim.ai/pricing); Promptly — цен в Chrome Web Store нет.
- [мир] Слова компаний о себе, без подтверждения оплаты [вендор]: Failproof AI — «5,235 developers», позже «5,240 developers» (живой счётчик)
  (https://befailproof.ai/); Future AGI — «2,400+ teams use Future AGI» и «Most teams pay nothing»
  (https://futureagi.com/pricing); Promptfoo — «156 of the Fortune 500 use Promptfoo»
  (https://www.promptfoo.dev/); Mantra — «built by an independent developer. No investors»
  (https://docs.mantra.gonewx.com/en/about/pricing.html).
- [мир] Бесплатные продукты без платной версии: Pixel Agents, оба claude-office, agent-virtual-office,
  PixelHQ, открытые панели (disler, hoangsonww, simple10, phuryn), vibe-log, Sniffly, навыки и
  плагины разбора сессий (hancengiz, agent-retro, retro, claude-retro-skill, session-retrospective,
  claude-lessons-learned, claude-reflect, claude-global-skills, insight-extractor, claude-insights,
  Continuous-Claude-v3, оба reflect, Retrospective Process, claude-smart), claude-code-templates,
  Invariant Explorer, Docent, Prompt Neat; из найденных 2026-10-01 — AgentsView, Claude Code Trace,
  Claude Trace Replay, Agent Sessions, Session Analyzer, остальные просмотрщики и панели из
  подразделов 12 и 13 (кроме AgentCenter и OpenClawHQ), навыки из подраздела 14, Prompt Reviewer,
  AI Prompt Checker, Prompt Analyzer PromptPrepare, Prompt Coach (Peak15 AI), Prompt Redesigner,
  cursor-doctor, OpenObserve, OpenLIT, MLflow, OpenLLMetry. Для них есть только сигналы внимания
  [счётчик]: звёзды GitHub и установки, приведённые выше.
- [мир] [счётчик] Установки улучшателей запросов и просмотрщиков сессий (не оплаты): Chrome Web
  Store — MetaPrompt 100,000 users (при платном плане $5,99 в месяц), Promptly 70,000 users, Prompt
  Perfect 10,000 users, PromptJolt 725, Prompt Fixer 130, Promptu 9; VS Code Marketplace — Claude
  Code and Codex Assist 11 151 установка (есть Pro), Prompt Reviewer 26 (ссылки — в таблице). Число
  оплативших среди них — не найдено.
- [мир] Независимых данных об оплате (выручка, число платящих) по продуктам, найденным 2026-10-01, не
  найдено: у них только страницы цен и счётчики установок и звёзд.
- [Россия] [СНГ] [Узбекистан] PromptLab, Vlex AI, FICHI.AI, PR-CY: платные тарифы в рублях [вендор] (https://promptslab.ru/enhancer/ ; https://vlex-ai.io/ru/ ; https://fichi.ai/bot/uluchshenie-prompta ; https://a.pr-cy.ru/prices/); число платящих — не найдено. Promptchi: платной версии нет; [счётчик] 6 пользователей в Chrome
  Web Store (см. следующий подраздел).

### Продукты на русском языке и для Казахстана/СНГ

**Казахстан — не найдено.** Казахстанского продукта, который разбирает сессию агента или
запросы к нему, не нашли. Где искали — в разделе «Где искали» (запросы на русском, английском и
казахском, Astana Hub, казахстанские СМИ). Для справки [Казахстан]: подборка Forbes.kz «10 ИИ-приложений,
созданных казахстанцами этим летом» (22.08.2023) — планетарий, исторический собеседник, репетитор
по математике, открытки и т. п.; ни одно не разбирает запросы или работу агентов [СМИ]:
https://forbes.kz/articles/za_predelami_chatgpt_10_ii-prilojeniy_sozdannyih_kazahstantsami_etim_letom

**Разбор всей сессии агента на русском языке — не найдено.** Нашлись только улучшатели запросов
и мониторинг трасс для компаний:

- [Россия] [вендор] «Лаборатория промптов» (promptslab.ru): «превращаем идеи в правильные запросы
  для нейросетей за секунды» — улучшает промпт по введённому тексту для ChatGPT, Claude, Gemini,
  DeepSeek, Midjourney и др., работает на русском; «условно бесплатный генератор промптов. Мы
  даем 3 попытки каждый день», попробовать можно без регистрации «в гостевом режиме»; пакеты
  кредитов 99 ₽ (50), 290 ₽ (200), 990 ₽ (1000); PRO — «590 ₽ / мес», «Безлимитные генерации»:
  https://promptslab.ru/enhancer/
- [СНГ] [вендор] Vlex AI — агрегатор нейросетей на русском с ассистентом «Улучшатель промтов»,
  «превращающий неструктурированные идеи в точные команды для LLM»; тарифы агрегатора:
  Бесплатный 0 ₽ (50 токенов), Базовый 499 ₽/мес (600 токенов), Продвинутый 2 499 ₽/мес (3000
  токенов); страна компании на страницах не указана:
  https://vlex-ai.io/ru/ii-assistenty/uluchshatel-promtov/ ; https://vlex-ai.io/ru/
- [Россия] [вендор] FICHI.AI — агрегатор нейросетей («Карты РФ», «Без VPN») с ассистентом
  «Улучшение промпта»: «ИИ-ассистент на FICHI.AI для улучшения промптов: вставьте черновик запроса
  — получите более ясный промпт для нейросети»; «Переписывает расплывчатый запрос в ясную
  инструкцию с целью и контекстом». Тарифы агрегатора: бесплатный старт; Базовый «790 ₽ /в месяц»
  (500 токенов, около 1 700 запросов); Профессиональный «1890 ₽ /в месяц» (1 500 токенов);
  «Гибкий» — «Оплата по факту использования без ежемесячной подписки»:
  https://fichi.ai/bot/uluchshenie-prompta
- [Россия] [вендор] «Генератор промптов» PR-CY (SEO-платформа, ООО «Анализ Сайта»): «Укажите вашу
  задачу или ваш короткий промпт и мы улучшим его»; «Генератор разберёт его и вернёт исправленную
  версию: добавит роль, уберёт двусмысленности, задаст формат ответа»; у кнопки — «Сгенерировать от
  0,03» без единицы измерения: https://pr-cy.ru/app/prompt-generator/ . Страница тарифов —
  «Подписка на тарифы», «Работаем по безналу для юрлиц»; суммы в тексте страницы не отобразились:
  https://a.pr-cy.ru/prices/
- [Узбекистан] [вендор] Promptchi, описание в Chrome Web Store (на русском): кнопка в поле ChatGPT
  делает запрос точнее — «добавляет задачу, контекст, аудиторию и нужный формат»; «уточняющие
  вопросы, если данных не хватает»; «работу с запросами на узбекском и русском»; «5 бесплатных
  улучшений в неделю без регистрации»; текст «передаётся через promptchi.uz в Google Gemini API»;
  «Первый релиз работает только в ChatGPT». [счётчик] 6 пользователей, оценок нет, версия 2.0.1 от
  01.09.2026, разработчик FullFocus.dev. Страница открыта по адресу
  https://chromewebstore.google.com/detail/prompt-optimizer-ai-promp/liofcdbejdpknkcapefbjcgjlamppghm?hl=en
  (найден поиском как «Prompt Optimizer», по этому адресу сейчас показывается Promptchi).
- [Узбекистан] [вендор] Сайт promptchi.uz (на узбекском): «Haftasiga 5 ta yaxshilash» — 5
  улучшений в неделю, «Roʻyxatdan oʻtmasdan beshta bepul yaxshilash» — пять бесплатных без
  регистрации; работает внутри ChatGPT; платных тарифов на странице нет: https://promptchi.uz/
- [Россия] [вендор] HiveTrace (ООО «ХайвТрейс», Ярославль): защита LLM-приложений — фильтр атак,
  очистка чувствительных данных, клиентские политики. Карточка «Мониторинг агентных систем»:
  «HiveTrace контролирует поведение агентных ИИ-систем с доступом к инструментам и API: отслеживает
  вызовы внешних сервисов, цепочки действий и решения агента, предотвращая несанкционированные
  операции» — с пометкой «Скоро», то есть функции пока нет; цены нет, демо по запросу:
  https://hivetrace.ru/
- [Россия] [вендор] Yandex Monium (статья технического менеджера продукта, 20.08.2026): «В нашем
  UI удобно смотреть историю сообщений, входные и выходные параметры инструментов»; LLM as a Judge
  описан в статье как подход отрасли, есть ли такой разбор в самом Monium — не сказано; «он уже
  работает в Яндекс Облаке»; цены в статье нет: https://infra.yandex.ru/blog/llm-observability
- [мир] [вендор] Из зарубежных продуктов русский язык запросов прямо указан у Pretty Prompt:
  https://www.pretty-prompt.com/chrome-extension

Найдены, но в таблицу не входят — это сами агентные платформы или агрегаторы, у которых своя
страница не описывает разбор сессии или запроса:

- [Россия] [вендор] Just AI Agent Platform — платформа для создания корпоративных агентов;
  «Трассировка каждого шага агента, контроль расходов на LLM … журналы выполнения для проверки
  качества ответов»; Cloud — «от 100 000 ₽ /мес»; в реестре отечественного ПО:
  https://just-ai.com/agent-platform-enterprise
- [Россия] [вендор] Cloud.ru Evolution AI Agents — «сервис для создания AI-агентов»; «Интеграция с
  Arize Phoenix позволяет отслеживать путь данных и запросов»; цены на странице нет:
  https://cloud.ru/products/evolution-ai-agents
- [Россия] [СМИ, рейтинг с партнёрскими ссылками] Рейтинг vc.ru (07.08.2026, раздел «Топ рейтинг»)
  называет шесть чат-агрегаторов: Study24.ai («встроенный улучшатель запросов», от 199–499 ₽/мес),
  GoGPT, GPTunnel («собственный промт-инженер», около 600–900 ₽/мес), MashaGPT, ChadGPT («разбор
  промтов», месячные 450–650 ₽), AllGPT («Промт-мастер», от 690–1490 ₽/мес). Кнопки «Попробовать»
  ведут через переадресацию vc.ru на партнёрские ссылки: у Study24.ai — на eduforms.org (переадресует
  в CPA-сеть Edugram), у AllGPT — на chat.gogpt.ru, то есть на GoGPT:
  https://vc.ru/top_rating/2722676-generatori-promtov-dlya-nevrosatej . Ещё восемь списков vc.ru и
  DTF (выдача запроса об AllGPT, 2026-10-01) называют те же сервисы и ещё BotHub, Сигмачат, Гервин,
  Синтакс, Clipia, RuGPT, AIR, Unitool, Mitup AI, AI Wiz, Router AI, Epic AI, F5 AI, VIS AI,
  TalkPilot, Jayflow (адреса списков — в «Где искали»). Каждый агрегатор проверен по своей странице
  по тому же правилу, что Vlex AI и FICHI.AI (результаты — в «Где искали»): ни у одного своя
  страница не описывает разбор или улучшение запроса, поэтому строк для них нет; у BotHub, AI Wiz,
  EpicAI, F5 AI и VIS AI — библиотеки или шаблоны запросов, у Clipia — «Промпт-инженер» для
  изображений и видео, TalkPilot не ответил.

## Где искали

**Правило включения — одно для всех.** Найденный продукт входит в таблицу, если его собственная
открытая страница (сайт, документация, README, текст навыка, карточка магазина) показывает, что он
(1) показывает или разбирает сессию агента — шаги, вызовы инструментов, ошибки, ход разговора,
состояние и ленту действий, — или (2) оценивает, улучшает или переписывает запрос к агенту или
модели: текст запроса, шаблон промпта или файл правил, который агент получает с каждым запросом.
Отдельные инструменты внутри других сервисов входят на тех же условиях: агент Prompt Coach в
Copilot, улучшатели запросов в Anthropic Console и у OpenAI, ассистенты-улучшатели в агрегаторах
(Vlex AI, FICHI.AI), генератор PR-CY. Не входят: (а) встроенные функции самих агентных платформ для
их собственных сессий — предмет `session-review-platforms.md`; (б) продукты, которые по своей
странице не делают ни (1), ни (2): только счётчики токенов и расходов, только метрики, библиотеки
готовых запросов и правил, чат-клиенты и агрегаторы без инструмента для запросов,
маршрутизаторы-шлюзы, защита и проверка запросов и ответов во время работы (Snyk Agent Guard,
Guardrails AI, OpenAI Guardrails), генераторы и конвертеры файлов правил; (в) коннекторы и обёртки,
которые только пересылают данные Claude Code в другую платформу или запускают другой продукт и сами
ничего не показывают, — их данные разбирает платформа-получатель, у которой есть своя строка; (г)
копии, форки и каталожные карточки уже учтённого продукта; (д) закрытые продукты; (е) продукты, своя
страница которых не нашлась или не открылась, — с указанием, где искали; (ж) инструменты запросов
только для генерации изображений, видео и музыки.

**Граница поиска.** Найденным считается продукт, названный: (1) в research/pixel-office.md, разделы
1–3; (2) в замечаниях проверки шага 1b
(`handoffs/BP-20260930-01/step-01b-plan-validator-session-review-tools.json`); (3) в выдаче
поисковых запросов обоих проходов (перечень ниже; WebSearch возвращает не больше девяти результатов
на запрос) или на страницах, открытых в первом проходе; (4) как «похожий плагин» на странице уже
найденного продукта (так найден claude-smart). Страница каждого такого продукта открыта 2026-09-30
или 2026-10-01, и правило применено к каждому; продукты, которые правило исключило или чья страница
не открылась, перечислены ниже с причиной. Списки сравнения внутри страниц продуктов («vs …», подборки вендоров) дальше не прослеживались: каждый такой список даёт десятки новых названий; исключение — блок «Related Skills» на странице Retrospective Process и блок «Similar plugins» на странице reflect (shfc), чьи названия открыты. Классы продуктов поиском не закрываются: каталог skills.rest сообщает о
«754,000+ skills indexed» (https://skills.rest/skill/retrospective-process), выдача каждого запроса
о просмотрщиках, панелях и навыках разбора сессий содержит новые репозитории, подборки сравнения
платформ наблюдаемости называют ещё десятки платформ, рейтинги vc.ru и DTF добавляют названия
агрегаторов. Поэтому таблица полна в этой границе, а не по рынку в целом; вопрос о полноте этих
классов передан ORCH в result.issues handoff-а доработки.

**Поисковые запросы (WebSearch), 2026-09-30.**

- Коучи запросов: «Pretty Prompt MCP server Claude Code Cursor prompt improve», «Pretty Prompt
  chrome extension "Grammarly for prompting" chromewebstore», «chromewebstore.google.com Pretty
  Prompt improve prompts ChatGPT Claude users», «"Pretty Prompt" revenue MRR paying users
  founder», «"Pretty Prompt" startup prompt extension interview founders growth 2026», «Microsoft
  365 Copilot price $30 per user per month Copilot Chat free agents pricing page», «Microsoft 365
  Copilot paid seats million earnings call 2026», «Anthropic Console prompt improver docs
  platform.claude.com prompt-improver».
- Платформы трассировки: «LangSmith Insights Agent analyze traces patterns failure modes docs»,
  «LangSmith threads multi-turn conversations view "Polly" AI assistant debug traces suggest
  prompt», «LangSmith trace Claude Code sessions integration docs», «Langfuse Claude Code
  integration trace sessions hooks», «LangChain ARR revenue 2026 LangSmith paying customers»,
  «Langfuse revenue ARR paying customers acquisition price ClickHouse», «Langfuse "Assistant"
  analyze thousands of observations changelog 2026», «"Catching conversation signals" Langfuse
  blog», «Helicone sessions agent tracing docs "sessions" visualize multi-step agent», «AgentOps
  session replay "recursive thought" detection infinite loops agent docs», «Arize Alyx agent
  analyze traces sessions suggest prompt improvements root cause», «Arize Phoenix Claude Code
  tracing sessions coding agent», «Arize AX Signal issues automatic detection agent traces docs»,
  «Arize AI Series C $70 million funding customers revenue», «W&B Weave Claude Code tracing
  sessions coding agent integration», «Braintrust Loop AI assistant analyze logs traces failures
  suggest prompt improvements», «Braintrust trace Claude Code sessions plugin coding agent»,
  «Braintrust AI observability ARR revenue 2026 Series B customers», «Opik Claude Code tracing
  sessions threads Comet coding agent», «Opik Ollie AI assistant debug traces root cause suggest
  fix», «Omnara Claude Code mobile approve permissions session progress github omnara-ai».
- Другие продукты разбора: «vibe-log Claude Code session analysis productivity report prompt
  coach», «Sniffly Claude Code analytics error breakdown usage patterns», «tool analyze Claude Code
  sessions retrospective what went wrong wasted time suggestions CLAUDE.md», «claude-reflect plugin
  corrections CLAUDE.md learn from session github», «Claude Code retrospective skill analyze
  session transcript friction lessons learned github», «"coding agent" session analytics startup
  review sessions developers prompts "wasted" tokens insights Claude Code Cursor 2026»,
  «maple.dev pricing observability OpenTelemetry Maple», «Honeycomb Claude Code monitoring
  sessions OpenTelemetry investigate», «Patronus AI Percival agent debugger trace analysis failure
  modes suggest prompt fixes pricing», «Raindrop AI monitoring agents issues user frustration
  signals pricing», «Raindrop AI agent monitoring raises seed funding», «Galileo Insights Engine
  agent failure modes automatic root cause suggestions pricing 2026», «Cisco acquires Galileo AI
  observability May 2026», «Transluce Docent analyze agent transcripts tool», «Laminar lmnr agent
  observability Claude Code sessions signals pricing», «Laminar Signals docs "Claude Code" trace
  coding agent laminar.sh», «SpecStory AI coding session history Claude Code Cursor pricing
  cloud», «SpecStory Pro plan price per month Spec Score cloud», «Entire checkpoints agent
  sessions git Thomas Dohmke Claude Code transcripts», «code.claude.com docs "/insights" command
  report sessions friction suggestions».
- Русский язык, Казахстан, СНГ: «анализ сессий Claude Code сервис разбор ошибок агента советы»,
  «сервис улучшения промптов на русском платный подписка промпт-коуч», «наблюдаемость LLM агентов
  российский сервис трассировка агентов мониторинг 2026», «"Improve Prompt" нейросеть улучшения
  промптов кредиты подписка сайт», «Astana Hub стартап анализ промптов ИИ-агентов Казахстан сервис
  мониторинг агентов», «Kazakhstan startup prompt engineering tool AI agents monitoring
  observability», «промпт жазу көмекші қазақ тілі сервис prompt improver Kazakh language»,
  «казахстанский сервис промпты нейросети стартап улучшение запросов ChatGPT Казахстан»,
  «site:astanahub.com prompt engineering OR промпт OR "AI agent" monitoring startup».

**Поисковые запросы (WebSearch), 2026-10-01 — второй проход.** Часть до возобновления работы: «Snyk
AI agent monitoring security Invariant Labs agent traces guardrails 2026», «Prometheus monitoring AI
agents LLM metrics only overview prometheus.io», «snyk.io AI security offering agentic Evo agent
guard runtime tool calls product page», «SigNoz Claude Code monitoring dashboard LLM observability
agent traces docs», «AllGPT нейросеть агрегатор "Промт-мастер" сайт» (запросы о Prometheus и AllGPT
повторены после возобновления, выдачи перечитаны и открыты целиком). Часть после возобновления:
«cursor-doctor nedcodes lint Cursor rules .mdc github npm», «AgentCenter AI agent dashboard monitor
coding agents sessions», «Guardrails AI guardrailsai.com validators LLM output what it does»,
«Claude Code session viewer replay transcripts web UI open source JSONL», «Claude Code session
analytics tool analyze transcripts friction mistakes wasted time report», «real-time dashboard AI
coding agent sessions Claude Code Codex prompt history tool logs open source», «prompt coach tool
feedback on your prompts score improve prompt writing for Claude Code Cursor developers», «best LLM
observability tools for AI agents 2026 tracing sessions open source comparison», «Cursor Codex
Copilot agent session history analyzer review my prompts retrospective tool», «AI prompt analyzer
reviews your prompt history scores prompt quality extension Claude ChatGPT Cursor», «Mission Control
HQ OpenClaw agents dashboard». Из выдач второй части каждый продукт и каждая страница открыты и разобраны по правилу (строки таблицы — в подразделах 12–16 «Что нашли», остальное — ниже); из выдач первой части разобраны продукты, названные в замечаниях проверки и в pixel-office.md (Snyk, Prometheus, SigNoz и др.). Поиск по GitHub API (`api.github.com/search/repositories`) использован один раз — чтобы найти репозиторий навыка coding-agent-sessions по названию; другие результаты этого поиска не рассматривались. Остальные страницы второго прохода открывались
напрямую по адресам из выдач первого прохода, из pixel-office.md и из замечаний проверки.

**Открыты и использованы.** Все ссылки из таблицы и фактов выше. Страницы открывались инструментом
WebFetch и напрямую (curl); для GitHub — ещё через `gh api` (README, звёзды, лицензии, форки).
2026-10-01 между 07:15 и 07:17 UTC ответ каждой из 381 уникальной ссылки файла проверен ещё раз: 367
ответили 200; ещё четыре — alternativeto.net (403 для curl, открыта через WebFetch), SourceForge и
Product Hunt (403 для обычного запроса, 200 при запросе с описанием клиента) и страница SEC (открыта
через WebFetch и запросом с описанием клиента) — открылись другим способом; десять не открылись:
patronus.ai/docs (401), репозиторий Git-Fg/meta-plugin-manager (404), копия claude-reflect в
маркетплейсе jeremylongshore (404), статья Wise на Medium (403), seedlegals.com (403),
specstory.com/pricing и www.specstory.com/pricing (404), talkpilot.ru и aipromptfixer.com (нет
ответа), getclaudeskills.com (500); они названы с причинами в этом разделе и не использованы как
источники фактов. Цитаты из пунктов раздела «Что нашли» (724 цитаты в 230 пунктах) сверены скриптом
с текстом страниц по адресам из тех же пунктов; без совпадения остались 12 — это мои пояснения в
кавычках (например, перевод с китайского), цитаты со страницы другого пункта, метаописание страницы,
живой счётчик Failproof AI (5,235 при первой проверке, 5,240 при повторной) и пресс-релиз SEC
(открывается только запросом с описанием клиента), и их я проверил вручную. Звёзды и лицензии — из
GitHub API (api.github.com/repos/…), они совпадают со страницами репозиториев.

**Где искали для ячеек «не найдено».** Для каждой ячейки «не найдено» проверены все страницы из
столбца «Источники» той же строки, а для README и страниц, скачанных напрямую, — ещё и поиск по
тексту слов prompt, error, fail, interrupt, permission, wait, idle, latency, duration, time, loop,
retry, suggest, recommend, fix. Дополнительно:

- Helicone — ещё https://docs.helicone.ai/features/sessions (про ошибки и вмешательства в
  сессиях ничего нет) и блог https://www.helicone.ai/blog/joining-mintlify.
- AgentOps — README на GitHub: анализ задержки событий есть (✅), обнаружение петель в работе
  (🚧), поэтому «потерянное время» — «частично», а не «да»; о показе запроса пользователя,
  вмешательств и о советах на главной и в README ничего нет.
- W&B Weave — советы: на странице продукта описан только рецепт, в котором сторонний агент
  (Claude Code) сам гоняет оценки и итерации по данным Weave; готовых советов от продукта на
  странице продукта, странице цен и странице интеграции с Claude Code нет.
- Datadog LLM Observability — вмешательства и советы: на странице продукта нет.
- Dash0 — советы: в блоге запуска и на сравнительной странице нет.
- Datadog Agent Console — постановка задачи и вмешательства: в блоге запуска нет.
- Amazon CloudWatch, Jellyfish — страницы описывают метрики, расходы и связь с PR; о содержании
  сессий нет; у Jellyfish ещё найдено предложение о том, что Claude Code сам связывает события с
  запросом через `prompt.id`, но о показе этого в Jellyfish не сказано; страница цен Jellyfish —
  только о ценообразовании.
- Torii — раздел о самом Torii в статье Torii: о ходе сессий агента, вызовах инструментов,
  ошибках и времени ничего нет (только аккаунты, установки, расходы по сотрудникам, пересечение
  подписок); других страниц Torii о Claude Code в первом проходе не встретилось.
- Omnara — страница цен и карточка App Store; главная omnara.com текста о сессиях не отдала.
- Визуализаторы и панели раздела 3 — README целиком (поиск слов выше).
- vibe-log — сайт, README и пример отчёта: ошибок и вмешательств в описании и в примере нет;
  «Pattern Recognition» — «Identifies recurring issues blocking your flow» не уточняет, какие это
  проблемы, поэтому «Ошибки» — «не найдено».
- Sniffly — README, сайт https://sniffly.dev (описания функций не отдал) и обзор aiengineerguide.
- SpecStory — цена тарифа Pro: https://docs.specstory.com/cloud/analytics,
  https://docs.specstory.com/cloud/overview, https://specstory.com/ и https://specstory.com/cloud
  (цен нет), https://specstory.com/pricing и https://www.specstory.com/pricing (404).
- Entire — цена: https://entire.io/ и новость о раунде; цен нет.
- Percival — документация https://docs.patronus.ai/docs/percival/percival вернула 401;
  проверены страница продукта и цены.
- Galileo, Laminar, Honeycomb, Maple, PromptLayer, Docent — страницы из столбца «Источники»; о
  клиентах Laminar, Honeycomb, Maple, Docent на них нет.
- HiveTrace — главная страница целиком, в том числе разметка карточки «Мониторинг агентных
  систем» (у неё метка «Скоро»); другие модули — фильтр атак, очистка данных, политики — к ходу
  сессии агента не относятся; цен нет.
- Yandex Monium — статья целиком; об ошибках, времени и советах в самом Monium ничего нет; цен
  нет.
- Sentry, New Relic, Grafana Cloud, SigNoz, Maxim AI — документация и страницы цен из столбца
  «Источники»: готовых советов на следующий запуск нет; у Grafana Cloud ещё проверена страница
  оценок (критерии задаёт пользователь).
- Invariant Explorer — главная Invariant Labs, страница Explorer (GitHub) и новость Snyk: кроме
  визуализации трасс, ничего о вмешательствах, ошибках, времени и советах нет.
- Promptfoo — главная и страница цен: разбора реальных сессий агента нет.
- Mantra — README, документация и обе страницы цен: разбора ошибок, потерь времени и советов нет;
  главная mantra.gonewx.com отдала только заголовок.
- claude-insights, insight-extractor, claude-code-templates, Continuous-Claude-v3, оба reflect,
  Retrospective Process, claude-smart — README, статьи и карточки каталогов из столбца
  «Источники».
- Future AGI — главная и страница цен: о вмешательствах пользователя ничего нет.
- Продукты подразделов 12–16 — README, тексты SKILL.md, страницы цен, документация и карточки
  магазинов из столбца «Источники»; в README просмотрщиков и панелей искались слова error, fail,
  retry, loop, stuck, idle, blocked, duration, latency, suggest, recommend, correct, interrupt.
  AgentsView — ещё страницы session-intelligence, quality и recall (рекомендации раздела Quality
  описаны без примеров, поэтому «Советы» — «частично»). Git-Fg session-analysis — репозиторий
  отвечает 404, описание только с карточки skills.lc. Claude Code Trace — разбор через Jev описан
  только в README проекта, страница Jev о сессиях агентов-программистов ничего не говорит. Платформы наблюдаемости из
  подраздела 16 — главная и страница цен; у Pydantic Logfire страница https://pydantic.dev/logfire
  отдаёт два разных варианта текста, поэтому опора — страница цен.
- Кто платит «Не найдено» — на страницах из столбца «Источники» этой строки сведений о покупателях
  нет.

**Проверены по правилу и не включены (страницы открыты 2026-10-01, если не сказано иное).**

- [мир] [вендор] Snyk — защита агентов в реальном времени («Agent Guard (Private Preview)»), а не
  разбор хода сессии: https://snyk.io/blog/introducing-agent-security/ (правило, п. (б)); его
  Invariant Explorer — отдельная строка.
- [мир] [вендор] Prometheus — «Prometheus collects and stores its metrics as time series data»;
  «If you need 100% accuracy, such as for per-request billing, Prometheus is not a good choice»:
  только метрики (п. (б)): https://prometheus.io/docs/introduction/overview/
- [мир] [вендор] Humanloop — «As we sunset the Humanloop platform…» (п. (д)):
  https://humanloop.com/
- [мир] [вендор] Velvet — «Velvet is now part of Arize» (п. (г), учтено в строке Arize):
  https://www.usevelvet.com/
- [мир] [вендор] Statsig — продукты «Experimentation», «Feature Flags», «Product Analytics»,
  «Session Replay», «Web Analytics»; об агентах и LLM на главной ничего (п. (б)):
  https://www.statsig.com/
- [мир] Официальное расширение Claude Code для VS Code и хуки/OpenTelemetry Claude Code (раздел 3
  pixel-office.md) — сама платформа (п. (а)).
- [мир] [вендор] Команда `/insights` в самом Claude Code — «Generate an HTML report analyzing your
  recent sessions on this machine: which projects you work in, how you use Claude Code, where things
  go wrong, and features to try»: https://code.claude.com/docs/en/commands . Встроенная функция
  платформы (п. (а)); на её отчёте построены строки claude-insights и insight-extractor.
- [мир] [вендор] PI Prompts — библиотека запросов («Keep your prompts in one library next to the chat
  box»): https://chromewebstore.google.com/detail/pi-prompts-for-chatgpt-ge/pkpcekmmpgpaiedfchfdmcimogogbeje?hl=en
  ; Snack Prompt — библиотека запросов сообщества («access to an extensive library of top prompts
  curated daily»): https://chromewebstore.google.com/detail/chatgpt-snack-prompt/lgpdceoebipofiijjgpiedpfcdenkndi?hl=en
  ; ChatGPT App — чат в боковой панели браузера:
  https://chromewebstore.google.com/detail/chatgpt-app/cdahaklhjckkkfljdmheilncimjlegii?hl=en
  (п. (б)).
- [Россия] [вендор] Агрегаторы из рейтинга vc.ru: GoGPT — «Шаблоны запросов — Сохраняйте
  промпты-шаблоны и запускайте их в один клик», инструмента разбора или улучшения запроса на
  странице нет: https://gogpt.ru/ ; MashaGPT — агрегатор «Пятьдесят нейросетей. Одна подписка», об
  улучшении запросов ничего: https://mashagpt.ru/ ; ChadGPT — «Библиотека промтов к нейросетям с
  качественными ответами. Можно добавлять свои», «разбора промтов» на странице нет:
  https://chadgpt.ru/ (п. (б)). GPTunnel — главная отдаёт только оболочку приложения, в
  документации API инструмента для запросов нет: https://gptunnel.ru/ ,
  https://docs.gptunnel.ru/ ; Study24.ai — сайт не ответил (curl — нет ответа, WebFetch — тайм-аут),
  ссылка рейтинга ведёт в CPA-сеть Edugram (https://eduforms.org/ → edugram.com); AllGPT — свой сайт
  не найден (allgpt.ru не ответил, allgpt.co — ошибка Wix), ссылка рейтинга ведёт на GoGPT (п. (е)).
- [мир] [вендор] Счётчики токенов и расходов: ccusage — «A fast local CLI for tracking tokens and
  estimated costs across Claude Code, Codex, …»: https://ccusage.com/ ; Claude Code Usage Monitor —
  «Real-time Claude Code usage monitor with predictions and warnings»:
  https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor ; gist «Claude Code token usage
  analyzer - breaks down usage by project, session, and subagent»:
  https://gist.github.com/kieranklaassen/7b2ebb39cbbb78cc2831497605d76cc6 ; шаблон дашборда Grafana
  «Claude Code» — «usage analytics: tracks cost, token consumption, API requests, tool usage,
  sessions…» по данным OpenTelemetry, агрегаты, а не ход сессии:
  https://grafana.com/grafana/dashboards/25340-claude-code/ (п. (б)).
- [мир] [вендор] LiteLLM — шлюз: «AI Gateway … with cost tracking, guardrails, load balancing, and
  logging»: https://github.com/BerriAI/litellm (п. (б)).
- [мир] [вендор] Коннекторы Claude Code → другая платформа (п. (в)): плагины сообщества для Langfuse
  — https://github.com/garygentry/claude-observability-plugin ,
  https://github.com/pdhoolia/langfuse-claude-code-plugin , https://github.com/douinc/langfuse-claudecode
  («Automatically sends conversation traces to Langfuse»), https://github.com/doneyli/claude-code-langfuse-template
  , https://github.com/odhomane/langfuse-ai-agent-hooks ; claude_telemetry — «OpenTelemetry wrapper
  for Claude Code CLI that logs … to Logfire, Sentry, Honeycomb, or Datadog»:
  https://github.com/TechNickAI/claude_telemetry ; ccsync — «Export Claude Code conversations to
  Opik»: https://github.com/comet-ml/ccsync ; coding-harness-tracing — «Trace coding harnesses like
  claude-code, cursor, and codex to Arize AX or Phoenix»: https://github.com/Arize-ai/coding-harness-tracing
  (учтено в строке Arize).
- [мир] [вендор] Копии и карточки (п. (г)): навык Prompt Coach в bear2u/my-skills и его карточки на
  skills.lc и awesomeskill.ai — копия hancengiz:
  https://skills.lc/bear2u/my-skills/bear2u-my-skills-claude-skills-code-prompt-coach-skill-md ,
  https://awesomeskill.ai/skill/my-skills-code-prompt-coach ; копия claude-reflect в маркетплейсе
  jeremylongshore — путь вернул 404:
  https://github.com/jeremylongshore/tons-of-skills-marketplace/tree/main/plugins/community/claude-reflect
- [мир] [вендор] Библиотеки и шаблоны запросов (п. (б)): promptpetal-mcp — «your saved prompts in
  Claude, Cursor, VS Code and more»: https://github.com/none298-dotcom/promptpetal-mcp ;
  claude-prompts-mcp — «MCP server for reusable prompt templates, multi-step workflow chains, and
  quality gates»: https://github.com/minipuft/claude-prompts-mcp
- [мир] [вендор] Не о разборе сессий и запросов (п. (б)): Pretty Insights — «Web analytics for SaaS
  founders» (https://alternativeto.net/software/pretty-insights/about); Promptmonitor — «tracks how
  your brand shows up in AI answers» [СМИ]
  (https://nocodeexits.substack.com/p/stuck-at-500-mrr-for-months-sold); The Prompting Company —
  помогает продуктам попадать в ответы ИИ (GEO) [СМИ]
  (https://techcrunch.com/2025/10/30/the-prompting-company-snags-6-5m-to-help-products-get-mentioned-in-chatgpt-and-other-ai-apps/);
  TypeSafe Jev — «Think of Jev as a frontier-intelligence function call: unstructured state in,
  typed probabilistic decisions out»; в списке применений — «Score, judge, verify, guardrail, and
  detect jailbreaks of LLM prompts, reasoning traces, and/or outputs»: универсальная
  модель-классификатор с оплатой за токены, готового разбора сессии на её странице нет; как движок
  разбора её применяет Claude Code Trace (строка в таблице:
  https://typesafe.ai/blog/introducing-system-one-models-and-jev), как оценщик — Langfuse
  (https://langfuse.com/blog/2026-09-18-using-typesafes-jev-for-evals).
- [мир] [вендор] postmortem (shfc) — «Prevent code regression by learning from historical fix
  commits»: учится на коммитах-исправлениях, а не на сессиях (п. (б)):
  https://www.claudepluginhub.com/plugins/shfc-reflect-plugins-reflect
- prompt-improver (melodic-software) — карточка каталога не отдала описания, репозиторий
  melodic-software/claude-ecosystem через GitHub API не найден (п. (е)):
  https://www.claudepluginhub.com/agents/melodic-software-claude-ecosystem-plugins-claude-ecosystem/agents/prompt-improver
- Improve Prompt и Prompt Optimizer — только карточки каталога neural-networked.ru, собственные
  сайты не найдены (п. (е)): https://neural-networked.ru/promptune/
- Репозиторий ArtemiiF/reflectory — GitHub API не нашёл его (п. (е)).
- [мир] [вендор] Защита во время работы, не разбор (п. (б)): Guardrails AI — «The AI Reliability
  Platform»; «Deploy runtime guardrails that detect policy violations, hallucinations, and data
  leakage. Block bad outputs before they reach users»: https://www.guardrailsai.com/ ; OpenAI
  Guardrails Python — «Guardrails is a safety framework for LLM applications that automatically
  validates inputs and outputs using configurable checks»:
  https://openai.github.io/openai-guardrails-python/
- [мир] [вендор] Инструменты вокруг файлов правил (выдача запроса о cursor-doctor): rule-gen —
  «Generate AI coding rules from your actual source code, powered by Google Gemini» и rule-porter —
  «Convert AI IDE rules between Cursor, Windsurf, CLAUDE.md, AGENTS.md, and Copilot» создают и
  конвертируют файлы правил, а не оценивают запрос (п. (б)): https://github.com/nedcodes-ok/rule-gen
  , https://github.com/nedcodes-ok/rule-porter ; cursor-lint-action — «This action now uses
  cursor-doctor», запускает проверку в CI, обёртка без своих функций (п. (в)):
  https://github.com/nedcodes-ok/cursor-lint-action ; cursorrules-collection — «110+ tested .mdc and
  .cursorrules files for Cursor AI» — библиотека правил (п. (б)):
  https://github.com/nedcodes-ok/cursorrules-collection ; карточки и статьи о cursor-doctor —
  https://www.jsdelivr.com/package/npm/cursor-doctor ,
  https://dev.to/nedcodes/how-to-lint-your-cursor-rules-in-ci-so-broken-rules-dont-ship-2n7a ,
  https://dev.to/nedcodes/how-to-vet-cursor-rules-before-using-them-a7c ,
  https://dev.to/nedcodes/i-built-a-linter-for-cursor-rules-because-nobody-knows-if-theirs-are-working-4f6h
  (п. (г)); страница npm ответила 403 (Cloudflare).
- [мир] Репозитории без описания разбора, форки и копии: JKershaw/dash — README из двух строк, «The
  code editor for your code editor» (п. (б)): https://github.com/JKershaw/dash ;
  rudironsoni/agent-sessions — по данным GitHub форк jazzyalex/agent-sessions (п. (г)):
  https://github.com/rudironsoni/agent-sessions ; Mikael-Lelouch/openclaw-mission-control — по
  данным GitHub форк crshdn/mission-control, который описан как «The world's first Autonomous
  Product Engine (APE)» — агентная платформа (пп. (г), (а)):
  https://github.com/Mikael-Lelouch/openclaw-mission-control ; карточки и копии — Claude Code Trace
  на hysenlabs.com (https://hysenlabs.com/en/projects/delexw-claude-code-trace), Claude Viewer на
  glama.ai
  (https://glama.ai/mcp/servers/@maxturazzini/claude-viewer/blob/739a2a845f05163438fe1aa490be26c47df3d5d8/CLAUDE.md),
  копия claude-code-transcripts на SourceForge — «This is an exact mirror of the
  claude-code-transcripts project»
  (https://sourceforge.net/projects/claude-code-transcripts.mirror/), страница GitHub Pages
  просмотрщика xlvlxn (https://xlvlxn.github.io/claude-session-viewer/), карточки навыков на
  mcpmarket.com (адреса — в строках таблицы), сайт и блог Agent Sessions
  (https://jazzyalex.github.io/agent-sessions/blog/where-agents-store-history/), страницы
  AgentCenter (https://agentcenter.cloud/about ,
  https://www.agentcenter.cloud/multi-agent-system-dashboard ,
  https://www.agentcenter.cloud/blogs/openclaw-dashboard-mission-control) — все описывают уже
  учтённый продукт (п. (г)).
- [мир] [вендор] Навыки из блока «Related Skills» на странице Retrospective Process (страницы
  skills.rest открыты 2026-10-01; п. (б)): learn (gstack, Shmurdoc) — «Capture and organize project
  learnings into a searchable JSONL knowledge base» (хранилище записанных уроков: поиск, чистка,
  экспорт; сессию сам не разбирает): https://skills.rest/skill/learn-shmurdoc ; meeting-notetaker —
  «Summarize meeting transcripts into structured Markdown summaries with decisions and action items»
  (протоколы совещаний): https://skills.rest/skill/meeting-notetaker-aiunlocked1412 ;
  mma-journal-record — «Record team decisions and learnings into the persistent knowledge graph»
  (журнал решений): https://skills.rest/skill/mma-journal-record ; pm-postmortem-writer — «Generate
  structured postmortem reports with 5-Why root cause analysis and assigned action items» (разбор
  запусков продукта и аварий): https://skills.rest/skill/pm-postmortem-writer-spacezephyr
- [мир] Названия из выдач запросов, чьи страницы не открылись или не нашлись (п. (е)):
  session-analyzer (jongwony) — страница каталога
  https://www.claudepluginhub.com/agents/jongwony-epistemic-cooperative-epistemic-cooperative/agents/session-analyzer
  отвечает «Page not found», репозиторий jongwony/epistemic-cooperative — 404; coding-agent-sessions
  — https://www.getclaudeskills.com/skills/coding-agent-sessions-code-yeongyu отвечает «Application
  Error» (500); AI Prompt Fixer — https://aipromptfixer.com/ не отвечает; Prompt Coach в Wise
  (статья на Medium) —
  https://medium.com/transferwise-design/from-playtime-to-practice-designing-ai-with-the-prompt-coach-71e6ac672ac2
  отвечает 403.
- [мир] Научная статья: Prompt Coach — «an agentic tutor that helps developers learn how to craft
  high-quality code-generation prompts through Socratic guidance embedded in-flow within their IDE»;
  «PC evaluates prompt quality across multiple dimensions»; исследовательский прототип с
  исследованием на 15 разработчиках, о выпуске продукта и о цене на странице не сказано (п. (е)):
  https://arxiv.org/abs/2607.06074
- [мир] [вендор] Серверы MCP и шлюзы вокруг Prometheus (выдача запроса о Prometheus; п. (б)):
  «Prometheus enables AI agents to query, discover, and analyze Prometheus metrics using natural
  language» — https://mcpmarket.com/server/prometheus-5 ; «Empower your LLMs to programmatically
  interact with Prometheus» — https://mcpmarket.com/server/prometheus-6 ; Agent Router — «it will
  collect AI specific metrics and expose them to Prometheus for monitoring by default» (шлюз):
  https://theagentrouter.ai/docs/next/capabilities/observability/metrics/
- [Россия] [СНГ] Агрегаторы из восьми списков vc.ru и DTF (выдача запроса об AllGPT; списки —
  https://vc.ru/top_rating/2310121-gde-nayti-gotovie-prompty-dlya-chatgpt-i-drugikh-neurosetei ,
  https://vc.ru/top_rating/2722641-6-luchshikh-servisov-dlya-generatsii-promtov ,
  https://vc.ru/top_rating/2310166-luchshie-servisy-dlya-sozdaniya-promtov ,
  https://vc.ru/top_rating/2721141-top-6-ai-promt-generatorov-dlya-neurossetey ,
  https://dtf.ru/top_rating/4762610-6-luchshikh-generatorov-promtov-dlya-neurossetey ,
  https://dtf.ru/flood/4425619-agregator-neyrosetey-6-luchshikh-saytov-dlya-rabotyi-s-ii ,
  https://vc.ru/top_rating/3083584-sayty-dlya-generatsii-promtov-dlya-ii-luchshie-servisy-i-ikh-osobennosti
  , https://dtf.ru/howto/4837859-20-luchshikh-agregatorov-neurosetey). Кнопки в списках ведут через
  партнёрские переадресации. Собственная страница каждого сервиса открыта 2026-10-01: BotHub
  (https://bothub.ru/) — в меню раздел «Промпты» (библиотека), «Улучшение текста» правит тексты, а
  не запросы; Сигмачат (https://sigma-chat.ru/) и Gerwin (https://gerwin.io/) — «все нейросети в
  одном месте», инструмента для запросов нет, у Gerwin есть только руководство по промптам; Syntx
  (https://syntx.ai/) — бот и приложение со 100+ моделями, инструмента запросов не описано; AIR
  (https://air.fail/), Unitool (https://unitool.ai/ru), Mitup AI (https://ai.mitup.ru/), RouterAI
  (https://routerai.ru/), Jayflow (https://jayflow.ai/) — агрегаторы и шлюзы без инструмента для
  запросов; AI Wiz (https://aiwiz.ru/) — «350+ Отборных Промптов» (библиотека); EpicAI
  (https://epicai.ru/) — «Создавайте промтов и ассистентов самостоятельно, либо воспользуйтесь
  существующей базой»; F5 AI (https://f5ai.ru/) — шаблоны с готовыми промптами для сотрудников; VIS
  AI (https://ai.vis.center/) — «Библиотека промптов» (все — п. (б)); Clipia (https://clipia.ai/) —
  «Промпт-инженер — Соберите идеальный промпт» и «5000+ готовых шаблонов промптов», но для генерации
  изображений и видео (п. (ж)); RuGPT (https://rugpt.io/) — страница отдаёт пустой документ,
  TalkPilot (https://talkpilot.ru/) — не ответил (п. (е)). Study24.ai, GoGPT, GPTunnel, MashaGPT,
  ChadGPT и AllGPT проверены раньше (см. выше).
- [мир] Статьи, руководства и подборки из выдач — это не продукты (все открыты 2026-10-01, если не
  сказано иное): об отчёте `/insights` — https://blog.vincentqiao.com/en/posts/claude-code-insights/
  , https://prosperinai.substack.com/p/claude-code-insights-command ; об agents-observe —
  https://www.blog.brightcoding.dev/2026/08/07/simple10agents-observe-real-time-dashboard-for-claude-code-sessions
  ; о панели AI Beacon — https://blog.marcnuri.com/ai-coding-agent-dashboard (по ней найден продукт,
  строка в таблице); о Prompt Coach (hancengiz) —
  https://www.cengizhan.com/p/claude-code-prompt-coach-skill-to (описывает тот же навык); о запросах
  — https://ai.gov.uk/knowledge-hub/prompts/improve-your-prompt-writing-skills/ ,
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12671783/ , https://arxiv.org/abs/2310.05191
  (исследования об обучении письму, не инструменты); о Prometheus и наблюдаемости —
  https://callsphere.ai/blog/agent-monitoring-prometheus-grafana-ai-specific-dashboards-2026 ,
  https://activewizards.com/blog/llm-observability-a-guide-to-monitoring-with-langsmith/ ,
  https://www.glukhov.org/observability/observability-for-llm-systems/ ,
  https://www.getmaxim.ai/articles/llm-observability-with-prometheus-metrics-and-dashboards/ ,
  https://www.agentcenter.cloud/blogs/agentcenter-vs-prometheus ; подборки платформ наблюдаемости —
  https://arize.com/blog/best-ai-observability-tools-for-autonomous-agents-in-2026/ ,
  https://www.getmaxim.ai/articles/top-5-tools-for-ai-agent-observability-in-2026/ ,
  https://www.confident-ai.com/knowledge-base/compare/best-ai-agent-observability-tools-2026 ,
  https://www.confident-ai.com/knowledge-base/compare/10-llm-observability-tools-to-evaluate-and-monitor-ai-2026
  , https://mlflow.org/top-5-agent-observability-tools/ ,
  https://pydantic.dev/articles/best-ai-observability-platform ,
  https://www.ayautomate.com/blog/best-ai-agent-observability-tools ,
  https://openobserve.ai/blog/llm-observability-tools/ ,
  https://latitude.so/blog/best-ai-observability-tools-agents-2026 ; о Guardrails AI —
  https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/third-party-scorers/guardrails ,
  https://qaskills.sh/blog/guardrails-ai-validators-guide-2026 ,
  https://theneuralbase.com/guardrails-ai/learn/beginner/guardrails-ai-validators-for-llm-outputs/ ,
  https://theneuralbase.com/guardrails/qna/how-to-create-validators-with-guardrails-ai/ ,
  https://adhdecode.com/articles/ai-security/ai-security-llm-output-validation-guardrails/ ; не
  открылись (403, Cloudflare): три статьи на Medium о Guardrails AI и одна об AgentPulse, статья на
  Medium о метриках агентов (teknasyon), статья о Mission Control на pub.towardsai.net.

**Открыты, но не дали нужного или в файл не вошли.**

- https://seedlegals.com/resources/founder-interview-pretty-prompt/ — 403.
- https://en.wowtale.net/2026/09/18/235150/ (раунд A Raindrop) — 403; сведения о раунде в файл не
  вошли.
- https://research.contrary.com/company/langchain — отчёт от 31.01.2025, устарел; вместо него —
  SiliconANGLE.
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-tools —
  переадресовала на руководство по промптам, где об улучшателе ничего нет; вместо неё — блог
  claude.com.
- https://wandb.ai/site/pricing/ — переадресация на https://coreweave.com/forge-pricing;
  https://docs.wandb.ai/weave/guides/integrations/claude_code — переадресация на
  docs.coreweave.com (обе новые страницы использованы).
- https://helicone-helicone-7.mintlify.app/observability/sessions — копия документации Helicone на
  временном домене Mintlify; не использована, потому что не ясно, официальная ли она.
- https://astanahub.com/en/l/prompt-engineering — страница входа; https://astanahub.com/ru/article/astana-hub-stanovitsia-tsentrom-natsionalnykh-ai-initsiativ-kazakhstana
  — текст статьи не отобразился.
- https://mantra.gonewx.com/ — отдала только заголовок; использованы GitHub и документация.
- Страницы Chrome Web Store через WebFetch уходили в цикл переадресаций; открыты напрямую (curl) с
  параметром hl=en.

<!-- conclusion:start -->
## Выводы исследователя

Ниже — моя интерпретация фактов выше, а не проверенные факты. После доработок в таблице 127
продуктов вместо 54 в первом проходе. Выводы первого прохода в целом остались, но бесплатных
продуктов, близких к разбору всей сессии, стало заметно больше. Все выводы относятся к найденным
продуктам: классы просмотрщиков сессий, навыков разбора, улучшателей запросов и платформ
наблюдаемости поиском не закрываются (см. «Границу поиска» в «Где искали»).

**Полного разбора по шести элементам нет ни у одного продукта.** Ни в одной строке таблицы нет «да»
во всех шести столбцах. Больше всего «да» — пять:

- бесплатные навыки для Claude Code retro (netresearch) и session-audit (ai-builder-team): нет «да»
  только в постановке задачи (у retro она «частично», у session-audit не найдена);
- Latitude — платформа для команд, которые выпускают агентов в продакшен: «да» в действиях,
  вмешательствах, ошибках, потерянном времени и советах (после находки запускает кодового агента,
  который исправляет и открывает PR); постановка задачи не найдена.

В четырёх «да» — бесплатные agent-retro, навык Prompt Coach (hancengiz), analyze-sessions (набор
aoshimash) и session-analysis (карточка Git-Fg), а также продукты для команд: Failproof AI, Future
AGI, Galileo, Opik, Raindrop, Datadog Agent Console. Failproof AI работает с Claude Code, Codex и
Cursor через хуки, бесплатен для одного пользователя, команды платят $99 и $599 в месяц — это самый
близкий к Pixel Office платный продукт для агентов-программистов из найденных. В трёх «да»
(действия, ошибки, потерянное время) — бесплатные AgentsView и Claude Code Trace; AgentsView
бесплатен (MIT, 6 034 звезды на GitHub).

Все эти «да» опираются на описания самих авторов: README, документацию, блоги, тексты навыков,
демонстрации интерфейса. Независимой проверки качества разбора я не нашёл.

**Что уже закрыто и кем.**

- Постановку задачи оценивают коучи и улучшатели запросов — их в таблице 22 с «да» в постановке и
  без хода сессии: от Pretty Prompt и Microsoft Prompt Coach до MetaPrompt, SpacePrompts, русских
  PromptLab, FICHI.AI, PR-CY и узбекского Promptchi. Хода сессии они не видят.
- В разборе самой сессии постановку задачи оценивают как «да» vibe-log, навык Prompt Coach
  (hancengiz), SpecStory (Spec Score ставит оценку первому запросу сессии) и Claude Trace Replay
  (prompt-quality review); ещё Promptly записывает переписку, а Promptfoo оценивает запросы тестами,
  а не реальными сессиями.
- Вмешательства пользователя разбирают как «да» 13 продуктов: бесплатные плагины и навыки для Claude
  Code (agent-retro, retro, claude-retro-skill, claude-reflect, reflect от shfc, claude-smart,
  session-audit, analyze-sessions, session-analysis от outfitter, ConKeeper) и платформы Langfuse
  (шаблон сигналов разговора), Raindrop (сигнал User Frustration) и Latitude.
- Потерянное время как «да» находят 16 продуктов. Бесплатные: AgentsView (повторы вызовов, правки
  одних и тех же файлов, время вне инструментов), Claude Code Trace (через Jev: повторная работа,
  «thrashing»), burnboard (аудит потерь: повторно запущенные команды, опросы), retro, session-audit,
  навык hancengiz, analyze-sessions, session-analysis (Git-Fg). Для команд: Opik, Datadog Agent
  Console, Raindrop, Galileo, Laminar, Future AGI, Failproof AI, Latitude.
- Советы на следующий запуск («да») дают 26 продуктов: платформы для команд (Arize, Braintrust,
  Opik, Galileo, Percival, Datadog Agent Console, Future AGI, Failproof AI, Latitude), SpecStory на
  тарифе Pro и бесплатные навыки и плагины разбора.
- Ни у одного продукта нет «да» одновременно в постановке задачи и во вмешательствах пользователя.

**Кто платит и сколько.**

1. **Компании, которые строят агентов.** Платят за трассировку с ИИ-разбором. Первые платные тарифы
   — от $19 до $299 в месяц: Opik, Grafana Cloud, Sentry, Langfuse, Laminar, LangSmith за место,
   SigNoz, Pydantic Logfire, Arize, W&B, Failproof AI, Latitude, Galileo, Honeycomb, Datadog,
   Braintrust, Raindrop; у Confident AI — $200. Следующие ступени дороже — например, $599 в месяц у
   Failproof AI и $2 000 у Confident AI. У New Relic и Future AGI оплата по объёму. Корпоративный
   уровень — $2 499 в месяц у Langfuse, у остальных — по договору.
2. **Руководители разработки.** Платят за панели по агентам-программистам: $10 за разработчика в
   месяц у Dash0; у Jellyfish — по числу мест и модулей, по запросу; у AWS — по объёму метрик. У
   Datadog Agent Console цена и платный доступ на открытых страницах не названы.
3. **Отдельные люди.** Платят за улучшение запросов: около $8 в месяц при оплате за год (Pretty
   Prompt), $5,99 (MetaPrompt), $7 (Prompt Fixer), $5–9 (SpacePrompts), от 499 до 2 499 ₽ в месяц у
   русских сервисов (у агрегаторов улучшатель входит в общий тариф). За разбор своих сессий с
   агентом-программистом отдельный человек по найденным данным платит мало или не платит:
   - бесплатны AgentsView, Claude Code Trace, burnboard, vibe-log, Sniffly, навыки ретро и
     визуализаторы; бесплатный тариф Failproof AI рассчитан на одного пользователя;
   - у Mantra воспроизведение сессий бесплатно, платные только синхронизация и публикация ($4–10 в
     месяц);
   - у SpecStory разбор на тарифе Pro, у расширения Claude Code and Codex Assist платные функции в
     Pro, но цену обоих я не нашёл;
   - AgentCenter ($14 в месяц и выше) и OpenClawHQ ($49 в месяц) продаются владельцам агентов
     OpenClaw, но это управление агентами, а не разбор сессий агента-программиста.

**Чем подтверждена оплата.** Данные о деньгах не от самой компании — выручка или покупки — есть
только у двух продуктов:

- LangChain — выручка по данным TechCrunch в пересказе SiliconANGLE;
- Pretty Prompt — 5 200+ покупок на AppSumo и оценка Latka около $220 тыс. за 2025 год.

У Braintrust пресса называет клиентов, но без сумм. У остальных — только страницы цен и слова самих
компаний: клиенты, «пользователи», «Most teams pay nothing» у Future AGI. Microsoft сообщает о 30+
млн платных мест Copilot, но сколько из них пользуются Prompt Coach, неизвестно. По продуктам,
найденным 2026-10-01, независимых данных об оплате нет; рядом с ценой есть только счётчики:
например, у MetaPrompt 100,000 установок в Chrome Web Store при платном плане $5,99 в месяц —
установки не оплаты.

**Значение для Pixel Office.** Формулировка «разбор всей сессии, а не одного запроса» сама по себе не отличие:

- бесплатные приложения, плагины и навыки для Claude Code уже разбирают сбои, повторы, исправления
  пользователя и лишние действия, а часть — предлагает правки в CLAUDE.md и хуки (AgentsView, Claude
  Code Trace, burnboard, retro, session-audit, analyze-sessions);
- Failproof AI и Latitude делают это с платными командными тарифами;
- в самом Claude Code есть команда `/insights` с отчётом «where things go wrong», и уже есть
  бесплатные утилиты, которые превращают этот отчёт в правила и навыки (claude-insights,
  insight-extractor);
- платные продукты с автоматическим разбором продаются командам, а не отдельному пользователю.

Незакрытым выглядит сочетание всех шести элементов в одном разборе, где «да» стоит и в постановке
задачи, и во вмешательствах. Сюда же — подача для отдельного человека, а не для команды или
руководителя. Спрос на такую подачу по найденным данным не подтверждён: всё похожее для отдельных
людей бесплатно или берёт деньги не за разбор. Вывод «не закрыто» относится к 127 найденным
продуктам; новые просмотрщики, навыки и панели появляются быстрее, чем поиск их закрывает, поэтому
перед запуском страницы его нужно перепроверить.

**Казахстан и СНГ.** Казахстанских продуктов нет. В России и Узбекистане есть улучшатели запросов
(дешёвые или бесплатные) и мониторинг трасс для компаний: Yandex Monium показывает трассы, а у
HiveTrace мониторинг агентов пока помечен «Скоро». Разбора всей сессии на русском языке я не нашёл;
24 агрегатора из списков vc.ru и DTF проверены по своим страницам: улучшатель запросов нашёлся у
двух (Vlex AI и FICHI.AI), у остальных — библиотеки запросов или ничего; разбора сессии нет ни у
одного. Для казахстанского пользователя Claude Code разбор сессии сейчас доступен только через
зарубежные, в основном англоязычные, инструменты.
<!-- conclusion:end -->
