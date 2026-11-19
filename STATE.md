# Sai — the current state

One screen. DOC-UPDATER rewrites the lines of this block at the end of every run and adds no dated sections (REQ-103, `decisions/0091` item 6). The journal up to the run M0DOCS-20261117-01 is `docs/archive/STATE-until-M0DOCS-20261117-01.md`, a byte copy of the file this one replaced. The iteration is in `PLAN.md`; the program is `docs/program/public-v1/PLAN.md`, its checkpoint `docs/program/public-v1/PROGRESS.md`.

**State:** the program PUBLIC-V1 (`decisions/0091`; the owner's choice of the finished product, `decisions/0115`), milestone M0 «Clean start» in progress; the first audit AUD-001 is closed («готов», `docs/audits/README.md`).

- Requirements (`docs/requirements.yaml`, the status lines of the blocks, read 2026-11-18T05:27:52Z): 110 in total — 38 done, 2 in progress, 3 blocked, 60 pending, 7 cancelled.
- Open defects (`docs/issues/`, the first line «Серьёзность: …» of each file, read 2026-11-18T05:27:52Z): 97 — 1 critical, 0 high, 9 medium, 87 low.

**Open gates:** the rows of «Owner gates» in `docs/program/public-v1/PROGRESS.md` with no recorded answer (read 2026-11-18T05:27:52Z):

- G4 First URL (with G8, at the first deploy)
- G6 API key, limit, model (report #M0, after P1)
- G7 Personal data (report #M2)
- G8 Vercel Pro (with G4)
- G9 Kazakh public (report #M1)
- G10 «Открывай»
- G11 «Начинай» (+ `stop` right for customers)
- G14 Domain and Kazakhstan hosting
- G15 Docker on the Mac; server (report #M4)
- G16 E-mail provider (report #M7)
- G17 Anthropic confirmation (report #M7)
- G19 Mac residual risk (only if S4 or P1(c) fails)
- G20 Admin second factor (report #M2)
- G21 «Похоже» (each look release)
- G22 Office event source, quality-bar R2 (report #M1)
- WF-05 step 8 (AUD-001)

Owner actions pending (the same file, «Now»): Vercel part 1 in his existing account with a new project for Sai, then the account e-mail, Team ID and Project ID; REQ-014 two checks

**Next step:** M0.10 build of run M0DOCS-20261117-01 — step 02 DOC-UPDATER (sub-steps S1-S4 of the design: archive and replace STATE.md and PLAN.md, edit docs/product, ideas/README.md, CLAUDE.md, README.md) under the locks L0 and L1 taken by ORCH; then S5a (ORCH cancels the four stale handoffs) and S5b (BACKEND-DEV, the two tools edits), the reviews, the tests, the gates. In parallel M0.9: run ISS-0092-20261117-01 step 03 CODE-DESIGNER. The order of M0 is decisions/0117 О33 (ISS-0092 through its step 10, then M0DOCS step 10, then one records release M0.13). — `docs/program/public-v1/PROGRESS.md`, «Now», «Next step (exact)».

The three sections below the line are copied verbatim from the old file: the code (`tools/src/contract.js`, `tools/src/apply.js`) and the test TM-01 (`tools/test/team-docs.test.js`) read them. Their text is the record of 2026-10-06, not the current plan.

---

### Решение владельца о старте

**2026-10-06 — решение о старте разработки продукта «виртуальная команда» принято владельцем.** Слова владельца: «Твоя задача — ДОВЕСТИ ПРОДУКТ ДО РАБОЧЕГО СОСТОЯНИЯ.» и «Главная задача этой сессии — получить максимально большой РЕАЛЬНЫЙ прирост готовности продукта». Проверка спроса (ниже) для этого продукта не проводилась — это названный риск (см. `decisions/0015-product-virtual-team-start.md`); владелец может отменить решение. Условие старта ниже относится к прежней идее (примерка одежды / квизы) и сохранено как история.

Прежнее условие (идея с магазинами одежды): не принято. Условие старта, о котором договорились:

1. Написать 20 Instagram-магазинам одежды в Алматы: сколько раз в день спрашивают
   «какой размер взять?», сколько обменов и возвратов из-за размера в месяц.
2. Тем, у кого часто, предложить платный пилот на месяц (ориентир 10 000 ₸).
3. **Старт**, если 1–2 магазина готовы заплатить. **Стоп**, если никто.

Когда владелец примет решение, записать его сюда: дата, результат проверки, решение.

Пометка 2026-10-11 (DOC-UPDATER, прогон `DOC-20261011-01`): прежнее условие с магазинами одежды снято решением владельца
`decisions/0033-drop-clothing-shop-product.md` — это история, не план.

<!-- sai:wf06:start -->
### Рекомендация агентов (WF-06)

Прогон `WF06-20260926-01`, вердикт версии 2 от 2026-09-28.
Рекомендованная идея: **Идея 1 — квизы, которые приводят заявки малому бизнесу** (`01-kviz-zayavki`), уверенность: низкая.

Причины:
- Отрыв минимальный и неустойчивый: 01-kviz-zayavki — 21, 02-sai — 20, разница 1 балл из 30 возможных. Он появился только в раунде 3: в раунде 1 впереди была 02-sai, 23 против 21. Все три правки 02-sai — по −1 (competition_gap 3→2, owner_goals 4→3, no_selling_self 5→4). Если отменить любую одну — ничья 21:21; любые две — 02-sai впереди 22:21; все три — 23:21, как в раунде 1. У 01 правок нет. Поэтому уверенность низкая, а следующий кандидат при провале проверки 01 — 02-sai.
- У 01-kviz-zayavki лучший из четырёх уровень доказательства спроса — demand_evidence 4: оплата самой категории подтверждена фактами покупок (у платного модуля concept.quiz «более 1000» установок), платные тарифы есть у Marquiz, MadTest, Enquiz и др., в Казахстане квиз-модули Битрикса продаются за тенге (Ready.kz, Adena). Не 5: отзывов, кейсов или жалоб именно от казахстанских бизнесов не найдено ни по одному конкуренту, а продажа за тенге — предложение реселлеров, не доказанные покупки. У 02-sai здесь 3: готовность магазинов платить прямо не доказана.
- Из шести критериев у 01-kviz-zayavki и 02-sai три равны (competition_gap 2 и 2, owner_goals 3 и 3, no_selling_self 4 и 4) и три различаются: 01 выше по demand_evidence (4 против 3) и build_fit (4 против 3), 02 выше по cost_to_test (5 против 4). build_fit 4 у 01: механика знакома по Advisor (код пишется заново), фото покупателей нет; у 02 — 3 из-за R3, платной примерки 35–40 ₸ за картинку и замеров каждой вещи. cost_to_test 4 у 01: ручная проверка за 2–4 недели с порогом «2 из 3 платят» до любой постройки; у 02 она ещё дешевле (без кода, 1–2 недели) — 5.

Условия:
- Рекомендуется начать с проверки спроса 01-kviz-zayavki, а не с разработки: код конструктора не пишется, пока после пробного периода фактически не заплатили не меньше 2 из 3 бизнесов (порог из самой идеи).
- Оплатой считаются только полученные деньги — не устное согласие и не похвала («Все хвалят, но никто не платит» — сигнал закрытия в самой идее).
- Считаются целевые заявки, а не все: в конкурентных нишах квизы собирают много некачественных заявок (vc.ru в исследовании 01). Что такое целевая заявка и какое число заявок считать «единицами», записывается до начала проверки.
- Хотя бы один из трёх бизнесов — не личный знакомый владельца: аналитик execution отметил, что готовность знакомых платить завышена, аналитики market и owner_fit в раунде 2 с этим согласились.
- Проверка включает доставку заявки владельцу бизнеса в WhatsApp — единственное из заявленных отличий, которого исследование не нашло у конкурентов; записывается, за что именно бизнес платит, и сравнивается с расходом на WhatsApp-шлюз. В источниках две цены таких сервисов: Wazzup — от 6000 ₸/мес за канал, ChatPush через Albato — от 1690 ₽/мес; оба найдены как платные внешние сервисы для Marquiz, а Wazzup по справке Marquiz пишет клиенту, прошедшему квиз, а не владельцу бизнеса. Расход на собственную доставку заявок владельцу в WhatsApp в источниках не указан — он определяется до начала проверки.
- Если бизнес не разместил ссылку на квиз в своей рекламе или Instagram, его результат записывается как «не проверено», а не как «нет спроса».
- Отрыв от 02-sai — 1 балл, и он держится на каждой из трёх правок раунда 3. Если проверка 01 остановлена по критериям остановки, следующим кандидатом рассматривается 02-sai по её собственному плану (20 Instagram-магазинов в Алматы, 1–2 недели, без кода, платный пилот около 10 000 ₸), а не 03-zhivoy-most (15) или 04-kamery-kpp (11). Решает владелец.
- Вердикт — рекомендация. Проверка начинается только после письменного решения владельца.

Остановиться, если:
- По окончании срока проверки (не более 4 недель) и пробного периода фактически заплатили меньше 2 из 3 бизнесов — конструктор не строится, проверка 01 закрывается.
- У бизнесов, которые разместили ссылку на квиз, целевых заявок за срок проверки нет или меньше порога, записанного до старта («Заявок нет или единицы» — сигнал закрытия в самой идее), — закрыть.
- Через 2 недели квизом не занимается ни один из бизнесов (сигнал закрытия в самой идее) — закрыть.
- Цена, которую бизнесы согласились платить в месяц, не покрывает расход на доставку их заявок в WhatsApp, определённый до начала проверки, — единственное найденное отличие не окупается; в таком виде 01 закрывается.

Решение принимает владелец. До его записи код продукта не пишется.
Подробно: `runs/WF06-20260926-01/verdict-2.md`; следующие шаги для ORCH: `runs/WF06-20260926-01/proposed-actions.json`.
<!-- sai:wf06:end -->

### Что делать дальше — по порядку

1. Владелец: решения одним списком — `PLAN.md`, итерация 6. **Ждёт владельца:** перезапуск
   сервера Pixel Office на порту 4780 (`cd tools && npm run pixel-office`: работает старый код —
   без записи текста и без окна «Просмотр истории»); подтверждение сходства офиса и окна с
   образцами и вида в 2K (снимки `office-actual-1920x1080-2026-10-05.png`,
   `office-actual-2560x1440-2026-10-05.png`, `history-window-1920x1080-2026-10-06.png`,
   `history-window-2560x1440-2026-10-06.png`); согласие на настоящую сессию Claude Code для UAT
   (REQ-001, REQ-007, REQ-008; без него REQ-001 и REQ-007 не станут done); переменная
   `SAI_PIXEL_OFFICE_STORE_TEXT` — по умолчанию хранение текста включено, выключить можно `0`,
   задавать надо и у сервера, и у Claude Code; подтверждение решений 0003–0016 (0015 меняет границу `CLAUDE.md` и `0001`, владелец может отменить); согласие на реальные запуски движка и потолок расходов (ключ API для основного варианта не нужен — вход Claude Code под подпиской); перезапуск сервера Pixel Office после выхода кода; развилка по
   процессам (`docs/business-plan/README.md`, «Решения владельца», решение 2); предложения П1–П8 (`decisions/0006-proposals-to-raise-the-bar.md`, по одному).
2. Владелец: путь на ближайшие 30 дней и остальные решения бизнес-плана —
   `docs/business-plan/README.md`, «Решения владельца»; по Pixel Office — Вопрос 2 документа
   `docs/business-plan/pixel-office-brief.md` (может ли платная версия читать текст сессий на
   компьютере пользователя). Страницу с предоплатой не запускать.
3. ORCH: итерация 2 — шаг 2f (свой репозиторий), затем 2g (проверка на чистой копии, поиск
   следов по всем признакам сразу — AP-024, и первая перепроверка требований в статусе
   done по WF-05).
4. ORCH: после слов владельца по итерации 3 — UAT на настоящей сессии и учёт REQ-001 и
   REQ-007 (статус done ставит DOC-UPDATER только после PASS RELEASE-VALIDATOR).
5. ORCH: итерация 5 — ISS-0002 (возобновить TEST-DESIGNER по
   `handoffs/ISS-0002-20260930-01/step-06-test-designer-r2.json`, затем проверка тестов,
   TEST-RUNNER, RELEASE-VALIDATOR по критерию 11 REQ-002 и учёт), ISS-0003, ISS-0004,
   ISS-0005 (под наблюдением).
6. ORCH до следующего настоящего `apply-verdict`: решить, что делать с `apply-report.json`
   прогона `WF06-20260926-01` — в нём записан более старый хеш `STATE.md`
   (`handoffs/ISS-0002-20260930-01/step-05-reviewer.json`, находка F7).
7. ORCH: дописать в `docs/workflows/WF-06-idea-selection.md`, что делать при E_WRITE и
   остатках прерванного запуска.
8. Учётчики прогонов ISS-0002 и Pixel Office: внести в `docs/anti-patterns.md` оставшиеся
   ошибки процесса — `handoffs/BP-20260930-01/orch-notes.md`, «Кандидаты в журнал ошибок»
   (пп. 2, 3, 5, 7, 8 — ISS-0002; п. 4 (а), (б) — Pixel Office; п. 4 (в) близок к AP-026 —
   сверить), записи хода 2026-10-01 о тестах ISS-0002 и раздел 11 (Q13) проекта
   `docs/design/REQ-001-pixel-office.md`. Следующий свободный номер — AP-039. Номер AP-015 в
   `handoffs/ISS-0002-20260930-01/step-01-issue-fixer.json` и в строке Q13 проекта ISS-0002
   занят записью о знаменателе — ссылку в проекте поправить.
9. После старта: решение 0001 (`decisions/README.md`) — стек и одна команда проверки (Q4).
10. Требования продукта — через WF-01 (REQ-ANALYST → REQ-VALIDATOR).
