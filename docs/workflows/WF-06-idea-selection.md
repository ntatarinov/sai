# WF-06 — Выбор идеи

Несколько агентов совместно анализируют идеи-кандидаты; один агент выносит итоговый
вердикт; второй агент получает вердикт, проверяет его и применяет в бизнес-логике
проекта. Требования — REQ-002…REQ-004, дизайн — `docs/design/REQ-002-idea-verdict.md`
(контракты файлов — там, §4; здесь — порядок работы).

Все команды — из `tools/`. Время — из часов: `date -u +"%Y-%m-%dT%H:%M:%SZ"`.

## Роли

| Роль | Мандат | Что делает в WF-06 |
|---|---|---|
| ORCH | `.claude/agents/orchestrator.md` | Шаги 0 и 6: готовит прогон, запускает агентов, пишет все handoff-ы, сверяет результат |
| IDEA-ANALYST ×3 | `.claude/agents/idea-analyst.md` | Шаги 1–3, каждый со своей точкой зрения: `market`, `execution`, `owner_fit`. Один запуск на точку зрения на все три раунда |
| IDEA-JUDGE | `.claude/agents/idea-judge.md` | Шаг 4: итоговый вердикт — **первый агент запроса владельца** |
| VERDICT-EXECUTOR | `.claude/agents/verdict-executor.md` | Шаг 5: получает вердикт, перепроверяет, применяет — **второй агент запроса владельца** |
| Владелец | — | Шаг 7: принимает решение. Агенты его не принимают |

Все роли — разные запуски агентов. Судья и исполнитель не бывают аналитиками.

## Шаги

**Параллельность (требование владельца: «Агенты должны многопоточно работать»).**
Всё, что не зависит друг от друга, запускается одновременно — одним сообщением с
несколькими запусками агентов:
- три аналитика в **каждом** раунде (шаги 1, 2, 3) работают одновременно;
- задачи из `proposed-actions.json`, которые не зависят друг от друга (например, две
  проверки конкурентов), отправляются одновременно;
- последовательны только настоящие зависимости: раунд 2 ждёт все оценки раунда 1,
  раунд 3 — все проверки раунда 2, судья — все ответы, исполнитель — вердикт;
- **PASS проверки — тоже зависимость:** следующий шаг не начинается, пока `validate`
  по предыдущей стадии не дал OK;
- параллельные агенты **никогда не пишут в один и тот же файл**: у каждого свой
  выходной файл, и ORCH назначает их так, чтобы они не пересекались. Чужой файл,
  который ещё пишется, может быть недописан — свою самопроверку агент оценивает
  только по своему файлу, стадию целиком проверяет ORCH, когда готовы все (AP-008).

**Шаг 0 — ORCH готовит прогон.**
1. Снимок «до» — **первым действием шага**, до любой правки:
   `npm run snapshot -- <вне проекта>/wf06-<RUN-ID>-before.txt`. Если после снимка что-то
   пришлось исправить — прогон начинается заново с новым RUN-ID (AP-007).
2. Проверить, что выводы в файлах идей размечены `<!-- conclusion:start -->` …
   `<!-- conclusion:end -->` (дизайн §4.2).
3. `npm run prepare-run -- <RUN-ID> --candidates <ids> --context <paths> --analyst market=analyst-market --analyst execution=analyst-execution --analyst owner_fit=analyst-owner-fit --judge judge --executor executor`.
4. Записать напечатанный `seal` в `context.run_seal` handoff-а шага 0 и в отчёт
   владельцу.

**Шаг 1 — раунд 1, оценки.** ORCH пишет три handoff-а и запускает трёх аналитиков
параллельно. Каждый пишет `assessment-<lens>.json` и проверяет его:
`npm run validate -- ../runs/<RUN-ID> --stage assessments` (после того как готовы все
три — это делает ORCH).

**Шаг 2 — раунд 2, взаимная проверка.** ORCH продолжает тех же трёх аналитиков. Каждый
читает оценки двух других и пишет `crossreview-<lens>.json`: по **каждой** чужой оценке —
`agree` или `disagree` с предложенным баллом и цитатой.
`npm run validate -- ../runs/<RUN-ID> --stage crossreviews`.

**Шаг 3 — раунд 3, ответы.** ORCH продолжает тех же аналитиков. Каждый отвечает на
**каждое** несогласие со своими оценками в `response-<lens>.json`: `revise` (новый балл)
или `hold` (держится, с цитатой). `npm run validate -- ../runs/<RUN-ID> --stage responses`.

**Шаг 4 — вердикт.** ORCH запускает судью. Судья пишет `verdict-N.json` и
`verdict-N.md` (N = 1 или номер доработки) и сам проверяет:
`npm run validate -- ../runs/<RUN-ID> --stage verdict`.

**Шаг 5 — исполнитель.** ORCH запускает исполнителя. Исполнитель:
1. сам проверяет вердикт (дизайн §4.9, пять обязательных проверок) и пишет
   `verdict-review-N.json` с `ACCEPT` или `REJECT`;
2. `npm run validate -- ../runs/<RUN-ID>`;
3. при `ACCEPT` или при третьем `REJECT`: `npm run apply-verdict -- ../runs/<RUN-ID>`.

**Шаг 6 — ORCH сверяет и передаёт дальше.**
1. Сверить artifacts_out исполнителя: блок в STATE.md, `proposed-actions.json`,
   `apply-report.json` (хеши совпадают с файлами).
2. По каждому действию из `proposed-actions.json` создать handoff следующей роли
   (`handoffs/<RUN-ID>/step-<step>-<role>.json`, `status: PENDING`); если действие
   зависит от другого — `context.depends_on`.
3. Снимок «после» — сразу после handoff-ов, до любого учёта:
   `npm run snapshot -- <вне проекта>/wf06-<RUN-ID>-after.txt`.
4. `npm run snapshot-diff -- <before> <after> --allow runs/<RUN-ID>/ --allow handoffs/<RUN-ID>/ --allow STATE.md`.
5. `npm run validate -- ../runs/<RUN-ID> --seal <seal>`.
6. Только после этого — учёт: статусы требований, `docs/anti-patterns.md`, STATE.md
   вне блока.

**Шаг 7 — владелец.** Читает блок «Рекомендация агентов (WF-06)» в STATE.md и
`verdict-N.md`, принимает решение. Решение о старте записывает в STATE.md только
владелец (или ORCH по его прямому слову).

## Артефакты

| Шаг | Кто | Файл в `runs/<RUN-ID>/` |
|---|---|---|
| 0 | ORCH (prepare-run) | `run.json`, `sources/…` (очищенные копии) |
| 1 | IDEA-ANALYST | `assessment-<lens>.json` |
| 2 | IDEA-ANALYST | `crossreview-<lens>.json` |
| 3 | IDEA-ANALYST | `response-<lens>.json` |
| 4 | IDEA-JUDGE | `verdict-N.json`, `verdict-N.md` |
| 5 | VERDICT-EXECUTOR | `verdict-review-N.json`; через apply-verdict — `proposed-actions.json`, `apply-report.json`, блок в `STATE.md` |
| 6 | ORCH | handoff-ы следующим ролям в `handoffs/<RUN-ID>/` |

## Handoff-ы

Формат и правила полей — `docs/workflows/handoffs.md`. Пишет **только ORCH**;
получатель меняет только `status`, `completed_at` и `result`.

- `workflow_id`: `"WF-06"`; `from_agent`: `"ORCH"`.
- Файлы: `handoffs/<RUN-ID>/step-00-orch.json`, `step-01-idea-analyst-<lens>.json`,
  `step-02-idea-analyst-<lens>.json`, `step-03-idea-analyst-<lens>.json`,
  `step-04-idea-judge[-vN].json`, `step-05-verdict-executor[-vN].json`, затем
  `step-10…`, `step-11…` из `proposed-actions.json`.
- `created_at` и `started_at` — одно чтение часов при отправке.
- `context.agent_run_id` — идентификатор запуска агента; ORCH пишет его сразу после
  запуска. У аналитика в раундах 1–3 он один и тот же.
- `context.run_seal` — только в handoff-е шага 0.

## Цикл доработки

- Исполнитель вернул `REJECT` в `verdict-review-N.json` и N < 3 → ORCH запускает судью
  снова (новый handoff шага 4 с `-v<N+1>`). Судья пишет `verdict-(N+1).json` с учётом
  `issues`, исполнитель проверяет его заново.
- Не более **3** проверок вердикта. Третий `REJECT` → apply-verdict пишет в STATE.md
  блок эскалации; прогон **ESCALATED**, решение за владельцем.
- Нарушение контракта, найденное `validate` на шагах 1–3, исправляет **автор** файла;
  ORCH продолжает того же агента с выводом validate.

## Условия остановки

- Прогон завершён: `apply-verdict` вывел `applied recommend` или `applied escalate`,
  шаг 6 выполнен.
- Прогон остановлен и эскалирован владельцу, если: `E_SOURCE_CHANGED` или `E_SEAL`
  (кто-то поменял копии — начинать новый прогон); автор не может исправить нарушение
  контракта за две попытки; snapshot-diff показал изменения вне разрешённых мест.
- Прогон никогда не завершается «вручную»: нельзя писать блок в STATE.md, handoff-ы
  или события Pixel Office в обход инструментов и этих шагов.
