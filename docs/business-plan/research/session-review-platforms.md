# Исследование: разбор всей сессии агента в самих агентных платформах

Продуктовая линия: `session-review-platforms`. Шаг WF-07 / 1, прогон BP-20260930-01, handoff
`handoffs/BP-20260930-01/step-01-market-researcher-session-review-platforms.json`, требование
REQ-006 (`docs/requirements.yaml`). Роль: MARKET-RESEARCHER. Отправная точка —
`docs/business-plan/research/pixel-office.md`, разделы 2 и 7. Факты первой версии взяты со страниц,
открытых 2026-09-30; факты, добавленные или исправленные в доработках r2 и r3, — со страниц, открытых
2026-10-01. Цифры и цитаты — как на открытой странице.

Доработка r2 (handoff `handoffs/BP-20260930-01/step-01-market-researcher-session-review-platforms-r2.json`)
исправляет замечания шага 1b и добавляет 14 строк (13 платформ из списка непроверенных и Roomote,
на сайт которого ведёт roocode.com). Доработка r3 (handoff
`handoffs/BP-20260930-01/step-01-market-researcher-session-review-platforms-r3.json`) исправляет пять
поправок второго раунда шага 1b, записывает правило для показанного плана и добавляет три строки
(OpenCode, Crush, Zoo Code). Факты, добавленные или исправленные в доработках: у таких пунктов
стоит «(проверено 2026-10-01)», у новых разделов — в заголовке. Остальные факты — со страниц, открытых
2026-09-30. Кроме того, 2026-10-01 все ссылки файла открыты повторно, а цитаты в кавычках, цены и
числа сверены с текстом страниц; то, что разошлось, исправлено и помечено. Между проверками менялась
страница Google Antigravity; журнал изменений Codex на learn.chatgpt.com меняется между загрузками.

Предмет — разбор всей рабочей сессии агента по шести элементам из второго отзыва рецензента
(`docs/business-plan/reviews/2026-09-30-external-review.md`, раздел 3): постановка задачи →
действия агента → вмешательства пользователя → ошибки → потерянное время → советы на следующий
запуск. «Агентная платформа» здесь — продукт, в котором человек сам ставит задачу агенту и работает
с ним в сессии: IDE, терминал, облачный агент, приложение. Отдельные продукты и сервисы разбора —
предмет параллельного файла `session-review-tools.md` (REQ-006, description); платформы для
разработчиков собственных агентов в таблицу не входят (см. «Где искали»).

Правило включения строк — одно для всех платформ (как во втором файле этого прогона): **агентная
платформа, которую я нашёл и чью официальную страницу открыл, получает строку в таблице.** Продукт,
который продан, переименован, закрыт или закрыт для новых клиентов (в том числе для части клиентов),
строку тоже получает, если его страница открылась; это сказано в столбце «Рынок» и в разделе
платформы. Платформа, чья официальная страница не открылась, строки не получает; что не открылось —
в «## Где искали».

Метки:
- **[мир]**, **[Казахстан]**, **[СНГ]**, **[Россия]** — к какому рынку относится факт;
- **[вендор]** — утверждение компании о себе: документация, цены, журнал изменений, блог компании,
  исходный код самой компании;
- **[независимо]** — источник, который не продаёт описываемый продукт: разбор стороннего автора,
  научная работа;
- **[СМИ]** — пресса, новостной или бухгалтерский портал;
- **[пользователь]** — сообщение пользователя вне компании (например, issue на GitHub);
- **[сторонний блог]** — блог компании, которая продаёт другой продукт; это не независимый
  источник.

## Что нашли (проверено 2026-09-30)

### 1. Есть ли разбор всей сессии в Claude Code и других агентных платформах?

Коротко по каждой платформе из вопроса; подробности и цитаты — в разделах 2–14, сводка — в таблице
«Покрытие разбора всей сессии».

- **Claude Code.** Функции, которая разбирает одну сессию по всем шести элементам, на открытых
  страницах документации не найдено. Есть три близкие функции [мир][вендор]:
  - `/insights` — HTML-отчёт по недавним сессиям на этой машине, до 200 новых сессий за запуск:
    чем вы заняты, трения вроде неверно понятых запросов и ошибочного кода, советы;
  - `/recap` — резюме текущей сессии, не длиннее 400 символов;
  - `/usage` — стоимость, длительность (по API и «настенная») и изменения кода текущей сессии.

  Источники: https://code.claude.com/docs/en/costs ; https://code.claude.com/docs/en/interactive-mode
- **GitHub Copilot.** Разбор одной сессии не найден. Есть `/chronicle` — сводки, советы и
  предложения к custom instructions по истории сессий. В том числе он ищет места, где пользователю
  пришлось поправлять агента [мир][вендор]:
  https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/chronicle
- **Cursor.** Разбор одной сессии не найден. На тарифе Enterprise есть Conversation Insights. Это
  классификация каждой сессии агента на командной панели: категория, тип работы, сложность,
  конкретность запросов [мир][вендор]: https://cursor.com/docs/account/teams/analytics
- **Codex.** Разбор одной сессии не найден. В CLI есть автоматические резюме (recaps) и короткая
  длительность хода в строке после ответа [мир][вендор] (проверено 2026-10-01):
  https://github.com/openai/codex/releases/tag/rust-v0.156.0 ;
  https://github.com/openai/codex/releases/tag/rust-v0.159.0
- **Claude (приложения и claude.ai).** Разбор одной сессии не найден. Есть Reflect (бета) — сводка
  использования за 1–12 месяцев с практическими советами. В ней есть разбор по навыкам, в том числе
  насколько хорошо пользователь описывает цели, с примерами того, как он работает с Claude
  (проверено 2026-10-01). В Cowork видны план, ход работы и результат [мир][вендор]:
  https://www.anthropic.com/news/reflect-with-claude ;
  https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork
- **Другие платформы.**
  - Devin (Cognition) — разбор одной завершённой сессии как отдельная функция, Session Insights.
    В нём шкала событий, найденные проблемы с оценкой влияния, переписанный запрос и пункты
    действий; без доплаты [мир][вендор]: https://docs.devin.ai/product-guides/session-insights
  - Augment Code (Cosmos) — по запросу пользователя Cosmos Advisor разбирает сессию, которая упала,
    зависла или дала плохой результат: находит корневую причину и указывает, что исправить. По
    накопленным сессиям Advisor ищет повторяющиеся сбои и зависшие сессии и советует, например,
    поправить промпт [мир][вендор] (проверено 2026-10-01):
    https://docs.augmentcode.com/cosmos/sessions-overview ;
    https://docs.augmentcode.com/cosmos/advisor/overview
  - Gemini CLI — итоговая статистика при выходе из сессии: вызовы инструментов, доля успешных, доля
    одобренных пользователем, время [мир][вендор]:
    https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/ui/components/StatsDisplay.tsx
  - У остальных проверенных платформ разбора одной сессии не найдено. Есть журнал, краткое резюме
    действий или счётчики (разделы 7–12) [мир].

**Как заполнена таблица.**

| Значение | Когда ставится |
|---|---|
| «да» | Встроенная функция платформы, видимая пользователю, разбирает этот элемент для одной конкретной сессии, и это описано на открытой странице |
| «частично» | Элемент есть не полностью: только в сводке по многим сессиям; или только показ, счётчик, краткое резюме без разбора; или только на части тарифов. Что именно — в разделах 2–12 |
| «нет» | Открытая страница прямо говорит, что такой функции нет |
| «не найдено» | На открытых страницах и в поиске не нашёл; где искал — в «## Где искали» |

Три уточнения, одни для всех строк:
- сырые данные для собственного разбора (экспорт OpenTelemetry, хуки) в ячейки не засчитываются;
  они перечислены в разделах платформ;
- память, которую агент сохраняет сам для себя, не засчитывается как «советы на следующий запуск»;
  засчитываются рекомендации и правки инструкций, построенные по сессиям;
- план или запрос, который платформа показывает пользователю, — это показ действий агента, а не
  разбор постановки задачи. Сюда относятся план до работы (Cowork, Jules, режим Plan в OpenCode,
  режим Architect в Zoo Code, `/plan` и `/grill-me` в Antigravity), строка «prompt, plan, commands,
  logs, messages, and output» в запуске Warp и исходный запрос в записи треда. Такой показ
  засчитывается в «Действия агента» и никогда — в «Постановка задачи». В «Постановка задачи»
  засчитывается только оценка, классификация или переписывание формулировки задачи пользователя:
  по одной сессии (Devin) или сводно по многим (`/insights`, `/chronicle`, Reflect, Specificity в
  Cursor, совет поправить промпт у Augment Code). Это правило само «да» не создаёт.

### Покрытие разбора всей сессии

| Продукт | Постановка задачи | Действия агента | Вмешательства пользователя | Ошибки | Потерянное время | Советы на следующий запуск | Цена | Кто платит | Рынок | Источники |
|---|---|---|---|---|---|---|---|---|---|---|
| Claude Code | частично | частично | частично | частично | частично | частично | Free — Claude Code не входит; Pro $20 в месяц ($17 при оплате за год); Max от $100 (5x — $100, 20x — $200); Team — место $25 в месяц ($20 за год), премиум-место $125 ($100 за год); Enterprise — $20 за место в месяц при оплате за год плюс использование по ценам API; цены без налогов. `/insights` — на любом тарифе и у любого провайдера, анализ расходует лимит тарифа или токены API; session recap включён на всех тарифах [вендор] | пользователь (Pro, Max) или организация (Team, Enterprise); при работе через API — тот, кто оплачивает API по токенам | [мир]; доступен в Казахстане по списку стран Anthropic [Казахстан] | https://code.claude.com/docs/en/costs ; https://code.claude.com/docs/en/commands ; https://code.claude.com/docs/en/interactive-mode ; https://code.claude.com/docs/en/agent-view ; https://www.zolkos.com/2026/02/03/deep-dive-how-claude-codes-insights-command-works.html ; https://claude.com/pricing ; https://support.claude.com/en/articles/11049741-what-is-the-max-plan ; https://www.anthropic.com/supported-countries |
| GitHub Copilot | частично | частично | частично | частично | частично | частично | Free $0; Pro $10; Pro+ $39; Max $100 в месяц; Business $19 и Enterprise $39 за место в месяц; `/chronicle` — всем пользователям Copilot CLI с версии 1.0.40 (01.05.2026), в Business и Enterprise администратор сначала включает синхронизацию сессий [вендор] | пользователь (Free, Pro, Pro+, Max) или организация (Business, Enterprise) | [мир]; Казахстана нет в перечне стран, куда Copilot нельзя продавать (там Россия и Беларусь) [Казахстан][СНГ] | https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/chronicle ; https://github.blog/changelog/2026-06-02-gain-insights-across-your-agent-sessions-with-chronicle/ ; https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/track-copilot-sessions ; https://github.com/github/copilot-cli/blob/main/changelog.md ; https://docs.github.com/en/copilot/get-started/plans ; https://docs.github.com/en/site-policy/other-site-policies/github-and-trade-controls |
| Cursor | частично | частично | не найдено | не найдено | не найдено | не найдено | Hobby — бесплатно; Individual: Pro $20, Pro+ $60, Ultra $200 в месяц; Teams — $40 за пользователя в месяц; Enterprise — по договору; цены без налогов. Conversation Insights — только Enterprise, бесплатно в период превью, с 01.01.2026 оплачивается инференс [вендор] | пользователь или команда; Conversation Insights — организация на Enterprise | [мир]; регионы — как у поставщиков моделей, в их списках Казахстан есть [Казахстан] | https://cursor.com/docs/account/teams/analytics ; https://cursor.com/changelog/side-chat ; https://cursor.com/pricing ; https://cursor.com/docs/account/regions |
| Codex | не найдено | частично | не найдено | не найдено | частично | не найдено | входит в тарифы ChatGPT: Free $0, Go $8, Plus $20, Pro $100, $200 или $500 в месяц; Business $20 за пользователя в месяц при оплате за год (от 2 пользователей; $25 помесячно); Enterprise и Edu — по договору [вендор] | пользователь или организация | [мир]; Казахстан в списке стран API OpenAI [Казахстан]; список стран ChatGPT не открылся | https://github.com/openai/codex/releases/tag/rust-v0.156.0 ; https://github.com/openai/codex/releases/tag/rust-v0.159.0 ; https://github.com/openai/codex/pull/48352 ; https://learn.chatgpt.com/docs/changelog ; https://learn.chatgpt.com/docs/cloud ; https://learn.chatgpt.com/docs/pricing ; https://developers.openai.com/api/docs/supported-countries |
| Claude (приложения и claude.ai) | частично | частично | частично | не найдено | не найдено | частично | Free $0; Pro $20 в месяц ($17 за год); Max от $100; Team; Enterprise. Reflect — бета на Free, Pro и Max с включённой памятью; Cowork — на Pro, Max, Team, Enterprise [вендор] | пользователь или организация | [мир]; Claude.ai доступен в Казахстане по списку стран Anthropic [Казахстан] | https://www.anthropic.com/news/reflect-with-claude ; https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork ; https://claude.com/pricing ; https://www.anthropic.com/supported-countries |
| Devin (Cognition) | да | да | частично | да | частично | да | Session Insights — для всех завершённых сессий без доплаты; тарифы: Free $0, Pro $20, Max $200 в месяц; Teams — $80 в месяц плюс $40 за место разработчика; Enterprise — по договору [вендор] | пользователь, команда или организация | [мир]; доступность в Казахстане — не найдено | https://docs.devin.ai/product-guides/session-insights ; https://docs.devin.ai/use-cases/gallery/analyze-session-acu-efficiency ; https://docs.devin.ai/release-notes/2025 ; https://devin.ai/pricing |
| Devin Desktop (бывший Windsurf) | не найдено | частично | не найдено | не найдено | не найдено | не найдено | те же тарифы, что у Devin: Free $0, Pro $20, Max $200 в месяц, Teams $80 плюс $40 за место, Enterprise — по договору [вендор] | пользователь, команда или организация | [мир]; Windsurf переименован в Devin Desktop [вендор] | https://devin.ai/desktop ; https://docs.devin.ai/desktop/cascade/cascade |
| Gemini CLI (Google) | не найдено | частично | частично | частично | частично | не найдено | с 18.06.2026 — по подпискам Gemini Code Assist Standard и Enterprise (их цены на открытых страницах не извлеклись); тарифы для частных лиц переведены на Antigravity [вендор] | организация с подпиской Gemini Code Assist | [мир]; с 18.06.2026 Gemini CLI не обслуживает частные аккаунты (Gemini Code Assist for individuals, Google AI Pro, Google AI Ultra), их перевели на Antigravity; для подписок Standard и Enterprise доступ прежний [вендор]; Казахстан в списке регионов Gemini API [Казахстан] | https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/ui/components/StatsDisplay.tsx ; https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/ui/components/SessionSummaryDisplay.tsx ; https://geminicli.com/docs/reference/commands/ ; https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals ; https://ai.google.dev/gemini-api/docs/available-regions |
| Google Antigravity | не найдено | частично | частично | частично | не найдено | частично | для частных лиц — $0 в месяц; Google AI Pro и Google AI Ultra — цены на странице не показаны; организациям — «Business plan via Google Cloud»: доступ через API с оплатой по потреблению, а для подходящих клиентов Gemini Enterprise — планы Standard/Plus от $30 за место в месяц и план pay-as-you-go без платы за место (страница изменилась 2026-10-01) [вендор] | пользователь или организация | [мир]; доступность в Казахстане — не найдено | https://antigravity.google/docs/walkthrough ; https://antigravity.google/docs/slash-commands/ ; https://antigravity.google/pricing |
| Jules (Google) | не найдено | частично | не найдено | не найдено | не найдено | не найдено | бесплатно — 15 задач в сутки; в Google AI Pro — 100, в Ultra — 300; платные тарифы только для личных аккаунтов @gmail.com; цены на странице не указаны [вендор] | пользователь | [мир]; доступность в Казахстане — не найдено | https://jules.google/docs/ ; https://jules.google/docs/changelog/ ; https://jules.google/docs/usage-limits/ |
| Kiro (AWS) | не найдено | частично | не найдено | не найдено | не найдено | не найдено | Free $0 (50 кредитов); Pro $20, Pro+ $40, Pro Max $100, Power $200 за пользователя в месяц; сверх лимита — $0,04 за кредит; Enterprise — по договору [вендор] | пользователь или команда | [мир] | https://kiro.dev/docs/cloud-sessions/ ; https://kiro.dev/pricing/ |
| Junie (JetBrains) | не найдено | частично | не найдено | не найдено | не найдено | не найдено | старт — 5 AI-кредитов или свой API-ключ; AI Pro — $8,33, AI Ultimate — $25 за пользователя в месяц [вендор] | пользователь или организация | [мир] | https://junie.jetbrains.com/docs/slash-commands.html ; https://junie.jetbrains.com/ |
| Amp | не найдено | частично | не найдено | не найдено | не найдено | не найдено | Hobby — бесплатно, оплата по факту; Individual — $20 в месяц (вариант Megawatt); для команд — без доплаты; Enterprise — по договору [вендор] | пользователь; расходы треда — на его владельце | [мир] | https://ampcode.com/docs/threads ; https://ampcode.com/docs/pricing |
| Replit Agent | не найдено | частично | не найдено | не найдено | не найдено | не найдено | Core $20 в месяц ($18 при оплате за год); Pro $100 ($90 за год); Enterprise — по договору; налог — в зависимости от места [вендор] | пользователь или организация | [мир] | https://docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks ; https://replit.com/pricing |
| Factory (Droid) | не найдено | не найдено | не найдено | не найдено | не найдено | не найдено | Pro $20, Plus $100, Max $200 в месяц; Factory Analytics — для Enterprise [вендор] | пользователь; аналитика — организация на Enterprise | [мир] | https://factory.com/news/factory-signals ; https://factory.com/news/factory-analytics ; https://docs.factory.com/factory-app/overview ; https://docs.factory.com/pricing |
| OpenHands | не найдено | частично | не найдено | частично | частично | нет | open source — бесплатно; облако для одного пользователя — бесплатно, модели по себестоимости; Enterprise — по договору [вендор] | пользователь (оплачивает модели) или организация (Enterprise) | [мир] | https://www.openhands.dev/blog/new-in-agent-canvas-august-2026 ; https://github.com/OpenHands/extensions/issues/373 ; https://github.com/OpenHands/extensions/pull/695 ; https://www.openhands.dev/pricing |
| SourceCraft Code Assistant (Яндекс) | не найдено | частично | не найдено | не найдено | не найдено | не найдено | с 01.10.2026: Free 0 ₽; Start 1 190 ₽; Go 2 490 ₽; Go X5 5 490 ₽; Go X15 11 490 ₽ за лицензию участника в месяц с НДС; в тенге — 0, 5 950, 12 450, 27 450, 57 450 ₸ [вендор] | организация через платёжный аккаунт: администратор назначает подписки участникам, активная лицензия оплачивается каждый месяц; квота нейрокредитов — личная у каждого участника | [Россия]; на странице цен есть цены в тенге [Казахстан] | https://sourcecraft.dev/portal/docs/ru/code-assistant/operations/jb-agent ; https://sourcecraft.dev/portal/docs/ru/code-assistant/release-notes ; https://sourcecraft.dev/portal/docs/ru/sourcecraft/pricing |
| GigaCode (СберТех) | не найдено | не найдено | не найдено | не найдено | не найдено | не найдено | «Персональный» — бесплатно; «Бизнес» — от 1 699 ₽ за пользователя в месяц [вендор] | пользователь или организация | [Россия]; доступность в Казахстане — не найдено | https://gitverse.ru/features/gigacode/ |
| Cline | не найдено | частично | не найдено | не найдено | не найдено | не найдено | open source — бесплатно, оплачивается только инференс; Enterprise — по договору [вендор] | пользователь (оплачивает инференс) или организация (Enterprise) | [мир] | https://docs.cline.bot/core-workflows/using-commands ; https://docs.cline.bot/core-workflows/checkpoints ; https://cline.bot/pricing |
| Kilo Code | не найдено | частично | не найдено | не найдено | не найдено | не найдено | для частного лица — $0 плюс инференс по ценам поставщиков; Teams — $15 за пользователя в месяц; Enterprise — по договору; Kilo Pass — от $19 в месяц, по желанию [вендор] | пользователь или команда | [мир] | https://kilo.ai/docs/collaborate/sessions-sharing ; https://kilo.ai/docs/collaborate/teams/analytics ; https://kilo.ai/teams |
| Roo Code (RooCodeInc/Roo-Code) | не найдено | не найдено | не найдено | не найдено | не найдено | не найдено | не найдено: roocode.com и roocode.com/pricing перенаправляют на roomote.dev, а там цены Roomote, не Roo Code | не найдено | [мир]; по README расширение закрыто 15.05.2026, репозиторий в архиве | https://github.com/RooCodeInc/Roo-Code ; https://roocode.com/pricing |
| Roomote (roomote.dev) | не найдено | не найдено | не найдено | не найдено | не найдено | не найдено | облако: до 10 пользователей $49 в месяц, 11–50 — $249, 51–100 — $499, больше — по договору; своя установка — бесплатно до 10 пользователей; ключ инференса — свой [вендор] | команда | [мир] | https://roomote.dev/ |
| Continue | не найдено | частично | не найдено | не найдено | не найдено | не найдено | не найдено: на сайте — только сообщение, что компанию купил Cursor [вендор] | не найдено | [мир]; компания куплена Cursor | https://docs.continue.dev/ide-extensions/agent/quick-start ; https://www.continue.dev/ |
| Zed | не найдено | частично | не найдено | не найдено | не найдено | не найдено | Personal — $0; Pro — $10 в месяц ($5 токенов включено); Business — $30 за место в месяц [вендор] | пользователь или организация | [мир] | https://zed.dev/docs/ai/agent-panel ; https://zed.dev/pricing |
| Warp | не найдено | частично | не найдено | частично | частично | не найдено | Free $0; Build — от $20 в месяц; Max — от $200 в месяц; Business — от $50 за пользователя в месяц, до 25 мест; Enterprise — по договору [вендор] | пользователь или команда | [мир] | https://docs.warp.dev/platform/managing-cloud-agents/ ; https://www.warp.dev/pricing |
| Augment Code (Cosmos) | частично | частично | не найдено | да | частично | да | Standard — $20 в месяц за команду до 50 мест ($20 использования включено); Business — $100 в месяц; Enterprise — по договору; Cosmos входит в Standard и Business [вендор] | команда (одна цена за команду) | [мир] | https://docs.augmentcode.com/cosmos/sessions-overview ; https://docs.augmentcode.com/cosmos/advisor/overview ; https://www.augmentcode.com/pricing |
| Tabnine | не найдено | частично | не найдено | не найдено | не найдено | не найдено | не найдено: tabnine.com/pricing ведёт на tricentis.com, цен Tabnine там нет; компанию купила Tricentis (30.07.2026) [вендор] | не найдено: цен Tabnine на открытых страницах нет; расход против месячного бюджета или квоты видит администратор организации (страница Agent Usage) | [мир]; компания куплена Tricentis, сделка объявлена 30.07.2026 [вендор] | https://docs.tabnine.com/main/getting-started/tabnine-agent ; https://docs.tabnine.com/main/administering-tabnine/managing-your-team/reporting/agent-usage-page ; https://finance.yahoo.com/technology/ai/articles/tricentis-acquires-tabnine-further-scale-150000471.html |
| Amazon Q Developer (AWS) | не найдено | не найдено | не найдено | не найдено | не найдено | не найдено | Free Tier; Pro — $19 в месяц за пользователя; новые подписки закрыты с 15.05.2026, поддержка плагинов и платных подписок — до 30.04.2027, замена — Kiro [вендор] | только прежние клиенты: пользователь или организация | [мир]; закрыт для новых клиентов с 15.05.2026, поддержка плагинов и платных подписок — до 30.04.2027, замена — Kiro [вендор] | https://aws.amazon.com/blogs/devops/amazon-q-developer-end-of-support-announcement/ ; https://aws.amazon.com/q/developer/pricing/ |
| ChatGPT Work (OpenAI) | не найдено | частично | не найдено | не найдено | не найдено | не найдено | входит в тарифы ChatGPT: Free $0, Go $8, Plus $20, Pro $100, $200 или $500, Business $20 за пользователя в месяц при оплате за год, Enterprise и Edu — по договору; лимиты общие с Codex [вендор] | пользователь или организация | [мир]; Казахстан в списке стран API OpenAI [Казахстан]; список стран ChatGPT не открылся | https://learn.chatgpt.com/docs/get-started-with-work ; https://learn.chatgpt.com/docs/pricing |
| Manus | не найдено | частично | не найдено | не найдено | не найдено | не найдено | Free, Pro, Team; цены на открытых страницах не показаны [вендор] | пользователь или команда (общий пул кредитов) | [мир] | https://help.manus.im/en/articles/11711198-how-can-i-share-a-task ; https://manus.im/docs/features/wide-research ; https://manus.im/docs/introduction/plans.md |
| Bolt | не найдено | частично | не найдено | не найдено | не найдено | не найдено | Free $0; Pro — $25 в месяц; Teams — $30 в месяц за участника; Enterprise — по договору [вендор] | пользователь или команда | [мир] | https://support.bolt.new/building/using-bolt/rollback-backup ; https://bolt.new/pricing |
| Lovable | не найдено | частично | не найдено | частично | частично | не найдено | Free; Pro — от $25 в месяц (100 кредитов); Business — от $50 в месяц; Enterprise — по объёму [вендор] | пользователь или команда (рабочее пространство) | [мир] | https://docs.lovable.dev/features/projects/chat ; https://docs.lovable.dev/introduction/subscription-plans |
| OpenCode | не найдено | частично | не найдено | частично | не найдено | не найдено | сам OpenCode — бесплатно, открытый код (лицензия MIT); необязательные: Zen — оплата за запрос, кредиты пополняются; Go — $10 в месяц, Go Plus — $40 в месяц [вендор] | пользователь; в рабочей области Zen для команд (бета) администратор задаёт месячные лимиты расходов на участника | [мир]; доступность в Казахстане — не найдено | https://opencode.ai/ ; https://opencode.ai/docs/ ; https://opencode.ai/docs/cli/ ; https://opencode.ai/docs/tui/ ; https://opencode.ai/docs/share/ ; https://opencode.ai/docs/go/ ; https://opencode.ai/docs/zen/ ; https://github.com/anomalyco/opencode |
| Crush (Charm) | не найдено | частично | не найдено | не найдено | не найдено | не найдено | сам Crush — бесплатно, исходный код по лицензии FSL-1.1-MIT; модели — по своим ключам или через Hyper, провайдера от Charm: Free $0 (100 Hypercredits в месяц), подписка $20 в месяц, предоплатные пакеты $5, $10, $20 [вендор] | пользователь; у Hyper для команд — мастер-ключи и отчёты по моделям и пользователям | [мир]; доступность в Казахстане — не найдено | https://github.com/charmbracelet/crush ; https://hyper.charm.land/ |
| Zoo Code (Zoo-Code-Org/Zoo-Code) | не найдено | частично | не найдено | частично | не найдено | не найдено | расширение бесплатно, открытый код (лицензия Apache-2.0); со своими ключами оплата только провайдеру; Zoo Gateway — кредиты, подписка не нужна [вендор] | пользователь | [мир]; форк сообщества, продолжающий Roo Code, работу над которым закрыла команда Roo (по сайту и README Zoo Code) [вендор]; доступность в Казахстане — не найдено | https://www.zoocode.dev/ ; https://docs.zoocode.dev/basic-usage/the-chat-interface ; https://docs.zoocode.dev/features/checkpoints ; https://github.com/Zoo-Code-Org/Zoo-Code |

### 2. Claude Code (Anthropic)

- `/insights` [мир][вендор]. Отчёт — «a report on how you work rather than how many tokens you've
  used». Функция анализирует недавние сессии на этой машине и пишет HTML-отчёт: «what you work on,
  friction points such as misunderstood requests or buggy code, and suggestions for using Claude
  Code more effectively».
  - Объём: за запуск — до 200 ещё не разобранных сессий, очень короткие пропускаются.
  - Если доступен auto mode, отчёт может оценить, сколько запросов разрешений auto mode обработал
    бы в этих сессиях.
  - Хранение: отчёт — `~/.claude/usage-data/report.html`, удаляется вместе с данными сессий,
    по умолчанию через 30 дней.
  - Доступ и оплата: «You can run /insights on any plan and with any provider». Токены анализа
    идут в лимит тарифа или счёт API. Сессии с других устройств и из claude.ai не входят.

  Источник: https://code.claude.com/docs/en/costs
- Справочник команд [мир][вендор]:
  - `/insights` — «Generate an HTML report analyzing your recent sessions on this machine: which
    projects you work in, how you use Claude Code, where things go wrong, and features to try. Not
    available in cloud sessions»;
  - `/export` — разговор как простой текст;
  - `/rewind` — откат к чекпоинту или резюме части разговора.

  Источник: https://code.claude.com/docs/en/commands
- Как `/insights` устроен внутри — разбор стороннего автора Роба Золкоса, 03.02.2026
  [мир][независимо]:
  - по каждой сессии модель извлекает «facets»: `underlying_goal`, `outcome`, `friction_counts`,
    `friction_detail`, `user_satisfaction_counts`, `claude_helpfulness`, `brief_summary` и др.;
  - без модели считаются `duration_minutes`, `user_interruptions`, `tool_errors`, `first_prompt`,
    строки и файлы и др.;
  - типы трений: `misunderstood_request`, `wrong_approach`, `buggy_code`, `user_rejected_action`,
    `claude_got_blocked`, `user_stopped_early`, `excessive_changes`, `slow_or_verbose`,
    `tool_failed`, `user_unclear`, `external_issue` и др.;
  - отчёт сводный по всем отобранным сессиям;
  - предложения: `claude_md_additions`, `features_to_try`, `usage_patterns`.

  На момент разбора лимит был 50 новых сессий за запуск; сейчас в документации — 200 (см. выше).
  Источник: https://www.zolkos.com/2026/02/03/deep-dive-how-claude-codes-insights-command-works.html
- Session recap [мир][вендор]. Когда пользователь возвращается к терминалу, Claude Code показывает
  однострочное резюме того, что произошло в сессии.
  - Условия: терминал не в фокусе не меньше трёх минут после завершённого хода, в сессии не меньше
    трёх ходов.
  - `/recap` — то же по запросу. Автоматическое резюме и `/recap` — не длиннее 400 символов.
  - Включено по умолчанию на всех тарифах и у всех провайдеров.

  Источник: https://code.claude.com/docs/en/interactive-mode. Функция вошла в обзор недели
  20–24.04.2026: https://code.claude.com/docs/en/whats-new/2026-w17
- `/usage` [мир][вендор].
  - Блок Session: `Total cost`, `Total duration (API)`, `Total duration (wall)`,
    `Total code changes`, использование по моделям, статистика кэша запросов.
  - На Pro, Max, Team, Enterprise — разбивка расхода лимитов: доли навыков, субагентов,
    MCP-серверов. «Behavior flags» (длинный контекст, промахи кэша) показываются, если поведение
    даёт 10% и больше недавнего использования, с советом, как его сократить.

  Источник: https://code.claude.com/docs/en/costs
- Agent view, research preview [мир][вендор]. В строке каждой сессии — однострочная сводка от модели
  класса Haiku: «what the session is doing, what it needs, or what it produced». Возраст
  завершённой сессии замирает на длительности прогона:
  https://code.claude.com/docs/en/agent-view
- Хранение сессий [мир][вендор].
  - Полная расшифровка хранится как JSONL: `~/.claude/projects/<project>/<session-id>.jsonl`, по
    умолчанию 30 дней.
  - Неназванная сессия получает заголовок — краткое изложение первого запроса.
  - По сессии можно задать вопрос из скрипта: `claude -p --resume <session-id> "summarize what we
    changed"`.

  Источник: https://code.claude.com/docs/en/sessions
- Claude-drafted feedback [мир][вендор]. Инструмент SendFeedback готовит черновик отчёта для
  Anthropic «covering a product problem or Claude's own behavior in the session».
  - Когда: инструмент или команда раз за разом падает; Claude не может помочь; пользователь
    указывает на ошибку, или Claude замечает её сам.
  - Черновик хранится локально и уходит в Anthropic только по решению пользователя.

  Источник: https://code.claude.com/docs/en/tools-reference
- Командная аналитика Team и Enterprise [мир][вендор]. Показывает принятые строки, долю принятых
  предложений, активных пользователей и сессии, PR с Claude Code, рейтинг 10 самых активных
  участников. Видят админы и владельцы. Разбора отдельных сессий в описании нет:
  https://code.claude.com/docs/en/analytics
- Сырые данные для собственного разбора — OpenTelemetry [мир][вендор]:
  - события `user_prompt` (текст скрыт по умолчанию, включается `OTEL_LOG_USER_PROMPTS=1`),
    `tool_result` (`success`, `duration_ms`, `error_type`), `tool_decision` (`accept` или
    `reject`, источник решения, в том числе `user_reject` и `user_abort`), `api_error`;
  - метрика `claude_code.active_time.total`;
  - трассировка — бета.

  Источник: https://code.claude.com/docs/en/monitoring-usage
- Тарифы [мир][вендор].
  - Free — Claude Code не входит.
  - Pro — $20 в месяц, $17 при оплате за год ($200 сразу).
  - Max — «From $100», 5x или 20x к лимитам Pro.
  - Team — от 2 до 150 человек: место $25 в месяц ($20 за год), премиум-место $125 ($100 за год).
  - Enterprise — $20 за место в месяц при оплате за год плюс использование по ценам API.
  - «Prices shown don't include applicable tax».

  Источник: https://claude.com/pricing. Max 5x — $100, Max 20x — $200 в месяц, веб-подписка:
  https://support.claude.com/en/articles/11049741-what-is-the-max-plan

### 3. Claude (приложения и claude.ai, включая Cowork)

- Reflect, 09.07.2026, бета [мир][вендор].
  - Что показывает: сводку того, как вы пользуетесь Claude, — ключевые темы, шаблоны использования,
    типы задач — за 1, 3, 6 или 12 месяцев.
  - Советы: «practical suggestions, like starting a Project instead of needing to re-explain the
    context». Есть тихие часы и напоминание сделать перерыв.
  - Кому: на Free, Pro и Max при включённой памяти. Разговоры Cowork — «available soon».
  - Что не берёт: инкогнито-чаты, файлы подключённых инструментов, разговоры с инструментом
    здоровья.

  Источник: https://www.anthropic.com/news/reflect-with-claude
- Reflect, разбор по навыкам [мир][вендор] (проверено 2026-10-01). Отчёт опирается на «4D AI
  Fluency Framework»:
  - «Delegation: Setting goals and deciding whether and how to engage with AI»;
  - «Description: Effectively describing goals to prompt useful AI behaviors and outputs»;
  - «Discernment: Accurately assessing the usefulness of AI outputs and behaviors»;
  - «Diligence: Taking responsibility for what we do with AI and how we do it».

  «Your report gives you a summary of your Claude activity across each dimension, with examples of
  how you tend to collaborate with Claude, like noting that you often rework email drafts in your
  own voice, or delegate tasks only after settling the strategy yourself». Кроме того, «The reflect
  feature provides a breakdown of when you use Claude most, and what you spent that time working
  on. Soon, we'll add a view of how much time you've spent using Claude». Сводка — за период 1–12
  месяцев, а не по одной сессии. Источник: https://www.anthropic.com/news/reflect-with-claude
- Та же функция в статье TechCrunch (Сара Перес, 09.07.2026) [мир][СМИ]. «Later, it will expand to
  include a view of how much time you've spent using Claude». Мнение автора: Reflect «subtly makes
  the case for why you should keep using it»:
  https://techcrunch.com/2026/07/09/anthropics-new-claude-feature-is-quietly-selling-you-on-ai/
- Cowork [мир][вендор].
  - Где: на платных тарифах (Pro, Max, Team, Enterprise) в Claude Desktop, вебе и мобильном
    приложении.
  - До работы: показывает план.
  - Во время работы: «Progress indicators show what Claude is doing at each step»; можно вмешаться
    и поправить задачу по ходу.
  - После: готовые файлы для просмотра и скачивания. Об итоговой сводке, времени или советах на
    странице не сказано.

  Источник: https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork
- «One Claude» [мир][вендор]. Chat и Cowork объединяются в один интерфейс, постепенно, начиная с
  Pro и Max. Долгие задачи идут в облаке; «the result is waiting in the conversation»:
  https://support.claude.com/en/articles/16761823-claude-cowork-and-chat-are-one-claude
- Аналитика Team и Enterprise [мир][вендор]. По Cowork — сессии в день, доля пользователей с
  сессиями, активные пользователи по дням, неделям, месяцам. Видят владельцы, на Enterprise — и
  админы: https://support.claude.com/en/articles/12883420-view-usage-analytics-for-team-and-enterprise-plans
- Сырые данные — OpenTelemetry для Cowork, Team и Enterprise [мир][вендор]. Передаются полный текст
  запросов, каждый вызов инструмента и MCP с параметрами, успехом или ошибкой и временем
  выполнения, пути файлов, решения об одобрении. Данные уходят в систему заказчика (SIEM, Datadog
  и т. п.): https://support.claude.com/en/articles/14477985-monitor-claude-cowork-activity-with-opentelemetry
- Тарифы — как в разделе 2 [мир][вендор]. Free $0 — без Claude Code и без Cowork; Pro $20; Max от
  $100; Team; Enterprise: https://claude.com/pricing

### 4. GitHub Copilot

- `/chronicle`, подкоманды [мир][вендор]:
  - `standup` — отчёт о работе по сессиям Copilot CLI, по умолчанию за 24 часа;
  - `tips` — 3–5 персональных рекомендаций по «your actual prompts, the tools you use, and the
    features you haven't tried yet», в том числе по стратегиям запросов;
  - `cost-tips` — отзыв о расходе токенов: длина запросов, частота вызовов инструментов, шаги
    продолжения;
  - `improve` — предложения к файлу custom instructions. Ищет «places where Copilot struggled to
    provide the kind of response or results you were looking for, or where you had to
    course-correct». Сигналы трения — «repeated test failures, build errors that required multiple
    attempts, user messages that corrected or redirected the agent». Работает в пределах текущего
    репозитория;
  - `search` — поиск по истории сессий.

  О сессиях можно спрашивать и без команды, например: «Using what you know about my sessions, what
  type of tasks give me one-shot successes», «Based on my previous CLI sessions, how could I prompt
  you in a way that would cost less?». Данные лежат в `~/.copilot/session-state/` и
  `~/.copilot/session-store.db`.
  Источник: https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/chronicle
- Журнал Copilot CLI [мир][вендор]:
  - 0.0.419 (27.02.2026) — `/chronicle` с подкомандами standup, tips, improve, экспериментально;
  - 1.0.40 (01.05.2026) — «Session history, file tracking, and the /chronicle command are now
    available to all users»;
  - 1.0.51 (20.05.2026) — `cost-tips`;
  - 1.0.66 (30.06.2026) — `/chronicle skills review`;
  - в ленте CLI заголовки показывают длительность каждого вызова инструмента (от 5 секунд).

  Источник: https://github.com/github/copilot-cli/blob/main/changelog.md
- 02.06.2026 [мир][вендор]. `/chronicle` видит сессии облачного агента, код-ревью, приложения
  GitHub Copilot, VS Code и JetBrains. Для Copilot Business и Enterprise администратор сначала
  включает синхронизацию локальных сессий:
  https://github.blog/changelog/2026-06-02-gain-insights-across-your-agent-sessions-with-chronicle/
- Сторонний разбор, Раджив Пентьяла, 11.04.2026 [мир][независимо]. `/chronicle tips` дал
  персональные советы по недавним сессиям, шаблонам сообщений и использованию инструментов. Тогда
  функция была экспериментальной и включалась `/experimental on`:
  https://rajeevpentyala.com/2026/04/11/github-copilot-cli-chronicle-to-improve-your-prompting-style/
- Облачный агент Copilot [мир][вендор].
  - Журнал: «Session logs show Copilot's internal reasoning and the tools it used to understand
    your repository, make changes, and validate its work».
  - Обзор: «monitor the agent's progress, token usage, and session length».
  - Управление: сессию можно перенаправить новым запросом или остановить.
  - Об итоговой сводке или разборе после сессии на странице не сказано.

  Источник: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/track-copilot-sessions
- VS Code, релизы июня 2026 [мир][вендор]: «See total session cost: Understand credit usage across
  the full chat, not just one request»; синхронизация сессий и chronicle:
  https://github.blog/changelog/2026-07-08-github-copilot-in-visual-studio-code-june-2026-releases/
- GitHub Agentic Workflows от GitHub Next и Microsoft Research [мир][вендор]. Пример-процесс «Copilot
  Session Insights» анализирует шаблоны и метрики сессий облачного агента и публикует разборы в
  Discussions. Такие процессы ставятся в свой репозиторий командой `gh aw add-wizard`:
  https://github.github.com/gh-aw/blog/2026-01-13-meet-the-workflows-advanced-analytics/. Пример такого
  разбора от 12.02.2026 — 50 сессий репозитория gh-aw, разделы «Executive Summary», «Success
  Factors», «Failure Signals»: https://github.com/github/gh-aw/discussions/15173
- Тарифы [мир][вендор]. Free $0; Pro $10; Pro+ $39; Max $100 в месяц; Business $19 и Enterprise $39
  за место в месяц. Copilot CLI есть во всех планах: https://docs.github.com/en/copilot/get-started/plans ;
  https://github.com/features/copilot/plans

### 5. Cursor

- Conversation Insights [мир][вендор].
  - Что делает: «Cursor analyzes the code and context in each agent session to understand what
    kind of work is occurring».
  - Измерения: Category, Work Type, Complexity и Specificity — «Measures how specific the prompts
    developers use with agents are».
  - Кому: включено по умолчанию у Enterprise. Классификация работает на устройстве.
  - Оплата: «free during the preview period. Starting January 1st, 2026, customers will be charged
    for inference».
  - О себе (маркетинг): «the first self-aware software engineering platform».

  Источник: https://cursor.com/docs/account/teams/analytics. Запуск — 18.12.2025:
  https://cursor.com/changelog/enterprise-dec-2025
- Cursor 3.11, 10.07.2026 [мир][вендор]. Поиск по расшифровкам прошлых чатов агента, побочные чаты
  `/side` и `/btw`. О сводках или разборе прошлых чатов в записи не сказано:
  https://cursor.com/changelog/side-chat
- Agent Review [мир][вендор]. Это ревью кода локальных изменений (вручную, после каждого коммита или
  командой `/agent-review`), а не разбор сессии: https://cursor.com/docs/agent/agent-review
- `/create-rule` [мир][вендор]. Пользователь описывает, что нужно, агент пишет файл правила. О
  правилах, построенных по разбору сессий, в документации не сказано: https://cursor.com/docs/rules
- Cursor Projects, 10.09.2026 [мир][вендор]. Агенты записывают в общий контекст проекта «what they
  learn about the codebase and how you prefer work to be done»; этим пользуются следующие агенты:
  https://cursor.com/changelog
- Сырые данные — хуки [мир][вендор]. События `sessionStart`, `sessionEnd`, `beforeSubmitPrompt`,
  `postToolUse`, `postToolUseFailure`, `stop` (статус `completed`, `aborted` или `error`) и др.
  Длительность есть в `postToolUse`, `postToolUseFailure`, `afterShellExecution` и других:
  https://cursor.com/docs/hooks
- Тарифы [мир][вендор] (проверено 2026-10-01). Hobby — бесплатно; Individual — три уровня: Pro $20,
  Pro+ $60, Ultra $200 в месяц (переключатель на странице и её структурированные данные); Teams — $40
  за пользователя в месяц, в том числе «Usage analytics to understand team behavior»; Enterprise — по
  договору. «All prices are exclusive of any applicable taxes»: https://cursor.com/pricing

### 6. Codex (OpenAI)

- Codex CLI 0.156.0, выпуск от 22.09.2026 [мир][вендор] (проверено 2026-10-01):
  - автоматические резюме — «Delay automatic recaps and compact their TUI layout», «Preserve
    conversation context and separate next actions in recaps»;
  - «Explore account usage, token totals, and plugin and skill activity through the `/usage`
    analytics dashboard»;
  - «Show task tokens and usage estimates in the agent command center».

  Источник: https://github.com/openai/codex/releases/tag/rust-v0.156.0
- Codex CLI 0.159.0, выпуск от 29.09.2026 [мир][вендор] (проверено 2026-10-01):
  - «New sessions get a compact welcome screen and consistent headers, with occasional tips during
    and after turns»;
  - «Show short turn durations in TUI completion footers».

  Источник: https://github.com/openai/codex/releases/tag/rust-v0.159.0. Как устроены эти советы — в
  описании PR #48352 из того же выпуска: «Show a random tip beneath the working status after 30
  seconds, using the existing tooltip catalog and current key bindings»; советы после хода — только
  после успешных ходов, не больше двух за сессию приложения: https://github.com/openai/codex/pull/48352
- Журнал изменений приложения Codex [мир][вендор]:
  - приложение Codex 26.602, 04.06.2026: «activity insights and share cards» в профиле — «review
    Codex usage highlights»;
  - 09.04.2026: «Added a Git summary and Sources section in the thread side panel».

  Источник: https://learn.chatgpt.com/docs/changelog. Эта страница меняется между загрузками: записи
  Codex CLI 0.156.0 и 0.159.0 на ней то есть, то нет (при загрузках 2026-10-01 в 07:10–07:11Z они
  были). Поэтому факты о Codex CLI сосланы на страницы выпусков на GitHub (см. выше).
- Условия автоматического резюме — из issue пользователя от 31.08.2026 [мир][пользователь]. Резюме
  появляется, если в разговоре не меньше трёх завершённых ходов, а терминал не в фокусе и
  простаивает три минуты. Размер — до 900 байт, на экране — до 320 символов. Issue закрыт как «not
  planned»: https://github.com/openai/codex/issues/41896
- Справочник команд CLI [мир][вендор]:
  - `/status` — конфигурация сессии и расход токенов;
  - `/usage` — дневная, недельная или накопленная активность токенов;
  - `/review` — ревью рабочего дерева;
  - `/memories` — включение генерации и использования памяти;
  - `/recap` в справочнике не найден.

  Источник: https://learn.chatgpt.com/docs/developer-commands?surface=cli
- Codex Cloud [мир][вендор]. Шаг «Review the work»: «Inspect changed files and check results,
  request follow-up changes, and commit or open a pull request when you're ready»:
  https://learn.chatgpt.com/docs/cloud
- Usage Insights для администраторов [мир][вендор] (проверено 2026-10-01). «Insights groups usage
  into categories and tasks»; в таблице — сообщения, доля кредитов и активные пользователи по
  категориям и задачам. Предупреждение: «A message count doesn’t tell you how much work the team
  finished»: https://learn.chatgpt.com/docs/enterprise/usage-insights
- Тарифы [мир][вендор]. «ChatGPT Work and Codex are included in your ChatGPT Free, Go, Plus, Pro,
  Business, Edu, or Enterprise plan».
  - Free $0; Go $8; Plus $20 в месяц.
  - Pro — $100, $200 или $500 в месяц.
  - Business — $20 за пользователя в месяц при оплате за год, от 2 пользователей; $25 при
    помесячной оплате.
  - Enterprise и Edu — по договору.

  Источник: https://learn.chatgpt.com/docs/pricing

### 7. Devin и Devin Desktop (Cognition)

- Session Insights [мир][вендор]. «Session Insights is an analysis feature that helps you
  understand what happened in your Devin sessions and provides actionable recommendations for
  improvement». «Session Insights is available for all completed Devin sessions at no additional
  cost».
  - Обзор: расход ACU; число сообщений пользователя — «A high message count can indicate that
    Devin needed frequent course corrections»; размер сессии XS–XL, сессии L и XL помечаются как
    «unhealthy»; категория задачи.
  - Вкладка Issue Timeline: «Issues Detected» — метка, оценка влияния, описание; «Timeline
    provides a chronological, color-coded view of key events».
  - Вкладка Actionable Feedback: «Improved Prompt shows a rewritten version of your original
    prompt» с подсветкой, что и почему изменено, и кнопкой Start new session; «Action Items lists
    recommended configuration changes to improve future sessions».
  - Вкладка Knowledge: полезные и вводящие в заблуждение знания.
  - Когда: лёгкая классификация — автоматически в конце сессии; полный анализ — автоматически для
    сессий L и XL, для остальных — по кнопке.

  Источник: https://docs.devin.ai/product-guides/session-insights
- Пример из галереи Devin [мир][вендор].
  - Сессия потратила 42 ACU там, где пользователь ожидал около 12.
  - Session Insights отметил на шкале моменты на 14-й и 28-й минуте, где Devin сменил подход.
  - Кнопка «Investigate with Devin» запускает отдельную сессию Devin с полной историей исходной. В
    примере она нашла, что 3 ACU ушли на сбои `npm install`.

  Источник: https://docs.devin.ai/use-cases/gallery/analyze-session-acu-efficiency
- Даты [мир][вендор]:
  - 10.06.2025 — «Session Insights is a new free feature that analyzes your Devin sessions and
    breaks down what happened and gives you actionable tips for next time»;
  - 21.11.2025 — кнопка «Investigate with Devin».

  Источник: https://docs.devin.ai/release-notes/2025
- Независимого (не от Cognition) описания Session Insights не найдено; статья DataCamp о Devin не
  открылась (см. «Где искали») [мир].
- Devin Desktop [мир][вендор]. «Devin Desktop is the new name for Windsurf». Командный центр агентов
  со статусами сессий (Running, Waiting for review, Done) и ревью каждого диффа агента:
  https://devin.ai/desktop. В документации Cascade: чекпоинты и откат; ссылки @ на прошлые
  разговоры, по которым подтягиваются «conversation summaries and checkpoints»:
  https://docs.devin.ai/desktop/cascade/cascade
- Тарифы, одни для Devin и Devin Desktop [мир][вендор]. Free $0; Pro $20; Max $200 в месяц; Teams —
  $80 в месяц за команду плюс $40 за место разработчика, до 200 пользователей; Enterprise — по
  договору: https://devin.ai/pricing ; https://devin.ai/desktop

### 8. Google: Gemini CLI, Antigravity, Jules

- Gemini CLI, итог сессии (по исходному коду Google) [мир][вендор]. При выходе печатает «Agent
  powering down. Goodbye!» и статистику сессии:
  - Interaction Summary: Tool Calls (успешные и неудачные), Success Rate, User Agreement (доля
    одобренных пользователем решений, «N reviewed»), Code Changes;
  - Performance: Wall Time, Agent Active, API Time, Tool Time с долями.

  Источники:
  https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/ui/components/SessionSummaryDisplay.tsx ;
  https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/ui/components/StatsDisplay.tsx
- Команды Gemini CLI [мир][вендор]. `/stats`, подкоманда `session` — «Show session-specific usage statistics,
  including duration, tool calls, and performance metrics»; `/rewind` — просмотр прошлых шагов с
  откатом: https://geminicli.com/docs/reference/commands/
- Перевод частных лиц на Antigravity [мир][вендор]. «Starting June 18, 2026, Gemini Code Assist IDE
  extensions stopped serving requests for the Gemini Code Assist for individuals, Google AI Pro,
  and Google AI Ultra tiers. This also applies to usage of Gemini CLI».
  - Вход «Login with Google» больше не работает; пользователям предложен переход на Antigravity.
  - Для подписок Gemini Code Assist Standard и Enterprise доступ не меняется.
  - Страница обновлена 02.09.2026.

  Источник: https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals.
  На странице квот Gemini CLI на 2026-09-30 указано: 1 000 запросов в день для пользователей
  Google-аккаунта через Gemini Code Assist for individuals [мир][вендор]:
  https://geminicli.com/docs/resources/quota-and-pricing/
- Antigravity [мир][вендор]:
  - Walkthrough (проверено 2026-10-01): «The agent creates walkthrough artifacts when it completes
    task implementation. This type of artifact includes a concise summary of the changes made to
    remind you of what happened in the active conversation»; для задач в браузере — «screenshots
    and screen recordings of what the agent built or created in the browser»
    (https://antigravity.google/docs/walkthrough; текст страницы изменился между 2026-09-30 и
    2026-10-01, цитата — по версии от 2026-10-01);
  - `/learn` (все тарифы; проверено 2026-10-01) — «Analyzes recent corrections, user feedback, and
    debugging resolutions from your active session»; результат, по странице, — постоянные правила
    проекта (`.antigravity/rules.md`) или переиспользуемые навыки агента (`SKILL.md`); в примере из
    документации пользователь сам называет, что сохранить. `/plan` и `/grill-me` — интервью о
    требованиях до работы (https://antigravity.google/docs/slash-commands/; текст этой страницы
    изменился между 2026-09-30 и 2026-10-01, цитата — по версии от 2026-10-01);
  - `/usage` в Antigravity CLI — квоты по моделям
    (https://antigravity.google/docs/cli/commands/usage/).
- Тарифы Antigravity [мир][вендор] (проверено 2026-10-01; страница изменилась между 2026-09-30 и
  2026-10-01). Для частных лиц — $0 в месяц; Google AI Pro и Google AI Ultra — цены на странице не
  показаны. Для организаций — «Business plan via Google Cloud»: «Access via API with
  consumption-based pricing», а «Available to eligible Gemini Enterprise customers: Standard/Plus
  plans starting at $30 USD per seat per month» и «Pay-as-you-go plan with $0 seat fee and
  consumption based pricing»: https://antigravity.google/pricing. Страница тарифов Google AI цен
  тоже не показала: https://one.google.com/about/google-ai-plans/
- Jules [мир][вендор]. План показывается на утверждение до изменений кода; есть уведомления о
  завершении: https://jules.google/docs/. Журнал изменений:
  - 22.05.2025 — кнопка Publish Branch в «summary UI in the activity feed»;
  - 03.09.2025 — «The critic's thought process is now visible in the UI»;
  - 30.09.2025 — «Jules now has the ability to learn from your interactions»;
  - последняя запись — 09.03.2026.

  Источник: https://jules.google/docs/changelog/
- Тарифы Jules [мир][вендор]. Бесплатно — 15 задач за сутки и 3 одновременно; в Google AI Pro — 100
  и 15; в Ultra — 300 и 60. Платные тарифы — только для личных аккаунтов @gmail.com. Цены на
  странице не указаны: https://jules.google/docs/usage-limits/

### 9. Другие платформы: Kiro, Junie, Amp, Replit, Factory, OpenHands

- Kiro (AWS) [мир][вендор].
  - Облачные сессии: история разговора, репозитории и файлы песочницы хранятся в облаке, при
    повторном подключении «the transcript replays where you left off». О разборе сессии на странице
    не сказано: https://kiro.dev/docs/cloud-sessions/
  - Отчёты об активности пользователей для Enterprise: разговоры, сообщения, кредиты, счётчики
    принятий. Хранятся в S3 заказчика, видят администраторы:
    https://kiro.dev/docs/enterprise/monitor-and-track/user-activity/
  - Тарифы: Free $0 (50 кредитов); Pro $20, Pro+ $40, Pro Max $100, Power $200 за пользователя в
    месяц; сверх лимита — $0,04 за кредит; Enterprise — по договору: https://kiro.dev/pricing/
- Junie (JetBrains) [мир][вендор].
  - `/stats` — «usage statistics for the current session and all-time totals, including token
    usage, used models, code changes»; `/history` — история задач; `/logs` — выгрузка логов сессии
    в ZIP; `/feedback` — отзыв команде Junie с логами:
    https://junie.jetbrains.com/docs/slash-commands.html
  - Тарифы на странице Junie: старт — 5 AI-кредитов или свой ключ; AI Pro — $8,33, AI Ultimate —
    $25 за пользователя в месяц: https://junie.jetbrains.com/
- Amp [мир][вендор].
  - Тред — «your prompts, the agent's replies, every tool call it made, and the files it changed».
    Тредами можно делиться; панель Review проходит по диффу; в меню видно, сколько тред стоил:
    https://ampcode.com/docs/threads
  - Тарифы: Hobby — бесплатно, оплата по факту; Individual — $20 в месяц; для команд — без доплаты
    («User management, controls, and analytics»); Enterprise — по договору:
    https://ampcode.com/docs/pricing. Расходы агента и машины списываются с владельца треда:
    https://ampcode.com/docs/threads
- Replit Agent [мир][вендор].
  - У каждого чекпоинта: «AI-generated descriptions: Clear, descriptive summaries of what was
    accomplished», время создания, объём изменений, стоимость:
    https://docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks
  - Тарифы: Core $20 в месяц ($18 при оплате за год); Pro $100 ($90 за год); Enterprise — по
    договору; «Prices are subject to tax depending on your location»: https://replit.com/pricing
- Factory (Droid) [мир][вендор].
  - Signals, 23.01.2026 — внутренняя система Factory. Модели-судьи разбирают сессии и ищут трения:
    «Error Events», «Repeated Rephrasing», «Escalation Tone», «Platform Confusion», «Abandoned Tool
    Flow», «Backtracking», «Context Churn»; ищут и моменты радости. Итог — ежедневные отчёты в Slack
    и тикеты, которые чинит сам Droid. «The model never surfaces raw conversation content to human
    analysts». Как функция для клиентов на странице не описана: https://factory.com/news/factory-signals
  - Factory Analytics, 11.03.2026, для Enterprise: токены, инструменты, активность, результат, по
    пользователям, готовность агентов: https://factory.com/news/factory-analytics
  - О сессиях в Factory App: «Organized, connected sessions», с фильтрами по проектам и машинам:
    https://docs.factory.com/factory-app/overview
  - Тарифы: Pro $20, Plus $100, Max $200 в месяц: https://docs.factory.com/pricing
- OpenHands [мир][вендор].
  - Обновление за август 2026, опубликовано 02.09.2026. Можно следить за действиями агента; есть
    панель коммитов, индикатор контекста и панель использования. Для автоматизаций — фазы
    `PENDING`, `RUNNING`, `FAILED` и панель с «run activity, failures, durations, details, and
    recent trends», стоимость LLM за прогон:
    https://www.openhands.dev/blog/new-in-agent-canvas-august-2026
  - Issue участника организации OpenHands на GitHub от 05.02.2026, открыт: «Currently, OpenHands
    users lack a built-in mechanism to review historical usage, identify behavioral patterns, or
    receive automated suggestions for personalizing their environment»; «Inspired by the `\insight`
    feature in Claude Code» предложена команда `/insight`:
    https://github.com/OpenHands/extensions/issues/373
  - PR «feat: add local session insight reports» от 28.09.2026 открыт и не влит:
    https://github.com/OpenHands/extensions/pull/695
  - Тарифы: open source — бесплатно; облако для одного пользователя — бесплатно, модели по
    себестоимости; Enterprise — по договору: https://www.openhands.dev/pricing

### 10. Российские платформы в СНГ: SourceCraft Code Assistant и GigaCode

- SourceCraft Code Assistant (Яндекс) [Россия][вендор].
  - Агентский режим: в интерфейсе SourceCraft и VS Code — с сентября 2025, в плагине JetBrains —
    превью (май–июнь 2026). Статистика использования Code Assistant в личном кабинете — май–июнь
    2026; просмотр потребления квот:
    https://sourcecraft.dev/portal/docs/ru/code-assistant/release-notes
  - В агентском режиме «При редактировании файла агент показывает diff с предложенными
    изменениями»; правки можно принять, отклонить или применять автоматически:
    https://sourcecraft.dev/portal/docs/ru/code-assistant/operations/jb-agent
  - О себе: «Сервис обслуживает десятки тысяч пользователей, в том числе более 60% всех
    разработчиков Яндекса»: https://sourcecraft.dev/portal/code-assistant/
- Тарифы SourceCraft с 01.10.2026 [Россия][Казахстан][вендор] (проверено 2026-10-01).
  - Free 0 ₽, Start 1 190 ₽, Go 2 490 ₽, Go X5 5 490 ₽, Go X15 11 490 ₽ за активную лицензию
    участника в месяц, с НДС.
  - Квота нейрокредитов в месяц: 500 / 2 000 / 4 000 / 20 000 / 60 000. Квота личная: «У каждого
    участника организации есть личная квота расхода нейрокредитов, заданная его подпиской».
  - Оплата: «Администратор организации назначает подписку конкретному участнику. Само назначение не
    запускает оплату»; лицензия активируется, когда участник впервые расходует нейрокредиты или
    использует дополнительные возможности SourceCraft, а после этого «остается активной и
    оплачивается каждый месяц независимо от дальнейшего использования».
    Платную подписку подключают для организации через её платёжный аккаунт.
  - Фраза «Квота на количество нейрокредитов суммируется по всем рабочим местам и закрепляется за
    организацией» относится к архивному тарифу Code Assistant Pro, а не к подпискам с 01.10.2026.
  - На той же странице — цены в тенге (0, 5 950, 12 450, 27 450, 57 450 ₸) и в долларах; для кого
    цены в тенге, не сказано.

  Источник: https://sourcecraft.dev/portal/docs/ru/sourcecraft/pricing
- GigaCode (СберТех) [Россия][вендор]. Агентный режим находит файлы, вносит изменения, запускает
  тесты, собирает проекты и оформляет коммиты. Тарифы: «Персональный» — бесплатно, «Бизнес» — «от
  1699₽ / за пользователя в месяц». О статистике, истории сессий или разборе работы агента на
  странице ничего нет: https://gitverse.ru/features/gigacode/

### 11. IDE- и терминальные агенты, добавленные в доработках r2 и r3 (проверено 2026-10-01)

- Cline [мир][вендор].
  - Команды: `/newtask` — «packages what matters (overall plan, work accomplished, relevant files,
    next steps) into a fresh task with a clean context window»; `/newrule` — создаёт файл правила о
    предпочтениях пользователя, «Cline will guide you through setting up guidelines»; `/smol` —
    сжатие истории разговора: https://docs.cline.bot/core-workflows/using-commands
  - Чекпоинты: «Every time Cline modifies a file or runs a command, it saves a snapshot of your
    project files»: https://docs.cline.bot/core-workflows/checkpoints
  - Enterprise: экспорт OpenTelemetry, аналитика использования и разбивка затрат — в инструментах
    наблюдаемости заказчика: https://docs.cline.bot/enterprise-solutions/overview
  - Тарифы: «Cline is free for individual developers. Pay only for AI inference on a usage basis»;
    Enterprise — Custom (JetBrains, централизованная оплата, панель управления командой,
    OpenTelemetry и др.): https://cline.bot/pricing
- Kilo Code [мир][вендор].
  - Сессии: «A session is your platform-agnostic interaction with Kilo. It remembers your
    repository, your task, and the conversation». Есть поиск по заголовкам и расшифровкам. Сессией
    можно поделиться только для чтения — на странице видны название и «a short preview of the
    conversation»; общую сессию можно форкнуть: https://kilo.ai/docs/collaborate/sessions-sharing
  - Аналитика Teams и Enterprise через Kilo Gateway: расходы, запросы, токены — по дням, моделям и
    участникам: https://kilo.ai/docs/collaborate/teams/analytics. AI Adoption Score от 0 до 100 из
    трёх измерений — Frequency, Depth, Coverage:
    https://kilo.ai/docs/collaborate/adoption-dashboard/understanding-your-score
  - Тарифы: платформа для частного лица — $0; Teams — $15 за пользователя в месяц; Enterprise — по
    договору; инференс — по ценам поставщиков; Kilo Pass — от $19 в месяц, по желанию:
    https://kilo.ai/teams
- Roo Code (RooCodeInc/Roo-Code) [мир][вендор].
  - Репозиторий на GitHub: «This repository was archived by the owner on May 15, 2026. It is now
    read-only». В README: «The Roo Code Extension was shut down on May 15th»; в качестве замены
    названы «ZooCode (a fork started by the Roo Code community)» и «Cline (from where Roo Code
    originated)». Описание продукта в README — «Your AI-Powered Dev Team, Right in Your Editor»,
    режимы Code, Architect, Ask, Debug и пользовательские, серверы MCP; о разборе сессий в README
    ничего нет: https://github.com/RooCodeInc/Roo-Code
  - Сайт из карточки репозитория, roocode.com, и страница roocode.com/pricing 2026-10-01 отвечают
    HTTP 301 с адресом https://roomote.dev/ (проверено запросом curl -I). Тарифы Roo Code на открытых
    страницах не найдены: https://roocode.com/pricing
- Roomote (roomote.dev) [мир][вендор] (проверено 2026-10-01).
  - Roomote — «a source-available, self-hosted AI coding teammate»; работает через Slack, Teams,
    Discord, Telegram.
  - Связь с Roo Code. Над заголовком страницы roomote.dev написано «By the creators of», рядом —
    логотип Roo Code (изображение с подписью alt «Roo Code»). Репозиторий Roomote —
    github.com/RooCodeInc/Roomote: публичный, не в архиве, в той же организации RooCodeInc, что и
    Roo-Code. В отзыве клиента на странице: «It's like when I tried Roo Code for the first
    time... But better.»
  - «Built-in review loops»: «It reviews its own changes, catches issues early, and cleans up fixes
    before a human has to step in» — это проверка агентом своего кода, а не разбор сессии.
    «Built-in analytics»: «Understand inference cost, team productivity and more with built-in
    interactive charts».
  - Тарифы: облако — до 10 пользователей $49 в месяц, 11–50 — $249, 51–100 — $499, больше 100 — по
    договору, пробный период 7 дней; своя установка — бесплатно до 10 пользователей; ключ
    инференса — свой.

  Источники: https://roomote.dev/ ; https://github.com/RooCodeInc/Roomote
- Continue [мир][вендор].
  - Сайт: «Continue has joined Cursor», «Continue was acquired by Cursor»: https://www.continue.dev/
  - Открытые расширения для VS Code и JetBrains с агентным режимом: https://docs.continue.dev/. По
    умолчанию агент спрашивает разрешение на вызов инструмента, пользователь разрешает или
    отклоняет; «Most errors are also caught and returned, so that Agent mode can decide how to
    proceed»: https://docs.continue.dev/ide-extensions/agent/quick-start
  - Тарифы на открытых страницах не показаны; страница о задачах Mission Control отдаёт 404 (см.
    «Где искали»).
- Zed [мир][вендор].
  - Agent Panel: число токенов текущего треда; история тредов по всем проектам с восстановлением;
    кнопка «Restore Checkpoint» после правок агента; «Open Thread as Markdown»; «New From Summary» —
    новый тред с кратким изложением текущего разговора; сообщения в очереди и режим «Steer»:
    https://zed.dev/docs/ai/agent-panel
  - Тарифы: Personal — $0; Pro — $10 в месяц, $5 токенов включено, сверх — по цене провайдера +10%;
    Business — $30 за место в месяц: https://zed.dev/pricing ;
    https://zed.dev/docs/account/plans-and-pricing
- Warp [мир][вендор].
  - Agent Management Panel и страница Runs в веб-приложении Oz:
    - статусы запусков — working, blocked, failed, succeeded, canceled;
    - источник запуска и израсходованные кредиты; у облачных запусков — длительность;
    - сессия открывается с «prompt, plan, commands, logs, messages, and output»;
    - фильтр, например «everything that failed today».

    «Warp's agent observability is run- and session-oriented»:
    https://docs.warp.dev/platform/managing-cloud-agents/
  - Тарифы: Free $0; Build — от $20 в месяц (1 500 кредитов); Max — от $200 в месяц (18 000
    кредитов); Business — от $50 за пользователя в месяц, до 25 мест, «Team usage metrics»;
    Enterprise — по договору, «Enterprise Analytics API»: https://www.warp.dev/pricing
- Augment Code (Cosmos) [мир][вендор].
  - Сессия Cosmos — место, «where you give the agent a task, watch it run and follow every turn»;
    «Every message, agent turn, and tool call in that conversation belongs to the Session».
  - Разбор неудачной сессии: «When a Session goes wrong — it fails, stalls mid-run, or produces a
    bad result — ask Cosmos Advisor to diagnose it. The Advisor reads the Session data and
    identifies the root cause, such as missing authentication, an unconnected integration, or a
    missing capability or Environment setup, and points you at the fix».

    Источник обоих пунктов: https://docs.augmentcode.com/cosmos/sessions-overview
  - Анализ по многим сессиям: Advisor «pulls session data and looks for patterns worth acting on —
    repeated failures (edit the prompt), usage skew (…), sessions stuck mid-run or waiting on humans
    (tighten the prompt, route to Slack, swap models), and missing capabilities (…). It surfaces the
    relevant cut, explains what it sees, and can apply the change in the same conversation»;
    «Cosmos doesn’t ship built-in analytics dashboards for this»:
    https://docs.augmentcode.com/cosmos/advisor/overview
  - Аналитика команды — только для Enterprise: активные пользователи, сообщения и вызовы
    инструментов, разбивка по пользователям: https://docs.augmentcode.com/analytics/overview
  - Тарифы: Standard — $20 в месяц за команду до 50 мест, $20 использования включено; Business —
    $100 в месяц, $100 использования; Enterprise — по договору; Cosmos входит в Standard и
    Business: https://www.augmentcode.com/pricing
- Tabnine [мир][вендор].
  - Tabnine Agent «adds and explains more of its reasoning to the user» и сам решает, когда
    спросить пользователя или запросить одобрение:
    https://docs.tabnine.com/main/getting-started/tabnine-agent
  - Страница Agent Usage для администраторов: расход против месячного бюджета или квоты, токены и
    стоимость по моделям и командам, самые частые инструменты и MCP-серверы, число пользователей и
    сообщений агента:
    https://docs.tabnine.com/main/administering-tabnine/managing-your-team/reporting/agent-usage-page
  - Сделка: 30.07.2026 Tricentis объявила о покупке Tabnine и встроит её Enterprise Context Engine в
    свою платформу (пресс-релиз Business Wire):
    https://finance.yahoo.com/technology/ai/articles/tricentis-acquires-tabnine-further-scale-150000471.html.
    На 2026-10-01 tabnine.com и tabnine.com/pricing перенаправляют на tricentis.com, цен Tabnine там
    нет.
- Amazon Q Developer (AWS) [мир][вендор].
  - Пост AWS от 30.04.2026: с 15.05.2026 «New Q Developer Free Tier account creation … and new Q
    Developer subscription creation … will be blocked»; поддержка плагинов для IDE и платных
    подписок заканчивается 30.04.2027; замена — Kiro:
    https://aws.amazon.com/blogs/devops/amazon-q-developer-end-of-support-announcement/ ;
    https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/q-developer-ide-end-of-support.html
  - Тарифы: Free Tier; Pro — $19 в месяц за пользователя: https://aws.amazon.com/q/developer/pricing/
- OpenCode (anomalyco/opencode) [мир][вендор] (доработка r3, проверено 2026-10-01).
  - «OpenCode is an open source agent that helps you write code in your terminal, IDE, or desktop»;
    среди возможностей на главной — «Share a link to any session for reference or to debug».
    Репозиторий github.com/anomalyco/opencode — лицензия MIT, не в архиве: https://opencode.ai/ ;
    https://github.com/anomalyco/opencode
  - Команда `opencode stats` — «Show token usage and cost statistics for your OpenCode sessions»
    (флаги `--days`, `--tools`, `--models`, `--project`): расход токенов и стоимость, а не время и
    не ошибки. `opencode export` — «Export session data as JSON», флаг `--sanitize` — «Redact
    sensitive transcript/file data»; `opencode import` принимает файл или ссылку общего доступа:
    https://opencode.ai/docs/cli/
  - В интерфейсе TUI: `/details` — «Toggle tool execution details»; `/sessions` — «List and switch
    between sessions»; `/export`, `/compact`, `/share`, `/unshare`. `/undo` — «Undo last message in
    the conversation. Removes the most recent user message, all subsequent responses, and any file
    changes»; `/redo` возвращает отменённое. Настройка «attention» (по умолчанию выключена): «The
    TUI can request attention for questions, permissions, session errors, and completed sessions»:
    https://opencode.ai/docs/tui/
  - Общий доступ. «Shared conversations are publicly accessible to anyone with the link»; при общем
    доступе OpenCode «Syncs your conversation history to our servers». Режимы: Manual (по
    умолчанию), Auto-share, Disabled: https://opencode.ai/docs/share/
  - Режим Plan: «Plan mode that disables its ability to make changes and instead suggest how it’ll
    implement the feature» — по правилу таблицы это показ действий агента. Общий совет в руководстве
    — «Give OpenCode plenty of context and examples to help it understand what you want» — не
    построен по сессиям пользователя и в ячейки не засчитан: https://opencode.ai/docs/
  - Тарифы. «OpenCode Go gives you reliable access to popular open coding models, with two monthly
    plans»: Go — $10 в месяц, Go Plus — $40 в месяц; «It’s completely optional and you don’t need
    to use it to use OpenCode»: https://opencode.ai/docs/go/. Zen: «You are charged per request and
    you can add credits to your account»; для команд — «Workspaces are currently free for teams as
    a part of the beta» и «Admins can also set monthly spending limits for each member to keep
    costs under control»: https://opencode.ai/docs/zen/
- Crush (charmbracelet/crush) [мир][вендор] (доработка r3, проверено 2026-10-01).
  - README: «Session-Based: maintain multiple work sessions and contexts per project»; «Flexible:
    switch LLMs mid-session while preserving context»; «By default, Crush will ask you for
    permission before running tool calls». Журнал: «Crush logs all sorts of stuff»; команды
    `crush logs`, `crush logs --tail 500`, `crush logs --follow`. «When you initialize a project,
    Crush analyzes your codebase and creates a context file that helps it work more effectively in
    future sessions» — это память самого агента, по правилу таблицы она в ячейки не засчитана.
    Лицензия — FSL-1.1-MIT, репозиторий не в архиве: https://github.com/charmbracelet/crush
  - По README, Hyper — «the official Crush provider. It’s subscription-based, with a free tier»
    (https://github.com/charmbracelet/crush). На странице Hyper: Free — $0 в месяц, «Everyone gets
    100 Hypercredits per month»; подписка — $20 в месяц, «250 Hypercredits, refreshing daily»;
    предоплатные пакеты — $5, $10 и $20 (100, 200 и 400 Hypercredits). Для команд — «master keys
    and sub-keys, per-model and per-user usage reports»: https://hyper.charm.land/ . Страница
    charm.land/crush перенаправляет на репозиторий GitHub.
- Zoo Code (Zoo-Code-Org/Zoo-Code) [мир][вендор] (доработка r3, проверено 2026-10-01).
  - Сайт: «Community-maintained · Continuing where Roo Code left off»; «In April 2026, the Roo Code
    team announced they were archiving the project to focus on Roomote. A few of us from the
    community decided to keep it alive». README репозитория: «Zoo Code continues development of this
    project after the Roo team wound down active Roo Code work to focus on Roomote»; лицензия
    Apache-2.0, репозиторий не в архиве: https://www.zoocode.dev/ ;
    https://github.com/Zoo-Code-Org/Zoo-Code
  - История чата — «It shows your requests, Zoo Code's responses, and any actions taken (like file
    edits or command executions)»; «If an error occurs, a red error message will be displayed»:
    https://docs.zoocode.dev/basic-usage/the-chat-interface . Контрольные точки — «Checkpoints
    automatically version your workspace files during Zoo Code tasks, enabling non-destructive
    exploration of AI suggestions and easy recovery from unwanted changes»:
    https://docs.zoocode.dev/features/checkpoints . Токены — «You can see the number of input and
    output tokens used for each interaction in the chat history»:
    https://docs.zoocode.dev/advanced-usage/rate-limits-costs
  - Режим Architect: «Plans complex changes without making edits. Outputs strategy documents and
    file maps you can review before any code is written» — по правилу таблицы это показ действий
    агента: https://www.zoocode.dev/ . «Enhance Prompt» переписывает запрос до отправки («improve
    the quality and effectiveness of your prompts before sending them to the AI model»), а не
    разбирает сессию, поэтому в ячейки не засчитан: https://docs.zoocode.dev/features/enhance-prompt
  - Тарифы. «Is Zoo Code really free?» — «Yes. The extension is free and open source forever. If you
    bring your own API keys, you only pay your provider. If you use Zoo Gateway, you pay for credits
    — no subscription required»: https://www.zoocode.dev/

### 12. Агенты для приложений и общих задач, добавленные в доработке (проверено 2026-10-01)

- ChatGPT Work (OpenAI) [мир][вендор].
  - «Delegate substantial tasks to ChatGPT with ChatGPT Work and get reviewable results»; «You can
    follow progress, answer questions, change direction, and approve important actions»:
    https://learn.chatgpt.com/docs/get-started-with-work
  - Исполнение и защита — общие с Codex; задача идёт локально или в облаке:
    https://learn.chatgpt.com/docs/enterprise/chatgpt-work-overview. Usage Insights для
    администраторов — общая страница для ChatGPT Work и Codex (раздел 6).
  - Computer History (приложение на macOS; Pro, Business, Enterprise; по умолчанию выключено)
    превращает активность пользователя в приложениях и на сайтах в воспоминания и временную шкалу и
    может предложить навык или автоматизацию для повторяющейся работы. Это действия самого
    пользователя на компьютере, а не сессия агента: https://learn.chatgpt.com/docs/customization/computer-history
  - Тарифы: «ChatGPT Work and Codex are included in your ChatGPT Free, Go, Plus, Pro, Business, Edu,
    or Enterprise plan»; «ChatGPT Work and Codex share usage»; цены — как в разделе 6:
    https://learn.chatgpt.com/docs/pricing
- Агентный режим ChatGPT (ChatGPT agent) [мир][сторонний блог][пользователь][вендор] (проверено
  2026-10-01).
  - Официальные страницы об агенте не открылись: статья справки
    help.openai.com/en/articles/11752874-chatgpt-agent (на неё ссылается блог Carly) и
    openai.com/index/introducing-chatgpt-agent/ отвечают HTTP 403 — на запросы curl в 07:11Z и на
    WebFetch. Строки в таблице у агентного режима нет (правило включения — в начале файла).
  - Блог Carly — компании, которая продаёт конкурирующий продукт, — приводит слова справки OpenAI:
    «ChatGPT agent is no longer available. Use ChatGPT Work for longer, multi-step tasks and
    finished deliverables»; по блогу, режим убран в начале августа 2026:
    https://www.usecarly.com/blog/chatgpt-agent-mode/
  - Форум сообщества OpenAI (страница открывается, HTTP 200). Сообщение пользователя kadda от
    2026-08-08: «ChatGPT Agent Mode has been removed and the current guidance is to “use Work.”»
    Ответ сотрудника OpenAI Support от 2026-09-07: «Work now has a separate cloud browser that can
    navigate interactive sites and pause for sign-in or takeover on supported accounts»:
    https://community.openai.com/t/agent-mode-was-removed-with-no-real-replacement/1389601
- Manus [мир][вендор].
  - Задачей можно поделиться публичной ссылкой; по словам справки, так можно показать «their usage
    process and experience»; служба поддержки смотрит сессию только по такой ссылке:
    https://help.manus.im/en/articles/11711198-how-can-i-share-a-task. В документации есть ссылки
    «Replay» на повтор задач (`?replay=1`): https://manus.im/docs/features/wide-research
  - Тарифы: Free, Pro, Team (общий пул кредитов). Цены на открытых страницах не показаны. В панели —
    история задач с расходом кредитов и «Spending Insights: Understand which types of tasks consume
    the most credits». Общий совет экономить кредиты: «Clear, well-defined tasks help Manus AI work
    more efficiently»: https://manus.im/docs/introduction/plans.md
- Bolt [мир][вендор].
  - История версий в чате: просмотр, предпросмотр, подписи и восстановление ранних версий
    проекта: https://support.bolt.new/building/using-bolt/rollback-backup
  - Тарифы: Free $0 (300 тыс. токенов в день, 1 млн в месяц); Pro — $25 в месяц (от 10 млн
    токенов); Teams — $30 в месяц за участника; Enterprise — по договору: https://bolt.new/pricing
- Lovable [мир][вендор].
  - Карточки активности «track its individual actions: file edits, commands, web searches, browser
    tests…»; Details view показывает «the full timeline of steps and file changes».
  - Время и кредиты: «Working for: How long Lovable has spent on the message. This measures active
    work, so it stops while the message is paused and waiting on you»; после завершения — «Worked
    for» и «Credits used».
  - Ошибки сборки: кнопка «Try to fix» — «Lovable scans the logs, finds the issue, and attempts a
    fix»; 10 бесплатных исправлений.
  - Подсказки после ответа — кнопки с функциями, которые можно сделать дальше: «Suggestions are
    based on your project and what you just built».

  Источник всех четырёх пунктов: https://docs.lovable.dev/features/projects/chat
- Тарифы Lovable [мир][вендор]: Free; Pro — от $25 в месяц (100 кредитов) до $2 250; Business — от
  $50 в месяц (100 кредитов); Enterprise — по объёму:
  https://docs.lovable.dev/introduction/subscription-plans

### 13. Казахстан и СНГ: доступность и налоги

- Anthropic [Казахстан][СНГ][вендор]. Казахстан, Кыргызстан, Узбекистан, Таджикистан, Армения,
  Грузия, Азербайджан — в списке стран и для API, и для Claude.ai; России и Беларуси нет:
  https://www.anthropic.com/supported-countries
- OpenAI API [Казахстан][СНГ][вендор]. Казахстан, Кыргызстан, Узбекистан, Таджикистан, Туркменистан,
  Армения, Грузия, Азербайджан, Молдова — в списке; России и Беларуси нет:
  https://developers.openai.com/api/docs/supported-countries. Список стран ChatGPT, куда входит
  Codex, не открылся (см. «Где искали»).
- Google [Казахстан][СНГ][вендор]. Те же страны — в списках веб-приложения Gemini и Gemini API;
  России и Беларуси нет: https://support.google.com/gemini/answer/13575153 ;
  https://ai.google.dev/gemini-api/docs/available-regions
- GitHub Copilot [Казахстан][СНГ][вендор]. «GitHub Copilot may not be sold, exported, or re-exported
  to any embargoed destination or a country listed in Country Group E:1 … These destinations
  currently include Cuba, Iran, North Korea, Russia, Belarus» и отдельные регионы Украины.
  Казахстана в перечне нет:
  https://docs.github.com/en/site-policy/other-site-policies/github-and-trade-controls
- Cursor [мир][вендор]. Региональные ограничения — те, что у поставщиков моделей (Anthropic, OpenAI,
  Google); страница ссылается на их списки: https://cursor.com/docs/account/regions
- Доступность в Казахстане Devin, Devin Desktop, Antigravity, Jules, Kiro, Junie, Amp, Replit,
  Factory, OpenHands и GigaCode — не найдено (см. «Где искали») [Казахстан]. То же — для платформ,
  добавленных 2026-10-01: Cline, Kilo Code, Roo Code, Roomote, Continue, Zed, Warp, Augment Code,
  Tabnine, Amazon Q Developer, Manus, Bolt, Lovable, OpenCode, Crush, Zoo Code. Для ChatGPT Work —
  как для Codex: Казахстан есть в списке стран API OpenAI, список стран ChatGPT не открылся
  [Казахстан].
- Налоги [Казахстан][СМИ]:
  - с 01.01.2022 иностранные компании, которые продают электронные услуги физлицам РК (B2C), сами
    встают на учёт и платят НДС; «Наши граждане не платят данный налог»
    (https://uchet.kz/news/nalogooblozheniya-inostrannoy-kompanii-pri-osushchestvlenii-elektronnoy-torgovli-tovarami-okazanii-u/);
  - на 06.11.2025 ставка — 12%, на учёте 118 иностранных компаний; среди плательщиков названы OpenAI
    и Microsoft Ireland Operations Limited
    (https://www.zakon.kz/finansy/6496816-nalog-na-Google-prines-kazakhstanu-svyshe-118-mlrd-tenge-chto-eto-takoe-i-kto-ego-platit.html);
  - в 2026 году стандартная ставка НДС с услуг нерезидента — 16%, в том числе на права на ПО и
    доступ к интернет-ресурсам; платит казахстанский покупатель, стоящий на учёте по НДС
    (https://mybuh.kz/useful/nds-za-nerezidenta-kak-nachislyat-i-kogda-oplachivat.html);
  - ставка для B2C в 2026 году — не найдено (см. «Где искали»).
- Казахстанских агентных платформ с разбором сессии — не найдено (см. «Где искали») [Казахстан].

### 14. Независимые данные: что идёт не так в сессиях агентов

- Препринт arXiv: Tang и соавторы, v1 — 28.05.2026, v2 — 31.08.2026 [мир][независимо].
  - Данные: 20 574 сессии агентов-программистов из 1 639 репозиториев, в IDE и CLI.
  - Метод: рассогласование между разработчиком и агентом видно по «developer pushback» — по тому,
    как разработчик возражает или поправляет агента.
  - Семь повторяющихся форм: как агент читает проект, понимает намерение разработчика, следует
    правилам, соблюдает границы действий, пишет и запускает код, сообщает о ходе работы.
  - Итог: «90.50% of episodes impose effort and trust costs rather than irreversible system damage,
    yet 91.49% of visible resolutions still require explicit user correction».

  Источник: https://arxiv.org/abs/2605.29442

## Где искали

**Поисковые запросы (WebSearch), 2026-09-30:**
- Claude и Anthropic: «Claude Code /insights command report sessions friction», «Claude Code
  session summary recap feature 2026», «Anthropic claude.com blog "/insights" Claude Code report»,
  «Claude Cowork progress panel task summary what Claude did support.claude.com», «Cowork
  "insights" OR "usage report" OR "session summary" Claude desktop 2026», «claude.ai "how you use
  Claude" personal report insights feature consumer 2026»;
- GitHub: «GitHub Copilot coding agent session logs track sessions docs.github.com», «GitHub
  Copilot agent session summary insights feedback "next time" 2026 changelog», «Copilot CLI
  "/chronicle" slash commands tips improve standup docs.github.com», «gh-aw
  "copilot-session-insights" workflow github agentic workflows»;
- Cursor: «Cursor agent session insights review past chats analysis feature 2026 changelog»,
  «cursor.com docs analytics dashboard agent usage team "conversation insights" OR "agent
  insights"», «Cursor "/create-rule" OR "Generate Cursor Rules" from conversation docs rules 2026»,
  «Cursor hooks docs agent events beforeSubmitPrompt afterAgentResponse stop audit»;
- OpenAI: «OpenAI Codex sessions insights analyze past sessions tips feature 2026»,
  «developers.openai.com codex cloud task logs summary citations worklog», «Codex CLI automatic
  recap "recap" conversation next actions docs learn.chatgpt.com»;
- Cognition: «Devin "Session Insights" analyze session feedback improved prompt docs.devin.ai»,
  «"Devin" "Session Insights" review improved prompt issue timeline experience blog
  -site:devin.ai -site:cognition.ai», «Windsurf Cascade conversation insights session analysis
  feature docs.windsurf.com 2026», «Windsurf pricing 2026 Pro Teams per month Cascade analytics
  dashboard», «Windsurf renamed "Devin Desktop" Cognition announcement 2026»;
- Google: «Gemini CLI /stats session summary on exit tool calls success rate user agreement wall
  time agent active», «Gemini Code Assist Standard Enterprise price per user per month 2026
  cloud.google.com pricing», «Google Antigravity walkthrough artifact agent manager task summary
  docs antigravity.google», «Antigravity pricing 2026 Google AI Pro Ultra quota antigravity CLI»,
  «Google Jules coding agent activity log plan critic task summary features pricing jules.google»;
- другие платформы: «Kiro IDE AWS agent session history summary "execution log" OR "session
  summary" OR "task summary" docs kiro.dev», «JetBrains Junie agent session summary trajectory plan
  steps report "what Junie did" docs», «Factory Droid session insights analyze sessions friction
  recommendations docs.factory.ai», «docs.factory.ai droid session analytics usage dashboard "/cost"
  OR "/usage" OR "insights" CLI», «Amp Sourcegraph ampcode thread analysis insights review past
  threads feature», «Replit Agent session summary checkpoint "what the agent did" usage breakdown
  effort 2026», «coding agent built-in "session retrospective" OR "session review" OR "post-session
  analysis" improved prompt what went wrong 2026», «Augment Code OR OpenHands OR Warp agent "session
  insights" OR "conversation insights" feature analyze agent session»;
- Россия и СНГ: «GigaCode агент режим агента история сессий статистика цена 2026», «SourceCraft
  Code Assistant агентный режим Яндекс цена статистика использования 2026», «SourceCraft статистика
  использования Code Assistant личный кабинет что показывает документация», «gitverse.ru GigaCode
  агент документация тарифы Персональный Бизнес», «GitVerse регистрация иностранный номер Казахстан
  Сбер ID GigaCode доступ из Казахстана»;
- Казахстан: «Cursor "model provider" region not supported countries list Russia China Kazakhstan
  docs cursor.com», «GitHub Copilot availability countries trade controls sanctioned regions
  docs.github.com Copilot not available», «НДС на электронные услуги иностранных компаний
  физическим лицам Казахстан 2026 ставка 16% "налог на Google"», «казахстанский ИИ-агент для
  разработчиков платформа Astana Hub кодинг-агент 2026», «Kazakhstan AI coding agent startup
  developer tool session analytics 2026».

**Поисковые запросы доработки r2 (WebSearch), 2026-10-01:** «Cline docs task history checkpoints
cost per task "/newrule" slash command», «Cline pricing teams enterprise per user 2026 cline.bot
pricing», «Roo Code Cloud task history analytics token usage cost per task sharing docs.roocode.com
pricing», «Roo Code Roomote 2026 Roo Code extension status RooCodeInc announcement», «Kilo Code docs
task history usage analytics teams dashboard pricing kilo.ai», «Continue.dev agents mission control
session history docs pricing 2026 continue.dev», «Zed agent panel thread history token usage docs
zed.dev pricing Zed Pro 2026», «Warp agents docs conversation history agent management panel usage
credits pricing warp.dev 2026», «Augment Code docs agent session history checkpoints usage analytics
"Augment" pricing 2026 augmentcode.com», «Tabnine agent docs conversation history usage reports
insights admin pricing 2026 tabnine.com», «Tricentis acquires Tabnine 2026 announcement», «Amazon Q
Developer 2026 status Kiro migration Q Developer CLI renamed Kiro CLI pricing Q Developer Pro»,
«aws.amazon.com Amazon Q Developer end of support new subscriptions Kiro announcement 2026
site:aws.amazon.com», «"ChatGPT agent" agent mode 2026 replaced by ChatGPT Work OpenAI»,
«help.openai.com ChatGPT agent article retired "ChatGPT Work" cloud browser», «Manus agent replay
session share task history credits pricing manus.im 2026», «site:manus.im replay task share "replay"
Manus help», «bolt.new docs agent chat history token usage pricing 2026 support.bolt.new»,
«support.bolt.new version history restore chat "Bolt" docs agent», «Lovable docs agent mode chat
history version history credits pricing 2026 docs.lovable.dev».

**Поисковые запросы доработки r3 (WebSearch), 2026-10-01:** «OpenCode open source AI coding agent
terminal opencode.ai docs share sessions stats», «Crush Charm terminal AI coding agent
charmbracelet crush sessions docs», «Zoo Code fork of Roo Code community VS Code extension official
site GitHub».

**Открыты и использованы.** Страницы открывались через WebFetch, а крупные — через curl с разбором
текста. Ссылки первой версии файла открыты 2026-09-30, ссылки доработок r2 и r3 — 2026-10-01 (пункты
с пометкой «(проверено 2026-10-01)» и разделы 11–12). Дополнительно:
- журнал изменений Claude Code на GitHub (raw-файл `CHANGELOG.md` репозитория
  `anthropics/claude-code`) — для версий `/recap` и `/insights`; даты `/insights` в нём нет;
- API GitHub — статус issue и PR OpenHands: автор issue — участник организации (MEMBER), PR открыт
  и не влит;
- API GitHub (2026-10-01) — тексты выпусков rust-v0.156.0 и rust-v0.159.0 и описание PR #48352
  репозитория openai/codex, статус репозитория RooCodeInc/Roo-Code (archived); HTML-страницы этих
  выпусков, PR и репозитория тоже открываются;
- API GitHub (2026-10-01, доработка r3) — статус репозиториев RooCodeInc/Roomote (публичный, не в
  архиве, создан 2026-07-07), anomalyco/opencode (лицензия MIT), charmbracelet/crush,
  Zoo-Code-Org/Zoo-Code (лицензия Apache-2.0, не в архиве); тема форума OpenAI в виде JSON — для
  точных текста и дат сообщений.

**Где искали по ячейкам «не найдено»:**
- **Cursor** (вмешательства, ошибки, потерянное время, советы): cursor.com/docs/account/teams/analytics,
  /docs/account/teams/dashboard (метрики там не расписаны), /docs/agent/agent-review,
  /docs/agent/prompting, /docs/rules, /docs/hooks, /pricing, /changelog (четыре страницы, записи с
  05.06 по 23.09.2026), /changelog/side-chat, /changelog/enterprise-dec-2025; запросы по Cursor выше.
- **Codex** (постановка задачи, вмешательства, ошибки, советы): полный текст
  learn.chatgpt.com/docs/changelog (поиск по insight, tips, recap, usage, review, summary, duration;
  страница меняется между загрузками: записи Codex CLI 0.156.0 и 0.159.0 на ней то были, то нет,
  при загрузках 2026-10-01 в 07:10–07:11Z — были),
  learn.chatgpt.com/docs/developer-commands?surface=cli, /docs/cloud, /docs/enterprise/usage-insights,
  /docs/pricing, issue github.com/openai/codex/issues/41896; страницы выпусков
  github.com/openai/codex/releases/tag/rust-v0.156.0 и /rust-v0.159.0, PR
  github.com/openai/codex/pull/48352 (2026-10-01); запросы по OpenAI выше. Советы «during and after
  turns» не засчитаны: по описанию PR #48352 это случайные подсказки из готового каталога, а не
  советы, построенные по сессии.
- **Claude (приложения и claude.ai)** (ошибки, потерянное время): anthropic.com/news/reflect-with-claude
  (повторно 2026-10-01: о времени — только «Soon, we'll add a view of how much time you've spent
  using Claude»), статья TechCrunch; support.claude.com — статьи о Cowork (начало работы, «one
  Claude», OpenTelemetry) и об аналитике Team и Enterprise; claude.com/pricing; запросы по Claude
  выше.
- **Devin Desktop** (всё, кроме действий): devin.ai/desktop, docs.devin.ai/desktop/cascade/cascade;
  страница Session Insights говорит только о сессиях Devin.
- **Gemini CLI** (постановка задачи, советы): geminicli.com/docs/reference/commands/, исходный код
  StatsDisplay.tsx и SessionSummaryDisplay.tsx, geminicli.com/docs/resources/quota-and-pricing/.
- **Google Antigravity** (постановка задачи, потерянное время): antigravity.google/docs/walkthrough,
  /docs/slash-commands/, /docs/artifact-review/, /docs/cli/commands/usage/, /docs/cli/conversations/,
  /pricing.
- **Jules** (всё, кроме действий): jules.google/docs/, /docs/changelog/, /docs/usage-limits/.
- **Kiro** (всё, кроме действий): kiro.dev/docs/cloud-sessions/,
  /docs/enterprise/monitor-and-track/user-activity/, /pricing/.
- **Junie** (всё, кроме действий): junie.jetbrains.com/docs/slash-commands.html,
  /docs/junie-cli-plan-mode.html, junie.jetbrains.com.
- **Amp** (всё, кроме действий): ampcode.com/docs (сюда перенаправляет /manual), /docs/threads,
  /docs/pricing.
- **Replit Agent** (всё, кроме действий): docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks,
  replit.com/pricing.
- **Factory** (все шесть элементов): factory.com/news/factory-signals, /news/factory-analytics,
  docs.factory.com/factory-app/overview, /pricing.
- **OpenHands** (постановка задачи, вмешательства): openhands.dev/blog/new-in-agent-canvas-august-2026,
  /pricing, issue и PR в OpenHands/extensions.
- **SourceCraft Code Assistant** (всё, кроме действий): sourcecraft.dev — история изменений Code
  Assistant, страница агентского режима JetBrains, портал Code Assistant, тарифы.
- **GigaCode** (все шесть элементов и доступность в Казахстане): gitverse.ru/features/gigacode/;
  результаты запросов по GigaCode и GitVerse (сторонние обзоры — не открывались как источник).
- **Cline** (всё, кроме действий): docs.cline.bot/core-workflows/using-commands, /checkpoints,
  /enterprise-solutions/overview; cline.bot/pricing; запросы по Cline выше.
- **Kilo Code** (всё, кроме действий): kilo.ai/docs/collaborate/sessions-sharing,
  /docs/collaborate/teams/analytics, /docs/collaborate/adoption-dashboard/understanding-your-score;
  kilo.ai/teams.
- **Roo Code** (все шесть элементов): репозиторий github.com/RooCodeInc/Roo-Code (страница и
  README), roocode.com и roocode.com/pricing (перенаправляют на roomote.dev); документация
  roocodeinc.github.io/Roo-Code (куда перенаправляют docs.roocode.com/roo-code-cloud/analytics и
  /task-sync) не дала текста ни через curl, ни через WebFetch.
- **Roomote** (все шесть элементов): roomote.dev — вся страница; в ней нет разбора сессии, есть
  самопроверка агента и сводные графики расходов и продуктивности.
- **Continue** (всё, кроме действий): continue.dev, docs.continue.dev (главная и
  /ide-extensions/agent/quick-start); docs.continue.dev/mission-control/tasks — 404.
- **Zed** (всё, кроме действий): zed.dev/docs/ai/agent-panel, zed.dev/pricing,
  zed.dev/docs/account/plans-and-pricing.
- **Warp** (постановка задачи, вмешательства, советы): docs.warp.dev/platform/managing-cloud-agents/,
  /support-and-community/plans-and-billing/credits/ и /plans-pricing-refunds/; warp.dev/pricing.
  Строка «prompt, plan, commands, logs, messages, and output» в запуске — показ действий, по
  правилу таблицы (раздел 1) она засчитана в «Действия агента», а не в «Постановка задачи».
- **Augment Code** (вмешательства): docs.augmentcode.com — /cosmos/sessions-overview,
  /cosmos/advisor/overview, /cosmos/advisor/limitations, /analytics/overview, указатель /llms.txt;
  augmentcode.com/pricing.
- **Tabnine** (всё, кроме действий): docs.tabnine.com — /main/getting-started/tabnine-agent и
  страница Agent Usage; tabnine.com и tabnine.com/pricing (перенаправляют на tricentis.com);
  пресс-релиз о покупке.
- **Amazon Q Developer** (все шесть элементов): пост AWS об окончании поддержки,
  docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/what-is.html и страница об окончании поддержки,
  aws.amazon.com/q/developer/pricing/.
- **ChatGPT Work** (всё, кроме действий): learn.chatgpt.com/docs/get-started-with-work,
  /docs/enterprise/chatgpt-work-overview, /docs/enterprise/usage-insights,
  /docs/customization/computer-history, /docs/extend/record-and-replay, /docs/pricing.
- **Manus** (всё, кроме действий): help.manus.im — статья о публичной ссылке на задачу;
  manus.im/docs/features/projects, /docs/features/wide-research, /docs/introduction/plans.md;
  manus.im/pricing (цены собираются скриптами и не извлеклись).
- **Bolt** (всё, кроме действий): support.bolt.new/building/using-bolt/rollback-backup,
  bolt.new/pricing.
- **Lovable** (постановка задачи, вмешательства, советы): docs.lovable.dev/features/projects/chat,
  /introduction/credits-and-usage, /introduction/subscription-plans.
- **OpenCode** (постановка задачи, вмешательства, потерянное время, советы): opencode.ai (на главной
  ответы раздела FAQ в HTML не нашлись), /docs/ (вводная), /docs/cli/, /docs/tui/, /docs/share/,
  /docs/zen/, /docs/go/, github.com/anomalyco/opencode; запросы r3 выше. `opencode stats` показывает
  токены и стоимость, но не время, поэтому «Потерянное время» не засчитано; общий совет из
  руководства не построен по сессиям, поэтому «Советы» не засчитаны.
- **Crush** (постановка задачи, вмешательства, ошибки, потерянное время, советы):
  github.com/charmbracelet/crush (страница и README), hyper.charm.land, charm.land и
  charm.land/crush (перенаправляет на репозиторий); запросы r3 выше.
- **Zoo Code** (постановка задачи, вмешательства, потерянное время, советы): zoocode.dev,
  docs.zoocode.dev (главная, /features/checkpoints, /features/enhance-prompt,
  /features/intelligent-context-condensing, /advanced-usage/rate-limits-costs,
  /basic-usage/the-chat-interface), карта сайта docs.zoocode.dev/sitemap.xml (517 страниц, из них 404 —
  заметки о выпусках; по названиям страниц об аналитике, истории задач или разборе сессии нет),
  github.com/Zoo-Code-Org/Zoo-Code; запросы r3 выше.
- **Доступность в Казахстане** Devin, Devin Desktop, Antigravity, Jules, Kiro, Junie, Amp, Replit,
  Factory, OpenHands, а также Cline, Kilo Code, Roo Code, Roomote, Continue, Zed, Warp, Augment Code,
  Tabnine, Amazon Q Developer, Manus, Bolt, Lovable, OpenCode, Crush, Zoo Code: на страницах цен и
  документации, перечисленных выше, списков стран нет; отдельно не искал.
- **Казахстанские агентные платформы**: два запроса про Казахстан выше. В выдаче — статьи Astana Hub
  о национальной ИИ-платформе, форум GITEX AI Kazakhstan и списки мировых агентов; казахстанского
  агента для разработчиков с разбором сессий нет.
- **Ставка НДС для B2C в 2026 году**: запрос про «налог на Google» выше; статья buh.mcfr.kz о новом
  Налоговом кодексе не открылась (403); uchet.kz (2022) ставку не называет; zakon.kz (06.11.2025)
  называет 12% на дату статьи.

**Не открылись или не дали данных:**
- help.openai.com/en/articles/7947663-chatgpt-supported-countries — 403, список стран ChatGPT не
  проверен;
- buh.mcfr.kz — 403;
- datacamp.com/tutorial/devin-ai — 403;
- codeassist.google и codeassist.google/products/business — цены не извлеклись, страница
  собирается скриптами;
- one.google.com/about/google-ai-plans/ — цены не показаны;
- 2026-10-01: help.openai.com/en/articles/6825453-chatgpt-release-notes — 403 (и через curl, и через
  WebFetch);
- 2026-10-01: manus.im/pricing — цены собираются скриптами, в тексте страницы их нет;
- 2026-10-01: roocodeinc.github.io/Roo-Code/roo-code-cloud/analytics/ — пустая страница;
- 2026-10-01: docs.continue.dev/mission-control/tasks — 404;
- 2026-10-01: tabnine.com/pricing — перенаправляет на tricentis.com, цен Tabnine нет.

**Вне предмета файла:**
- платформы для разработчиков собственных агентов. Открыта
  platform.claude.com/docs/en/managed-agents/observability — там описан API событий сессии, без
  разбора в консоли; OpenAI Agents SDK и Agents API не проверялись;
- отдельные инструменты разбора сессий, в том числе навыки-«ретроспективы» из выдачи, а также
  Pretty Prompt и Microsoft Prompt Coach — предмет `session-review-tools.md`.

**Как применено правило включения (см. начало файла: найдена и открыта — строка в таблице).** Первая
версия файла называла 14 платформ непроверенными. В доработке r2, 2026-10-01:
- строки получили 13: Augment Code, Warp, Zed, Cline, Roo Code, Kilo Code, Continue, Tabnine,
  Amazon Q Developer, ChatGPT Work, Manus, Bolt, Lovable;
- четырнадцатая новая строка — Roomote: страница открыта; на roomote.dev написано «By the creators of»
  рядом с логотипом Roo Code, репозиторий Roomote лежит в той же организации RooCodeInc, а
  roocode.com перенаправляет на roomote.dev. Roomote и Roo Code — два продукта с разным состоянием:
  расширение Roo Code закрыто 15.05.2026, Roomote развивается. Поэтому строк две;
- строки не получил агентный режим ChatGPT: его официальные страницы не открылись —
  help.openai.com/en/articles/11752874-chatgpt-agent и openai.com/index/introducing-chatgpt-agent/
  отвечают HTTP 403 (curl, 2026-10-01, 07:11Z; WebFetch — то же). Страница
  help.openai.com/en/articles/6825453-chatgpt-release-notes тоже отвечает 403, но это журнал выпусков
  ChatGPT, а не статья об агенте. Что известно об агентном режиме из страниц, которые открылись, — в
  разделе 12.

В доработке r3, 2026-10-01, строки получили ещё три платформы, которые файл раньше называл, но не
открывал: OpenCode, Crush и Zoo Code. Их официальные страницы открыты (раздел 11). Остальные
платформы, которые встречались только в заголовках результатов поиска и не открывались, строк не
получили: правило требует открытой страницы.

<!-- conclusion:start -->
## Выводы исследователя

Ниже — моя интерпретация фактов выше, а не проверенные факты.

**Ответ на главный вопрос.** В пяти платформах из условия (Claude Code, GitHub Copilot, Cursor,
Codex, Claude) разбора одной сессии по всем шести элементам я не нашёл. Но части такого разбора есть
уже у всех пяти:

- сводный разбор по многим сессиям: `/insights` в Claude Code, `/chronicle` в Copilot, Reflect в
  Claude, Conversation Insights в Cursor (только Enterprise);
- краткое резюме одной сессии: `/recap` и строка в agent view у Claude Code, recaps в Codex;
- цифры одной сессии: `/usage` в Claude Code, длительность хода в Codex; у Gemini CLI — итог при
  выходе.

Ближе всех к «разбору после каждой сессии» подошёл Devin. Его Session Insights даёт «да» по
постановке задачи, действиям, ошибкам и советам и «частично» по вмешательствам и потерянному
времени. Это бесплатно, но работает только для сессий самого Devin.

Второй такой случай нашёлся в доработке — Augment Code (Cosmos). Его Advisor по запросу разбирает
одну сессию, если она упала, зависла или дала плохой результат: называет корневую причину и
говорит, что исправить. По многим сессиям он советует поправить промпт. Но это разбор сбоя, а не
каждой сессии, и примеры причин — в настройке окружения, а не в формулировке задачи. Разбора
вмешательств пользователя у Augment я не нашёл.

Из 35 строк таблицы «да» есть только у этих двух платформ. У остальных 16 платформ, добавленных
в доработках, разбора нет:

- у 13 — показ действий; к нему у Warp и Lovable добавлены сбои и длительность, а у OpenCode и
  Zoo Code — сообщения об ошибках;
- у Roo Code, Roomote и Amazon Q Developer не найдено ни одного элемента.

**Что остаётся пустым для Claude Code.** По одной сессии Claude Code я не нашёл встроенного средства,
которое показывает три вещи:

- где пользователь плохо поставил задачу;
- сколько времени ушло впустую и на что;
- как сформулировать задачу лучше в следующий раз.

`/insights` отвечает на похожие вопросы, но сводно по десяткам сессий и без оценки потерянного
времени. `/usage` даёт время сессии целиком, без разметки потерь. Reflect в приложениях Claude
оценивает навык «Description» — насколько хорошо пользователь описывает цели, — но тоже сводно за
месяцы и только по чатам.

**Вендоры закрывают разрыв быстро.** Session Insights у Devin есть с июня 2025. Остальное появилось
за последние десять месяцев:

- Conversation Insights в Cursor — декабрь 2025;
- `/insights` в Claude Code — не позже 03.02.2026 (дата разбора Золкоса);
- `/chronicle` в Copilot — февраль 2026 экспериментально, май — для всех;
- session recap в Claude Code — апрель; Reflect — июль; recaps в Codex — сентябрь 2026.

Добавлю ещё три сигнала. У Antigravity есть `/learn` (дату на странице не нашёл). Factory уже
разбирает сессии по трениям, но внутри, для себя. В OpenHands предложение сделать `/insight` прямо
ссылается на Claude Code как на образец. Риск, что Claude Code или Copilot добавят разбор одной
сессии в следующих версиях, я оцениваю как высокий.

**Рынок агентных платформ быстро меняется.** По фактам разделов 7, 11 и 12:

- Windsurf стал Devin Desktop;
- Continue куплен Cursor, Tabnine — Tricentis;
- расширение Roo Code закрыто 15.05.2026 (по README его репозитория), а roocode.com
  перенаправляет на сайт Roomote;
- Amazon Q Developer закрыт для новых клиентов в пользу Kiro;
- агентный режим ChatGPT, по сторонней статье, заменён ChatGPT Work.

Для бизнес-плана это значит, что список конкурентов устаревает за месяцы. Таблицу стоит
перепроверять перед любым решением.

**Цены и кто платит.** Отдельной подписки на разбор сессий я не нашёл ни у кого: он входит в тариф.

- Devin — без доплаты;
- Claude Code — за счёт лимита тарифа или токенов API;
- Copilot — во всех планах, в Business и Enterprise после включения администратором;
- Cursor — только Enterprise; с 01.01.2026 за Conversation Insights берут оплату за инференс.

**Казахстан и СНГ.**

- Claude Code, Claude, Copilot и Cursor доступны в Казахстане по данным вендоров: списки стран
  Anthropic, OpenAI и Google, перечень ограничений Copilot. У Codex подтверждён только список стран
  API; список ChatGPT не открылся.
- Цены — в долларах; у Claude и Cursor прямо сказано, что без налогов.
- Местных платформ с разбором сессий не найдено. У российских SourceCraft и GigaCode разбора сессий
  тоже не найдено. У SourceCraft есть цены в тенге.

**Что это значит для строки ценности.** Отличие, которое ещё можно заявлять по найденному: разбор
одной конкретной сессии Claude Code сразу после неё, с оценкой потерянного времени и вмешательств
пользователя.

Нельзя заявлять, что разбора «нет вообще»:

- у Claude Code есть бесплатный сводный разбор (`/insights`);
- у Devin есть разбор одной сессии;
- у Augment Code есть разбор одной неудачной сессии.

«Не найдено» по потерянному времени у крупных платформ — результат моего поиска, а не доказательство,
что функции нет. Независимые данные (arXiv: 91,49% видимых исправлений требуют явной поправки
пользователя) говорят, что вмешательства — обычная часть работы с агентом. Значит, в них есть что
разбирать. Готов ли кто-то за это платить, эти данные не показывают.
<!-- conclusion:end -->
