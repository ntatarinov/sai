# ISS-0145 — Eighteen pending requirement blocks name a cancelled block in `depends_on`

Серьёзность: LOW. Статус: open. Найдено: DOC-UPDATER (шаг 03 прогона `M2ACCT-20261123-01`, after the rescoping of eleven old blocks by REQ-114 … REQ-120); заведено ORCH, 2026-11-23T17:47:05Z. Пункт планки: Q1 (a dependency that can never be met).
Требования: REQ-023, REQ-029, REQ-060, REQ-066, REQ-067, REQ-075, REQ-080, REQ-081, REQ-082, REQ-088, REQ-090, REQ-092, REQ-093, REQ-094, REQ-095, REQ-096, REQ-098, REQ-099.

## Что не так

These pending blocks list in `depends_on` one of the blocks cancelled on 2026-11-23 (REQ-018, REQ-019, REQ-024, REQ-059, REQ-062, REQ-064, REQ-065, REQ-077, REQ-078, REQ-079, REQ-089), each replaced by a block of REQ-114 … REQ-120. A cancelled dependency is never `done`, so these blocks could never start by the rule of their own `depends_on`.

## Доказательство

`handoffs/M2ACCT-20261123-01/step-03-doc-updater.json` (result.issues: the list of blocks and the cancelled block each names).

## Как исправить

A WF-01 micro-amendment run: each `depends_on` entry that names a cancelled block is replaced by the block that took it over (the pointer in the cancelled block's status comment); the meaning of no criterion changes. Many of these blocks are themselves rescoped by M3 and M4; the run is best made at the start of M3.1.

## Маршрут

WF-01, at M3.1.
