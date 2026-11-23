# 0134 — The owner hands the development to the team: build, check, push after green checks; the path to the first client; the worker runs as a Linux container on Windows and macOS

Status: **accepted** (the owner's words, 2026-11-23, the session on the owner's Windows PC, chat; the readings marked «ORCH» are ORCH's under that delegation, the owner can cancel each by a word).

## Question

After decisions/0133 ORCH said what it would do next (check the stage order against the goal; find out how the owner works on Windows and macOS without porting the agent engine). The owner answered how the work is to go on.

## Owner's words (verbatim)

> Всё верно, согласен с твоим уточнением по пункту 4.
>
> Продолжай работу самостоятельно. Не нужно каждый раз спрашивать у меня разрешения на технические решения, если они не создают существенных рисков.
>
> Главная цель — довести Sai до состояния, когда первый реальный клиент сможет самостоятельно пройти весь путь от идеи до готового результата.
>
> При этом не ограничивайся только анализом и планированием. Если видишь, что конкретную задачу уже можно реализовать, приступай к её выполнению.
>
> Самостоятельно определяй приоритеты, выполняй задачи, проверяй результаты и исправляй обнаруженные ошибки.
>
> Изменения в GitHub отправляй после успешных проверок, если для этого не требуется отдельное согласование и нет риска затронуть стабильную рабочую версию.
>
> Не нужно постоянно возвращаться ко мне с отчётами о каждом действии. Сообщай о завершённых значимых этапах, существенных проблемах и решениях, которые действительно требуют моего участия.
>
> По Windows и macOS выбирай наиболее рациональный вариант без лишней переработки архитектуры.
>
> Главное — переходи от обсуждений к реальной разработке и доводи начатые задачи до работающего результата.

## Decision

1. **The reading of item 5 of decisions/0133 is confirmed** (the chain of a session stays fixed; the agents inside the development stage are flexible).
2. **Pushes to GitHub (ORCH).** The stable working version is the production site https://sai-team.vercel.app (it changes only by a CLI deploy, never by a push). Hence:
   - temporary `ci/*` branches and the work branch `m0-records` (fast-forward only): pushed when ORCH needs them;
   - `main`: pushed after the full check is green on GitHub on the exact tree and, where the workflow has one, after PASS of RELEASE-VALIDATOR (decisions/0048, 0110), fast-forward only. This replaces the separate «да» for the release of the records (decisions/0127 Л) and for later releases to `main`;
   - **still the owner's:** a deploy to production (it changes the stable version), a force-push, a history rewrite before its rehearsal (decisions/0132 item 4), deleting branches or data, G21, G2 and G6 (money and the API key).
3. **The path to the first client (ORCH).** PLAN M2 → M3 → M4 already is this path; AC4.8 (the e2e chain: invite → login → project → interview → ТЗ → approve → build → preview → zip) is its test. What the first invited client needs beyond M4: the client starts the work himself with the limits (a part of M5: rights, ceilings, kill switch), the api worker for an organisation that is not the owner's (a part of M7: the container), the legal pages and the lawyer (the owner, decisions/0133 item 2). What waits: M6 beyond the minimal office of M4, M8, M9, stage 6 of decisions/0127 (public API), the kk texts, audit waves 2–4 except the security dimensions of new code. Stage 0b is folded into M0.13 (the records released, the lines joined). The exact reorder is a row of «Plan amendments» in PROGRESS.md.
4. **Windows and macOS (ORCH, no port of the engine).** The team core stays POSIX. The worker (`app/worker/` with the core in-process, ARCH §1) runs as a **Linux container** from its first version, not first on the Mac: Docker Desktop on Windows (present on the owner's PC, WSL 2 underneath) and on macOS, and the same image on a server later. ARCH already plans this container for M7; it moves to M2.4. Secrets go to the container's environment or secret file instead of the macOS Keychain. The owner uses Sai through the browser on any system. His local tools (Pixel Office hooks) get the Windows guard of ISS-0132 (fail closed) and nothing more. Real AI runs use the api mode (the owner's paid key, G6, and a cap, G2); the subscription mode `owner-local` is not on the client path.
5. **Local checks in a Linux container (ORCH).** Agents may run the checks inside a Linux container on this PC to find failures early; the evidence of a run stays the GitHub run (decisions/0110). Nothing runs on Windows directly.
6. **Reports.** ORCH reports finished milestones, material problems and decisions that need the owner, not each step.

## Why

The owner wants the development to move without him in the routine. The production site is the only thing visitors see, and only a deploy changes it, so a push to `main` after green checks has no risk for the stable version. A container gives one way to run the worker on Windows, macOS and a server without rewriting the POSIX core, which is the «most rational variant without extra rework».

## Boundary

No deploy, no force-push, no deletion, no real model run and no API key without the owner. The rules of the reference product (decisions/0133 item 3) and the frozen PLAN/ARCHITECTURE (decisions/0091: changes as rows of «Plan amendments») stay.

## Basis

The owner's chat message of 2026-11-23 quoted above; decisions/0048, 0091, 0110, 0127, 0130, 0132, 0133; PLAN §5 M2–M7; ARCHITECTURE §1, §9.
