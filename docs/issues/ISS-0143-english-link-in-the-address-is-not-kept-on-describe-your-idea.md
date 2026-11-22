# ISS-0143 — The link «Describe your idea» does not keep the English language when English comes only from the address `?lang=en`

Серьёзность: LOW. Статус: open. Найдено: RELEASE-VALIDATOR (шаг 13 прогона `M1WORDS-20261122-02`, post-deploy запись, замечание R-1), на production; заведено DOC-UPDATER (шаг 14, WF-02 шаг 10 после релиза), 2026-11-22T22:36:46Z, номер выдал ORCH. Пункт планки: Q1 (поведение без критерия). Не из этой работы: модуль языка сайта относится к REQ-111.
Требования: REQ-111 (the language module of the public pages); REQ-113 criterion 8 reads the link only («the first link after the block is `/how.html#describe-idea`»), and it holds.

## Что не так

When English comes only from the address (`https://sai-team.vercel.app/demo.html?lang=en`, nothing stored in the browser), the button «Describe your idea» on the demo result opens `how.html#describe-idea` in Russian (the part is titled «Как описать идею»), because the link does not carry the language and the address `?lang=en` is not stored. When English is chosen with the page's own EN button (the choice is stored), the same button opens the page in English (the post-deploy record B-8: 8 of 8). So the visitor who arrives by a link with `?lang=en` sees the language fall back to Russian at the first click. It is the behaviour of the language module of REQ-111, not changed by REQ-113; the requirement says only that `?lang=` and the stored language behave as before. Whether a link `?lang=en` was meant to store the language is not recorded; RELEASE-VALIDATOR did not check it.

## Доказательство

- `docs/uat/M1WORDS-20261122-02-prod.md`, finding R-1 and the section «Faults of my own driver» (the first full run opened the Russian page after `?lang=en`; with the EN button 8 of 8 stayed English); `handoffs/M1WORDS-20261122-02/step-13-release-validator-postdeploy.json`.
- To see it: open `https://sai-team.vercel.app/demo.html?lang=en` in a window with no stored language, go through the demo to the result, press «Describe your idea»: the page that opens is Russian.

## Как исправить

Only if the owner wants it: either the language from the address is stored when it is read (then the next page keeps it), or the link of the button carries `?lang=` of the page. It is a change of the language module of REQ-111 (a WF-01 micro-amendment of REQ-111 criteria on the language, then WF-02); no fix is needed for REQ-113.

## Маршрут

The owner's choice, with the next change of the language module or of the public pages; a Low remark, nothing is broken for a visitor who uses the page's own language button.
