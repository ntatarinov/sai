# ISS-0144 — In the tools that keep running on the Windows thin client, `O_NOFOLLOW ?? 0` opens a file without the no-follow flag

Серьёзность: LOW. Статус: open. Найдено: ISSUE-FIXER (шаг 01 прогона `ISS-0132-20261123-01`, I2 D) и REQ-ANALYST (шаг 02, О7); заведено ORCH, 2026-11-23T17:13:05Z. Пункт планки: Q10 (a protection that depends on the OS falls back silently).
Требования: REQ-110 (the supported platforms, criteria 12-19 written by ISS-0132); REQ-014 (traces), REQ-063 (handoffs-check).

## Что не так

On win32 `fs.constants.O_NOFOLLOW` is undefined, and `tools/src/handoffs/check.js`, `tools/src/traces/check.js` and the picker open files with `O_NOFOLLOW ?? 0`, so the flag is silently absent. An `lstat` check comes first in every place, so what remains is a race between the check and the open on a Windows machine. These tools must keep running on the thin client (decisions/0134 item 4), so the guard of ISS-0132 does not refuse them.

## Доказательство

`handoffs/ISS-0132-20261123-01/step-01-issue-fixer.json` (the list of places, I2 D) and `step-02-req-analyst.json` (О7).

## Как исправить

After the open, compare the identity of the opened file (`fstat` dev and ino) with the `lstat` before it and refuse on a mismatch, on every platform; a test with a link swapped in between. Porting the POSIX protections is out of scope (decisions/0127 Г, 0134 item 4).

## Маршрут

WF-03, later; not on the path of the first client.
