# REQ-070 — acceptance run on the running system: the demo tenants of the new office

WF-02, step 8 (UAT-RUNNER), run `DEMO070-20261027-01`, handoff step 18. There is no scenario file: the steps are taken from the task of the handoff, the criterion and the design `docs/design/REQ-070-demo-tenants-v3.md` (decisions/0079, item 6). The step of the readers of the translations is already done and summed in the handoffs of steps 16 and 17; it was not repeated. The code, the tests and the data files were not changed (checked by the digests below). The result is read by BA-ANALYST; the decision to release is the owner's.

Written 2026-10-27 (the clock of the computer, `date -u`), run between 08:15 and 08:20 UTC.

## Verdict: PASS

All six steps passed. No blocking failure. Remarks (not failures) are at the end.

| Step | What | Result |
|---|---|---|
| 1 | `npm run picker -- check` on `stock.json` and `agency.json` | PASS |
| 2 | Separate server on the new stand; six questionnaire answers | PASS |
| 3 | Real result route, 24 requests (2 tenants x 4 sets x 3 languages) | PASS |
| 4 | Stop, no process left, port free | PASS |
| 5 | The old stand: two links, six hashes equal the literals of SV-9c | PASS |
| 6 | This record | done |

## How the stand was made

- The computer has 16 GB of RAM: one server at a time, no browser (no page reads the new data yet), single commands.
- Two servers of the owner were already listening on the ports 4782 and 4790 before the run and after it. They were not touched. Both of my servers used `--port 0` (any free port).
- Each server had its own new scratch home folder inside the session scratchpad (outside the project). All files of this run (answers, hashes, small checking programs) are in the scratchpad, not in the project.
- The servers were started with `node src/picker/cli.js serve ...` from `tools/`: it is exactly what the script `picker` of `tools/package.json` runs (`"picker": "node src/picker/cli.js"`). I used it instead of `npm run picker -- serve` only to have the process id of the server itself and stop it cleanly. `check` was run through `npm run picker --` as the task says.
- Requests: real `curl` over HTTP to `127.0.0.1`; the result route is `POST /t/<id>/api/result?lang=<lang>` with the body `{"answers": {...}}`, the header `Origin: http://127.0.0.1:<port>` and `Content-Type: application/json` (tools/README.md, sections "Protection" and "Language"). The body was built from the real answer file by the command given in the README.

## Step 1 — the check of the two tenant files

Action, per file (from `tools/`):

    npm run picker -- check src/picker/demo-tenants-v3/stock.json
    npm run picker -- check src/picker/demo-tenants-v3/agency.json

Repeated state: the same command run again with `npm run -s` (clean output), and the sha256 of the files taken before and after.

| File | Exit code | stderr | The line printed |
|---|---|---|---|
| `stock.json` | 0 | empty (0 bytes) | `Файл арендатора stock в порядке: вопросов 5, решений 4, правил 15.` |
| `agency.json` | 0 | empty (0 bytes) | `Файл арендатора agency в порядке: вопросов 5, решений 4, правил 15.` |

With `npm run -s` stdout is exactly one line (1 line each) and it is the literal line above. With plain `npm run` npm adds its own header (a blank line, `> sai-tools@0.1.0 picker`, `> node src/picker/cli.js check ...`, a blank line) before that line; the README says so ("`npm run` prints extra header lines"). The literal line is there, unchanged.

sha256 before and after the run (the two tenant files and the four answer files; identical both times, also identical after the whole run):

    1b2bdb67fa7e6c004f727f509e0e2a4a0e8e7b06f7c8a72e6ba8d7ab6d2ee98f  src/picker/demo-tenants-v3/stock.json
    69dc84b012d08220e4470dd190c72dbb7094c7155dc4007ed1c0b84f7508e81b  src/picker/demo-tenants-v3/agency.json
    021100bb1af2cf22cac219b5a956120be256cf1642f9fc90e074091b4ce51b96  src/picker/demo-answers-v3/stock.json
    15ad71aa7bcfe29f0aa40b0427302739262e42c500eb82fb3fdf359fdf28cd26  src/picker/demo-answers-v3/agency.json
    c412d3987caa0524b223152fa465321e5de71f382444460d1d13b3ed4a2b068e  src/picker/demo-answers/uchet-pro.json
    8d3be981bde3dfcb49ff44570461c68a1272092f6b68cd09646d9474b9d95393  src/picker/demo-answers/svet-marketing.json

(The task says "the four answer files": the folder `demo-answers-v3/` holds two and the old folder `demo-answers/` holds two; all four were hashed.)

Comparison with the expected: exit 0, one literal line, stderr empty, files unchanged. **PASS.**

## Step 2 — the new stand and the questionnaires

Action (scratch home 1, empty before the start: 0 entries):

    node src/picker/cli.js serve --tenants src/picker/demo-tenants-v3 --home <scratch home 1> --port 0

Seen on stdout, five lines, stderr empty:

    Сайт подбора запущен. Откройте ссылки:
    http://127.0.0.1:<port>/t/agency/
    http://127.0.0.1:<port>/t/stock/
    Изменения файлов арендаторов применяются после перезапуска.
    Остановить сайт: Ctrl+C.

Two links, `/t/agency/` and `/t/stock/`, in this order. Then `GET /t/<id>/api/questionnaire?lang=<lang>` for both tenants and ru, kk, en (6 requests). A small program of my own (outside the project) read the six saved bodies.

| Check | stock (ru / kk / en) | agency (ru / kk / en) |
|---|---|---|
| HTTP code | 200 / 200 / 200 | 200 / 200 / 200 |
| `look` present; mark; staff count | mark `С`; 4 staff | mark `Л`; 4 staff |
| `desk` of the five questions, in order | 1,2,3,3,4 in all three | 1,2,3,3,4 in all three |
| `chips` on the number question | `[500,3000,10000,50000]` in all three (`unit` in the language of the page) | `[200000,500000,1000000,3000000]` in all three (`unit` in the language of the page) |
| `object` with an `id` on every option | 14 of 14 in all three | 15 of 15 in all three |
| `whatsapp` in `leads` | `77010000000` in all three | `77020000000` in all three |
| `version` of the questionnaire | in the ru answer of stock: equals the sha256 of `stock.json` (step 1); the other answers were not compared | not compared |

No other 11-digit number is in any of the six answers. `leads` of every answer holds `contact_fields`, `whatsapp`, `consent_text`, `operator_name`, `privacy_contact`, `retention_days` (no `max_per_hour` or `max_stored`; the README says they are not given to the visitor).

Cross-tenant search, in both directions, over the answers of the other tenant in all three languages: for each tenant 57 probe strings — the tenant name (ru, kk and the en spelling), the three taglines, the three industries, the three headlines, the four staff names, the whatsapp number. Hits: stock texts in the agency answers 0; agency texts in the stock answers 0. Control: the same probes find the tenant's own name in its own answers (`grep -c` gives 1 for the ru stock, the en stock and the en agency answers), so the search is able to find. **PASS.**

## Step 3 — the real result route, the answer sets

Action: for each tenant (`stock`, `agency`), each set (`leader`, `close`, `none`, `half`) of `src/picker/demo-answers-v3/<tenant>.json`, each language (ru, kk, en), the command of the README:

    node --input-type=module -e '... JSON.stringify({ answers: a[<set>] }) ...' \
      | curl -s -X POST -H "Origin: http://127.0.0.1:<port>" -H "Content-Type: application/json" \
        --data @- "http://127.0.0.1:<port>/t/<tenant>/api/result?lang=<lang>"

24 requests. Repeated state: the saved bodies compared by a program of my own with table 7.1 of the design; the home folder listed before and after (0 entries both times); a questionnaire request after the `half` errors (200).

The server's result holds `clear_leader`, `recommended`, `no_match_text`, `hypotheses` (and no `ranking`, as the README says: points of the solutions that are not recommended are not given to the visitor), so the table column "ranking" is not compared; the recommended ids and scores are.

| Tenant | Set | HTTP | `clear_leader` | `recommended` (id : score) | `no_match_text` | `hypotheses` | Table 7.1 | Same in ru, kk, en |
|---|---|---|---|---|---|---|---|---|
| stock | leader | 200 | true | sk-base : 13 | null | sk-h1 | equal | yes |
| stock | close | 200 | false | sk-exchange : 7, sk-terminal : 5 | null | none | equal | yes |
| stock | none | 200 | null | empty list | equals the file's text of that language | sk-h1, sk-h2 | equal | yes |
| agency | leader | 200 | true | lw-start : 11 | null | none | equal | yes |
| agency | close | 200 | false | lw-channels : 7, lw-report : 5 | null | none | equal | yes |
| agency | none | 200 | null | empty list | equals the file's text of that language | lw-h1 | equal | yes |

- The mark of a clear leader (`clear_leader` true) is given for `leader` only; `close` gives 2 recommended solutions with `clear_leader` false (the mark of close variants); `none` gives an empty list and the no-match text. 18 of 18 cases equal the table.
- `no_match_text` of `none` was compared with `result.no_match_text[<lang>]` of the tenant file: equal in all six cases (ru, kk, en for each tenant). The kk and en texts are different from the ru text (not a copy).
- `half` (6 requests): HTTP 400 in all six, body `{"error":"answers_invalid","message":"<text in the language>","question":"<id>"}`: `question` is `sku` for stock and `budget` for agency (the first required question that the set leaves out, as F8 of the design says). The messages: ru «Ответы не подходят к этой анкете. Пройдите анкету ещё раз.», kk «Жауаптар бұл сауалнамаға сәйкес келмейді. Сауалнаманы қайта толтырыңыз.», en «The answers do not fit this questionnaire. Go through it again.». No stack, no crash: the server answered the next request with 200.
- The home folder (scratch home 1) after all 24 requests: 0 entries (before: 0). No application was stored.
- The server's stderr stayed empty (0 bytes) during the whole run.

Comparison: all as expected. **PASS.**

## Step 4 — stop

Action: `kill -TERM <pid of the server>` (the signal the README names).

Repeated state: `ps -p <pid>` — process gone; `lsof -iTCP:<port>` — nothing listens (0 lines); `curl http://127.0.0.1:<port>/` — no connection (code 000); stderr of the server 0 bytes. The only `serve` processes left on the computer, ports 4782 and 4790, are the owner's own and were there before. (The exit code of the server was not read, because it ran in the background; its stop and the free port are what was observed.) **PASS.**

## Step 5 — the old stand

Action (scratch home 2, empty before: 0 entries):

    node src/picker/cli.js serve --tenants src/picker/demo-tenants --home <scratch home 2> --port 0

Seen: the same five lines with two links as before: `/t/svet-marketing/` and `/t/uchet-pro/`, stderr empty. Then `GET /t/<id>/api/questionnaire?lang=<lang>` for both ids and ru, kk, en: 200 in all six; `shasum -a 256` of the saved body compared with the literals `DEMO_HASHES` of the test SV-9c in `tools/test/picker-server.test.js` (read from the file by a program, not copied by hand):

| Tenant | ru | kk | en |
|---|---|---|---|
| uchet-pro | `ed7d6584...cc1e96` equal | `b7ed6ba4...b4081` equal | `b74367cc...f4d95e` equal |
| svet-marketing | `952a99e2...eceda60` equal | `53a70619...f75024` equal | `1a0b16d1...fa3fc7c` equal |

(Shortened here; the full 64-character values were compared and are the literals of SV-9c.) Home folder after: 0 entries. Stop: `kill -TERM`, process gone, the port answers nothing (code 000), no `serve` process of mine remains. **PASS.**

## After the whole run

- `shasum -a 256` of the six data files equals the digests of step 1 (compared sorted: identical).
- `git status --short` shows no change that is mine: the files shown are those that were already new or modified before the run (`decisions/`, `docs/requirements.yaml`, `tools/README.md`, `docs/design/REQ-070-...`, `handoffs/`, the new data folders and `tools/test/picker-demo-v3.test.js`); this record and the handoff are the only things written by this run.
- No commit, no checkout, no reset, no stash, no clean was run.
- No credentials were needed. No real person's data was used (the data are the invented tenants and invented answers). The owner's working servers on 4782 and 4790 were not touched.

## Remarks (not failures; the criterion does not ask for them, AP-117)

1. `npm run picker -- check` without `-s` prints three extra npm header lines before the literal line (documented in the README). The literal line is correct and stderr is empty.
2. The en questionnaire of `stock` still holds Cyrillic letters in places that are not translated texts: the staff names, the object tag `1С` (digit 1 and the Cyrillic С, as the design says), `operator_name` and `privacy_contact` of `leads` (seen in the en answer of `stock`: `privacy_contact` is a Russian sentence). The names and the tag are as the design describes, but `privacy_contact` is a plain Russian string in the file, so the visitor may see it in Russian in every language; BA-ANALYST may want to decide whether that is intended.
3. The server's result has no `ranking`, so the "ranking" column of table 7.1 cannot be seen on the real route (it is covered by the engine test DT-3b).
4. Only HTTP was used: no page reads the new data yet, so there was no browser step (as the task says).
