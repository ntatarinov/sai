# ISS-0147 — Low points left by the run M2AUTH-20261123-01: no test at a fractional second of Retry-After, one outdated comment, two hardening notes of the reviews

Серьёзность: LOW. Статус: open. Найдено: TEST-DESIGN-VALIDATOR (шаг 05b, F1), REVIEWER (шаг 04b, P2-1 и P2-2) и RELEASE-VALIDATOR (шаг 09b, пункты 1, 8 и 10 списка); заведено DOC-UPDATER, 2026-11-24T03:58:48Z, под номером, названным ORCH в задаче шага 10. Пункт планки: Q6 (a test must be able to fail), Q10.
Требования: REQ-114 (c5 «Retry-After equal to the seconds left», c14), decisions/0137 Addition 4; none of these points fails a criterion.

## Что не так

- **(a) No test probes Retry-After at a fractional second.** The lock and the admin delay answer `Retry-After` as `ceil(seconds left)` (`secondsLeft` in `app/server/auth/lockout.js`), but LO-1, LO-3, LO-6 and the lock answer of LO-5 all stand on a whole second, where `ceil` and `floor` agree. The mutant `Math.ceil` → `Math.floor` survives (TEST-DESIGN-VALIDATOR, mutant O3). The code is right: the RELEASE-VALIDATOR probe of step 9 read 899 at 898.5 s left.
- **(b) A comment of `app/server/routes/auth.js` (line 545) is narrower than the code.** It says «An unused reset link of the admin no longer sets a password», while `deleteUnusedResets(req.q, row.id)` removes the unused reset links of whichever user changes his own password (SEC F5, decisions/0137 Addition 4). Only the comment is wrong.
- **(c) IPv6 text that is not a normal client address shares one bucket** (REVIEWER P2-1, `app/server/http/rate-limit.js` `addressKey`): `::`, `::1` and a hex-written mapped address such as `::ffff:102:304` all key to `0:0:0:0::/64`. On Node the socket gives the dotted mapped form, which `client-ip.js` already turns into IPv4, and on Vercel the header is a normal address, so no real client is affected now.
- **(d) `app/scripts/uat-login.js` opens the secret file without `O_NONBLOCK`** (REVIEWER P2-2, lines 160-190): a file swapped for a FIFO between the `lstat` and the open would block the script at the open. It needs a local writer in the owner's secret folder and only hangs the script; the `fstat` check that follows would refuse it.

## Доказательство

`handoffs/M2AUTH-20261123-01/step-05b-test-design-validator.json` (F1, mutant O3), `step-04b-reviewer.json` (P2-1, P2-2), `step-09b-release-validator.json` (the list for DOC-UPDATER, items 1, 8 and 10); `sed -n 545p app/server/routes/auth.js` shows the comment of (b).

## Как исправить

1. (a) Add one probe at a fractional offset (for example 1.5 s before the end of the admin delay and of an ordinary lock) expecting `Retry-After` «2»; check that the mutant now dies.
2. (b) Reword the comment: the unused reset links of the user who changes his password.
3. (c) If a hex mapped form is ever seen in a log, make `client-ip.js` normalise it to IPv4 before `addressKey`; otherwise accept.
4. (d) Add `fs.constants.O_NONBLOCK` to the open flags of `uat-login.js`, with a test row.

## Маршрут

WF-03, one run when the code of these places is touched next (no criterion needs it; the severity is LOW). The code files are not edited by DOC-UPDATER.
