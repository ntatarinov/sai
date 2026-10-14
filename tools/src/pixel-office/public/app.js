// The page of Pixel Office (design 4.6-4.13): the header with the link to the
// server, the line "Сейчас" and the buttons of walking; the office with its
// legend and the card of an agent; the journal with its filters; the panel of
// tasks. Everything is built from one array of journal lines. The page only
// reads: its one network function sends GET. Every text that comes from the
// journal is put into the page as text (textContent), never as markup.
//
// The module touches the world only through the object `env` that it is given
// (document, fetch, clocks, timers, frames, the size of the window), so a test
// can replace all of it.

import {
  MASK_LABEL,
  POLL_MS,
  POLL_TIMEOUT_MS,
  STALE_AFTER_MS,
  parseLine,
} from "./schema.js";
import { ageOf, buildModel, showsAge, showsSessionEvent } from "./model.js";
import { buildHistory } from "./history.js";
import {
  MAIN_KEY,
  bubblesAt,
  buildCard,
  buildOffice,
  roleKey,
} from "./office-model.js";
import { buildInstanceCard, defaultInstance } from "./instance-card.js";
import { createSim } from "./office-sim.js";
import { eventDetails } from "./event-details.js";
import { roleName, shortId } from "./words.js";
import {
  MIN_CELL_PX,
  canvasPoint,
  drawOffice,
  fitCanvas,
  hitOffice,
  labelWidths,
} from "./office-view.js";
import {
  FILTERS,
  TONES,
  filterJournal,
  journalRows,
  nowLine,
  taskPanel,
} from "./panels.js";
import {
  ageText,
  fmtDateTime,
  fmtTime,
  fmtTimeSec,
  tzLabel,
} from "./format.js";
import {
  CANVAS_UNSUPPORTED,
  CARD_CLOSE,
  CARD_EMPTY,
  CARD_HEADINGS,
  CARD_SESSIONS,
  EMPTY_HINT,
  EMPTY_JOURNAL,
  FILTER_LABELS,
  HEADER_BADGE,
  HISTORY_BADGE,
  HISTORY_CLOSE,
  HISTORY_COL_AGENT,
  HISTORY_COL_DOES,
  HISTORY_COL_RESULT,
  HISTORY_COL_TASK,
  HISTORY_EMPTY_CELL,
  HISTORY_ERROR,
  HISTORY_LOADING,
  HISTORY_META_FINISHED,
  HISTORY_META_STARTED,
  HISTORY_NOTE_AUTO,
  HISTORY_NOTE_BY,
  HISTORY_NOTE_MISSING,
  HISTORY_NO_TASKS,
  HISTORY_OPEN,
  HISTORY_SECTION_REQUEST,
  HISTORY_SECTION_TIMELINE,
  HISTORY_SECTION_UNDERSTOOD,
  HISTORY_SECTION_WORK,
  HISTORY_SERVICE,
  HISTORY_TASK_N,
  HISTORY_TEXT_DISABLED,
  HISTORY_TRUNCATED,
  JOURNAL_COUNT,
  JOURNAL_TITLE,
  JOURNAL_ZONE,
  LABEL_ENDED,
  LABEL_FIRST_EVENT,
  LABEL_LAST_EVENT,
  LABEL_STARTED,
  LEGEND_IDLE,
  LEGEND_IDLE_MAIN,
  LEGEND_WORKING,
  LIVE,
  MAIN_ROW,
  NOT_FROM_HOOKS,
  NOW_EMPTY,
  NOW_LIST_LABEL,
  NOW_PREFIX,
  NO_CONNECTION,
  NO_DATA,
  OFFICE_NAME,
  OFFICE_SCROLL_LABEL,
  PAUSE,
  RESUME,
  SECTION_CURRENT,
  SECTION_HISTORY,
  SECTION_STARTS,
  SESSION_RUNNING,
  SESSION_STALE,
  SESSION_WORD,
  SHOWN_NOTE,
  SPEED_LABELS,
  STATE_LABELS,
  AGENT_NOT_RECORDED,
  CARD_BLOCKS,
  CARD_INSTANCE,
  CARD_SESSION,
  COPY,
  COPY_FAIL,
  COPY_LABEL_AGENT,
  COPY_LABEL_SESSION,
  COPY_OK,
  EVENT_TABLE,
  FRESH_LIMIT,
  GIVEN_BY,
  GIVEN_NOTE,
  INSTANCES_COUNT,
  LAST_START,
  LAUNCHER_NO_LINK,
  LAUNCHER_NOT_RECORDED,
  MAIN_LABEL,
  RETURN_NOTE,
  SERVER_STARTED,
  STATE_ROWS,
  TASK_DESC_BY,
  TASK_NO_DESC,
  TASK_NO_LINK,
  TASK_SEVERAL,
  UNKNOWN_ERRORS,
  UNKNOWN_MESSAGES,
  WORKPLACE_DESK,
  WORKPLACE_IDLE,
  WORKPLACE_WORKING,
  DETAIL_LABELS,
  DETAILS_CLOSE,
  SESSION_FULL,
  SESSION_UNKNOWN,
  TASK_NOW,
  TIME_UNKNOWN,
  TASKS_TITLE,
} from "./texts.js";

const API_EVENTS = "/api/events";
const APP_NAME = "sai-pixel-office";
// The model is rebuilt when the data changed and at least this often: the
// mark "future" of the reading rule depends on the clock.
const REFRESH_MS = 10000;
// A frame is never longer than this for the movement: after a pause of the tab
// the characters do not jump.
const MAX_FRAME_SECONDS = 0.05;
// The wide layout (the same thresholds as the @media rule of style.css).
const WIDE_MIN_WIDTH = 1240;
const WIDE_MIN_HEIGHT = 640;
// A list that is not further than this from its bottom stays at the bottom.
const BOTTOM_SLACK = 24;
const SPEED_IDS = Object.freeze([1, 2, 4]);

function fill(template, values) {
  let text = template;
  for (const [name, value] of Object.entries(values)) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
}

function sameStarts(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].time !== b[i].time) return false;
    if (a[i].journal_lines !== b[i].journal_lines) return false;
  }
  return true;
}

// The shape of an answer of the server (design 4.6). A foreign server on this
// port gives a failure, not an empty page.
function validShape(body) {
  return (
    body !== null &&
    typeof body === "object" &&
    body.app === APP_NAME &&
    Number.isInteger(body.lines) &&
    body.lines >= 0 &&
    Number.isInteger(body.from) &&
    body.from >= 0 &&
    Array.isArray(body.events) &&
    Array.isArray(body.server_starts)
  );
}

export function createApp(env) {
  const {
    document,
    fetchFn,
    nowFn,
    setIntervalFn,
    clearIntervalFn,
    setTimeoutFn,
    clearTimeoutFn,
    requestFrameFn,
    AbortControllerCtor,
    viewportFn,
    addResizeListener,
    clipboardFn,
  } = env;

  // The one array of journal lines: element i is line i of the file, null for
  // a line that is not valid. It is changed in place, so there is one array.
  const entries = [];
  let serverStarts = [];
  let model = buildModel(entries, serverStarts, nowFn());
  let office = buildOffice(model);
  let rows = journalRows(model, office);
  let history = buildHistory(model);
  let sim = createSim();
  sim.sync(office);

  let started = false;
  let stopped = false;
  let intervalId = null;
  let inFlight = false;
  // "none" before any answer, "live" while the last poll succeeded, "down"
  // when it failed (design 4.9).
  let link = "none";
  // The first consistent answer has been applied.
  let loaded = false;
  let historyDone = false;
  let lastRebuildAt = -Infinity;
  let filter = "all";
  let paused = false;
  let speed = 1;
  let selectedKey = null;
  // The open card: null, {kind: "main"} or {kind: "instance", key} (REQ-044).
  let card = null;
  // The character whose legend button gets the focus when the card closes
  // (the role of the card shown last).
  let cardReturnKey = null;
  // The caption after "Скопировать": {key, target, ok} or null.
  let copied = null;
  let journalShown = false;
  // The line of the row of the journal whose details are open, or null.
  let journalOpen = null;
  // The list of the rows of "Сейчас" now on the page, or null.
  let nowList = null;
  // The window of history: the key of the open request (null: closed), the
  // time and session of that request (a key that later names another line is
  // an error, not another request), and what opened it: {kind: "journal",
  // index} or {kind: "task", key}.
  let historyKey = null;
  let historyOf = null;
  let historyOpener = null;
  // The buttons "открыть историю запроса" of the panel of tasks by the key of
  // their item, as drawn last.
  const taskButtons = new Map();
  // The legend buttons by the key of the character and the rows of the journal
  // as drawn last: the page finds its own elements without searching the DOM.
  const legendButtons = new Map();
  let journalItems = [];
  let ctx = null;
  let cellPx = MIN_CELL_PX;
  let lastFrameAt = null;
  // The model is rebuilt: modelVersion grows. The office is drawn: drawnVersion
  // takes the version it was drawn from. If they differ at a tick of the
  // polling, no frame has drawn the new model and the page draws it itself.
  let modelVersion = 0;
  let drawnVersion = -1;
  const reported = new Set();
  const els = {};
  let elsReady = false;

  // ------------------------------------------------------------ helpers

  const byId = (id) => document.getElementById(id);

  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.classList.add(className);
    if (text !== undefined) el.textContent = text;
    return el;
  }

  // A data attribute through the attribute and, where there is one, through
  // dataset, so both ways of reading it see the same value.
  function setData(el, name, value) {
    const text = String(value);
    el.setAttribute(`data-${name}`, text);
    if (el.dataset !== undefined && el.dataset !== null) {
      el.dataset[name] = text;
    }
  }

  // One line on the console for each different message: an error that repeats
  // in every frame must not fill the console (design 4.5).
  function reportOnce(what, err) {
    const message = err instanceof Error ? err.message : String(err);
    if (reported.has(`${what}: ${message}`)) return;
    reported.add(`${what}: ${message}`);
    console.error(`Pixel Office: ${what}: ${message}`);
  }

  // The element that has the focus of the keyboard, or null.
  function focusedElement() {
    return document.activeElement ?? null;
  }

  function characterOf(key) {
    return office.characters.find((c) => c.key === key);
  }

  // ------------------------------------------------------------ network

  // The only network function of the page: GET, an address on this server
  // (relative), a limit of POLL_TIMEOUT_MS for the whole request, enforced by
  // our own timer (design 4.6).
  function getJson(url) {
    const controller = new AbortControllerCtor();
    let timer = null;
    const work = (async () => {
      const res = await fetchFn(url, {
        method: "GET",
        signal: controller.signal,
      });
      const ok =
        res.status === undefined ? res.ok === true : res.status === 200;
      if (!ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })();
    // An answer that comes after the limit is of no interest and must not
    // become an unhandled rejection.
    work.catch(() => {});
    const limit = new Promise((_resolve, reject) => {
      timer = setTimeoutFn(() => {
        controller.abort();
        reject(new Error("timeout"));
      }, POLL_TIMEOUT_MS);
    });
    return Promise.race([work, limit]).finally(() => clearTimeoutFn(timer));
  }

  function setLink(state) {
    if (link === state) return;
    link = state;
    guarded("шапка", renderLink);
    // Before the first answer the list of the journal tells about the link.
    if (!loaded) guarded("журнал", renderJournal);
    // The open window of history tells about a lost link.
    if (historyKey !== null) guarded("история", renderHistory);
  }

  // Applies a consistent answer. from = 0: the array is replaced; from =
  // entries.length: the lines are appended. Elements that are not valid lines
  // are kept as null, so the length and the numbers of the lines do not change.
  // Returns true if anything changed.
  function applyAnswer(body) {
    const lines = body.events.map((item) =>
      item === null ? null : parseLine(item),
    );
    const startsNow = body.server_starts.filter(
      (s) => s !== null && typeof s === "object",
    );
    let changed = !sameStarts(serverStarts, startsNow);
    serverStarts = startsNow;
    if (body.from === 0) {
      if (entries.length > 0 || lines.length > 0) changed = true;
      if (entries.length > 0) {
        // The journal was replaced (deleted or cut): the routes of the old one
        // are forgotten and the new one is shown as history.
        sim = createSim();
        sim.setPaused(paused);
        sim.setSpeed(speed);
        historyDone = false;
      }
      entries.length = 0;
    } else if (lines.length > 0) {
      changed = true;
    }
    for (const line of lines) entries.push(line);
    return changed;
  }

  // One request to the server, and, if its answer does not fit the array that
  // the page has, one more at once; the second such answer is a failure.
  async function requestCycle() {
    let misfits = 0;
    for (;;) {
      let body;
      try {
        body = await getJson(`${API_EVENTS}?after=${entries.length}`);
      } catch {
        // The server is not there, did not answer in time, or answered with
        // something that is not JSON: the page keeps what it has.
        setLink("down");
        return;
      }
      if (!validShape(body)) {
        setLink("down");
        return;
      }
      if (body.from === 0 || body.from === entries.length) {
        const changed = applyAnswer(body);
        const first = !loaded;
        loaded = true;
        setLink("live");
        if (changed || first) rebuild(true);
        return;
      }
      misfits += 1;
      if (misfits >= 2) {
        setLink("down");
        return;
      }
    }
  }

  // Polls the server: one request in flight at a time. A call while a request
  // is on its way returns at once.
  async function poll() {
    if (stopped || inFlight) return;
    resolveEls();
    inFlight = true;
    try {
      await requestCycle();
    } catch (err) {
      // A defect of the page itself, not of the network: it is reported once
      // and the polling goes on.
      reportOnce("ошибка опроса", err);
    } finally {
      inFlight = false;
    }
  }

  // ------------------------------------------------------------ the model

  function rebuild(fromAnswer) {
    try {
      const now = nowFn();
      model = buildModel(entries, serverStarts, now);
      office = buildOffice(model);
      rows = journalRows(model, office);
      history = buildHistory(model);
      sim.sync(office);
      sim.enqueue(office.routes, { seen: !historyDone });
      if (fromAnswer) historyDone = true;
      lastRebuildAt = now;
      modelVersion += 1;
    } catch (err) {
      reportOnce("ошибка построения страницы", err);
      return;
    }
    renderAll();
    // After the legend is drawn: the place for the canvas depends on its
    // height (design 4.13).
    guarded("холст", fit);
  }

  function guarded(what, render) {
    try {
      render();
    } catch (err) {
      reportOnce(`ошибка отрисовки: ${what}`, err);
    }
  }

  // All the views are rebuilt from the one model: they cannot disagree. A
  // failure of one of them is reported and does not stop the others.
  function renderAll() {
    guarded("шапка", renderLink);
    guarded("строка «Сейчас»", renderNow);
    guarded("легенда", renderLegend);
    guarded("журнал", renderJournal);
    guarded("задачи", renderTasks);
    guarded("карточка", renderCard);
    guarded("история", renderHistory);
  }

  // ------------------------------------------------------------ header

  function renderLink() {
    if (els.link) setData(els.link, "state", link);
    if (els.linkStatus) {
      let text = "";
      if (link === "live") text = LIVE;
      else if (link === "down") text = NO_CONNECTION;
      els.linkStatus.textContent = text;
    }
  }

  // One row of the block "Сейчас": the name of the role and, for a task with a
  // description, " — " and the description, each as text.
  function nowRowEl(row) {
    const el = make("span", "now-row");
    el.setAttribute("role", "listitem");
    setData(el, "key", row.key);
    setData(el, "kind", row.kind);
    if (row.kind === "main" || row.description === null) {
      el.appendChild(make("span", "now-role", row.text));
    } else {
      el.appendChild(make("span", "now-role", row.role));
      el.appendChild(make("span", "now-sep", " — "));
      el.appendChild(make("span", "now-desc", row.description));
    }
    return el;
  }

  function renderNow() {
    if (!els.now) return;
    if (!loaded) {
      els.now.hidden = true;
      return;
    }
    const line = nowLine(model);
    if (els.nowText) {
      // The list is built anew; its scroll and the focus of the keyboard on it
      // are kept between rebuilds.
      const old = nowList;
      const hadFocus = old !== null && old === focusedElement();
      const scroll = old === null ? 0 : old.scrollTop;
      const label = make("span", "now-label", NOW_PREFIX);
      let body;
      if (line.busy) {
        body = make("span", "now-list");
        body.setAttribute("id", "now-list");
        body.setAttribute("role", "list");
        body.setAttribute("tabindex", "0");
        body.setAttribute("aria-label", NOW_LIST_LABEL);
        for (const row of line.rows) body.appendChild(nowRowEl(row));
      } else {
        body = make("span", "now-empty", line.text.slice(NOW_PREFIX.length));
      }
      els.nowText.replaceChildren(label, body);
      nowList = line.busy ? body : null;
      if (nowList !== null && old !== null) {
        nowList.scrollTop = scroll;
        if (hadFocus) nowList.focus();
      }
    }
    els.now.title = line.title;
    setData(els.now, "busy", line.busy ? "true" : "false");
    setData(els.now, "unconfirmed", line.unconfirmed >= 1 ? "true" : "false");
    els.now.hidden = false;
  }

  function renderControls() {
    if (els.pause) {
      els.pause.textContent = paused ? RESUME : PAUSE;
      els.pause.setAttribute("aria-pressed", paused ? "true" : "false");
    }
    for (const m of SPEED_IDS) {
      const button = els.speeds[m];
      if (button)
        button.setAttribute("aria-pressed", m === speed ? "true" : "false");
    }
  }

  function setPaused(value) {
    paused = value === true;
    sim.setPaused(paused);
    guarded("кнопки", renderControls);
  }

  function setSpeed(m) {
    if (!SPEED_IDS.includes(m)) return;
    speed = m;
    sim.setSpeed(m);
    guarded("кнопки", renderControls);
  }

  // ------------------------------------------------------------ legend

  function legendButton(key) {
    return legendButtons.get(key) ?? null;
  }

  function renderLegend() {
    if (!els.legend) return;
    // The buttons are replaced: the key of the button with the focus is kept,
    // and the new button of the same character gets the focus back.
    const focused = focusedElement();
    let focusKey = null;
    for (const [key, button] of legendButtons) {
      if (button === focused) focusKey = key;
    }
    legendButtons.clear();
    if (!loaded) {
      els.legend.replaceChildren();
      return;
    }
    const items = office.characters.map((c) => {
      const li = make("li", "legend-entry");
      const button = make("button", "legend-item");
      button.setAttribute("type", "button");
      setData(button, "key", c.key);
      setData(button, "state", c.working ? "working" : "idle");
      button.setAttribute(
        "aria-pressed",
        c.key === selectedKey ? "true" : "false",
      );
      const swatch = make("span", "swatch");
      if (c.working) setData(swatch, "color", c.color);
      let state = LEGEND_IDLE;
      if (c.working) state = LEGEND_WORKING;
      else if (c.kind === "main") state = LEGEND_IDLE_MAIN;
      button.appendChild(swatch);
      button.appendChild(make("span", "name", c.full));
      button.appendChild(make("span", "state", state));
      button.addEventListener("click", () => openCard(c.key));
      li.appendChild(button);
      legendButtons.set(c.key, button);
      return li;
    });
    els.legend.replaceChildren(...items);
    if (focusKey !== null) legendButton(focusKey)?.focus();
  }

  // ------------------------------------------------------------ journal

  // The parts of a row of the journal, the same in the journal and in the
  // card: the line of time, "who" and session (and the mark), the words of the
  // event, the description and the caption of a service message. All as text.
  function rowParts(view, into, icon) {
    const meta = make("span", "row-meta");
    const time = fmtTimeSec(view.time);
    meta.appendChild(make("span", "time", time === "" ? TIME_UNKNOWN : time));
    meta.appendChild(make("span", "who", view.who));
    meta.appendChild(
      make(
        "span",
        "session",
        view.session_id === null ? SESSION_UNKNOWN : shortId(view.session_id),
      ),
    );
    if (view.marked) {
      meta.appendChild(make("span", "source", view.source));
      meta.appendChild(make("span", "mark", NOT_FROM_HOOKS));
    }
    if (icon !== null) {
      const mark = make("span", "row-icon", icon);
      mark.setAttribute("aria-hidden", "true");
      meta.appendChild(mark);
    }
    into.appendChild(meta);
    const main = make("span", "row-main");
    main.appendChild(make("span", "event", view.words));
    into.appendChild(main);
    if (view.description !== "") {
      into.appendChild(make("span", "row-desc", view.description));
    }
    if (view.event === "UserPromptSubmit" && view.prompt_kind === "service") {
      into.appendChild(make("span", "history-service", HISTORY_SERVICE));
    }
  }

  function rowItem(view) {
    const li = make("li", "row");
    setData(li, "index", view.index);
    setData(li, "tone", view.tone);
    setData(li, "marked", view.marked ? "true" : "false");
    setData(li, "kind", view.kind);
    return li;
  }

  // A row without details and without buttons: the rows of the card.
  function journalRow(view) {
    const li = rowItem(view);
    rowParts(view, li, null);
    return li;
  }

  // One field of the details: its caption and its value element.
  function detailField(box, name, label) {
    const row = make("div", "detail");
    setData(row, "field", name);
    row.appendChild(make("span", "detail-label", label));
    const value = make("span", "detail-value");
    row.appendChild(value);
    box.appendChild(row);
    return value;
  }

  // An element <details> of the details of an event; its summary takes the
  // focus by the name "part:<part>".
  function detailMore(part, caption, focus, parts) {
    const more = make("details", "detail-more");
    setData(more, "part", part);
    const summary = make("summary", undefined, caption);
    setData(summary, "focus", `part:${part}`);
    more.appendChild(summary);
    focus.set(`part:${part}`, summary);
    parts.set(part, more);
    return more;
  }

  // The details of the open row (REQ-045, criterion 3; design 5.1).
  function detailsOf(index, focus, parts) {
    const box = make("div", "event-details");
    box.setAttribute("id", `event-${index}`);
    const d = eventDetails(model, history, index);
    if (d === null) return box;
    detailField(box, "when", DETAIL_LABELS.when).textContent = d.when;
    detailField(box, "source", DETAIL_LABELS.source).textContent = d.source;
    const session = detailField(box, "session", DETAIL_LABELS.session);
    if (d.session === null) {
      session.textContent = SESSION_UNKNOWN;
    } else {
      session.appendChild(make("span", "session-short", d.session.short));
      const more = detailMore("session", SESSION_FULL, focus, parts);
      more.appendChild(make("span", "full-id", d.session.full));
      session.appendChild(more);
    }
    detailField(box, "agent", DETAIL_LABELS.agent).textContent = d.agent;
    const task = detailField(box, "task", DETAIL_LABELS.task);
    if (d.task.state === null) {
      task.textContent = d.task.text;
    } else {
      task.appendChild(
        make("span", "task-name", `${d.task.text} · ${TASK_NOW}: `),
      );
      const badge = make(
        "span",
        "state-badge",
        STATE_LABELS[d.task.state] ?? d.task.state,
      );
      setData(badge, "state", d.task.state);
      task.appendChild(badge);
    }
    if (d.note !== null) {
      maskedInto(
        detailField(box, "note_text", DETAIL_LABELS.note_text),
        d.note.text,
      ).classList.add("history-note-text");
      if (d.note.req_id !== null) {
        detailField(box, "req", DETAIL_LABELS.req).textContent = d.note.req_id;
      }
      if (d.note.request_time !== null) {
        const value = detailField(
          box,
          "request_time",
          DETAIL_LABELS.request_time,
        );
        const shown = fmtDateTime(d.note.request_time);
        value.appendChild(make("span", undefined, shown || TIME_UNKNOWN));
        if (d.note.auto) value.appendChild(historyAutoMark());
      }
    }
    const what = detailField(box, "what", DETAIL_LABELS.what);
    what.appendChild(make("span", "detail-words", d.words));
    what.appendChild(make("span", "detail-meaning", d.meaning));
    detailField(box, "not_proved", DETAIL_LABELS.not_proved).textContent =
      d.not_proved;
    if (d.mark !== null) {
      detailField(box, "mark", DETAIL_LABELS.mark).textContent = d.mark;
    }
    const tech = detailMore("tech", DETAIL_LABELS.tech, focus, parts);
    const list = make("ul", "detail-tech");
    for (const [key, value] of d.tech) {
      const li = make("li");
      li.appendChild(make("span", "tech-key", `${key}: `));
      li.appendChild(make("span", "tech-value", value));
      list.appendChild(li);
    }
    tech.appendChild(list);
    box.appendChild(tech);
    const close = make("button", "ctl", DETAILS_CLOSE);
    close.classList.add("details-close");
    close.setAttribute("type", "button");
    setData(close, "focus", "close");
    close.addEventListener("click", () => closeEvent(true));
    focus.set("close", close);
    box.appendChild(close);
    return box;
  }

  // A row of the journal panel (REQ-045, design 5.1): the row itself is a
  // button that opens and closes the details of the event under it; a message
  // of the owner with a window has a separate button that opens the window
  // (REQ-008). Returns the row with its focusable elements and its <details>.
  function journalPanelRow(view) {
    const li = rowItem(view);
    const focus = new Map();
    const parts = new Map();
    const open = journalOpen === view.index;
    const toggle = make("button", "row-toggle");
    toggle.setAttribute("type", "button");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-controls", `event-${view.index}`);
    setData(toggle, "focus", "toggle");
    rowParts(view, toggle, open ? "▾" : "▸");
    toggle.addEventListener("click", () => toggleEvent(view.index));
    li.appendChild(toggle);
    focus.set("toggle", toggle);
    const key = `req:${view.index}`;
    if (
      view.event === "UserPromptSubmit" &&
      view.prompt_kind === "owner" &&
      history.byKey.has(key)
    ) {
      li.classList.add("opens-history");
      setData(li, "request", key);
      const button = make("button", "history-open", HISTORY_OPEN);
      button.setAttribute("type", "button");
      setData(button, "request", key);
      setData(button, "focus", "history");
      const opener = { kind: "journal", index: view.index };
      button.addEventListener("click", () => openHistory(key, opener));
      li.appendChild(button);
      focus.set("history", button);
    }
    if (open) li.appendChild(detailsOf(view.index, focus, parts));
    li.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || journalOpen !== view.index) return;
      if (typeof event.preventDefault === "function") event.preventDefault();
      if (typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }
      closeEvent(true);
    });
    return { index: view.index, li, focus, parts };
  }

  function journalNote(reason) {
    const li = make("li", "journal-empty");
    setData(li, "reason", reason);
    if (reason === "empty") {
      li.appendChild(make("span", "empty-title", EMPTY_JOURNAL));
      li.appendChild(make("span", "empty-hint", EMPTY_HINT));
    } else {
      li.textContent = reason === "no-connection" ? NO_CONNECTION : NO_DATA;
    }
    return li;
  }

  // The first row visible from the top: its line and its distance from the
  // top of the visible part.
  function anchorOf(list) {
    const top = list.scrollTop;
    for (const { index, li } of journalItems) {
      if (li.offsetTop + li.offsetHeight > top) {
        return { index, offset: li.offsetTop - top };
      }
    }
    return null;
  }

  // The element with the focus inside a row of the journal: the line of the
  // row and the name of the element, or null.
  function journalFocus() {
    const focused = focusedElement();
    if (focused === null) return null;
    for (const item of journalItems) {
      for (const [name, el] of item.focus) {
        if (el === focused) return { index: item.index, name };
      }
    }
    return null;
  }

  // keep: the line of a row whose place on the screen stays (the open row, or
  // the row just opened or closed); reveal: scroll so that this row is seen.
  function renderJournal(toBottom = false, keep = null, reveal = false) {
    const zone = fill(JOURNAL_ZONE, { tz: tzLabel() });
    const list = els.journal;
    if (!loaded) {
      if (els.journalMeta) els.journalMeta.textContent = zone;
      if (list) {
        list.replaceChildren(
          ...(link === "down" ? [journalNote("no-connection")] : []),
        );
      }
      journalItems = [];
      return;
    }
    const picked = filterJournal(rows, filter);
    if (els.journalMeta) {
      els.journalMeta.textContent =
        zone +
        fill(JOURNAL_COUNT, { n: picked.rows.length, N: picked.matching });
    }
    if (!list) return;
    // A row whose details are open but which is no longer shown closes.
    if (
      journalOpen !== null &&
      !picked.rows.some((view) => view.index === journalOpen)
    ) {
      journalOpen = null;
    }
    const atBottom =
      list.scrollHeight - list.clientHeight - list.scrollTop <= BOTTOM_SLACK;
    const anchor = anchorOf(list);
    const keepIndex = keep ?? journalOpen;
    const kept = journalItems.find((item) => item.index === keepIndex);
    const keptOffset =
      kept === undefined ? null : kept.li.offsetTop - list.scrollTop;
    // The rows are replaced: the element with the focus and the open parts of
    // the details are given back to the new rows.
    const focus = journalFocus();
    const openParts = new Map();
    for (const item of journalItems) {
      if (item.index !== journalOpen) continue;
      for (const [part, el] of item.parts)
        openParts.set(part, el.open === true);
    }
    journalItems = picked.rows.map(journalPanelRow);
    for (const item of journalItems) {
      if (item.index !== journalOpen) continue;
      for (const [part, el] of item.parts) {
        if (openParts.get(part) === true) el.open = true;
      }
    }
    let items = journalItems.map((item) => item.li);
    if (rows.length === 0) items = [journalNote("empty")];
    else if (picked.rows.length === 0) items = [journalNote("filtered")];
    list.replaceChildren(...items);
    const now = journalItems.find((item) => item.index === keepIndex);
    if (!journalShown || toBottom) {
      list.scrollTop = list.scrollHeight;
    } else if (now !== undefined && keptOffset !== null) {
      list.scrollTop = now.li.offsetTop - keptOffset;
    } else if (atBottom || anchor === null) {
      list.scrollTop = list.scrollHeight;
    } else {
      const same = journalItems.find((item) => item.index === anchor.index);
      list.scrollTop =
        same === undefined ? 0 : same.li.offsetTop - anchor.offset;
    }
    if (reveal && now !== undefined) {
      const top = now.li.offsetTop;
      const bottom = top + now.li.offsetHeight;
      if (bottom > list.scrollTop + list.clientHeight) {
        list.scrollTop = Math.min(top, bottom - list.clientHeight);
      } else if (top < list.scrollTop) {
        list.scrollTop = top;
      }
    }
    journalShown = true;
    if (focus !== null) {
      const item = journalItems.find((it) => it.index === focus.index);
      const el = item?.focus.get(focus.name) ?? item?.focus.get("toggle");
      if (el !== undefined) el.focus();
      else list.focus();
    }
  }

  // Opens the details of a row (the details open before close): the focus
  // stays on the row.
  function openEvent(index) {
    journalOpen = index;
    guarded("журнал", () => renderJournal(false, index, true));
    journalItems
      .find((item) => item.index === index)
      ?.focus.get("toggle")
      ?.focus();
  }

  // Closes the open details; focusRow: the focus goes to its row.
  function closeEvent(focusRow) {
    const index = journalOpen;
    if (index === null) return;
    journalOpen = null;
    guarded("журнал", () => renderJournal(false, index, false));
    if (focusRow) {
      journalItems
        .find((item) => item.index === index)
        ?.focus.get("toggle")
        ?.focus();
    }
  }

  function toggleEvent(index) {
    if (journalOpen === index) closeEvent(true);
    else openEvent(index);
  }

  function renderFilters() {
    for (const name of FILTERS) {
      const button = els.filters[name];
      if (button) {
        button.setAttribute("aria-pressed", name === filter ? "true" : "false");
      }
    }
  }

  function setFilter(name) {
    filter = FILTERS.includes(name) ? name : "all";
    guarded("фильтры", renderFilters);
    guarded("журнал", () => renderJournal(true));
  }

  // ------------------------------------------------------------ tasks

  function timeSpan(className, label, iso) {
    const span = make("span", className, fmtTime(iso));
    setData(span, "label", label);
    return span;
  }

  // The age of the last event as a separate span; none if it is unknown.
  function ageSpan(ms) {
    const text = ageText(ms);
    return text === "" ? null : make("span", "age", text);
  }

  // The contents of an item of the list (a task or a row of the main
  // session); the same in the panel and in the card.
  function itemInto(el, item) {
    setData(el, "kind", item.kind);
    setData(el, "key", item.key);
    setData(el, "state", item.state);
    const head = make("div", "item-head");
    let role;
    if (item.kind === "main") {
      role = make("span", "item-role", MAIN_ROW);
      setData(role, "color", 0);
    } else {
      const character = characterOf(roleKey(item.role));
      role = make("span", "item-role", roleName(item.role));
      setData(role, "color", character === undefined ? 0 : character.color);
    }
    head.appendChild(role);
    head.appendChild(
      make("span", "item-state", STATE_LABELS[item.state] ?? item.state),
    );
    el.appendChild(head);
    if (item.kind === "task") {
      el.appendChild(make("span", "item-full", item.role));
      if (typeof item.description === "string" && item.description !== "") {
        el.appendChild(make("span", "item-desc", item.description));
      }
    }
    const time = make("div", "item-time");
    time.appendChild(timeSpan("started", LABEL_STARTED, item.started_at));
    if (showsSessionEvent(item.state)) {
      time.appendChild(
        timeSpan("last-event", LABEL_LAST_EVENT, item.session_last_event_at),
      );
      // After a restart the age says nothing about the work, so none is shown.
      if (showsAge(item.state)) {
        const age = ageSpan(item.age_ms);
        if (age !== null) time.appendChild(age);
      }
    } else if (item.state === "completed") {
      time.appendChild(timeSpan("ended", LABEL_ENDED, item.ended_at));
    }
    time.appendChild(make("span", "session", shortId(item.session_id)));
    el.appendChild(time);
    return el;
  }

  function sessionCard(card) {
    const div = make("div", "session-card");
    setData(div, "session", shortId(card.session_id));
    setData(div, "running", card.running ? "true" : "false");
    if (card.word !== null) {
      setData(div, "word", card.word);
      const badge = make(
        "span",
        "session-badge",
        card.word === "running" ? SESSION_RUNNING : SESSION_STALE,
      );
      setData(badge, "state", card.word);
      div.appendChild(badge);
    }
    const line = make("span", "session-line");
    line.appendChild(make("span", "session-word", SESSION_WORD));
    line.appendChild(make("span", "session-id", shortId(card.session_id)));
    div.appendChild(line);
    const times = make("div", "session-times");
    times.appendChild(
      timeSpan("first-event", LABEL_FIRST_EVENT, card.first_event_at),
    );
    times.appendChild(
      timeSpan("last-event", LABEL_LAST_EVENT, card.last_event_at),
    );
    const age = ageSpan(card.age_ms);
    if (age !== null) times.appendChild(age);
    div.appendChild(times);
    return div;
  }

  function sectionTitle(name, text) {
    const h3 = make("h3", "section-title", text);
    setData(h3, "section", name);
    return h3;
  }

  // An item of the panel of tasks: the contents of itemInto (the same as in the
  // card of an agent) and, last, a separate button that opens the window of
  // the request the item belongs to; the item itself is not a button
  // (REQ-008, design 7.5).
  function panelItem(item) {
    const el = itemInto(make("div", "item"), item);
    const key =
      item.kind === "task"
        ? history.windowOfTask.get(item.key)
        : history.windowOfMainRow.get(item.key);
    if (key === undefined) return el;
    const button = make("button", "history-open", HISTORY_OPEN);
    button.setAttribute("type", "button");
    setData(button, "request", key);
    const opener = { kind: "task", key: item.key };
    button.addEventListener("click", () => openHistory(key, opener));
    el.appendChild(button);
    taskButtons.set(item.key, button);
    return el;
  }

  function renderTasks() {
    const body = els.tasks;
    if (!body) return;
    // The buttons are replaced: the button with the focus gets it back.
    const focused = focusedElement();
    let focusKey = null;
    for (const [key, button] of taskButtons) {
      if (button === focused) focusKey = key;
    }
    taskButtons.clear();
    if (!loaded) {
      body.replaceChildren();
      return;
    }
    const panel = taskPanel(model);
    const out = panel.running.map(sessionCard);
    out.push(sectionTitle("current", SECTION_CURRENT));
    if (panel.current.length === 0) {
      out.push(make("p", "section-empty", NOW_EMPTY));
    }
    for (const item of panel.current) out.push(panelItem(item));
    if (panel.unconfirmed_note !== null) {
      const note = make("p", "unconfirmed-note", panel.unconfirmed_note.text);
      setData(note, "section", "unconfirmed");
      out.push(note);
    }
    out.push(sectionTitle("history", SECTION_HISTORY));
    if (panel.history.length === 0) {
      out.push(make("p", "section-empty", NO_DATA));
    }
    for (const entry of panel.history) {
      out.push(
        entry.kind === "session" ? sessionCard(entry) : panelItem(entry),
      );
    }
    if (panel.total > panel.shown) {
      out.push(
        make(
          "p",
          "tasks-note",
          fill(SHOWN_NOTE, { n: panel.shown, N: panel.total }),
        ),
      );
    }
    out.push(sectionTitle("starts", SECTION_STARTS));
    if (panel.starts.length === 0) {
      out.push(make("p", "section-empty", NO_DATA));
    } else {
      const ul = make("ul", "starts");
      for (const s of panel.starts) {
        ul.appendChild(make("li", undefined, fmtDateTime(s.time)));
      }
      out.push(ul);
    }
    body.replaceChildren(...out);
    if (focusKey !== null) taskButtons.get(focusKey)?.focus();
  }

  // ------------------------------------------------------------ card

  // total: how many items the section has before its limit; when it is more
  // than shown, the note "показано n из N" stands under the list.
  function cardSection(name, heading, items, total = items.length) {
    const section = make("section", "card-section");
    setData(section, "list", name);
    section.appendChild(make("h4", undefined, heading));
    const ul = make("ul");
    if (items.length === 0) ul.appendChild(make("li", "empty", CARD_EMPTY));
    for (const item of items) ul.appendChild(item);
    section.appendChild(ul);
    if (total > items.length) {
      section.appendChild(
        make(
          "p",
          "tasks-note",
          fill(SHOWN_NOTE, { n: items.length, N: total }),
        ),
      );
    }
    return section;
  }

  // The five sections of the card of a role (REQ-007, REQ-042): the card of
  // the main session and the part "Вся роль" of the card of an instance.
  function roleSections(data) {
    const viewByIndex = new Map(rows.map((r) => [r.index, r]));
    return [
      cardSection(
        "in-progress",
        CARD_HEADINGS.in_progress,
        data.in_progress.map((item) => itemInto(make("li", "item"), item)),
      ),
      cardSection(
        "unconfirmed",
        CARD_HEADINGS.unconfirmed,
        data.unconfirmed.map((item) => itemInto(make("li", "item"), item)),
        data.unconfirmed_total,
      ),
      cardSection(
        "recent-completed",
        CARD_HEADINGS.recent_completed,
        data.recent_completed.map((item) => itemInto(make("li", "item"), item)),
      ),
      cardSection(
        "unrecorded",
        CARD_HEADINGS.unrecorded,
        data.unrecorded.map((item) => itemInto(make("li", "item"), item)),
        data.unrecorded_total,
      ),
      cardSection(
        "recent-events",
        CARD_HEADINGS.recent_events,
        data.recent_events
          .map((row) => viewByIndex.get(row.index))
          .filter((view) => view !== undefined)
          .map(journalRow),
      ),
    ];
  }

  // A date and time with seconds, or TIME_UNKNOWN; with the age when asked.
  function whenAge(iso, withAge) {
    const shown = fmtDateTime(iso);
    if (shown === "") return TIME_UNKNOWN;
    if (!withAge) return shown;
    const age = ageText(ageOf(iso, model.now_ms));
    return age === "" ? shown : `${shown} · ${age}`;
  }

  function stateBadge(state) {
    const badge = make("span", "state-badge", STATE_LABELS[state] ?? state);
    setData(badge, "state", state);
    return badge;
  }

  // The words of an act of an agent: a start, a repeated start or a stop.
  function actWords(kind) {
    if (kind === "resume") return EVENT_TABLE.agent_resume.act;
    if (kind === "stop") return EVENT_TABLE.agent_stop.act;
    return EVENT_TABLE.agent_start.act;
  }

  // The card being built: its focusable elements by name and its <details>
  // by part, so the next rebuild can give back the focus and the open parts.
  let cardFocus = new Map();
  let cardParts = new Map();
  let cardBody = null;

  function focusable(el, name) {
    setData(el, "focus", name);
    cardFocus.set(name, el);
    return el;
  }

  function cardButton(className, text, name, onClick) {
    const button = make("button", className, text);
    button.setAttribute("type", "button");
    focusable(button, name);
    button.addEventListener("click", onClick);
    return button;
  }

  function cardMore(part, caption) {
    const more = make("details", "card-more");
    setData(more, "part", part);
    more.appendChild(focusable(make("summary", undefined, caption), part));
    cardParts.set(part, more);
    return more;
  }

  function blockTitle(text) {
    return make("h4", "card-block", text);
  }

  function copyRow(data, target) {
    const row = make("div", "copy-row");
    setData(row, "target", target);
    row.appendChild(
      make(
        "span",
        "copy-label",
        target === "agent" ? CARD_INSTANCE : CARD_SESSION,
      ),
    );
    row.appendChild(
      make(
        "span",
        "full-id",
        target === "agent" ? data.agent.full : data.session.full,
      ),
    );
    const button = cardButton("ctl", COPY, `copy-${target}`, () => {
      copyId(target);
    });
    button.classList.add("copy");
    button.setAttribute(
      "aria-label",
      target === "agent" ? COPY_LABEL_AGENT : COPY_LABEL_SESSION,
    );
    row.appendChild(button);
    if (
      copied !== null &&
      copied.key === data.key &&
      copied.target === target
    ) {
      const result = make(
        "span",
        "copy-result",
        copied.ok ? COPY_OK : COPY_FAIL,
      );
      setData(result, "ok", copied.ok ? "true" : "false");
      row.appendChild(result);
    }
    return row;
  }

  function cardHead(data) {
    const head = make("div", "card-head");
    const swatch = make("span", "card-swatch");
    setData(swatch, "color", data.color);
    const title = make("h3", "card-title", data.title);
    title.setAttribute("id", "card-title");
    head.appendChild(swatch);
    head.appendChild(title);
    if (data.code !== null)
      head.appendChild(make("span", "card-code", data.code));
    const idsLine = make("p", "card-ids");
    idsLine.appendChild(make("span", undefined, `${CARD_INSTANCE} `));
    idsLine.appendChild(make("b", "card-id", data.agent.short));
    idsLine.appendChild(make("span", undefined, ` · ${CARD_SESSION} `));
    idsLine.appendChild(make("b", "card-id", data.session.short));
    head.appendChild(idsLine);
    const more = cardMore("ids", CARD_BLOCKS.ids);
    more.appendChild(copyRow(data, "agent"));
    more.appendChild(copyRow(data, "session"));
    head.appendChild(more);
    if (link === "down")
      head.appendChild(make("p", "card-offline", NO_CONNECTION));
    return head;
  }

  // One of the three lines of "Состояние": its caption, its value and the
  // lines of its basis.
  function stateRow(name, value, basis) {
    const row = make("div", "state-row");
    setData(row, "row", name);
    row.appendChild(make("span", "state-label", STATE_ROWS[name]));
    const first = make("span", "state-value");
    if (typeof value === "string") first.textContent = value;
    else first.appendChild(value);
    row.appendChild(first);
    for (const line of basis)
      row.appendChild(make("span", "state-basis", line));
    return row;
  }

  function taskBasis(st) {
    const out = [];
    if (showsAge(st.state)) {
      const minutes = String(STALE_AFTER_MS / 60000);
      const time = whenAge(st.session_last_event_at, true);
      out.push(
        `${LABEL_LAST_EVENT} ${time} · ${FRESH_LIMIT.split("{m}").join(minutes)}`,
      );
      if (st.last_start !== null) {
        out.push(
          `${actWords(st.last_start.kind)} · ${whenAge(st.last_start.at, false)}`,
        );
      }
    } else if (st.state === "restarted") {
      out.push(
        SERVER_STARTED.split("{time}").join(whenAge(st.server_start_at, false)),
      );
    } else if (st.state === "completed") {
      out.push(`${EVENT_TABLE.agent_stop.act} · ${whenAge(st.stop_at, false)}`);
    } else if (st.state === "unrecorded") {
      out.push(
        `${EVENT_TABLE.session_end.words} · ${whenAge(st.session_end_at, false)}`,
      );
    }
    return out;
  }

  function instanceButton(item, name, how) {
    const button = cardButton("instance", undefined, name, () =>
      openInstance(item.key, how),
    );
    setData(button, "key", item.key);
    if (item.current === true) button.setAttribute("aria-current", "true");
    const head = make("span", "instance-head");
    head.appendChild(make("span", "instance-id", item.short));
    head.appendChild(stateBadge(item.state));
    button.appendChild(head);
    let time = `${LAST_START} ${whenAge(item.last_start_at, false)}`;
    if (item.session_last_event_at !== null) {
      time += ` · ${LABEL_LAST_EVENT} ${whenAge(
        item.session_last_event_at,
        false,
      )}`;
      const age = ageText(item.age_ms);
      if (age !== "") time += ` · ${age}`;
    }
    button.appendChild(make("span", "instance-time", time));
    button.appendChild(
      make("span", "instance-desc", item.description ?? TASK_NO_DESC),
    );
    return button;
  }

  function instanceColumn(data) {
    const section = make("section", "card-instance");
    section.appendChild(blockTitle(CARD_BLOCKS.task));
    const t = data.current_task;
    if (t.kind === "described") {
      section.appendChild(make("p", "task-desc", t.text));
      section.appendChild(make("p", "task-note", TASK_DESC_BY));
    } else {
      const text =
        t.kind === "several"
          ? TASK_SEVERAL
          : t.kind === "no_link"
            ? TASK_NO_LINK
            : TASK_NO_DESC;
      section.appendChild(make("p", "task-none", text));
    }
    section.appendChild(blockTitle(CARD_BLOCKS.state));
    const st = data.task_state;
    section.appendChild(stateRow("task", stateBadge(st.state), taskBasis(st)));
    const ev = data.agent_event;
    section.appendChild(
      stateRow(
        "agent",
        ev === null
          ? TIME_UNKNOWN
          : `${actWords(ev.kind)} · ${whenAge(ev.at, true)}`,
        [AGENT_NOT_RECORDED],
      ),
    );
    section.appendChild(
      stateRow(
        "workplace",
        data.workplace.working
          ? WORKPLACE_WORKING.split("{n}").join(String(data.workplace.count))
          : WORKPLACE_IDLE,
        [WORKPLACE_DESK],
      ),
    );
    section.appendChild(blockTitle(CARD_BLOCKS.launcher));
    const l = data.launcher;
    if (l.kind === "subagent" && l.has_task) {
      const button = cardButton(
        "card-link",
        `${l.name} · ${l.short}`,
        "launcher",
        () => openInstance(l.key, "link"),
      );
      setData(button, "key", l.key);
      section.appendChild(button);
    } else {
      let text = MAIN_LABEL;
      if (l.kind === "subagent")
        text = `${l.name} · ${l.short} — ${LAUNCHER_NOT_RECORDED}`;
      else if (l.kind === "none") {
        text = l.reason === "several" ? TASK_SEVERAL : LAUNCHER_NO_LINK;
      }
      section.appendChild(make("p", "card-launcher", text));
    }
    section.appendChild(make("p", "card-unknown", UNKNOWN_MESSAGES));
    section.appendChild(make("p", "card-unknown", UNKNOWN_ERRORS));
    return section;
  }

  function instancesColumn(data) {
    const section = make("section", "card-instances");
    const title = blockTitle(CARD_BLOCKS.instances);
    title.appendChild(
      make(
        "span",
        "card-count",
        INSTANCES_COUNT.split("{N}").join(String(data.instances.total)),
      ),
    );
    section.appendChild(title);
    const list = (items) => {
      const ul = make("ul", "instances");
      for (const item of items) {
        const li = make("li");
        li.appendChild(instanceButton(item, `instance:${item.key}`, "switch"));
        ul.appendChild(li);
      }
      return ul;
    };
    section.appendChild(list(data.instances.shown));
    if (data.instances.rest.length > 0) {
      section.appendChild(
        make(
          "p",
          "tasks-note",
          fill(SHOWN_NOTE, {
            n: data.instances.shown.length,
            N: data.instances.total,
          }),
        ),
      );
      const more = cardMore("more", CARD_BLOCKS.more);
      more.appendChild(list(data.instances.rest));
      section.appendChild(more);
    }
    return section;
  }

  function emptyLine() {
    return make("p", "card-empty", CARD_EMPTY);
  }

  function instanceParts(data) {
    const given = cardMore("given", CARD_BLOCKS.given);
    if (data.given.length === 0) given.appendChild(emptyLine());
    for (const g of data.given) {
      const item = make("div", "card-entry");
      const by =
        g.by.kind === "main" ? MAIN_LABEL : `${g.by.name} · ${g.by.short}`;
      item.appendChild(
        make(
          "span",
          "entry-line",
          `${whenAge(g.at, false)} · ${GIVEN_BY}${by}`,
        ),
      );
      item.appendChild(
        make("span", "entry-desc", g.description ?? TASK_NO_DESC),
      );
      item.appendChild(make("span", "entry-note", GIVEN_NOTE));
      given.appendChild(item);
    }
    const starts = cardMore("starts", CARD_BLOCKS.starts);
    if (data.starts.length === 0) starts.appendChild(emptyLine());
    for (const st of data.starts) {
      starts.appendChild(
        make(
          "p",
          "entry-line",
          `${actWords(st.kind)} · ${whenAge(st.at, false)}`,
        ),
      );
    }
    const returns = cardMore("returns", CARD_BLOCKS.returns);
    if (data.returns.length === 0) {
      const line = make("p", "entry-line");
      line.appendChild(stateBadge(data.task_state.state));
      returns.appendChild(line);
    }
    for (const r of data.returns) {
      returns.appendChild(
        make(
          "p",
          "entry-line",
          `${EVENT_TABLE.agent_stop.act}${RETURN_NOTE} · ${whenAge(r.at, false)}`,
        ),
      );
    }
    const launched = cardMore("launched", CARD_BLOCKS.launched);
    if (data.launched.length === 0) launched.appendChild(emptyLine());
    for (const item of data.launched) {
      if (item.has_task) {
        const button = cardButton(
          "instance",
          undefined,
          `launched:${item.key}`,
          () => openInstance(item.key, "link"),
        );
        setData(button, "key", item.key);
        const head = make("span", "instance-head");
        head.appendChild(
          make("span", "instance-id", `${item.name} · ${item.short}`),
        );
        head.appendChild(stateBadge(item.state));
        button.appendChild(head);
        launched.appendChild(button);
      } else {
        launched.appendChild(
          make("p", "entry-line", `${item.name} · ${item.short}`),
        );
      }
    }
    const role = cardMore("role", CARD_BLOCKS.role);
    if (data.role_card !== null) {
      for (const section of roleSections(data.role_card)) {
        role.appendChild(section);
      }
    }
    return [given, starts, returns, launched, role];
  }

  // The new contents of the card, built whole before anything is replaced; null
  // when what the card showed is gone from the model.
  function buildCardTree() {
    if (card === null) return null;
    const close = make("button", "card-close", "×");
    close.setAttribute("type", "button");
    close.setAttribute("aria-label", CARD_CLOSE);
    focusable(close, "close");
    close.addEventListener("click", () => closeCard());
    const body = make("div", "card-body");
    if (card.kind === "main") {
      const data = buildCard(model, office, MAIN_KEY);
      if (data === null) return null;
      const head = make("div", "card-head");
      const swatch = make("span", "card-swatch");
      setData(swatch, "color", data.color);
      const title = make("h3", "card-title", data.full);
      title.setAttribute("id", "card-title");
      head.appendChild(swatch);
      head.appendChild(title);
      body.appendChild(head);
      body.appendChild(
        make(
          "span",
          "card-working",
          `${CARD_SESSIONS}${data.sessions_running}`,
        ),
      );
      for (const section of roleSections(data)) body.appendChild(section);
      return { close, body, kind: "main", columns: "1" };
    }
    const data = buildInstanceCard(model, office, card.key);
    if (data === null) return null;
    body.appendChild(cardHead(data));
    const columns = make("div", "card-columns");
    columns.appendChild(instanceColumn(data));
    if (data.instances.total > 1) columns.appendChild(instancesColumn(data));
    body.appendChild(columns);
    for (const part of instanceParts(data)) body.appendChild(part);
    return {
      close,
      body,
      kind: "instance",
      columns: data.instances.total > 1 ? "2" : "1",
    };
  }

  // Draws the card again from the model (design 6.2): the open parts, the
  // element with the focus and the scroll of the body are kept, unless `fresh`
  // says what to reset: {parts: null | Set of parts to close, focus, scrollTop}.
  function renderCard(fresh = null) {
    const overlay = els.overlay;
    const el = els.card;
    if (!overlay || !el) return;
    const focused = focusedElement();
    let focusName = null;
    for (const [name, item] of cardFocus)
      if (item === focused) focusName = name;
    const openParts = new Map();
    for (const [part, details] of cardParts)
      openParts.set(part, details.open === true);
    const scroll = cardBody === null ? 0 : cardBody.scrollTop;
    const oldFocus = cardFocus;
    const oldParts = cardParts;
    cardFocus = new Map();
    cardParts = new Map();
    let tree;
    try {
      tree = buildCardTree();
    } catch (err) {
      // What was drawn stays on the screen.
      cardFocus = oldFocus;
      cardParts = oldParts;
      throw err;
    }
    if (tree === null) {
      const hadCard = card !== null;
      const focusInside = focusName !== null;
      card = null;
      copied = null;
      cardFocus = new Map();
      cardParts = new Map();
      cardBody = null;
      el.replaceChildren();
      overlay.hidden = true;
      if (hadCard) {
        // What the card showed is gone: the choice is dropped too.
        selectedKey = null;
        releaseModal();
        if (focusInside) returnFocus();
        cardReturnKey = null;
      }
      return;
    }
    setData(el, "kind", tree.kind);
    setData(el, "columns", tree.columns);
    el.replaceChildren(tree.close, tree.body);
    cardBody = tree.body;
    els.cardClose = tree.close;
    for (const [part, details] of cardParts) {
      const keepOpen =
        fresh === null
          ? openParts.get(part) === true
          : fresh.parts !== null &&
            !fresh.parts.has(part) &&
            openParts.get(part) === true;
      if (keepOpen) details.open = true;
    }
    overlay.hidden = false;
    if (fresh === null) {
      cardBody.scrollTop = scroll;
      if (focusName !== null) (cardFocus.get(focusName) ?? tree.close).focus();
    } else {
      cardBody.scrollTop = 0;
      (cardFocus.get(fresh.focus) ?? tree.close).focus();
    }
  }

  function setModal() {
    pageBody()?.setAttribute("data-modal", "card");
  }

  function releaseModal() {
    if (historyKey === null) pageBody()?.removeAttribute("data-modal");
  }

  // The focus after the card closes: the legend button of the role of the
  // card shown last, else the scrolling area of the office.
  function returnFocus() {
    const button = cardReturnKey === null ? null : legendButton(cardReturnKey);
    if (button !== null) button.focus();
    else els.officeScroll?.focus();
  }

  // Selects a character (its frame on the canvas, its legend button pressed)
  // and opens its card: the card of the main session or of the default
  // instance of the role. A key without a character or without an instance
  // closes the card and drops the choice.
  function openCard(key) {
    resolveEls();
    let next = null;
    if (key !== null && key !== undefined && characterOf(key) !== undefined) {
      if (key === MAIN_KEY) next = { kind: "main" };
      else {
        const instance = defaultInstance(model, key);
        if (instance !== null) next = { kind: "instance", key: instance };
      }
    }
    copied = null;
    if (next === null) {
      const wasOpen = card !== null;
      selectedKey = null;
      card = null;
      guarded("легенда", renderLegend);
      guarded("карточка", () => renderCard());
      if (wasOpen) releaseModal();
      cardReturnKey = null;
      return;
    }
    selectedKey = key;
    cardReturnKey = key;
    card = next;
    cardParts = new Map();
    setModal();
    guarded("легенда", renderLegend);
    guarded("карточка", () =>
      renderCard({ parts: null, focus: "close", scrollTop: 0 }),
    );
  }

  // Shows another instance in the open card (design 6.4): "switch" from the
  // list of the instances of the role keeps the open parts of the role and the
  // focus on the pressed item; "link" is like a new opening.
  function openInstance(taskKey, how) {
    const task = model.tasks.find((t) => t.key === taskKey);
    if (task === undefined) return;
    const roleChanged = selectedKey !== roleKey(task.role);
    selectedKey = roleKey(task.role);
    cardReturnKey = selectedKey;
    card = { kind: "instance", key: taskKey };
    copied = null;
    if (roleChanged) guarded("легенда", renderLegend);
    guarded("карточка", () =>
      renderCard(
        how === "switch"
          ? {
              parts: new Set(["ids", "given", "starts", "returns", "launched"]),
              focus: `instance:${taskKey}`,
              scrollTop: 0,
            }
          : { parts: null, focus: "close", scrollTop: 0 },
      ),
    );
  }

  // Copies the full identifier of the instance (design 6.4): only the value,
  // one call of writeText; no clipboard, a refusal or an exception is a
  // failure, and the value stays on the screen.
  async function copyId(target) {
    if (card === null || card.kind !== "instance") return;
    const key = card.key;
    const data = buildInstanceCard(model, office, key);
    if (data === null) return;
    const value = target === "agent" ? data.agent.full : data.session.full;
    let ok = false;
    try {
      const clip = typeof clipboardFn === "function" ? clipboardFn() : null;
      if (
        clip !== null &&
        typeof clip === "object" &&
        typeof clip.writeText === "function"
      ) {
        await clip.writeText(value);
        ok = true;
      }
    } catch {
      // The clipboard refused: the person selects the value by hand.
      ok = false;
    }
    copied = { key, target, ok };
    if (card !== null && card.kind === "instance" && card.key === key) {
      guarded("карточка", () => renderCard());
    }
  }

  function selectCharacter(key) {
    openCard(key);
  }

  // Closes the card; the character stays selected. The focus goes to the
  // legend button of the role of the card (opened by the legend or the
  // canvas), else to the scrolling area of the office.
  function closeCard() {
    resolveEls();
    if (card === null) return;
    card = null;
    copied = null;
    guarded("карточка", () => renderCard());
    releaseModal();
    returnFocus();
    cardReturnKey = null;
  }

  // The controls of the card for Tab (design 6.3): every button and summary in
  // the order of the tree, except the contents of a closed <details> (its own
  // summary counts) and hidden elements.
  function cardControls() {
    const out = [];
    const walk = (node) => {
      for (const child of Array.from(node.children ?? [])) {
        if (child.hidden === true) continue;
        const tag = String(child.tagName).toUpperCase();
        if (tag === "BUTTON" || tag === "SUMMARY") {
          out.push(child);
          continue;
        }
        if (tag === "DETAILS" && child.open !== true) {
          const summary = Array.from(child.children ?? []).find(
            (c) => String(c.tagName).toUpperCase() === "SUMMARY",
          );
          if (summary !== undefined) out.push(summary);
          continue;
        }
        walk(child);
      }
    };
    if (els.card) walk(els.card);
    return out;
  }

  function cycleCardFocus(back) {
    const controls = cardControls();
    if (controls.length === 0) return;
    const at = controls.indexOf(focusedElement());
    let next;
    if (at === -1) next = back ? controls.length - 1 : 0;
    else next = (at + (back ? -1 : 1) + controls.length) % controls.length;
    controls[next].focus();
  }

  // ------------------------------------------------------------ history

  // The body element of the page: the attribute data-modal on it stops the
  // page under the window from scrolling (a style attribute is not used).
  function pageBody() {
    return document.body ?? els.historyOverlay?.parentNode ?? null;
  }

  // A text of the journal with every label "[скрыто]" in its own span; all of
  // it as text, never as markup.
  function maskedInto(el, text) {
    const parts = text.split(MASK_LABEL);
    parts.forEach((part, k) => {
      if (k > 0) el.appendChild(make("span", "history-masked", MASK_LABEL));
      if (part !== "") el.appendChild(make("span", undefined, part));
    });
    return el;
  }

  function historyState(state) {
    const span = make("span", "history-state", STATE_LABELS[state] ?? state);
    setData(span, "state", state);
    return span;
  }

  function historyAutoMark() {
    return make("span", "history-auto", ` · ${HISTORY_NOTE_AUTO}`);
  }

  function historySection(name, heading) {
    const section = make("section", "history-section");
    setData(section, "section", name);
    section.appendChild(make("h3", "history-heading", heading));
    return section;
  }

  function historyMeta(request) {
    const meta = make("p", "history-meta");
    meta.appendChild(historyState(request.state));
    meta.appendChild(make("span", undefined, " · "));
    meta.appendChild(
      make(
        "span",
        "history-started",
        `${HISTORY_META_STARTED} ${fmtDateTime(request.started_at)}`,
      ),
    );
    // Without a Stop the words of the state already stand first: "finished"
    // would be false for a request still in work, and repeating the state
    // adds nothing.
    if (request.finished_at !== null) {
      meta.appendChild(make("span", undefined, " · "));
      meta.appendChild(
        make(
          "span",
          "history-finished",
          `${HISTORY_META_FINISHED} ${fmtDateTime(request.finished_at)}`,
        ),
      );
    }
    return meta;
  }

  function requestSection(request) {
    if (request.text === null) {
      const line = make("p", "history-disabled", HISTORY_TEXT_DISABLED);
      setData(line, "section", "request");
      return line;
    }
    const section = historySection("request", HISTORY_SECTION_REQUEST);
    section.appendChild(maskedInto(make("div", "history-quote"), request.text));
    if (request.truncated) {
      section.appendChild(
        make(
          "p",
          "history-truncated",
          fill(HISTORY_TRUNCATED, { n: Array.from(request.text).length }),
        ),
      );
    }
    return section;
  }

  function understoodSection(request) {
    const section = historySection("understood", HISTORY_SECTION_UNDERSTOOD);
    const note = request.note;
    if (note === null) {
      section.appendChild(make("p", "history-missing", HISTORY_NOTE_MISSING));
      return section;
    }
    const by = make("p", "history-by");
    by.appendChild(
      make("span", undefined, `${HISTORY_NOTE_BY} · ${fmtTimeSec(note.time)}`),
    );
    if (note.auto) {
      by.appendChild(historyAutoMark());
    }
    section.appendChild(by);
    section.appendChild(maskedInto(make("div", "history-quote"), note.text));
    return section;
  }

  // A cell of the table with the caption of its column, shown only when the
  // table is a stack of cards in a narrow window.
  function historyCell(column, value, className) {
    const td = make("td");
    setData(td, "column", column);
    td.appendChild(make("span", "history-cell-label", column));
    td.appendChild(make("span", className, value));
    return td;
  }

  function resultOf(task) {
    let text = `${LABEL_STARTED} ${fmtTime(task.started_at)}`;
    if (task.state === "completed") {
      text += ` · ${LABEL_ENDED} ${fmtTime(task.ended_at)}`;
    } else if (showsSessionEvent(task.state)) {
      text += ` · ${LABEL_LAST_EVENT} ${fmtTime(task.session_last_event_at)}`;
    }
    return text;
  }

  function workSection(request) {
    const section = historySection("work", HISTORY_SECTION_WORK);
    if (request.tasks.length === 0) {
      section.appendChild(make("p", "history-none", HISTORY_NO_TASKS));
      return section;
    }
    const table = make("table", "history-table");
    const head = make("thead");
    const headRow = make("tr");
    for (const column of [
      HISTORY_COL_TASK,
      HISTORY_COL_AGENT,
      HISTORY_COL_DOES,
      HISTORY_COL_RESULT,
    ]) {
      headRow.appendChild(make("th", undefined, column));
    }
    head.appendChild(headRow);
    table.appendChild(head);
    const bodyRows = make("tbody");
    for (const task of request.tasks) {
      const tr = make("tr");
      setData(tr, "key", task.key);
      setData(tr, "state", task.state);
      const first = make("td");
      first.appendChild(
        make("span", "history-task", fill(HISTORY_TASK_N, { n: task.ordinal })),
      );
      first.appendChild(historyState(task.state));
      tr.appendChild(first);
      tr.appendChild(historyCell(HISTORY_COL_AGENT, task.role, "history-role"));
      tr.appendChild(
        task.description === null
          ? historyCell(HISTORY_COL_DOES, HISTORY_EMPTY_CELL, "history-empty")
          : historyCell(HISTORY_COL_DOES, task.description, "history-does"),
      );
      tr.appendChild(
        historyCell(HISTORY_COL_RESULT, resultOf(task), "history-result"),
      );
      bodyRows.appendChild(tr);
    }
    table.appendChild(bodyRows);
    section.appendChild(table);
    return section;
  }

  function timelineSection(request) {
    const section = historySection("timeline", HISTORY_SECTION_TIMELINE);
    const list = make("ol", "history-timeline");
    for (const item of request.timeline) {
      const li = make("li", "history-event");
      setData(li, "kind", item.kind);
      const kind = model.entries[item.index]?.hook_event_name;
      setData(
        li,
        "tone",
        item.kind === "note" ? "note" : (TONES[kind] ?? "session"),
      );
      const line = make("span", "history-event-line");
      line.appendChild(make("span", "time", fmtTimeSec(item.time)));
      line.appendChild(make("span", undefined, " · "));
      line.appendChild(make("span", "who", item.who));
      line.appendChild(make("span", undefined, " — "));
      if (item.kind === "note" && item.auto === true) {
        line.appendChild(make("span", "what", HISTORY_NOTE_BY));
        line.appendChild(historyAutoMark());
      } else {
        line.appendChild(make("span", "what", item.what));
      }
      li.appendChild(line);
      if (item.detail !== null) {
        li.appendChild(
          item.kind === "note"
            ? maskedInto(make("span", "history-note-text"), item.detail)
            : make("span", "history-detail", item.detail),
        );
      }
      list.appendChild(li);
    }
    section.appendChild(list);
    return section;
  }

  // The request that the window shows, or null when it is gone from the data
  // or its key now names another line.
  function openRequest() {
    const request = history.byKey.get(historyKey);
    if (request === undefined || historyOf === null) return null;
    if (
      request.time !== historyOf.time ||
      request.session_id !== historyOf.session_id
    ) {
      return null;
    }
    return request;
  }

  // Draws the open window again from the model; the scroll position of the
  // body is kept, "×" and the body are not replaced, so the focus stays.
  function renderHistory() {
    const body = els.historyBody;
    if (!body || historyKey === null) return;
    const top = body.scrollTop;
    const out = [make("span", "history-badge", HISTORY_BADGE)];
    const request = loaded ? openRequest() : null;
    if (!loaded) {
      const line = make("p", "history-loading", HISTORY_LOADING);
      line.setAttribute("id", "history-title");
      out.push(line);
    } else if (request === null) {
      const line = make("p", "history-error", HISTORY_ERROR);
      line.setAttribute("id", "history-title");
      out.push(line);
    } else {
      const title = make("h2", "history-title", request.title);
      title.setAttribute("id", "history-title");
      out.push(title, historyMeta(request));
      if (link === "down") {
        out.push(make("p", "history-offline", NO_CONNECTION));
      }
      out.push(
        requestSection(request),
        understoodSection(request),
        workSection(request),
        timelineSection(request),
      );
    }
    body.replaceChildren(...out);
    body.scrollTop = top;
  }

  // Opens the window of a request. Only one window is open at a time: an
  // open card of an agent closes first (the choice of the character stays,
  // the focus is not given back to it).
  function openHistory(key, opener) {
    resolveEls();
    if (!els.historyOverlay || !els.historyBody) return;
    const request = history.byKey.get(key);
    if (request === undefined) return;
    if (card !== null) {
      card = null;
      copied = null;
      cardReturnKey = null;
      guarded("карточка", () => renderCard());
    }
    historyKey = key;
    historyOf = { time: request.time, session_id: request.session_id };
    historyOpener = opener ?? null;
    els.historyBody.scrollTop = 0;
    guarded("история", renderHistory);
    els.historyOverlay.hidden = false;
    pageBody()?.setAttribute("data-modal", "history");
    els.historyClose?.focus();
  }

  // The element that opened the window, found again after the panels were
  // drawn anew; else the list of the journal.
  function historyOpenerElement() {
    const opener = historyOpener;
    if (opener !== null && opener.kind === "journal") {
      const row = journalItems.find((item) => item.index === opener.index);
      const button = row?.focus.get("history");
      if (button !== undefined) return button;
    } else if (opener !== null && opener.kind === "task") {
      const button = taskButtons.get(opener.key);
      if (button !== undefined) return button;
    }
    return els.journal ?? null;
  }

  function closeHistory() {
    resolveEls();
    if (historyKey === null) return;
    historyKey = null;
    historyOf = null;
    if (els.historyOverlay) els.historyOverlay.hidden = true;
    els.historyBody?.replaceChildren();
    pageBody()?.removeAttribute("data-modal");
    historyOpenerElement()?.focus();
    historyOpener = null;
  }

  // ------------------------------------------------------------ the office

  // The rectangle of an element, or null when there is none or it is empty.
  function rectOf(el) {
    if (typeof el.getBoundingClientRect !== "function") return null;
    const r = el.getBoundingClientRect();
    const ok =
      r !== null &&
      typeof r === "object" &&
      Number.isFinite(r.width) &&
      Number.isFinite(r.height) &&
      Number.isFinite(r.top) &&
      Number.isFinite(r.bottom) &&
      r.width > 0 &&
      r.height > 0;
    return ok ? r : null;
  }

  // The place for the canvas and its size: a whole number of pixels per cell,
  // not less than MIN_CELL_PX (design 4.13, 4.15, 8). Width and height are
  // attributes of the canvas, not a style. The gap above the legend is read
  // from the scroll area of the canvas: a scrolled canvas may reach below it.
  function fit() {
    const canvas = els.office;
    const holder = els.officeScroll ?? canvas;
    const inner = els.officeInner;
    if (!ctx || !canvas || !inner) return;
    const view = typeof viewportFn === "function" ? viewportFn() : null;
    const wide =
      view === null ||
      (view.width >= WIDE_MIN_WIDTH && view.height >= WIDE_MIN_HEIGHT);
    // At a scale above 1 the panel has fractional sizes: the rectangles are
    // read first (design 4.14, rule 5); the whole-number sizes are the way
    // out for an element that has no rectangle.
    const box = rectOf(inner);
    const legendBox = els.legend ? rectOf(els.legend) : null;
    const canvasBox = box ? rectOf(holder) : null;
    const byRect =
      box !== null &&
      (els.legend === null || (legendBox !== null && canvasBox !== null));
    const areaWidth = byRect ? box.width : inner.clientWidth;
    let height = Infinity;
    if (wide) {
      height = byRect ? box.height : inner.clientHeight;
      if (height > 0) {
        let legendHeight = 0;
        let gap = 0;
        if (els.legend) {
          if (byRect) {
            legendHeight = legendBox.height;
            gap = legendBox.top - canvasBox.bottom;
          } else {
            legendHeight = els.legend.offsetHeight || 0;
            gap =
              els.legend.offsetTop - (holder.offsetTop + holder.offsetHeight);
          }
          if (!Number.isFinite(gap) || gap < 0) gap = 0;
        }
        // A legend that takes the whole panel leaves no place: the canvas then
        // takes the smallest cell instead of the default one.
        height = Math.max(1, height - legendHeight - gap);
      }
    }
    const size = fitCanvas(office.layout, { width: areaWidth, height });
    cellPx = size.cellPx;
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
      drawOnce();
    }
  }

  // Draws the office as it is now. data-drawn is set only after the drawing is
  // complete: it tells that the office is alive, not that the page was loaded.
  function drawOnce() {
    if (!ctx) return;
    const version = modelVersion;
    try {
      const count = drawOffice(ctx, office, {
        positions: sim.positions(),
        selectedKey,
        bubbles: bubblesAt(office, nowFn()),
        cellPx,
      });
      setData(els.office, "drawn", count);
      drawnVersion = version;
    } catch (err) {
      reportOnce("ошибка рисования офиса", err);
    }
  }

  function onFrame(timestamp) {
    if (stopped) return;
    const now = Number.isFinite(timestamp) ? timestamp : nowFn();
    const dt =
      lastFrameAt === null
        ? 0
        : Math.min(MAX_FRAME_SECONDS, Math.max(0, (now - lastFrameAt) / 1000));
    lastFrameAt = now;
    try {
      sim.tick(dt);
    } catch (err) {
      reportOnce("ошибка движения персонажей", err);
    }
    drawOnce();
    requestFrameFn(onFrame);
  }

  function onCanvasClick(event) {
    const point = canvasPoint(event, els.office, office.layout, cellPx);
    const key = hitOffice(
      office,
      sim.positions(),
      point.px,
      point.py,
      labelWidths(ctx, office),
    );
    openCard(key);
  }

  // ------------------------------------------------------------ start

  function onTick() {
    if (stopped) return;
    if (ctx && drawnVersion !== modelVersion) drawOnce();
    poll().then(() => {
      if (!stopped && nowFn() - lastRebuildAt >= REFRESH_MS) rebuild(false);
    });
  }

  function onVisibility() {
    if (stopped) return;
    if (document.visibilityState === "visible") poll();
  }

  // One handler of the keys of the page. While the window of history is open
  // it takes the keys: Esc closes only it, Tab and Shift+Tab go round "×" and
  // the body of the window. Otherwise Esc closes the card of an agent.
  function onKey(event) {
    if (historyKey !== null) {
      const prevent = () => {
        if (typeof event.preventDefault === "function") event.preventDefault();
      };
      if (event.key === "Escape") {
        prevent();
        closeHistory();
      } else if (event.key === "Tab") {
        prevent();
        const active = focusedElement();
        let next = event.shiftKey === true ? els.historyBody : els.historyClose;
        if (active === els.historyClose) next = els.historyBody;
        else if (active === els.historyBody) next = els.historyClose;
        next?.focus();
      }
      return;
    }
    if (card === null) return;
    if (event.key === "Escape") {
      if (typeof event.preventDefault === "function") event.preventDefault();
      closeCard();
    } else if (event.key === "Tab") {
      if (typeof event.preventDefault === "function") event.preventDefault();
      cycleCardFocus(event.shiftKey === true);
    }
  }

  // The elements of the page, found once by the identifiers of index.html.
  function resolveEls() {
    if (elsReady) return;
    elsReady = true;
    els.link = byId("link");
    els.linkStatus = byId("link-status");
    els.badge = byId("source-badge");
    els.now = byId("now");
    els.nowText = byId("now-text");
    els.pause = byId("pause");
    els.speeds = {};
    for (const m of SPEED_IDS) els.speeds[m] = byId(`speed-${m}`);
    els.officePanel = byId("office-panel");
    els.officeInner = byId("office-inner");
    els.officeScroll = byId("office-scroll");
    els.office = byId("office");
    els.officeNote = byId("office-note");
    els.legend = byId("legend");
    els.journalTitle = byId("journal-title");
    els.filters = {};
    for (const name of FILTERS) els.filters[name] = byId(`filter-${name}`);
    els.journalMeta = byId("journal-meta");
    els.journal = byId("journal");
    els.tasksTitle = byId("tasks-title");
    els.tasks = byId("tasks");
    els.overlay = byId("card-overlay");
    els.card = byId("card");
    els.historyOverlay = byId("history-overlay");
    els.history = byId("history");
    els.historyClose = byId("history-close");
    els.historyBody = byId("history-body");
  }

  // The constant captions are set once more from texts.js, the listeners are
  // attached, the canvas is prepared.
  function decorate() {
    resolveEls();
    if (els.badge) els.badge.textContent = HEADER_BADGE;
    if (els.officePanel)
      els.officePanel.setAttribute("aria-label", OFFICE_NAME);
    if (els.officeScroll)
      els.officeScroll.setAttribute("aria-label", OFFICE_SCROLL_LABEL);
    if (els.journalTitle) els.journalTitle.textContent = JOURNAL_TITLE;
    if (els.tasksTitle) els.tasksTitle.textContent = TASKS_TITLE;
    if (els.pause) {
      els.pause.addEventListener("click", () => setPaused(!paused));
    }
    for (const m of SPEED_IDS) {
      const button = els.speeds[m];
      if (!button) continue;
      button.textContent = SPEED_LABELS[m];
      button.addEventListener("click", () => setSpeed(m));
    }
    for (const name of FILTERS) {
      const button = els.filters[name];
      if (!button) continue;
      button.textContent = FILTER_LABELS[name];
      button.addEventListener("click", () => setFilter(name));
    }
    if (els.overlay) {
      els.overlay.addEventListener("click", (event) => {
        if (event.target === els.overlay) closeCard();
      });
    }
    if (els.historyClose) {
      els.historyClose.textContent = "×";
      els.historyClose.setAttribute("aria-label", HISTORY_CLOSE);
      els.historyClose.title = HISTORY_CLOSE;
      els.historyClose.addEventListener("click", () => closeHistory());
    }
    if (els.historyOverlay) {
      els.historyOverlay.addEventListener("click", (event) => {
        if (event.target === els.historyOverlay) closeHistory();
      });
    }
    if (els.office) {
      ctx = els.office.getContext("2d");
      const supported = ctx !== null && ctx !== undefined;
      if (!supported) ctx = null;
      els.office.hidden = !supported;
      if (els.officeNote) {
        els.officeNote.textContent = supported ? "" : CANVAS_UNSUPPORTED;
        els.officeNote.hidden = supported;
      }
      if (supported) els.office.addEventListener("click", onCanvasClick);
    }
    guarded("кнопки", renderControls);
    guarded("фильтры", renderFilters);
  }

  // The first load, then the polling. The page keeps polling even if the first
  // load failed: when the server comes back, the page loads everything.
  async function start() {
    if (started) return;
    started = true;
    decorate();
    intervalId = setIntervalFn(onTick, POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("keydown", onKey);
    if (typeof addResizeListener === "function") {
      addResizeListener(() => guarded("холст", fit));
    }
    renderAll();
    guarded("холст", fit);
    if (ctx) requestFrameFn(onFrame);
    await poll();
  }

  function stop() {
    stopped = true;
    if (intervalId !== null) clearIntervalFn(intervalId);
    intervalId = null;
  }

  return {
    start,
    poll,
    stop,
    getModel: () => model,
    getOffice: () => office,
    getSim: () => sim,
    setFilter,
    setPaused,
    setSpeed,
    selectCharacter,
    closeCard,
    getHistory: () => history,
    openHistory,
    closeHistory,
  };
}
