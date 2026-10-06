// Small helpers shared by the modules of Sai Team (the check of an answer, the
// scenario of scripted, the pause between attempts). A pure module without state.

export function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// A plain object (from JSON or a literal): not null, not an array, prototype
// Object.prototype or null.
export function isPlainObject(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// A pause that the signal (optional) ends early; true when it ran to the end.
export function abortablePause(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
