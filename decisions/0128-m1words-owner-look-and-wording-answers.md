# 0128 — The owner's answers on the look of REQ-113 and on three wording questions; the push of the wording snapshot

Status: **accepted** (the owner's answers, 2026-11-22, the session on the owner's Windows PC, chat; recorded by ORCH).

## Question

REQ-113 (the visitor status block «Что работает сейчас») had passed its tests on GitHub, DESIGN-QA, the acceptance and the
readers (run M1STATUS-20261122-02). Two things were the owner's: (1) gate G21 for the look (REQ-113 criterion 11): he was
shown ten pictures made by a real Chrome on a local copy of the site at commit b25c11e (the folder lies outside the project)
and asked for «похоже» or «не похоже»; (2) three wording questions that came from the reader without context (docs/uat/REQ-113.md,
findings F1, F2 and F3).

The three questions as they were asked in the chat (verbatim):

- «Расшифровать «ТЗ» как «техническое задание»?»
- «Добавить фразу «Способа получить приглашение пока нет.»?»
- «Слово «Принято» оставить как есть?»

## Owner's words (verbatim)

- To the look and to the three questions: «1. Похоже 2. По всем трём вопросам ответ да» (2026-11-22, chat).
- Later the same day, to the question whether the temporary branch `ci/m1-words-1` may be sent to GitHub for the checks:
  «Отправляй в гитхаб» (2026-11-22, chat).

## Options

Each question had two answers («да» or «нет»); the owner could also write «на твоё усмотрение», for which ORCH had named its
defaults (spell out, add the sentence, keep the stage name). He answered each one himself.

## Decision

1. **G21 for the look of REQ-113: «Похоже».** The answer was given on the pictures of the build **before** the wording round
   (commit b25c11e). The wording round changes texts only: one more sentence in the closing paragraph of the block, the long
   form of «ТЗ» in one line, and four English values (among them the mark «Working» for «Works»). Criterion 11 asks that the
   owner is shown the two screens after the build, so ORCH shows him the two screens of the final build after DESIGN-QA has
   measured it and quotes his answer in the gate table of docs/program/public-v1/PROGRESS.md. The release waits for that
   answer.
2. **F1, «ТЗ»: spelled out.** The line under the row title becomes «ИИ-аналитик задаёт вопросы и пишет техническое задание
   (ТЗ).»; the row title keeps the short form.
3. **F2, the invitation: said plainly.** The closing paragraph gains the sentence «Способа получить приглашение пока нет.»
   No contact, form or waiting list is promised: none exists.
4. **F3, «Принято»: stays.** The stage name is not changed. ORCH's reading: the note of stage 1 (`how_stage_1_note`) is not
   changed either, because the owner was asked only about the name and said to leave it as it is.
5. **The push.** The owner's «Отправляй в гитхаб» covered one temporary branch: `ci/m1-words-1`, commit 0c50fc2 (the tree
   of `main` e0a425b with `app/` of commit 4fa85ed). Result: the workflows `check` (run 45031353719) and `app` (run
   45031353708) both finished with success. Every other push, the deploy and the deletion of the temporary branches still wait
   for his word.

The wording changes went through WF-01 (run M1WORDS-20261122-01, gate PASS at pass 2) and the code round of WF-02 (run
M1WORDS-20261122-02).

## Why

The look gate and the words of the public site are the owner's (G21; decisions/0125 item 5 leaves the wording questions of
the reader to him). The exact words of the questions and of the answers were in no file of the project (remark V4 of
handoffs/M1WORDS-20261122-01/step-02-req-validator.json), so they are written here.

## Boundary

This record does not release anything. It does not answer the two older owner questions that stay open (the banner says
«вход по приглашению» although no invitations exist before M2; «4 из 5» is shown for 4.5, decisions/0125 item 5).

## Basis

The owner's chat messages of 2026-11-22 quoted above; docs/uat/REQ-113.md (F1–F3); REQ-113 criterion 11; quality-bar Q12.
