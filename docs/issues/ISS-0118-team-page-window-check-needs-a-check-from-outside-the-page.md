# ISS-0118 — The window check of the team page spec runs inside the page, so it cannot prove what the person sees and can press in each window (a button not painted, under a box that lets clicks through, shrunk, hidden except its centre, disabled, or drawn over by its own pseudo-element stays green; smooth scrolling gives a false red)

Серьёзность: LOW. Статус: open. Найдено: TEST-FIXER (шаг 07d, issue I2, пробы TF4, TF5, TF6), TEST-DESIGN-VALIDATOR (шаг 07e, находка H1, мутант TV26; issues I1 и I2, мутанты TV24 и TV23), прогон `ISS-0116-20261117-01`, 2026-11-17; решения ORCH `decisions/0114`, Д17 и Д19; заведено DOC-UPDATER (шаг 10), 2026-11-17T15:46:08Z. Пункт планки: Q5 (тест держит критерий и ловит поломку). Требования: REQ-107 (сделано; критерий 7 — «the form button is inside the window»), REQ-011 (страница команды, `tools/src/web/`). Решение: `decisions/0114`, Д17 и Д19 (названные пределы проверки внутри страницы; закрыть их может только проверка снаружи страницы — новое требование или новый дефект, его предлагают владельцу позже).

## Что не так

Test `windows` of `tools/test/e2e/team-web.e2e.js` checks criterion 7 of REQ-107 with the page code `REACH` (lines 1489–1521). It has five parts, each asserted on its own in each window (lines 1553–1565):

- the button lies sideways inside the window before any scroll;
- it is reached with no sideways scroll;
- it is reached with no scroll of a box the person cannot scroll;
- it is inside the window;
- it is what the window shows at its centre.

All five are read inside the page, by the page's own DOM functions, at one moment, in the three windows 1470×784, 390×844 and 320×568. So they prove where the button lies and which element is at its centre. They do not prove what the person sees or can press. The ISS-0116 run recorded these cases as named limits (`decisions/0114`, Д17, Д19), each measured or named:

1. **Not painted.** Opacity 0 on the button or an ancestor (TF4: green), or transparent colours, or a colour equal to the background. The hit test reads elements, not pixels.
2. **Covered by a box that lets clicks through.** An opaque box over the button with `pointer-events: none` (TF5: green). `document.elementFromPoint` skips such a box.
3. **Shrunk.** A transform to 2 percent of its size (TF6: green). The rectangle is still above 0, and the centre is still the button.
4. **Hidden except its centre.** A box or a `clip-path` that hides all of the button except its centre point (named, not measured).
5. **Drawn over by its own pseudo-element.** An opaque box over the whole button drawn by the button's own pseudo-element (TV24: green). `elementFromPoint` counts a pseudo-element as its host.
6. **Disabled in a window.** The page sets `disabled` on `#create` in a window up to 330 px (TV26: green with the run's spec and with the tag's; finding H1). Criterion 7 asks that the button is inside the window, not that it works there.
7. **"Can be scrolled" taken from the computed style only.** A box with `overflow: auto` that the person's wheel or keys cannot reach still counts as one the person can scroll (named, not measured).
8. **One moment and three windows.** The check reads once, right after the list loads. A page that hides or moves the button later, or a window of another size, is not seen. The same limit gives a false red on a benign page: with `scroll-behavior: smooth` and the button 1000 px down at 320 px (TV23), the check is red at «is inside the window». It reads the rectangle before the smooth scroll ends. The tag's file does the same. Today's page has no smooth scrolling and needs no scroll in any of the three windows.
9. **A page that replaces the functions the check calls.** A page that replaces `scrollIntoView`, `getBoundingClientRect`, `getComputedStyle` or `elementFromPoint` can make any reading.

Why LOW: today's page holds criterion 7. All five parts are true in the three windows (steps 07e and 09), and no page today hides, covers, shrinks or disables the button. Each case needs a page change that no test today expects. The check is stronger than before the run (L2 of ISS-0116 is closed).

## Доказательство

- `handoffs/ISS-0116-20261117-01/step-07d-test-fixer.json`, issue I2: TF4, TF5 and TF6 measured green; items 4, 7, 8 and 9 named.
- `handoffs/ISS-0116-20261117-01/step-07e-test-design-validator.json`: finding H1 (TV26), issue I1 (TV24), issue I2 (TV23).
- `decisions/0114`, Д17 and Д19.
- `tools/test/e2e/team-web.e2e.js` (sha256 `61d69de8…`), test `windows` (line 1478), `REACH` and `REACH_PARTS` (lines 1489–1521), the windows and the loop over the parts (lines 1553–1565), read as text at step 10.
- To repeat, only in a fresh clone outside the project and under the safety rules of the run: a temporary home and `SAI_TEAM_HOME` under the temporary root, the trap copy as the only Claude program, `SAI_TEAM_REAL_RUNS` never set (`decisions/0113`, rule R2-T). Apply the probe to the page in `tools/src/web/public/` (for example `opacity: 0` on `#create`, TF4) and run test `windows` alone; it stays green.

## Как исправить

First ORCH decides, with the owner, whether this is a new requirement or a fix of the check (`decisions/0114` Д17: «a new requirement or a new defect, offered to the owner later»). «The person sees the button and can press it in each window» is more than criterion 7 asks, and a threshold (a minimum size, a contrast, a difference of pixels) is a decision. Then TEST-DESIGNER adds a check from outside the page, through the browser protocol:

1. **A real click** at the button in each window, which must start a create: a new project and its journal. The kit already has a protocol click: `page.click` sends `Input.dispatchMouseEvent` to the point it found and refuses a covered element with `CLICK_INTERCEPTED` (`tools/test/e2e/kit/page.js`). Which of items 2, 4, 5, 6 and 9 it closes is measured by the fixer.
2. **A screenshot comparison** of the button's place against the page without the button (or against a reference), with thresholds, for items 1, 3 and 5. The kit has a whole-window PNG screenshot (`page.screenshot`) but no way to compare pixels. Adding one is a change of the kit with its own tests (REQ-104).
3. **A reading after the scroll has settled** (the rectangle the same in two frames in a row), for the false red of item 8. More moments or more window sizes are added only if the owner wants them.

Each new assertion is red on its probe first (TF4, TF5, TF6, TV24, TV26) and green on today's page and on the benign twins (TV17a, TF2v, and TV23 with the settled reading). A weaker check, a skip or a removed part is not a fix (Q6).

## Маршрут

ORCH, with the owner: WF-01 (if it is a new requirement) → WF-03 or WF-02 for TEST-DESIGNER (the spec; BACKEND-DEV for a kit change), with TEST-DESIGN-VALIDATOR (and SECURITY-REVIEWER and REVIEWER for a kit change). Not urgent; on ORCH's order. It can go together with ISS-0114 and ISS-0115 (the same page).
