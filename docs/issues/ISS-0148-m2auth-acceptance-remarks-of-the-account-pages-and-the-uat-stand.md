# ISS-0148 — Remarks of the acceptance of the four account pages (M-1 to M-6) and one cosmetic point of the login prompt

Серьёзность: LOW. Статус: open. Найдено: UAT-RUNNER (шаги 08 и 08b, замечания M-1 … M-6, запись `docs/uat/M2AUTH-20261123-01.md`), REVIEWER (шаг 04d, P4-1) и RELEASE-VALIDATOR (шаг 09b, пункты 2 … 7 списка); заведено DOC-UPDATER, 2026-11-24T03:58:48Z, под номером, названным ORCH в задаче шага 10. Пункт планки: Q10.
Требования: REQ-114 (c13 the account pages, c3 the session cookie); none of these points fails a criterion.

## Что не так

- **(a) M-1: console lines.** Chrome writes «Failed to load resource» for every refusal the pages expect, the commonest being `GET /api/auth/me` 401 on every visit of a signed-out page. They are browser lines, not page errors, but they make the console of a signed-out page noisy for any later check that wants it empty.
- **(b) M-2: one refused request.** On `reset.html` in a browser that still holds a session (the admin opened his own link while signed in) the first `POST /api/auth/reset` is refused 403 `csrf_refused` and `api.js` repeats it after `GET /api/auth/me` (design 5.1 names this one repeat). Without a session the first request passes.
- **(c) M-3: the setup token is a text field.** `setup.html` shows the token in clear text. The owner types it once on his own screen; a password field is a question for BA-ANALYST.
- **(d) The TOTP turn-off form** shows its code prompt under the error label, the pattern that remark M-4 fixed on `login.html` in rework 02d. It is not fixed on the turn-off form.
- **(e) M-5: the cookie flags are not seen locally.** The `__Host-sai_s` cookie and its `Secure` flag cannot appear on a local http stand; they are read after the deploy (design 14, the post-deploy record). Open until that read.
- **(f) M-6: a stop by process id on Windows** ends the server at once (exit code 1); no graceful stop was observed. A property of the platform, not of the app; noted so that nobody reads the exit code as a crash.
- **(g) REVIEWER P4-1:** after a `totp_invalid` answer the empty `#prompt` paragraph of `login.html` stays inside the shown code row and may add one line of margin above the code label if `.msg-text` has a vertical margin. Cosmetic; UAT 08b saw the prompt and the code field work at 390 px and 320 px but did not record a gap.

## Доказательство

`docs/uat/M2AUTH-20261123-01.md` (section «Remarks», M-1 … M-6, and the re-check after rework 02d), `handoffs/M2AUTH-20261123-01/step-04d-reviewer.json` (P4-1), `step-09b-release-validator.json` (list for DOC-UPDATER, items 2 … 7).

## Как исправить

1. (a) Optional: ask `/api/auth/me` only when a cookie exists, or accept; say which in the next acceptance run.
2. (b) Accept, or read the CSRF token before the first POST when a session exists.
3. (c) Ask BA-ANALYST whether a password field is wanted; the answer goes to the REQ-114 text if it changes anything.
4. (d) Show the code prompt on the turn-off form in a prompt element, as `login.html` does, with a UAT row.
5. (e) Read the cookie flags in the post-deploy record of the release that first carries 0002; close the point there.
6. (f) No fix; keep the note in the UAT record.
7. (g) Look at it in a browser at 390 px; if there is a gap, set `hidden` on an empty `#prompt`.

## Маршрут

WF-03, one run for (d) and (g) when the pages are touched next; (e) is closed by the post-deploy record; the others are accepted unless the owner asks otherwise. The severity is LOW.
