# ISS-0146 — Low points left after the fix of ISS-0132: a mode narrower than 0700 is accepted, five places do not read a mode back, two test rows are missing, one comment is outdated

Серьёзность: LOW. Статус: open. Найдено: SECURITY-REVIEWER (шаг 05 прогона `ISS-0132-20261123-01`, LOW 1 и LOW 2), CODE-DESIGN-VALIDATOR (шаг 03b, L3), TEST-DESIGN-VALIDATOR (шаг 07, F1 и F3), REVIEWER (шаг 05, R1) и RELEASE-VALIDATOR (шаг 09, пункт 5e); заведено DOC-UPDATER, 2026-11-23T19:07:05Z, под номером, названным ORCH в задаче шага 10. Пункт планки: Q10 (a protection that depends on the OS must be read back, not assumed), Q6 (a test that pins what is promised).
Требования: REQ-110 (criteria 12-19, all met; none of these points fails a criterion); decisions/0127 Г, 0134 item 4, 0136.

## Что не так

- **(a) `ensureHome` accepts a narrower mode.** `ensureHome` in `tools/src/team/home.js` accepts a mode narrower than 0700 after the chmod (0500, 0000), while `ensureStateDir` in `tools/src/pixel-office/state-dir.js` requires exactly 0700 (AP-014: two places of the same kind, two rules). No row of PLT-14 pins it.
- **(b) The other places that set a mode do not read it back** (design limit 2; the read-back is done only for the two roots): `tools/src/team/engine/channel.js:609` (`prepareDir`), `tools/src/team/files.js:100`, `tools/src/team/lock.js:182`, `tools/src/team/store.js:626-639`, `tools/src/pixel-office/journal.js:69`. They are unreachable on win32 now, because every entry refuses first, but on another file system that keeps no modes they would claim a protection they did not set.
- **(c) HK-41 pins only win32.** The hook drop is not pinned for another refused platform such as freebsd or cygwin (the allow-list is pinned in PLT-01, the hook is not).
- **(d) The place of the hook's drop is not pinned.** HK-41 does not prove that the drop comes before the read of the state folder (design gate pass, L3).
- **(e) The comment of `main` in `tools/src/pixel-office/note.js` (lines 255-257) is outdated** (a code file, so it was not edited by DOC-UPDATER): it says that the exit code is 2 only for a usage error, but the Node-floor refusal and the platform refusal also end with 2 (`NODE_REFUSAL_EXIT`).
- **Residual, recorded as a reason and not as a separate fix.** `tools/src/team/executors/proc.js` (`signalGroup`, `groupAlive`, `stopGroup`) still reports «the group is gone» on win32 (reproduced by RELEASE-VALIDATOR on the tag and on the fix: gone after 0 ms with the child alive). It is unreachable now only because `run()` of `claude-cli` refuses with `E_PLATFORM` before the spawn. This is the reason that guard must stay first; a change that lets a real run start on win32 needs a real group stop first (it is not planned, decisions/0127 Г).

## Доказательство

`handoffs/ISS-0132-20261123-01/step-05-security-reviewer.json` (LOW 1, LOW 2), `step-03b-code-design-validator.json` (L3), `step-07-test-design-validator.json` (F1, F3), `step-05-reviewer-code.json` (R1), `step-09-release-validator.json` (the list for DOC-UPDATER, item 5).

## Как исправить

1. (a) Make `ensureHome` require exactly 0700 as `ensureStateDir` does, with a PLT-14 row for 0500 and 0000.
2. (b) Read the mode back in the five places, or move them under one helper that does it; each with a row on a file system that keeps no modes.
3. (c) and (d) Add rows to HK-41: freebsd and cygwin, and the order «drop, then state read».
4. (e) Correct the comment of `main` in `note.js` (2 for a usage error, the Node-floor refusal and the platform refusal; 1 for the others).

## Маршрут

WF-03, one run when the code of these places is touched next (no criterion needs it; the severity is LOW).
