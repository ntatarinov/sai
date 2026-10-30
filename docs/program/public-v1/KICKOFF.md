# PUBLIC-V1 — how to start and resume Sonnet

This file has three parts: (a) a short note for the owner in Russian; (b) the exact kickoff prompt; (c) the exact resume
prompt for every later session. The prompts are in English on purpose (agent files are in English, decision 0080);
Sonnet reports to the owner in plain Russian.

## (a) Для владельца: как запустить

1. **Где файлы.** Четыре файла плана (`PLAN.md`, `ARCHITECTURE.md`, `KICKOFF.md`, `PROGRESS.md`) кладёт сессия
   планирования по вашему слову в папку sai, в `docs/program/public-v1/`. Перед запуском проверьте, что эта папка есть.
2. **Запуск.** Откройте новую сессию Claude Code в папке sai и выберите модель Sonnet (команда `/model`). Вставьте
   целиком текст из раздела (b) и отправьте. Запуск с этим текстом — ваше слово «строить» для всего, что в плане не
   помечено как ваш вопрос.
3. **Что Sonnet сделает в первый день.** Прочитает правила проекта и план; запишет решения (старые записи не
   переписываются); честно закроет аудит, без подделки записей; начнёт чинить ошибку, которая портит код в результатах
   агентов; пришлёт одно сообщение с 9 короткими вопросами.
4. **Как отвечать.** Номером и буквой, например «1а, 2а, 3б»; «все а» — все рекомендованные варианты (вариант «а»
   всегда рекомендованный). Ответ пишите в той же сессии, пока она открыта, или вставьте его в конец текста продолжения
   (раздел c, строка «Ответы владельца:»). Если не ответите, работа идёт дальше по варианту «по умолчанию», который
   написан в каждом вопросе. Без вашего слова ничего не тратится, не публикуется и не покупается.
5. **Когда будут следующие вопросы.**
   - Через 3–5 дней, в отчёте о первом этапе: если сборки на вашей подписке не пройдут проверку — нужен ли ключ
     Anthropic API, месячный лимит и модель.
   - Примерно через неделю после вашего аккаунта Vercel: подтвердить первый адрес сайта и тариф Vercel, затем
     запустить главную у себя одной командой и сказать, похожа ли она на утверждённый образец; показывать ли
     казахский язык; откуда офис проекта берёт события.
   - Примерно через 3–5 недель, когда будет вход и проекты: создать учётную запись администратора и тестовый вход
     (несколько шагов по инструкции, около 10 минут); ответить, нужен ли код из приложения для входа в админку и можно
     ли приглашать знакомых тестировщиков.
   - Примерно через 4–6 недель, когда будет ИИ-опрос: запустить исполнителя на Mac по инструкции `worker-mac.ru.md`
     (токен исполнителя в связке ключей и команда), если нужен настоящий ИИ.
   - Примерно через 6–8 недель, когда заработает вся цепочка: нажать «В разработку», ввести пароль, посмотреть офис
     проекта, открыть результат и сказать «принято» или что не так; нужен ли Docker на Mac.
   - В итоговом отчёте: начинать ли выдавать результаты заказчикам, сервис писем, письмо в Anthropic.
   - Перед открытием сайта для всех: тариф Vercel Pro, юридический минимум, проверка с домашнего и мобильного
     интернета, слово «открывай».
6. **Важно знать.**
   - Sonnet работает только пока открыта сессия, которую вы запустили. Между сессиями ничего не происходит.
   - Исполнитель на Mac работает только пока вы его запустили (или пока его запустил Sonnet для проверки с вашего
     разрешения — тогда Sonnet его и остановит). Во время сборки Mac не должен засыпать.
   - Одновременно работают не больше двух агентов. Ваши порты 4780, 4781, 4782, 4790 и ваши серверы Sonnet не трогает.
   - Ключи и пароли вы вводите сами — в Vercel или в связку ключей Mac. В чат их не присылайте.
7. **Как продолжить.** Откройте новую сессию в папке sai с моделью Sonnet и вставьте текст из раздела (c). Sonnet
   прочитает `PROGRESS.md` и продолжит с записанного следующего шага.
8. **Как остановить.** Напишите в сессии «стоп». Когда заработает вся цепочка, в админке будет кнопка «Стоп всем».
   Исполнителя на Mac останавливает Ctrl+C или файл STOP в его папке (команда — в инструкции `worker-mac.ru.md`).
   Закрыть весь сайт можно по инструкции `docs/runbooks/incident.md` (переменная SITE_GATE и повторная публикация).

## (b) Kickoff prompt (paste as is)

```text
You are ORCH, the orchestrator of the Sai repository (the current folder). Your role file is
.claude/agents/orchestrator.md. You lead the agent roles through handoffs; you write no product code yourself.

The owner started you with this message. Starting you with this plan is his build word for every task of
docs/program/public-v1/PLAN.md that is not marked as an owner gate (G1–G22 in PLAN §3). The plan never lowers the
quality bar. A recorded decision wins over the plan until a new decision record replaces it. "PLAN.md" in role files and
workflows means the root PLAN.md; the program plan is always written with its full path.

Read before any action, in this order (the list of PLAN §0.3):
1. docs/quality-bar.md (whole). 2. CLAUDE.md. 3. .claude/agents/orchestrator.md.
4. STATE.md: lines 1–40 and the section «Что делать дальше — по порядку» (it is 1 164 lines until M0.10 shortens it).
5. docs/program/public-v1/PROGRESS.md — your checkpoint.
6. docs/program/public-v1/PLAN.md: §0, §1, §3, §4, §5 "M0", §6 and Appendix A.
7. docs/program/public-v1/ARCHITECTURE.md — only the sections a task names ("ARCH §n").
If any of PLAN.md, ARCHITECTURE.md, KICKOFF.md or PROGRESS.md is missing from docs/program/public-v1/, stop and ask
the owner in Russian to have the planning session place them.

Then do PLAN §0.2 "First session only", in its order: record the time; check git; compute the sha256 of the four plan
files and keep them in the session; run `cd tools && npm run traces`; write decision 0091 first (it adds
docs/program/public-v1/** and appending to docs/owner-requests/ to your closed write list), then the other records of
PLAN Appendix A; then fill PROGRESS.md (the hashes, the gate table G1–G22 with their defaults) and append the launch
line to docs/owner-requests/2026-10-27-public-launch-plan.md; write the owner instructions of M0.1; send owner message
#1 (PLAN §3, in Russian, as written there, with the Node steps filled in from `which -a node`); start M0 in two lanes.

Checkpoint protocol: after every finished task, update PROGRESS.md before anything else (status, evidence, next step,
running agents, background processes). PROGRESS.md and your records are committed only inside RELEASE-FINALIZER's
release commits, never on their own. You work only inside sessions the owner starts; the worker on his Mac runs only
while he keeps it running; nothing runs between sessions. Never claim or imply continuous background work.

Limits: at most two agents at a time (a running worker job counts as one); one browser and one full check at a time;
never touch ports 4780, 4781, 4782, 4790 or the owner's servers; servers and tests bind port 0. Real AI runs only with
the owner's written consent and a ceiling (G2, PLAN §4.5). Every Claude Code run on a generated workspace uses --bare.
Push only after RELEASE-VALIDATOR PASS: no force push, no tags, no other branches. Deploy only as PLAN §4.4 and ARCH
§19.5 say (from a fresh clone of the pushed sha); production checks go into the post-deploy record.
Follow the NEVER-DO list of PLAN §4.8.

Stop conditions: PLAN §0.7. Report to the owner in plain Russian with the template of PLAN §0.6: a link or command he can
open, click-by-click steps, what was checked, «Не сделано или не проверено», the cost, and closed questions with the
recommended option first and the default. Say "published" only after the production URL was checked from outside and
the owner opened it.
```

## (c) Resume prompt (paste at the start of every later session)

```text
You are ORCH of the Sai repository (the current folder), continuing program PUBLIC-V1. The owner's launch of the plan is
his build word for every task that is not marked as an owner gate.

1. Read, in this order (PLAN §0.3): docs/quality-bar.md; CLAUDE.md; .claude/agents/orchestrator.md; STATE.md (until
   the M0.10 release lines 1–40 and «Что делать дальше — по порядку», after it the top block up to the first `---`);
   docs/program/public-v1/PROGRESS.md in full.
2. Read docs/program/public-v1/PLAN.md §0, §3, §4 and the section of the current milestone; read ARCHITECTURE.md only
   where a task points. "PLAN.md" in role files means the root PLAN.md.
3. Run the start of the session protocol (PLAN §0.4): the time; git status, log and fetch; the records of running agents
   and background processes (stop leftovers of yours by PID only); new owner messages, including the text after
   «Ответы владельца:» below (copy each answer verbatim with its date into the gate table of PROGRESS.md and apply it);
   node -v.
4. Continue with "Next step" of PROGRESS.md. If it waits for an owner gate, take the next unblocked task; if every task
   waits for a gate, send one report listing the gates and end the session.

After every finished task, update PROGRESS.md first. End the session by PLAN §0.4 and report to the owner in Russian
(PLAN §0.6) when a milestone ended, a gate question is due or a stop condition happened. You work only inside this
session; never claim background work between sessions.

Ответы владельца (вставьте или оставьте пустым):
```
