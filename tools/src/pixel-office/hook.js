// Pixel Office hook program (design 6.3). Claude Code runs it, through hook.sh,
// at each hook event and gives the event as JSON on stdin. It stamps the time of
// the event, keeps only the allowed fields, signs the body with the secret from
// the state directory and posts it to the local server.
//
// It runs inside the owner's session, so it never writes to stdout or stderr
// (stdout of some events goes into the model's context) and every failure ends
// quietly with exit code 0. The server may be down: the event is then lost.

// First action: the moment the hook fired. The input has no time field; the
// time is never recalculated or shifted afterwards (REQ-001, criterion 2).
const firedAt = new Date().toISOString();

function quit() {
  process.exit(0);
}

process.on("uncaughtException", quit);
process.on("unhandledRejection", quit);

// The whole of stdin as text; quits when it is larger than max bytes.
function readInput(max) {
  return new Promise((resolve) => {
    const chunks = [];
    let total = 0;
    process.stdin.on("data", (chunk) => {
      total += chunk.length;
      if (total > max) quit();
      else chunks.push(chunk);
    });
    process.stdin.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf8")),
    );
    process.stdin.on("error", quit);
  });
}

// One POST; resolves when the answer is read, the connection fails or the time
// is up. The status of the answer does not matter: there are no retries. The
// request goes through an agent of its own, not the default one: proxy
// variables of the environment never send the signed body away from
// 127.0.0.1 (REQ-008, F6).
function post(http, host, port, body, signature, headerName, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        agent: new http.Agent({ keepAlive: false }),
        host,
        port,
        path: "/api/events",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          [headerName]: signature,
        },
        signal: AbortSignal.timeout(timeoutMs),
      },
      (res) => {
        res.on("error", resolve);
        res.on("end", resolve);
        res.resume();
      },
    );
    req.on("error", resolve);
    req.end(body);
  });
}

async function run() {
  // Linux and macOS only (ISS-0132): elsewhere the event is dropped silently, before
  // stdin and before any state is read; it is never written later.
  const platformGuard = await import("../platform-guard.js");
  if (!platformGuard.isSupportedPlatform(process.platform)) return;
  const config = await import("./config.js");
  // Safety net: whatever happens, the hook is gone after this long.
  setTimeout(quit, config.HOOK_HARD_EXIT_MS);

  const { default: http } = await import("node:http");
  const os = await import("node:os");
  const protocol = await import("./protocol.js");
  const stateDir = await import("./state-dir.js");

  const text = await readInput(config.HOOK_INPUT_MAX);
  const body = protocol.buildWriteBody(JSON.parse(text), firedAt, {
    storeText: protocol.storeTextEnabled(process.env),
  });
  if (body === null) return;

  const dir = stateDir.resolveStateDir(process.env, os.homedir());
  const secret = stateDir.readSecret(dir);
  if (secret === null) return;
  const portText = stateDir.readStateText(dir, config.PORT_FILE);
  const portMatch =
    portText === null ? null : /^\s*(\d{1,5})\s*$/.exec(portText);
  const port = portMatch === null ? 0 : Number(portMatch[1]);
  if (port < 1 || port > 65535) return;

  const payload = JSON.stringify(body);
  await post(
    http,
    config.HOST,
    port,
    payload,
    protocol.signBody(secret, payload),
    protocol.SIGNATURE_HEADER,
    config.HOOK_HTTP_MS,
  );
}

try {
  await run();
} catch {
  // Any failure: the event is lost, the session does not notice.
}
quit();
