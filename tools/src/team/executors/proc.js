// The process group of an executor (design REQ-010, section 5.6): the process is
// started with its own group (detached), and the whole group is stopped, so a
// child of Claude Code does not outlive the attempt.

const POLL_MS = 50;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Sends a signal to the group; a group that is already gone is not an error.
export function signalGroup(pid, sig) {
  try {
    process.kill(-pid, sig);
  } catch (err) {
    if (err && err.code === "ESRCH") return;
    throw err;
  }
}

// true while at least one process of the group exists.
export function groupAlive(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (err) {
    return !(err && err.code === "ESRCH");
  }
}

async function goneWithin(pid, ms) {
  const until = Date.now() + ms;
  for (;;) {
    if (!groupAlive(pid)) return true;
    if (Date.now() >= until) return false;
    await wait(POLL_MS);
  }
}

// SIGTERM to the group; after graceMs SIGKILL; then waits at most waitMs for the
// group to be gone. false — the group did not go.
export async function stopGroup(pid, { graceMs, waitMs }) {
  try {
    signalGroup(pid, "SIGTERM");
  } catch {
    // EPERM and the like: SIGKILL below is the next try.
  }
  if (await goneWithin(pid, graceMs)) return true;
  try {
    signalGroup(pid, "SIGKILL");
  } catch {
    // Reported by the wait below.
  }
  return goneWithin(pid, waitMs);
}
