// REQ-011, criterion 8 (design REQ-011, sections 7, 9): an event written through
// the core is in the next answer without a restart; the page polls at least every 5
// seconds (the constant REFRESH_MS of the code of the page); GET writes nothing
// (WEB-8a…WEB-8c).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { openWriter } from "../src/team/store.js";
import { journal, snapshot } from "./exec-helpers.js";
import {
  ROLE_NUMBERS,
  projectsInEveryStatus,
  richProject,
} from "./team-web-fixtures.js";
import {
  PUBLIC_DIR,
  eng,
  planTask,
  project,
  startServer,
  webSandbox,
  withPlan,
} from "./team-web-helpers.js";
import { replay } from "../src/team/reducer.js";

test("WEB-8a an event written through the core after the first answer is in the next answer of the same server (chat, page, list), without a restart", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  p.w.close();
  const s = await startServer(t, box);
  const before = (await s.get(`/api/projects/${p.id}/chat`)).json.messages
    .length;
  const page0 = (await s.get(`/api/projects/${p.id}`)).json;
  const list0 = (await s.get("/api/projects")).json.projects[0];
  const w = openWriter(p.id, { home: box.home });
  w.say("Сообщение, записанное через ядро");
  withPlan(w, [planTask("t-0001", "researcher"), planTask("t-0002", "lawyer")]);
  w.close();
  const chat = (await s.get(`/api/projects/${p.id}/chat`)).json;
  assert.equal(chat.messages.length, before + 1);
  assert.equal(chat.messages.at(-1).text, "Сообщение, записанное через ядро");
  const page = (await s.get(`/api/projects/${p.id}`)).json;
  assert.notDeepStrictEqual(page.happening, page0.happening);
  assert.equal(page.happening.at(-1).at, journal(p).at(-1).ts);
  assert.equal(page.tasks.length, 2);
  assert.equal(page0.tasks.length, 0);
  const list = (await s.get("/api/projects")).json.projects[0];
  assert.equal(list0.progress_text, "Задач пока нет");
  assert.equal(list.progress_text, "0 из 2 задач");
  assert.equal(list.status, "running");
  // and once more: every request reads anew
  const w2 = openWriter(p.id, { home: box.home });
  w2.append(eng("TASK_STARTED", {}, "t-0001"));
  w2.close();
  const busy = (await s.get(`/api/projects/${p.id}`)).json.busy;
  assert.equal(busy.length, 1);
});

test("WEB-8b the code of the page polls with const REFRESH_MS = N; and N ≤ 5000 (the design sets exactly 5000); the caption of the page says the same", () => {
  const app = fs.readFileSync(path.join(PUBLIC_DIR, "app.js"), "utf8");
  const found = [...app.matchAll(/^const REFRESH_MS = (\d+);$/gm)];
  assert.equal(found.length, 1);
  const n = Number(found[0][1]);
  assert.ok(n > 0 && n <= 5000, String(n));
  assert.equal(n, 5000);
  assert.equal(
    [...app.matchAll(/\bREFRESH_MS\b/g)].length >= 2,
    true,
    "it is used",
  );
  const html = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
  assert.ok(html.includes("обновление раз в 5 секунд"));
});

test("WEB-8c every GET route on projects in every status (and a damaged one, and one with an unfinished last line) leaves every path and hash of SAI_TEAM_HOME the same", async (t) => {
  const box = webSandbox(t);
  const all = projectsInEveryStatus(t, box);
  const rich = richProject(t, box);
  for (const [, p] of all) p.w.close();
  rich.w.close();
  // an unfinished last line and a damaged line in the middle
  fs.appendFileSync(all[0][1].events, '{"seq":9,"ty');
  const broken = project(t, box);
  withPlan(broken.w, [planTask("t-0001", "researcher")]);
  broken.w.close();
  const lines = fs.readFileSync(broken.events, "utf8").split("\n");
  lines[1] = "{испорчено";
  fs.writeFileSync(broken.events, lines.join("\n"));
  const s = await startServer(t, box);
  const before = snapshot(box.home);
  const paths = ["/", "/app.js", "/style.css", "/api/projects"];
  for (const p of [...all.map(([, x]) => x), rich, broken]) {
    paths.push(`/api/projects/${p.id}`, `/api/projects/${p.id}/chat`);
    // the damaged journal cannot be replayed: its one task is asked for anyway
    const tasks = p === broken ? [{ id: "t-0001" }] : replay(journal(p)).tasks;
    for (const task of tasks)
      paths.push(`/api/projects/${p.id}/tasks/${task.id}`);
    for (const n of ROLE_NUMBERS)
      paths.push(`/api/projects/${p.id}/roles/${n}`);
  }
  paths.push("/api/projects/p-20990101-a1b2c3", "/api/projects/../x");
  const statuses = new Set();
  for (const pth of paths) {
    const r = await s.get(pth);
    statuses.add(r.status);
  }
  assert.deepStrictEqual([...statuses].sort(), [200, 404, 500]);
  assert.ok(paths.length > 100, String(paths.length));
  assert.deepStrictEqual(snapshot(box.home), before);
});
