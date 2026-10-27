# REQ-069 — acceptance run: the tenant file format `sai-picker-tenant/3` on the running picker server

WF-02, step 8 (UAT-RUNNER), run `LOOK069-20261026-01`, handoff `step-17-uat-runner.json`. There is no `docs/uat/REQ-069.md` of BA-ANALYST: the task of ORCH and the design `docs/design/REQ-069-tenant-look-format.md` (section 6.4 for the lines, section 10 for the samples) describe the steps (`decisions/0079`, item 6), so no scenario of my own was added. Run made on 2026-10-26 (computer clock, `date -u`, about 20:51Z to 20:54Z). No browser was used: this requirement changes no page (the page file `public/index.html` is byte-equal to the one of the base tag, step S2-6). The reading and the signature of the result are BA-ANALYST's; the decision to release is the owner's.

## Result

**Verdict: PASS. 8 of 8 steps passed, 0 failures, 0 steps not carried out.** Steps: S1-1 (three accepted samples), S1-2 (five broken samples), S2-1 (start and the block about the not served tenant), S2-2 (the look of A and B in three languages), S2-3 (no look of B in the answer of A), S2-4 (the broken tenant answers 404), S2-5 (six answers of the demo tenants), S2-6 (the old page of a demo tenant). Remarks (not failures, AP-117) are at the end.

## The stand

- Everything ran in a scratch copy of `tools/` (with the working files of this run) and in a new scratch home folder, both inside the session scratchpad folder, never in the project folder. The tenants folder of the stand was a new folder with five files: `ok-office-a.json`, `ok-office-b.json` and `e-desk-order.json` (copied from `tools/test/fixtures/picker-look/`, one broken `/3` file: desks 1,2,1,2) and the two demo tenants `uchet-pro.json` and `svet-marketing.json` (copied from `tools/src/picker/demo-tenants/`).
- The server is my own: `node src/picker/cli.js serve --tenants <new folder> --home <new empty folder> --port 0`, the real command `npm run picker -- serve` runs the same file. Port 4782 (the default) was already taken by another process of the computer before the run (`lsof`), so `--port 0` was used; the real port, 56159, was read from the printed links. One server at a time. It was stopped at the end (S2-7 below).
- No credential, secret, photo or personal data exists in this run (Q7, R3). No journal of events is part of this run (R2 does not apply). The picker server writes nothing to the disk: the `--home` folder had 0 entries after the run.

## Part 1. The command `check`

Command for each file: `cd tools && npm run -s picker -- check test/fixtures/picker-look/<name>.json` (`-s` removes the three header lines that `npm run` prints; with plain `npm run` the same line follows them, checked on `ok-minimal`). For each: exit code, stdout, stderr size, sha256 of the file before and after the command.

### S1-1. Three accepted samples

- **Action.** `check` on `ok-office-a.json`, `ok-office-b.json`, `ok-minimal.json`.
- **Repeated state request.** `shasum -a 256` of each file after the command, compared with the value before; stderr size.
- **Comparison.** Expected (design 6.4, 10.2): exit 0, the one line «Файл арендатора <id> в порядке: вопросов N, решений M, правил K.», empty stderr, file unchanged.
- **Evidence.**

| File | Exit | stdout (one line) | stderr | sha256 before = after |
|---|---|---|---|---|
| `ok-office-a` | 0 | `Файл арендатора ok-office-a в порядке: вопросов 4, решений 2, правил 3.` | 0 bytes | yes (`1bbc6968adf4a527…`) |
| `ok-office-b` | 0 | `Файл арендатора ok-office-b в порядке: вопросов 4, решений 2, правил 3.` | 0 bytes | yes (`5c5cac80db5a5645…`) |
| `ok-minimal` | 0 | `Файл арендатора ok-minimal в порядке: вопросов 4, решений 2, правил 3.` | 0 bytes | yes (`532da708e8d173d2…`) |

- **Result.** PASS.

### S1-2. Five broken samples

- **Action.** `check` on `e-contrast-light.json` (a colour with low contrast), `e-object-unknown.json` (a bad object id), `e-desk-order.json` (desks out of order), `e-wa-plus.json` (a bad WhatsApp number), `e-staff-name-url.json` (a bad staff name).
- **Repeated state request.** The same as S1-1 (sha256 after, stderr size).
- **Comparison.** Expected: exit 1, the line(s) of design 6.4 and 10.2 for the sample, empty stderr, file unchanged.
- **Evidence.** (exact stdout, one line each; the message ids are those of section 6.4)

| Sample | Exit | stdout | Design | stderr | sha256 before = after |
|---|---|---|---|---|---|
| `e-contrast-light` | 1 | `e-contrast-light.json: look.colors.light.accent: E_LIMIT: Контраст цвета с листом светлой темы меньше 3,0 : 1. Возьмите цвет темнее.` | M18 | 0 bytes | yes |
| `e-object-unknown` | 1 | `e-object-unknown.json: questions[0].options[0].object.id: E_REF: Допустимо только: shelf, shop, boxes, monitor, laptop, scanner, tsd, clip, bell, phone, cell, headset, poster, coins, chart.` | M20 | 0 bytes | yes |
| `e-desk-order` | 1 | `e-desk-order.json: questions[2].desk: E_ORDER: Номер стола меньше, чем у предыдущего вопроса. Не уменьшайте его.` | M25 | 0 bytes | yes |
| `e-wa-plus` | 1 | `e-wa-plus.json: leads.whatsapp: E_FIELD: Номер WhatsApp — только цифры, без плюса и пробелов. Исправьте значение.` | M31 | 0 bytes | yes |
| `e-staff-name-url` | 1 | `e-staff-name-url.json: look.team[0].name: E_FIELD: Имя — только буквы, цифры, пробел, дефис, апостроф и точка. Исправьте значение.` | M14 | 0 bytes | yes |

  The place, the code and the whole text equal the rows of design 10.2 and the messages of 6.4 for all five (read against the document, not computed from the code).
- **Result.** PASS.

## Part 2. The server

### S2-1. Start and the block about the not served tenant

- **Action.** `node src/picker/cli.js serve --tenants <folder of five files> --home <new empty folder> --port 0`, output to two files.
- **Repeated state request.** `cat` of both output files after the start; the same server answered the requests of S2-2 … S2-6 (below); `ls -A` of the home folder after the run.
- **Comparison.** Expected: the five-line start block with the links of the healthy tenants only, and on stderr the block «Арендатор <file> не обслуживается:» with the lines of the check for the broken file (`tools/README.md`, "Which files the server takes").
- **Evidence.** stdout: `Сайт подбора запущен. Откройте ссылки:`, then the four links `/t/ok-office-a/`, `/t/ok-office-b/`, `/t/svet-marketing/`, `/t/uchet-pro/` on port 56159 (no link for `e-desk-order`), `Изменения файлов арендаторов применяются после перезапуска.`, `Остановить сайт: Ctrl+C.` stderr (two lines): `Арендатор e-desk-order.json не обслуживается:` and `e-desk-order.json: questions[2].desk: E_ORDER: Номер стола меньше, чем у предыдущего вопроса. Не уменьшайте его.` (the same line as in S1-2). Home folder: 0 entries.
- **Result.** PASS.

### S2-2. The look, desk, chips, objects and whatsapp of A and B in ru, kk, en

- **Action.** `curl "http://127.0.0.1:56159/t/<id>/api/questionnaire?lang=<lang>"` for `ok-office-a` and `ok-office-b`, `ru`, `kk`, `en` (six requests); answers saved.
- **Repeated state request.** The answers were read back from the saved files and compared, field by field and by language, with the tenant file in the tenants folder (a program over the JSON, with the file values read from the file).
- **Comparison.** Expected (design 7.1, 7.2): HTTP 200; keys in the order `version, lang, languages, name, look, intro, questions_min, questions_max, questions, ai, leads`; the look with `mark`, `tagline`, `industry`, `headline`, `colors`, `team` in the language; `desk`, `chips` of the questions, `object` of the options, `whatsapp` in `leads`; `max_per_hour` and `max_stored` not in the answer.
- **Evidence.** All six: HTTP 200, `application/json; charset=utf-8`, 2599 / 2621 / 2208 bytes for A (ru/kk/en) and 2595 / 2579 / 2184 bytes for B. The key order is exactly as above in all six. Per answer, equal to the file in that language: tagline, headline, industry, the four staff (name, role, says, figure, shirt), the four colours, desk and chips of every question, `object` of every option, `leads.whatsapp`. In 48 of 48 comparisons (8 per answer × 6) the result was "equal". Values seen: A: mark «О», desks `1,1,2,4`, chips `[20,40,120]` on the third question, objects `shop`, `laptop` (tag «ПК»), `coins` (level 3), `bell`, `leads.whatsapp` `77011112233`; B: mark «С», desks `1,2,3,3`, chips `[5,25,500]`, objects `chart` (level 4), `cell` (tag «5G»), `scanner`, `poster` (glyph `house`), `leads.whatsapp` `77022223344`. The strings `max_per_hour` and `max_stored` appear in none of the six answers (the file values 37/4217 and 41/5309 are not in them).
- **Result.** PASS.

### S2-3. No look of B in the answer of A (and of A in B)

- **Action.** A program took every string of the look of B in all three languages (and the whatsapp number of B) from the file of B and searched for it in the three saved answers of A; then the same in the other direction.
- **Repeated state request.** The search was run on the saved server answers, not on the files.
- **Comparison.** Expected: nothing of the look of the other tenant.
- **Evidence.** The only strings found in both directions are `accent`, `accent2` and `ink`: these are the closed shirt names of the catalogue (design 5.3), the same words for every tenant, not the look of a tenant. Everything else (taglines, headlines, industries, staff names, roles, replies, colours, the mark, the whatsapp number): 0 matches in both directions.
- **Result.** PASS.

### S2-4. The broken tenant answers 404

- **Action.** `curl` of `/t/e-desk-order/api/questionnaire?lang=ru` (the not served tenant) and of `/t/net-takogo/api/questionnaire?lang=ru` (an unknown name).
- **Repeated state request.** The two bodies compared byte by byte with `cmp`; the start output of S2-1 shows that the file is not served.
- **Comparison.** Expected: 404, and the same answer as for an unknown tenant (README, "Addresses"; Q8).
- **Evidence.** Both: HTTP 404; body `{"error":"not_found","message":"Страница не найдена. / Бет табылмады. / Page not found."}`; `cmp` reports no difference.
- **Result.** PASS.

### S2-5. The six answers of the demo tenants

- **Action.** `curl -s "http://127.0.0.1:56159/t/<id>/api/questionnaire?lang=<lang>" | shasum -a 256` for `uchet-pro` and `svet-marketing`, `ru`, `kk`, `en`.
- **Repeated state request.** Each answer was asked separately a second time and searched for the keys `look`, `desk`, `chips`, `object`, `whatsapp` (`grep -c`).
- **Comparison.** The literals are the `DEMO_HASHES` of `tools/test/picker-server.test.js` (test SV-9c, copied from the file, not recomputed from the code).
- **Evidence.**

| Tenant | Language | sha256 got (first 16) | Literal of SV-9c (first 16) | Key search | Result |
|---|---|---|---|---|---|
| `uchet-pro` | ru | `ed7d65846b4885f0` | `ed7d65846b4885f0` | 0 matches | PASS |
| `uchet-pro` | kk | `b7ed6ba4f73efa98` | `b7ed6ba4f73efa98` | 0 | PASS |
| `uchet-pro` | en | `b74367ccc8716c37` | `b74367ccc8716c37` | 0 | PASS |
| `svet-marketing` | ru | `952a99e23c9c060a` | `952a99e23c9c060a` | 0 | PASS |
| `svet-marketing` | kk | `53a706196b498567` | `53a706196b498567` | 0 | PASS |
| `svet-marketing` | en | `1a0b16d18ea49937` | `1a0b16d18ea49937` | 0 | PASS |

  The comparison was made on the whole 64 signs of each hash (the table shows the first 16).
- **Result.** PASS (6 of 6).

### S2-6. The old page of a demo tenant

- **Action.** `curl -o page.html http://127.0.0.1:56159/t/uchet-pro/`; also the page of `svet-marketing` and of `ok-office-a`.
- **Repeated state request.** `shasum -a 256` of the saved page, and of `public/index.html` as it was on the base tag (`git show base/LOOK069-20261026-01:tools/src/picker/public/index.html`, read only).
- **Comparison.** Expected: HTTP 200 and the same bytes as before the requirement.
- **Evidence.** `/t/uchet-pro/`: HTTP 200, `text/html; charset=utf-8`, 423 bytes, sha256 `c81e7ef3fa624c146a665b0cb724095be28131b818a1b3bea4b8b5ad762e68bd`; the base tag has the same sha256 (the whole 64 signs equal). The pages of `svet-marketing` and `ok-office-a` also answered 200.
- **Result.** PASS.

### S2-7. The stop (a duty of the task, not a scenario)

SIGTERM to the server process; after one second the process was gone, a request to the port gave no connection (curl code 000) and `lsof` showed nothing listening on 56159. No other process of mine is left. The owner's process on port 4782 was not touched.

## After the run

- Project files changed by this run: this file and the handoff only. `git status` shows no other change made by me; `tools/test/fixtures/picker-look/ok-minimal.json` has the same sha256 (`532da708…`) as the scratch copy before and after the checks. No commit, no checkout, reset, stash or clean.

## Remarks (not failures, AP-117)

- **R-1.** Port 4782 was occupied by another process before the run, so `--port 0` was used. This is not a defect: the server accepts the key.
- **R-2.** The exit code of the server after SIGTERM was not read (the server ran detached); the README says 0. The stop itself (process gone, port closed) was observed. The test suite covers the exit code; it is outside the criteria checked here.
- **R-3.** The staff names in the samples are the same in the three languages (they are names, not translated texts); this is the file content, not a defect.
