# 0088 — Requests are reviewed in a list and sent to development by the owner's button behind a password; the customer cabinet comes later

Status: **accepted as the direction** (ORCH, 2026-10-27, by the owner's words in `docs/owner-requests/2026-10-27-request-list-to-development.md`; the owner may cancel any item). The requirements follow from WF-01 run `DEVLAUNCH-20261027-01`; nothing is built by this record.

## Question

After the visitor leaves a request, who takes it into work and how, what does the customer get, and what happens with the Pixel Office the visitor sees?

## Decision

1. **Test mode first.** Now nothing is delivered to a customer: the owner goes through the survey himself and at the end sees the built variant.
2. **No automatic pick-up.** Requests collect in a list on the operator board (REQ-077/078). The owner reads a request, edits it if needed and presses «В разработку». Only this press starts agents.
3. **A check before the start.** The button works only after a password (or an equivalent check) so that tokens are not spent by accident; one development run at a time. The password is never stored in the repository.
4. **Agents build the site** for the request on the owner's computer; where the result is put and how the owner opens it is chosen by REQ-ANALYST and ORCH in the requirements.
5. **Entry point.** The public entry stays the HTML site of the approved sample (`decisions/0083`): pixel, with modern shades.
6. **Later phase (customer cabinet).** After the customer has received the development and accepted it, his personal cabinet shows the Pixel Office with the work on his task. He may submit changes there, but not at once: a change goes to a queue and the owner decides. Everything is multi-tenant: a customer sees only his own company's data.

## What this narrows

- `0073` item 3 and `0074` item 2 ("no route starts development, no stage about development"): the **customer's** routes still start and change nothing. Only the operator board (a local server, secret link and password) may start a development run.
- `0083` item 7 ("the visitor never sees agents' real events"): stays in force for the public survey and the request page; the cabinet of item 6 may show the work on the customer's own task, only through a prepared safe set of data (roles and plain-words steps), never texts of tasks, code, paths or logs.

## Why

The owner wants control over the spending of tokens and a visible whole journey from the request to the built result, without automatic work.

## Boundary

Not a permission to publish on the internet, to spend paid services, or to build before the requirements pass the gates. Does not change done requirement blocks.

## Basis

`docs/owner-requests/2026-10-27-request-list-to-development.md`, `decisions/0073`, `0074`, `0083`, `0084`.
