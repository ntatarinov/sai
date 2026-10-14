// Starts the page in the browser (design 2.1). This is the only file that
// reads the globals of the window; the tests never import it, they call
// createApp with their own objects.

import { createApp } from "./app.js";

const app = createApp({
  document: window.document,
  fetchFn: (url, init) => window.fetch(url, init),
  nowFn: () => Date.now(),
  setIntervalFn: (fn, ms) => window.setInterval(fn, ms),
  clearIntervalFn: (id) => window.clearInterval(id),
  setTimeoutFn: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeoutFn: (id) => window.clearTimeout(id),
  requestFrameFn: (fn) => window.requestAnimationFrame(fn),
  AbortControllerCtor: window.AbortController,
  viewportFn: () => ({ width: window.innerWidth, height: window.innerHeight }),
  addResizeListener: (fn) => window.addEventListener("resize", fn),
  // The clipboard of the browser for "Скопировать", or null (REQ-044).
  clipboardFn: () => window.navigator?.clipboard ?? null,
});

app.start().catch((err) => {
  console.error(`Pixel Office: страница не запустилась: ${err}`);
});
