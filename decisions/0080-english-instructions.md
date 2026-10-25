# 0080 — Instructions for agents are written in English

Status: **accepted** (ORCH, 2026-10-25, on the owner's words of 2026-10-25: «описание агентов должны быть написаны на англ и вся остальная документация, потому что ты их лучше читаешь чем на русс»; the owner may change it).

## Question

In which language are the instructions for the agents and the documentation of the working folder written, so that the agents read them reliably, without changing any rule?

## Options

- **A. Keep Russian everywhere** (the state before 2026-10-25) - no work, but the owner's words say the model reads English more reliably; `README.en.md` and `docs/agents.en.md` were already a second, drifting copy.
- **B. Translate only the role files** - the smallest change, but the workflows, the quality bar and the mistakes log that the roles read would stay Russian, so one reader would need both languages.
- **C. Translate everything an agent reads at the start of its work** (items 1-6 below) and keep history as it is - chosen.
- **D. Keep both languages side by side** - rejected: two copies drift apart (this is what `README.en.md` showed), and every rule would have to be changed twice.

## Decision

1. **In scope (translate):** the role files `.claude/agents/*.md` (37), `docs/workflows/*.md`, `docs/quality-bar.md`, `docs/anti-patterns.md`, `CLAUDE.md`, `README.md`, `tools/README.md`. English becomes the only language of these files. `README.en.md` and `docs/agents.en.md` stop being separate copies: their content is merged into `README.md` and the role files, then the two files are removed.
2. **Not in scope now:** history that records what happened (`handoffs/`, `decisions/` 0001–0079, `docs/issues/`, `docs/releases/`, `docs/research/`, `docs/uat/`, `docs/design/`, `docs/business-plan/`, `docs/product/`), `docs/requirements.yaml`, `STATE.md`, `PLAN.md`. They stay as they are and are translated later only when the owner asks. New decisions, handoffs, issues and reports are written in English from now on; the first rule that cannot be broken is that a reader never needs Russian to follow a role file.
3. **Never translated:** what the owner or a customer reads — page texts, tenant texts and their ru/kk/en versions, the Pixel Office guide, tool error messages (they are quoted verbatim in English role files, in the original Russian, with a short English gloss), and ORCH's reports to the owner (they stay plain Russian, see the owner's profile).
4. **Meaning must not change.** Same rules, same numbers, same names. Every file name, identifier, field name, AP-NNN, REQ-NNN, ISS-NNNN, decision number, command and role code stays as is. A translation is not a chance to improve or shorten a rule; a wording change that alters a rule is a separate decision.
5. **One glossary** (the term in English, with the Russian it replaces): handoff — handoff; gate — gate (ворота); run — run (прогон); step — step (шаг); pass of a gate — gate pass (проход); write set — write set (набор разрешённых файлов); mutant — mutant; oracle — oracle (независимая проверка ожидаемого); acceptance — acceptance (приёмка); acceptance by the owner — owner acceptance; release — release (выпуск); release report — release report; accounting — bookkeeping (учёт); the bar — the quality bar (планка); reader — reader (агент-читатель); rework step — rework step (доработка); base tag — base tag; micro-amendment — micro-amendment (микроправка).
6. **Tests.** Tests that read these files and compare Russian wording (they are listed by the first step of the run) are changed to the English wording in the same run; a test is never weakened, only re-pointed at the same fact.
7. **Literals that tools and files read stay as they are.** A translation does not touch a word that code or another file reads letter for letter; such a word stays Russian and, in an English text, is quoted with a short English gloss. Found by searching `tools/src` (`grep -rnP '[\x{0400}-\x{04FF}]' src`, excluding messages the tools print and the page texts of `src/*/public/`):
   - «неизвестно» - a time field that starts with this word (`src/handoffs/times.js`, `UNKNOWN`); `docs/workflows/handoffs.md`, sections "Time" and "Pauses and interruptions", must write it, not "unknown".
   - `# база: <40 hex>` - the header of `tools/handoffs/exceptions.tsv`, and «База handoffs-check: <40 hex>» - the line in the record of `decisions/` with the largest number where it is present (`src/handoffs/exceptions.js`, `HEADER`, `DECISION_LINE`).
   - The three headings of `STATE.md`: «### Что делать дальше — по порядку» (the anchor after which the block is put), «### Решение владельца о старте» (the owner's section, never touched) and «### Рекомендация агентов (WF-06)» (the block that `apply-verdict` writes); the confidence words «низкая», «средняя», «высокая» that it writes (`src/contract.js`: `STATE_ANCHOR`, `OWNER_HEADING`, `BLOCK_HEADING`, `CONFIDENCE_RU`; `src/apply.js`). The role files and WF-06 quote them with a gloss.
   - «## Ограничения» - a section that `verdict-N.md` of the judge must have (`src/validate.js`, around line 861); `idea-judge.md` quotes it.
   - «Записано:» and «Статус:» (paragraph starts) and the table columns «Итог», «Статус», «Почему нет» - removed from the copies of the idea sources by `prepare-run` (`src/contract.js`: `STRIPPED_PARAGRAPH_PREFIXES`, `STRIPPED_TABLE_COLUMNS`).
   - Read by files and by the agents' own commands, not by code in `tools/src` (the search finds none): «FAIL принят» - the verdict that ORCH writes in `context.orch_check` on FAIL (`.claude/agents/orchestrator.md`, `docs/workflows/handoffs.md`, 46 existing handoffs, counted on 2026-10-25); the fields of a defect file `Серьёзность: ... Статус: open. Найдено: ...`, the statuses `closed, <дата>`, `closed, <дата>, дефекта нет`, `closed, <дата>, причина не устранена, продолжение — ISS-NNNN` and the sections «Что не так», «Доказательство», «Как исправить», «Маршрут», «Закрыто» (`docs/workflows/WF-03-defect.md`; counted by `grep 'Статус: open'` in `docs/issues/`); the four field names of a mistakes-log record «Что случилось», «Почему это плохо», «Как правильно», «Где найдено» (`docs/anti-patterns.md`); «допущение», «(источник: ...)» and «## Ценность одной фразой» of the business-plan files (`plan-writer.md`, `plan-validator.md`).
   - Identifiers written with Cyrillic letters stay Cyrillic: `Д7`, `Ф1`-`Ф7`, `О1`-`О7`, `К8`, `WEB-15 (б)`, `5а`, `4б`, and the letters of the checklist of WF-01 and `req-validator.md`, items (а)-(е) (the earlier records cite them; Latin (a)-(f) would also move (д) to (e) and (е) to (f)), with the sub-items `6а`-`6в` of `release-validator.md` and `3а` of `req-analyst.md`. A Latin gloss in brackets is allowed next to them.
   - Placeholders inside commands and file names are English (`<outside the project>`, `<short>`, `<port>`, `<files>`): no code reads the Russian form (`tools/test/handoffs-paths.test.js` accepts any `<...>` stand-in). `<вне проекта>` stays only where a quotation of an old handoff needs it.
8. **One wording for a standard heading.** The 37 role files use one wording each: "What to read before work", "What to hand over", "Check before handing over", "Boundary with ..." (the most frequent one in the three translated batches), "flaky test" and "score" (not "grade"). A test that reads a heading is changed together with it.
9. **Quotations in `docs/requirements.yaml`.** Item 2 leaves the file in Russian, but a done requirement whose criterion quotes a heading or a phrase of a translated file would fail its next recheck. Only the quoted heading or phrase is changed to the English one that now exists (the same fact), as a micro-amendment of WF-01 with an event in the status history of the block; no status and no meaning of a criterion changes (run `TRANSL-20261025-01`, step 08).

## Why

The owner reads the agents' instructions through the agents, and English is read more reliably by the model than Russian.

## Boundary

Does not change any rule, requirement, code or the language in which the owner is spoken to.

## Basis

The owner's words of 2026-10-25 quoted in the status line above; `decisions/0079` (the descriptions of the roles and workflows that this run translates); `handoffs/TRANSL-20261025-01/` (steps 01-08; the gate findings are in `step-07-release-validator.json`, `step-07b-release-validator.json` and `step-07c-release-validator.json`); `tools/test/` (the tests re-pointed in step 06); `docs/workflows/WF-01-requirement.md` ("Micro-amendment after the code design").
