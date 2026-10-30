# 0096 — Light lane (in force from 2026-10-28 by the owner's answer to G12; first drafted as a proposal)

Status: **accepted** — in force from the owner's answer of 2026-10-28 (see "Addition" below). Earlier status: proposed. It takes effect only when the owner answers «а» to G12; his exact answer and its date are then appended here as "Addition". Until then every change goes the full WF-02 route.

## Question

20–37 handoffs per requirement are measured. May small text, legal and service-page edits (no server, data, money or rights) use a lighter route?

## Options

- A (proposed): a light lane for the paths below; the independent check is kept.
- B: the full route for everything (the default until the owner answers).

## Decision

Quoted G12 question: «Облегчённая проверка для правок текстов, юридических и служебных страниц (без сервера, данных, денег и прав): разработчик и одна независимая проверка вместо 20+ шагов; безопасность, выпуск и сверка вида с образцом — как раньше. а) Да (Рекомендую) б) Нет, всё по полному пути. Если не ответите — всё по полному пути.» The owner's answer: <not yet given>.

If «а»: eligible changes (only the paths of program plan §4.1 LIGHT) run WF-02 as ORCH → developer (code, tests, short design, both checks) → RELEASE-VALIDATOR (eligibility by diff against the allowed paths, both checks itself, every criterion, at least 5 own mutants, Q7 search including served pages, real Chrome matrix) → DOC-UPDATER → RELEASE-FINALIZER; one translation-reader round per language. Never for the public look (always WF-04 with DESIGN-QA and G21). Any doubt → FULL.

## Why

Speed without weakening: every item of quality bar §2 stays checkable.

## Boundary

Not for anything on the protected list of program plan §4.1. The quality bar is unchanged.

## Basis

Quality bar §5; REQ-041; the measured 20–37 handoffs per requirement; program plan §3 (G12).

## Addition (2026-10-28, ORCH, the owner's answer to G12)

The owner's answer, verbatim: «Да (Рекомендую)» (2026-10-28, session 1, chat question; the question is quoted in "Decision" above). Effect: the light lane is in force for the paths of program plan §4.1 LIGHT; the public look is always the full route; any doubt → FULL. The quality bar is unchanged.
