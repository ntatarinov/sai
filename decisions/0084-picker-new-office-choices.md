# 0084 — What decision 0083 replaces in earlier picker decisions, and the choices that go with the new office site

Status: **accepted** (ORCH, 2026-10-26, as the consequence of the owner's «да» to `decisions/0083` and his words about the journey from A to Z and the fewest movements; the owner may cancel any item). The two items that waited for the owner were answered the same day (item 4).

## Question

`decisions/0083` accepts the direction "tenant's pixel office, one tap per answer, live result". Earlier decisions describe other screens and flows. Which of them are replaced, which stay, and what is chosen for the points the requirements REQ-069…078 left open?

## Decision

### 1. What is replaced

- `0074` item 3 (the customer picture is a byte copy of the staff office grid with the figures "Analyst" and "Designer"): replaced by the tenant's own office scene with four desks, built from a closed catalogue of object ids (REQ-069, REQ-071). The caption "the picture shows the stage of the work, not the movements of people" stays on "My request".
- `0074` item 8 (only the owner or ORCH hands the link to the customer): replaced; the private link is shown to the visitor at once after his request is accepted (REQ-059, REQ-064, REQ-076). Leads accepted before stay `open` with a link given by hand.
- `0077` items 3 and 5 and `0078` item 3 ("Next" and "Skip", the temporary result screen until REQ-058): replaced by the one-tap flow, "I do not know", the live receipt and the result page (REQ-074 and the receipt and result requirements).
- `0074` item 1 (the customer page is a module of the staff office server): replaced as far as the customer's office is drawn by the tenant-office scene and reached through the same public server of the picker; item 2 onwards stay.
- `0065` items 3 and 5 ("leads are never served over the network"): narrowed. The **public** server of the picker never serves leads; the operator board (REQ-077) is a separate local command on the loopback address with a 128-bit secret code and serves them to the owner only.
- `0078` item 5 (the storage format with five fields) and item 8 (the rule for the counter N), and `0077` item 4: see items 14 and 15 of section 3; the storage format changes only as REQ-074 states.
- Standing criteria of the done REQ-057: 1 and 11 are superseded by REQ-071 and REQ-085, 2 by REQ-074, 7 by REQ-075 and REQ-080; 3, 4 and 5 change form only; 6, 8 and 9 stay; 10 changes through the was→became table of REQ-069. Criteria of the done REQ-061 that name schema versions follow the same rule as REQ-061 did to REQ-054. Criteria written as `git diff base/<RUN-ID> -- <file>` are run-relative: they are checked at their own release and are not re-run at later audits.
- The guard tests of the done page (QS-1…QS-12 and the page model tests that the new files turn red) are replaced by the was→became table that REQ-069 holds (it is the first requirement that adds a file to `public/`); the other requirements name only their rows; each ban keeps its intent.

### 2. What stays in force

`0073` and `0074` except items 3 and 8: the customer's page is read-only, four stages, no way to reach development, no real events of agents, logs, code or task texts. `0072`, `0071`, `0070`, `0068`, `0069`, `0082`, `0083` are untouched. The finished REQ-054, 055, 056, 061, 068 are not edited.

### 3. Choices (defaults; the owner may change them)

1. The "fit" percent of the sample is not shown; the page shows "Подходит: <решение>" and "Точность: K из N ответов".
2. The two new demo tenants are separate files in a separate folder; the old two stay as /2 samples and prove the fallback look.
3. REQ-057 stays `done`; its replaced criteria are recorded here, not by editing the done block.
4. The operator board is a separate local command with a secret link, not a page of the public site.
5. "I do not know" is allowed on every question, including required ones; the result is built from the answers given.
6. A tenant writes modules, days, rate and margin in an `estimate` section; a tenant without it shows no price.
7. Spam control without the visitor's address: 30 requests per hour per tenant (changeable in the file), 1000 stored, the same contact with the same answers within 10 minutes is refused.
8. The stage names are the owner's words: «Принято», «Готовим документацию», «Готовим спецификацию», «Готово к просмотру».
9. "At most 6 questions" is advice for the tenant guide, not a hard error of the file check; the stand has 5.
10. PDF only through the browser's print dialog in the first stage.
11. In the set of answers `null` means "I do not know" and closes the question for the engine; a missing key does not (REQ-072; used by REQ-074, 075, 059, 076, 084).
12. REQ-062 and REQ-063 (the AI part) are bound to the route `POST api/result` and the old result page, which the new page no longer calls: when the owner gives his word for them, they go through WF-01 again before anything is built.
13. The quiet caption under the public scene ("the picture shows the stage, not the movements of people") stays.
14. **The counter N of the question label stays as REQ-057 has it** (the rule of the done S1 file, including after "Back"). The engine's `partial.total` of REQ-072 is used only for the receipt's line "Точность: K из N ответов"; no requirement claims that the two numbers are equal.
15. **Theme button labels** are «Светлая / Тёмная / Авто» (kk «Ашық / Қараңғы / Авто», en «Light / Dark / Auto») so that they never contain the banned words «день», «күн», «day»; this is the only word of the approved sample that changes.
16. The progress record of an accepted request is asserted in REQ-064 (which depends on the request server), not in REQ-059.
17. For a tenant file of format /1 or /2 (no `look`), the shared tenant-look module returns the role `null` for the four staff (no key of `texts.js`); the visitor page maps `null` at desk n to its own key `scene_desk_n`; the board serves all three formats and draws no role label for such a tenant.

### 4. Owner's answers (hold released, 2026-10-26)

Asked in the session with the recommended answer first; the owner chose both recommended answers:

- Consent for the contact: one sentence above the button "Отправить" with no checkbox (answer «Фраза без галочки (Рекомендую)»).
- The WhatsApp button may open the external address `wa.me` in a new window (answer «Да, в новом окне (Рекомендую)»); no Telegram button, an @handle can be typed into the contact field.

The hold paragraphs in REQ-059, REQ-076 and the `whatsapp` field of REQ-069 are removed by a WF-01 micro-amendment (the consent sentence and the `wa.me` construction rules stay as written in those blocks).

### 5. The look at the reference product (decision 0082, item 1)

A read-only study of the reference interface was done on 2026-10-26 on a copy outside the repository (notes and snapshots outside). Its result is used in the sample and in this group of requirements.

### 6. One extra rework after the third FAIL of the requirement gate (the owner's allowance, 2026-10-26)

The requirement gate (REQ-VALIDATOR) returned FAIL three times (steps 02, 04, 06 of run `DESIGN0083-20261026-01`). By `decisions/0079` item 4 ORCH stopped and asked the owner. The remaining blocking finding H1 (REQ-077 criterion 9 and REQ-069 criterion 4 cannot both hold: the fallback look returns scene keys that the board search forbids) was put to the owner with two options; he chose «Одна правка и перечитать (Рекомендую)» (one edit and a re-read). Scope: exactly one rework step that fixes H1 in REQ-069, REQ-077 and REQ-078 and takes the cheap Low items H3, H5, H6, H7, H10, H13, and then one re-read of those three blocks by REQ-VALIDATOR. It is not a general rule and does not raise the limit of three passes (as `decisions/0081`).

## Why

The owner wants one clear journey with the fewest taps. Without a written replacement the old decisions and done criteria would contradict the new requirements, and the audits would flag them.

## Boundary

Does not change code, done requirement blocks or `0073`'s read-only rule. The requirements REQ-069…078 and the edited pending ones follow this record.

## Basis

`decisions/0083`, the owner's messages of 2026-10-25/26 (verbatim in `docs/owner-requests/2026-10-25-picker-design-enterprise.md`), `handoffs/DESIGN0083-20261026-01/step-01-req-analyst.json` (issues and owner questions), `step-02-req-validator.json` (findings F5, I3, I4, I5).
