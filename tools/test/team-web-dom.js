// A small model of the DOM of a browser for the tests of the code of the page of
// Sai Team (tools/src/web/public/app.js) in Node, without a dependency. Not a test
// file.
//
// Why a model: jsdom is the tool chosen for the tests of pages (decisions/0023, D2;
// REQ-033), but it is not installed and REQ-011 adds no dependency (design REQ-011,
// sections 0, 15 WEB-3g, 20). This model is NOT a browser and NOT jsdom: it parses
// the real index.html into elements, implements only what app.js calls (elements,
// attributes, text, templates, the selectors app.js uses, events, focus), and runs
// the real app.js in a vm context with a fake fetch, fake timers and a fake
// location. Layout, styles, scrolling and real focus order are not modelled; what
// a test checks through this model is the logic of the page: which requests it
// makes and when, which texts and attributes it puts into the markup.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const VOID = new Set(["meta", "link", "input", "br", "img", "hr", "source"]);
const RAW = new Set(["script", "style"]);

// ---- nodes ------------------------------------------------------------------------------

class Node {
  constructor(doc) {
    this.ownerDocument = doc;
    this.parentNode = null;
    this.childNodes = [];
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  get children() {
    return this.childNodes.filter((n) => n instanceof Element);
  }

  get firstElementChild() {
    return this.children[0] ?? null;
  }

  get nextElementSibling() {
    if (this.parentNode === null) return null;
    const sibs = this.parentNode.childNodes;
    for (let i = sibs.indexOf(this) + 1; i < sibs.length; i += 1) {
      if (sibs[i] instanceof Element) return sibs[i];
    }
    return null;
  }

  get textContent() {
    return this.childNodes.map((n) => n.textContent).join("");
  }

  set textContent(value) {
    for (const n of this.childNodes) n.parentNode = null;
    this.childNodes = [];
    const text = String(value ?? "");
    if (text !== "") this.appendChild(new Text(this.ownerDocument, text));
  }

  appendChild(node) {
    return this.insertBefore(node, null);
  }

  insertBefore(node, ref) {
    if (node.parentNode !== null) node.parentNode.removeChild(node);
    const at = ref === null ? -1 : this.childNodes.indexOf(ref);
    if (at === -1) this.childNodes.push(node);
    else this.childNodes.splice(at, 0, node);
    node.parentNode = this;
    return node;
  }

  removeChild(node) {
    const at = this.childNodes.indexOf(node);
    if (at !== -1) this.childNodes.splice(at, 1);
    node.parentNode = null;
    return node;
  }

  remove() {
    if (this.parentNode !== null) this.parentNode.removeChild(this);
  }

  contains(node) {
    for (let n = node; n !== null; n = n.parentNode)
      if (n === this) return true;
    return false;
  }

  // Every element below this node, in document order.
  descendants(out = []) {
    for (const n of this.childNodes) {
      if (n instanceof Element) {
        out.push(n);
        n.descendants(out);
      }
    }
    return out;
  }

  querySelectorAll(selector) {
    const groups = parseSelector(selector);
    return this.descendants().filter((el) => groups.some((g) => g(el)));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class Text extends Node {
  constructor(doc, data) {
    super(doc);
    this.data = data;
  }

  get textContent() {
    return this.data;
  }

  set textContent(v) {
    this.data = String(v);
  }

  cloneNode() {
    return new Text(this.ownerDocument, this.data);
  }
}

function camelToData(name) {
  return `data-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

class Element extends Node {
  constructor(doc, tag) {
    super(doc);
    this.localName = tag.toLowerCase();
    this.tagName = tag.toUpperCase();
    this.attributes = new Map();
    this.listeners = new Map();
    this.value = "";
    this.disabled = false;
    this.readOnly = false;
    this.inert = false;
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.clientHeight = 0;
    this.max = 1;
    this.content = null;
    const self = this;
    this.dataset = new Proxy(
      {},
      {
        get: (_, k) =>
          typeof k === "string"
            ? (self.getAttribute(camelToData(k)) ?? undefined)
            : undefined,
        set: (_, k, v) => {
          self.setAttribute(camelToData(k), String(v));
          return true;
        },
      },
    );
    this.classList = {
      contains: (c) => self.className.split(/\s+/).includes(c),
      add: (c) => {
        if (!self.classList.contains(c))
          self.className = `${self.className} ${c}`.trim();
      },
      remove: (c) => {
        self.className = self.className
          .split(/\s+/)
          .filter((x) => x !== "" && x !== c)
          .join(" ");
      },
      toggle: (c, force) => {
        const on = force === undefined ? !self.classList.contains(c) : force;
        if (on) self.classList.add(c);
        else self.classList.remove(c);
        return on;
      },
    };
  }

  get id() {
    return this.getAttribute("id") ?? "";
  }

  get className() {
    return this.getAttribute("class") ?? "";
  }

  set className(v) {
    this.setAttribute("class", v);
  }

  get hidden() {
    return this.attributes.has("hidden");
  }

  set hidden(v) {
    if (v) this.attributes.set("hidden", "");
    else this.attributes.delete("hidden");
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  cloneNode(deep) {
    const el = new this.constructor(this.ownerDocument, this.localName);
    for (const [k, v] of this.attributes) el.attributes.set(k, v);
    el.value = this.value;
    el.max = this.max;
    if (deep)
      for (const n of this.childNodes) el.appendChild(n.cloneNode(true));
    if (this.content !== null) el.content = this.content.cloneNode(true);
    return el;
  }

  // Shown: neither it nor an ancestor is hidden.
  get shown() {
    for (let n = this; n instanceof Element; n = n.parentNode) {
      if (n.hidden) return false;
    }
    return true;
  }

  getClientRects() {
    return this.shown && this.ownerDocument.contains(this) ? [{}] : [];
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  blur() {
    if (this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = this.ownerDocument.body;
    }
  }

  scrollIntoView() {}

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  removeEventListener(type, fn) {
    const list = this.listeners.get(type) ?? [];
    const at = list.indexOf(fn);
    if (at !== -1) list.splice(at, 1);
  }

  dispatchEvent(event) {
    event.target ??= this;
    event.currentTarget = this;
    for (const fn of [...(this.listeners.get(event.type) ?? [])]) fn(event);
    return !event.defaultPrevented;
  }
}

class Anchor extends Element {}

// ---- selectors (only the forms app.js uses) ----------------------------------------------

function parseCompound(text) {
  const tests = [];
  let rest = text.trim();
  const tag = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(rest);
  if (tag) {
    const name = tag[0].toLowerCase();
    tests.push((el) => el.localName === name);
    rest = rest.slice(tag[0].length);
  }
  while (rest.length > 0) {
    let m;
    if ((m = /^\.([A-Za-z0-9_-]+)/.exec(rest))) {
      const c = m[1];
      tests.push((el) => el.classList.contains(c));
    } else if ((m = /^\[([a-z-]+)(?:=(?:"([^"]*)"|'([^']*)'))?\]/.exec(rest))) {
      const [, name, dq, sq] = m;
      const want = dq ?? sq;
      tests.push((el) =>
        want === undefined
          ? el.hasAttribute(name)
          : el.getAttribute(name) === want,
      );
    } else if ((m = /^:not\(\[([a-z-]+)\]\)/.exec(rest))) {
      const name = m[1];
      tests.push((el) => !el.hasAttribute(name));
    } else {
      throw new Error(`dom model: unsupported selector ${text}`);
    }
    rest = rest.slice(m[0].length);
  }
  return (el) => tests.every((f) => f(el));
}

function parseSelector(selector) {
  return selector.split(",").map((part) => {
    if (/\s/.test(part.trim())) {
      throw new Error(`dom model: no combinators: ${selector}`);
    }
    return parseCompound(part);
  });
}

// ---- the parser of HTML (enough for index.html) -------------------------------------------

function decode(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseInto(doc, html, root) {
  const stack = [root];
  const top = () => stack.at(-1);
  // where children of a template go
  const into = () => (top().content !== null ? top().content : top());
  let i = 0;
  while (i < html.length) {
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i);
      i = end + 3;
      continue;
    }
    if (html.startsWith("<!", i)) {
      i = html.indexOf(">", i) + 1;
      continue;
    }
    if (html.startsWith("</", i)) {
      const end = html.indexOf(">", i);
      const name = html
        .slice(i + 2, end)
        .trim()
        .toLowerCase();
      while (stack.length > 1) {
        const el = stack.pop();
        if (el.localName === name) break;
      }
      i = end + 1;
      continue;
    }
    if (html[i] === "<" && /[a-zA-Z]/.test(html[i + 1] ?? "")) {
      const m =
        /^<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/.exec(
          html.slice(i),
        );
      if (m === null) throw new Error(`dom model: bad tag at ${i}`);
      const name = m[1].toLowerCase();
      const el = name === "a" ? new Anchor(doc, name) : new Element(doc, name);
      for (const a of m[2].matchAll(
        /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
      )) {
        el.attributes.set(
          a[1].toLowerCase(),
          decode(a[2] ?? a[3] ?? a[4] ?? ""),
        );
      }
      into().appendChild(el);
      i += m[0].length;
      if (name === "template") el.content = new Element(doc, "#fragment");
      if (RAW.has(name) || name === "textarea") {
        const end = html.indexOf(`</${name}`, i);
        const raw = html.slice(i, end);
        if (name === "textarea") el.value = decode(raw);
        i = html.indexOf(">", end) + 1;
        continue;
      }
      if (VOID.has(name) || m[3] === "/") {
        if (name === "input") el.value = el.getAttribute("value") ?? "";
        continue;
      }
      if (name === "progress") {
        el.max = Number(el.getAttribute("max") ?? 1);
        el.value = Number(el.getAttribute("value") ?? 0);
      }
      stack.push(el);
      continue;
    }
    const next = html.indexOf("<", i + 1);
    const end = next === -1 ? html.length : next;
    into().appendChild(new Text(doc, decode(html.slice(i, end))));
    i = end;
  }
}

class Document extends Node {
  constructor(html) {
    super(null);
    this.ownerDocument = this;
    this.listeners = new Map();
    this.content = null;
    parseInto(this, html, this);
    this.documentElement = this.querySelector("html");
    this.body = this.querySelector("body");
    this.head = this.querySelector("head");
    this.activeElement = this.body;
  }

  getElementById(id) {
    return (
      this.descendants().find((el) => el.getAttribute("id") === id) ?? null
    );
  }

  createElement(tag) {
    return tag.toLowerCase() === "a"
      ? new Anchor(this, tag)
      : new Element(this, tag);
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  dispatchEvent(event) {
    for (const fn of [...(this.listeners.get(event.type) ?? [])]) fn(event);
  }
}

export function event(type, over = {}) {
  return {
    type,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...over,
  };
}

// ---- the page --------------------------------------------------------------------------------

// Loads index.html (with the key `key` in its marker, as the server gives it) and
// runs app.js. `fetch(path, init)` answers the requests: it returns
// { status, body } (or a promise of it), or throws for «no connection».
// Returns { doc, ctx, byId, calls, timers, now(), advance(ms), settle(), eval(code),
// hash(), go(hash), reloads }.
export function loadPage({
  publicDir,
  key = "a".repeat(64),
  fetch,
  hash = "",
  wide = true,
  start = Date.UTC(2026, 0, 5, 9, 0, 0),
}) {
  const html = fs
    .readFileSync(path.join(publicDir, "index.html"), "utf8")
    .replace(
      '<meta name="sai-page" content="" />',
      `<meta name="sai-page" content="${key}" />`,
    );
  const doc = new Document(html);
  const calls = [];
  let now = start;
  let nextId = 1;
  const timers = new Map();
  const windowListeners = new Map();
  const location = {
    _hash: hash,
    reloads: 0,
    get hash() {
      return this._hash;
    },
    set hash(v) {
      const value = v === "" || v.startsWith("#") ? v : `#${v}`;
      if (value === this._hash) return;
      this._hash = value;
      queueMicrotask(() => {
        for (const fn of windowListeners.get("hashchange") ?? [])
          fn(event("hashchange"));
      });
    },
    reload() {
      this.reloads += 1;
    },
  };
  const ctx = {
    document: doc,
    location,
    console,
    CSS: { escape: (s) => String(s).replace(/["\\]/g, "\\$&") },
    HTMLAnchorElement: Anchor,
    queueMicrotask,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + Math.max(0, ms ?? 0), fn, ms });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
    matchMedia: () => ({ matches: wide, addEventListener() {} }),
    addEventListener: (type, fn) => {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(fn);
    },
    fetch: (p, init) => {
      const call = { path: p, init, at: now, settled: false };
      calls.push(call);
      return Promise.resolve()
        .then(() => fetch(p, init, call))
        .then((reply) => {
          call.settled = true;
          if (reply.statusThrows === true) {
            // a response object that breaks when the page reads its status: an
            // unexpected exception inside the poll, after the body was read
            return {
              get status() {
                throw new Error("unexpected");
              },
              json: async () => JSON.parse(JSON.stringify(reply.body)),
            };
          }
          return {
            status: reply.status,
            json: async () => {
              if (reply.raw !== undefined) return JSON.parse(reply.raw);
              return JSON.parse(JSON.stringify(reply.body));
            },
          };
        });
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  // Date.now of the page follows the fake clock; new Date() stays real.
  vm.runInContext(
    `Date.now = () => __now();`,
    Object.assign(ctx, { __now: () => now }),
  );
  const source = fs.readFileSync(path.join(publicDir, "app.js"), "utf8");
  vm.runInContext(`"use strict";\n${source}`, ctx, { filename: "app.js" });

  const settle = async (rounds = 20) => {
    for (let i = 0; i < rounds; i += 1)
      await new Promise((r) => setImmediate(r));
  };
  // Moves the fake clock by ms, running every timer that comes due in order.
  const advance = async (ms) => {
    const until = now + ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, tm]) => tm.at <= until)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
      if (due.length === 0) break;
      const [id, tm] = due[0];
      timers.delete(id);
      now = Math.max(now, tm.at);
      tm.fn();
      await settle();
    }
    now = until;
    await settle();
  };
  return {
    doc,
    ctx,
    calls,
    timers,
    location,
    byId: (id) => doc.getElementById(id),
    now: () => now,
    tick: (ms) => {
      now += ms;
    },
    advance,
    settle,
    eval: (code) => vm.runInContext(code, ctx),
    go: async (h) => {
      location.hash = h;
      await settle();
    },
  };
}
