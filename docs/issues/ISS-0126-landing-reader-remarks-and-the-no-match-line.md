# ISS-0126 — The twelve remarks of the reader without context and the no-match receipt line: questions for the owner about the words of the landing

Серьёзность: LOW. Статус: open. Найдено: BA-ANALYST (шаг 08d, `owner_attention`, читатель без контекста R-01 прошёл 12 из 12 вопросов) и DESIGN-QA-VALIDATOR (шаг 07b, N11), прогон `M1CODE-20261119-01`; заведено DOC-UPDATER (шаг 10), 2026-11-21. Пункт планки: Q1 (текст требования и критерии принадлежат владельцу).
Требования: REQ-111 (тексты страниц, критерии 13 и 14), REQ-112 (подписи сцены). Решение: `decisions/0124` О33, О41 (N11 принят и записан), О43.

## Что не так

None of these fails a criterion, and the reader answered all twelve test questions. They are the reader's remarks on the words and the structure of the pages, for the owner to decide (the stage words are fixed by REQ-112 criterion 4, so a change of those goes through the requirement, not through the scenario):

1. Orders: every page of the local stand says «заказы не принимаются» while the same pages say what can be ordered. The order texts are left out on production (G8 «б»), so the contradiction exists on the local stand and on the way to a release that shows them; how the two are worded together is the owner's choice.
2. The words «Pixel Office» are not on the site; it says «пиксельный офис». Which name the site shows?
3. The demo has no free-text field while «Как проходит опрос» (`how.html`) says each question has «поле для своего ответа»; the demo is a five-card selection. Say so in the demo or on `how.html`?
4. «Точность подбора 5 из 5» on the demo result is read as the number of answers given, and «точность» may read as a promise. Keep, rename or explain?
5. Stage names and terms: stage 3 «Готовим спецификацию» against «ТЗ» of stage 2 (the reader could not tell them apart); «ТЗ» is not spelled out on the landing; «требования» and «ТЗ» are used as one thing.
6. Jargon without a gloss: «API», «CRM», «встроенные данные», «панели показателей на примерных данных», «на экране или в браузере», «секретных ключей», «открытые вопросы», «догадки отмечены отдельно», «скачивается архивом».
7. «То, что нарушает правила использования ИИ» (what Sai does not do): which rules, no link.
8. «Описать идею» leads to a text part, not a form; the site does not say how to get an invitation; «владелец Sai» and «подтверждает запуск своим паролем» read as the platform owner's duty and stay unclear for a client after the test mode.
9. The caption «Вы у двери» and «Картинка показывает этапы работы, а не движения людей»: the reader did not know what the picture is for; the four numbered buttons of `how.html` hardly show their effect (a hidden caption changes).
10. The question card in the demo changes its speaker title (Руководитель проекта, Аналитик, Разработчик, Проверяющий) while `how.html` says the analyst asks the questions.
11. After «Не знаю» on every question the result still says «Подходит» and names a type: should a result with no real answers say that?
12. No prices, terms or conditions anywhere: by design (the forbidden-words lists); noted only because the reader looked for them.

And the no-match line (DESIGN-QA N11, accepted in `decisions/0124` О41): 13 of the 900 combinations of answers give no match with few answers and no server answer, and the receipt then still speaks of the server («Если данные должны храниться на всех устройствах, нужен сервер, а серверы Sai пока не делает»). The sentence is conditional and not false, but it is not the visitor's reason. A second no-match line «too few answers» is a change of the requirement's texts for a later release, not for G21.

## Доказательство

`handoffs/M1CODE-20261119-01/step-08d-ba-analyst-signoff.json` (`owner_attention`, `reader_test_R01`), `step-07b-design-qa-validator.json` (N11), `decisions/0124` О33, О41, О43; `docs/uat/REQ-111.md`.

## Как исправить

Each item is the owner's decision about wording (and some need a change of a requirement text, WF-01). Proposed order: the owner reads the list with the protected preview at G21 and says per item «keep» or «change»; the changes go to REQ-ANALYST as a micro-amendment or a new requirement for the next release; the texts are changed in `app/public/shared/i18n/texts.js` and `app/content/sai-intake.json` with the kk and en twins (a change of reviewed code restarts steps 3 and 4).

## Маршрут

The owner at G21, then WF-01 (REQ-ANALYST, REQ-VALIDATOR) for the changes of wording that touch a criterion, then WF-02.
