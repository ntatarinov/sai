# ISS-0131 — The public git history still holds the name of the reference product and 12 files of a former project (first commit), and the old Mac login name in 7 handoffs; decisions 0019 and 0111 left the rewrite to the owner

Серьёзность: HIGH. Статус: open. Найдено: AUD-002, SECURITY-AUDITOR (docs, records), 2026-11-22 (находки SEC-DOCS-01 (High), SEC-REC-03 (Medium), SEC-DOCS-02 (Low), SEC-REC-04 (Low)); заведено ORCH, 2026-11-22T19:32:14Z. Пункт планки: Q7 and decisions 0019, 0082, 0111.
Требования: none; the owner's rule about the reference product (read only, no trace).

## Что не так

- The name is added in six commits (7591fc0, 187b0aa, 6143f0c, 3cb5166, 956decd, a879495; 2026-10-05 to 2026-10-09). Commit 7591fc0 (the first commit, 461 files) adds 12 files under `reference/` (ORCH re-checked: 12, all reachable from origin/main; the working tree has none). The repository is PUBLIC since 2026-11-15. No open defect covers it. The working tree is clean: 0 hits in 2970 files, and the traces check prints 0.
- The old Mac login name stands in 7 handoffs on origin/main (inside grep patterns that prove its absence) and so in the public history (SEC-REC-03).
- Low: the Vercel team id and project id stand in docs/program/public-v1/PROGRESS.md (SEC-DOCS-02, account identifiers, not credentials); a SHA-256 fingerprint of the owner's Pixel Office write-secret file stands in 36 handoffs on origin/main (SEC-REC-04; not the secret, not reversible).

## Доказательство

docs/audits/AUD-002/docs/security.json (SEC-DOCS-01, SEC-DOCS-02), docs/audits/AUD-002/records/security.json (SEC-REC-03, SEC-REC-04); `git merge-base --is-ancestor <commit> origin/main` is true for all six commits.

## Как исправить

1. THE OWNER DECIDES (rewriting a published history, or making the repository private, cannot be undone and is his): (a) accept the open history and say who owns the former project's code; (b) rewrite the history of `main` (a force-push, one branch at a time, with the list of commits; the copies on GitHub caches and forks stay); (c) make the repository private again (it was opened on purpose by decision 0111, so this reverses a decision). ORCH recommends asking him with the facts of this record.
2. Whatever he chooses: replace the Vercel ids of PROGRESS.md line 17 by placeholders (a document edit, DOC-UPDATER) and decide whether the fingerprint stays.

## Маршрут

Owner decision (a question in the report); the document edits by DOC-UPDATER after it. No code.
