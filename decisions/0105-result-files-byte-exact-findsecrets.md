# 0105 — Result files: byte-exact storage, `findSecrets`, refusal of a real secret (REQ-102, defect ISS-0093)

Status: **accepted** (ORCH, 2026-10-28, from the built and gate-checked fix of run `ISS-0093-20261028-01`; conventions in `decisions/0102`, answers of the owner of 2026-10-28 in its Additions 9-12; the owner may cancel).

## Question

The Sai Team core hid, with the free-text masking rules of the Pixel Office journal, parts of every result file (rule M7: any run of three dotted parts, rule M10: long strings), so generated code came out corrupted and the unmasked source was deleted (audit AUD-001, finding SEC-01, defect ISS-0093). How are result files stored and handed on, and how is a real secret kept out of them (quality bar Q7)?

## Options

- A (chosen): store the file byte-exact (sha256 of the original) and refuse a file that holds a real secret, by one new pure scan `findSecrets` in `tools/src/pixel-office/mask.js` with the forms Ф1-Ф9 of REQ-102; `maskSecrets` stays unchanged for journal text and the owner's Pixel Office.
- B (rejected): keep masking and narrow only M7; the stored file would still be changed by the other free-text rules, and what is stored would not be what the agent wrote.
- C (rejected): add a rule like M10 for files (long unprefixed strings); the plan seed «идентификатор из 40 знаков» must be stored, so it is not a rule of the scan.

## Decision

1. **Stored copy.** An accepted result file is stored and handed on to the reviewer and to dependent tasks exactly as written (a BOM and CRLF included), through the three import paths (`writeResultFile`, `importWorkFile`, `importResultBytes`) and the read of `depsOf`; its sha256 is the hash of the original. `findSecrets` runs before the first write (`#publish`), in one full pass at step 1 of `acceptResult`, and in `depsOf`.
2. **A file with a real secret is refused**, not stored masked: `E_WORK_FILE` with reason `secret`, nothing written, the attempt fails with a readable text that names at most three distinct accepted file names (only names that `maskSecrets` leaves unchanged; the rest as «и ещё N»; never a value), the same string in the event, the team question and the error line.
3. **What the scan refuses** (forms Ф1-Ф9 of REQ-102): private key blocks, prefixed keys (`sk-`, `ghp_`, `AKIA`/`ASIA`, `github_pat_` with the left boundary), a JWT shape, `Authorization` and `Bearer` values, an address password, and `name=value` / `name: value` for secret-like names, always for a **literal** value. The rules M7 and M10 are not carried over: they are the cause of the defect. The scan is linear (a per-pass record of failed searches; the closer drop in one pass), measured on twelve families up to 4 MiB.
4. **Closed list of placeholders.** A value is kept if it is a placeholder: one of the 26 words of the closed list, a chain of `*`/`x`, or — only for a value made of letters, digits, `_`, `.` and `-` — a value that starts with `your` or contains `example` (an ampersand, a slash, a colon or a space glued on makes the value a literal: the fix after the finding F1 of the security gate). The list stays closed (owner's answer, 0102 item 30 and 35). The price of the rule (false refusal): a fake password in an agent's own test such as `wrong-password`, a bare address as a value, a quoted «your password» are refused and the attempt fails without retry.
5. **Expression values.** A value that is itself an expression — a path, a template, a call, a bare identifier such as `authHeader`, `$(…)`, a block opener — is not a secret literal and stays stored: the secret is read from a place, which is what Q7 wants. The owner accepted this (0102 items 21, 30, 35); the residual risk (4) is named.
6. **Residual risks named** in the requirement, in `tools/README.md` and in the release report: a real secret typed in the form of an expression (4); a secret with a placeholder word inside a value of the safe character set (4); an assignment with a space before the sign and an address with no user (5); the text after the first value on an `Authorization` line is not examined, and the scheme word split by white space (6, owner accepted, 0102 item 30); a kept call value is not scanned inside, so a glued pair after it stays kept (7, owner accepted, to be closed later by a separate defect, 0102 item 35); a long unprefixed secret is not caught (the rule M10 is not carried over: the plan seed requires the 40-character identifier to be stored).
7. **Sources.** The source of an accepted file leaves `work/` as before; the source of a file refused for a secret leaves `work/` too (an extension of `decisions/0018` P6 and `0035`), so the secret stays on no disk. The scripted (test) executor accepts files one by one: a file accepted before a refused one stays stored; the secret itself is still never stored because the scan sits in `#publish`.
8. **Old files.** A file stored by the old core with the mark `[скрыто]` in the form of a secret (`password=[скрыто]`) is refused by the new forms and therefore withheld from the reviewer by a constant text; a harmless file that only contains the mark passes through.
9. **What this record replaces for result files.** `decisions/0017` P9: «В `files/` и в журнал из них попадает только маскированное» — no longer true for `files/` (the file is stored exactly and a secret is not accepted; the half about the journal stays). `decisions/0035` item 1: «Принятые файлы из `files/` (они уже маскированы)» — the copy is now exact and holds no secret because a file with a secret is not accepted. The risk table row А of `decisions/0035`: «копия из `files/` маскирована, секрета в ней нет» — read the same way. Twelve guard tests change by the «was → became» table of REQ-102.
10. **Journal masking unchanged.** `maskSecrets` and the rules M1-M10 stay as they are for journal text and the owner's Pixel Office (the first 315 lines of `mask.js` are byte-identical to the base). ISS-0058 and ISS-0045 (those rules on journal text) remain open and are a separate, later run.

## Why

The agent's work must reach the reviewer and the customer exactly as written, and a real secret must reach no disk: refusing the whole file is simpler and safer than altering it, and the old masking rules cannot tell code from a secret. REQ-102 passed three requirement gates, a design gate (with the owner's allowance for one extra pass), a micro-amendment gate twice and two code gates twice.

## Boundary

Not a change of the quality bar and not a permission to store secrets. Does not touch the Pixel Office journal rules, the 37-event catalogue, `engine/single-run.js` (written exclusion), the owner's local tools or any port.

## Basis

`docs/requirements.yaml` block REQ-102 (and the amended criteria of REQ-009, REQ-010, REQ-013); `docs/design/REQ-102-result-files-byte-exact.md`; `decisions/0102` (all Additions); `decisions/0017`, `0018`, `0035`, `0095`; `handoffs/ISS-0093-20261028-01/` (the gate reports); AUD-001 finding SEC-01.
