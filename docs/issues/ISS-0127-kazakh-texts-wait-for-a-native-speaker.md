# ISS-0127 — The Kazakh texts (285 lines and six corrections of reader round 1) wait for a person who knows Kazakh; kk stays hidden on production

Серьёзность: LOW. Статус: open. Найдено: читатель казахских текстов, раунд 1 (шаг 8, п. 6), прогон `M1CODE-20261119-01`; заведено DOC-UPDATER (шаг 10), 2026-11-21. Пункт планки: Q1; AP-114 (читатели-не-носители расходятся, окончательное «да» агентов не доказывает правоту спорных строк).
Требования: REQ-111 (тексты ru, en, kk; kk построен и проверен, на production скрыт по G9). Решение: `decisions/0124` О43, О21; владельческий ворот G9 (kk на production не показывается, пока он не ответит).

## Что не так

The Kazakh texts of the public pages and of the demo (285 lines) were written and read by agents that are not native speakers (FOR_NATIVE_SPEAKER, AP-114). Round 1 of the Kazakh reader found six small corrections that were **not applied**, because kk is hidden on production (G9) and the texts are marked for a native speaker: line 89 `demo_your_answers` lost «Ваши» → «Жауаптарыңыз»; 102 `demo_includes` «Құрамына не кіреді»; 101 `demo_putting` «Нәтиже құрастырылуда…»; 139 `order_can_5`; 196 and 251 (calques). The English rounds were applied (`decisions/0124` О43). The Kazakh texts are only a draft until a person who knows Kazakh reads them.

## Доказательство

`decisions/0124` О43 (the lines and the corrections), `docs/program/public-v1/PROGRESS.md` (log of 2026-11-21), `handoffs/M1CODE-20261119-01/step-08d-ba-analyst-signoff.json` (kk not run, G9), AP-114.

## Как исправить

A person who knows Kazakh (the owner names him) reads the 285 lines of `app/public/shared/i18n/texts.js` (the kk block) and the kk side of `app/content/sai-intake.json`, with the six corrections above as the start; the corrected lines are applied by FRONTEND-DEV in one round with the unit tests of the texts (`app/test/unit/texts.test.js`), and only then the owner is asked G9 (show kk on production). Not before.

## Маршрут

The owner (G9 and the reader), then a WF-02 round of the texts (steps 3 and 4 again) and a run on GitHub; kk stays out of the production build until then (`PUBLIC_LANGS` of the production build).
