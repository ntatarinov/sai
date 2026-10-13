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

import { MASK_LABEL, POLL_MS, POLL_TIMEOUT_MS, parseLine } from "./schema.js";
import { UNCONFIRMED_STATES, buildModel } from "./model.js";
import { buildHistory } from "./history.js";
import {
  bubblesAt,
  buildCard,
  buildOffice,
  roleKey,
  roleLabel,
} from "./office-model.js";
import { createSim } from "./office-sim.js";
import {
  MIN_CELL_PX,
  canvasPoint,
  drawOffice,
  fitCanvas,
  hitTest,
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
  CARD_WORKING,
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

// An item that has a last event of its session to show: in progress or one of
// the states the journal does not confirm (stale, restarted).
function hasSessionEvent(state) {
  return state === "in_progress" || UNCONFIRMED_STATES.includes(state);
}

function shortId(id) {
  return Array.from(typeof id === "string" ? id : "")
    .slice(0, 8)
    .join("");
}

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
  let cardOpen = false;
  // What opened the card: the key of a legend button, or null (the canvas).
  let openerKey = null;
  let journalShown = false;
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

  function renderNow() {
    if (!els.now) return;
    if (!loaded) {
      els.now.hidden = true;
      return;
    }
    const line = nowLine(model);
    if (els.nowText) els.nowText.textContent = line.text;
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
      button.addEventListener("click", () => openCard(c.key, c.key));
      li.appendChild(button);
      legendButtons.set(c.key, button);
      return li;
    });
    els.legend.replaceChildren(...items);
    if (focusKey !== null) legendButton(focusKey)?.focus();
  }

  // ------------------------------------------------------------ journal

  function journalRow(view) {
    const li = make("li", "row");
    setData(li, "index", view.index);
    setData(li, "tone", view.tone);
    setData(li, "marked", view.marked ? "true" : "false");
    const meta = make("span", "row-meta");
    meta.appendChild(make("span", "time", fmtTimeSec(view.time)));
    meta.appendChild(make("span", "session", shortId(view.session_id)));
    if (view.marked) {
      meta.appendChild(make("span", "source", view.source));
      meta.appendChild(make("span", "mark", NOT_FROM_HOOKS));
    }
    li.appendChild(meta);
    const main = make("span", "row-main");
    main.appendChild(make("span", "who", view.who));
    main.appendChild(make("span", "event", view.event));
    li.appendChild(main);
    if (view.description !== "") {
      li.appendChild(make("span", "row-desc", view.description));
    }
    return li;
  }

  // A row of the journal panel: a message of the owner with a window opens it
  // (the row itself takes the focus and the action); a service message only
  // says so (REQ-008, design 7.5). The rows of the card stay as they are.
  function journalPanelRow(view) {
    const li = journalRow(view);
    if (view.kind !== "UserPromptSubmit") return li;
    const key = `req:${view.index}`;
    if (view.prompt_kind === "owner" && history.byKey.has(key)) {
      li.classList.add("opens-history");
      li.setAttribute("tabindex", "0");
      setData(li, "request", key);
      li.appendChild(make("span", "history-open", HISTORY_OPEN));
      const opener = { kind: "journal", index: view.index };
      li.addEventListener("click", () => openHistory(key, opener));
      li.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (typeof event.preventDefault === "function") event.preventDefault();
        openHistory(key, opener);
      });
    } else if (view.prompt_kind === "service") {
      li.appendChild(make("span", "history-service", HISTORY_SERVICE));
    }
    return li;
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

  function renderJournal(toBottom = false) {
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
    const atBottom =
      list.scrollHeight - list.clientHeight - list.scrollTop <= BOTTOM_SLACK;
    const anchor = anchorOf(list);
    // The rows are replaced: the row with the focus gets it back.
    const focused = focusedElement();
    const focusIndex =
      journalItems.find((item) => item.li === focused)?.index ?? null;
    journalItems = picked.rows.map((view) => ({
      index: view.index,
      li: journalPanelRow(view),
    }));
    let items = journalItems.map((item) => item.li);
    if (rows.length === 0) items = [journalNote("empty")];
    else if (picked.rows.length === 0) items = [journalNote("filtered")];
    list.replaceChildren(...items);
    if (!journalShown || toBottom || atBottom || anchor === null) {
      list.scrollTop = list.scrollHeight;
    } else {
      const same = journalItems.find((item) => item.index === anchor.index);
      list.scrollTop =
        same === undefined ? 0 : same.li.offsetTop - anchor.offset;
    }
    journalShown = true;
    if (focusIndex !== null) {
      journalItems.find((item) => item.index === focusIndex)?.li.focus();
    }
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
      role = make("span", "item-role", roleLabel(item.role));
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
    if (hasSessionEvent(item.state)) {
      time.appendChild(
        timeSpan("last-event", LABEL_LAST_EVENT, item.session_last_event_at),
      );
      // After a restart the age says nothing about the work, so none is shown.
      if (item.state !== "restarted") {
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

  function renderCard() {
    const overlay = els.overlay;
    const el = els.card;
    if (!overlay || !el) return;
    // The contents are replaced: the focus on "×" goes to the new "×".
    const closeFocused =
      els.cardClose !== undefined &&
      els.cardClose !== null &&
      els.cardClose === focusedElement();
    const card =
      cardOpen && selectedKey !== null
        ? buildCard(model, office, selectedKey)
        : null;
    if (card === null) {
      if (cardOpen) {
        // The character is gone: the card closes and the choice is dropped.
        cardOpen = false;
        selectedKey = null;
      }
      el.replaceChildren();
      overlay.hidden = true;
      return;
    }
    const close = make("button", "card-close", "×");
    close.setAttribute("type", "button");
    close.setAttribute("aria-label", CARD_CLOSE);
    close.addEventListener("click", () => closeCard());
    const head = make("div", "card-head");
    const swatch = make("span", "card-swatch");
    setData(swatch, "color", card.color);
    const title = make("h3", "card-title", card.full);
    title.setAttribute("id", "card-title");
    head.appendChild(swatch);
    head.appendChild(title);
    const working = make(
      "span",
      "card-working",
      card.kind === "main"
        ? `${CARD_SESSIONS}${card.sessions_running}`
        : `${CARD_WORKING}${card.working_count}`,
    );
    const viewByIndex = new Map(rows.map((r) => [r.index, r]));
    el.replaceChildren(
      close,
      head,
      working,
      cardSection(
        "in-progress",
        CARD_HEADINGS.in_progress,
        card.in_progress.map((item) => itemInto(make("li", "item"), item)),
      ),
      cardSection(
        "unconfirmed",
        CARD_HEADINGS.unconfirmed,
        card.unconfirmed.map((item) => itemInto(make("li", "item"), item)),
        card.unconfirmed_total,
      ),
      cardSection(
        "recent-completed",
        CARD_HEADINGS.recent_completed,
        card.recent_completed.map((item) => itemInto(make("li", "item"), item)),
      ),
      cardSection(
        "unrecorded",
        CARD_HEADINGS.unrecorded,
        card.unrecorded.map((item) => itemInto(make("li", "item"), item)),
        card.unrecorded_total,
      ),
      cardSection(
        "recent-events",
        CARD_HEADINGS.recent_events,
        card.recent_events
          .map((row) => viewByIndex.get(row.index))
          .filter((view) => view !== undefined)
          .map(journalRow),
      ),
    );
    overlay.hidden = false;
    els.cardClose = close;
    if (closeFocused) close.focus();
  }

  // Selects a character (its frame on the canvas, its legend button pressed)
  // and opens its card; a key without a character closes the card and drops
  // the choice.
  function openCard(key, opener) {
    resolveEls();
    if (key === null || key === undefined || characterOf(key) === undefined) {
      selectedKey = null;
      cardOpen = false;
      openerKey = null;
    } else {
      selectedKey = key;
      cardOpen = true;
      openerKey = opener;
    }
    guarded("легенда", renderLegend);
    guarded("карточка", renderCard);
    if (cardOpen) els.cardClose?.focus();
  }

  function selectCharacter(key) {
    openCard(key, null);
  }

  // Closes the card; the character stays selected. The focus goes back to the
  // legend button that opened the card (the canvas takes no focus).
  function closeCard() {
    resolveEls();
    if (!cardOpen) return;
    cardOpen = false;
    guarded("карточка", renderCard);
    if (openerKey !== null) legendButton(openerKey)?.focus();
    openerKey = null;
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
    } else if (hasSessionEvent(task.state)) {
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
    if (cardOpen) {
      cardOpen = false;
      openerKey = null;
      guarded("карточка", renderCard);
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
      if (row !== undefined && row.li.classList.contains("opens-history")) {
        return row.li;
      }
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
    const key = hitTest(sim.positions(), point.px, point.py);
    openCard(key, null);
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
    if (event.key === "Escape" && cardOpen) closeCard();
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
