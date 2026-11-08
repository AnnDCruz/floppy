// Run with: npm test   (throwaway database)
const os = require("os");
const path = require("path");
const fs = require("fs");
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.STUDYFORGE_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sf-en-")), "test.sqlite3");

const express = require("express");
const app = express();
app.use(express.json());
app.use("/api/events", require("../routes/events"));
app.use("/api/notes", require("../routes/notes"));

let server;
let base;
test.before(async () => {
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://localhost:${server.address().port}/api`;
});
test.after(() => server.close());

const call = async (method, p, body) => {
  const res = await fetch(base + p, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};

test("events: validation", async () => {
  assert.equal((await call("POST", "/events", {})).status, 400);
  assert.equal((await call("POST", "/events", { title: "x", event_date: "2026-02-30" })).status, 400); // not a real date
  assert.equal((await call("POST", "/events", { title: "x", event_date: "2026-11-10", start_time: "25:00" })).status, 400);
  const r = await call("POST", "/events", { title: "x", event_date: "2026-11-10", start_time: "15:00", end_time: "14:00" });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /before/);
});

test("events: create, list by month and day, edit, delete", async () => {
  const a = (await call("POST", "/events", { title: "Mastercard phone interview", event_date: "2026-11-12", start_time: "15:00", end_time: "15:45", notes: "Prep STAR stories" })).body;
  const b = (await call("POST", "/events", { title: "CoE meeting", event_date: "2026-11-12" })).body;
  await call("POST", "/events", { title: "December thing", event_date: "2026-12-03" });

  const month = (await call("GET", "/events?month=2026-11")).body;
  assert.deepEqual(month.map((e) => e.title), ["Mastercard phone interview", "CoE meeting"]); // timed first, then untimed
  assert.equal((await call("GET", "/events?date=2026-11-12")).body.length, 2);
  assert.equal((await call("GET", "/events?from=2026-11-13")).body.length, 1);

  const upd = await call("PATCH", `/events/${a.id}`, { end_time: "16:00" });
  assert.equal(upd.body.end_time, "16:00");
  assert.equal((await call("PATCH", `/events/${a.id}`, { start_time: "17:00" })).status, 400); // would put start after end
  assert.equal((await call("PATCH", "/events/9999", { title: "x" })).status, 404);

  await call("DELETE", `/events/${b.id}`);
  assert.equal((await call("GET", "/events?date=2026-11-12")).body.length, 1);
});

test("notes: create, autosave-style edits, pin ordering, delete", async () => {
  const n1 = (await call("POST", "/notes", {})).body;
  assert.equal(n1.title, "Untitled");
  const n2 = (await call("POST", "/notes", { title: "Interview details", body: "Zoom link..." })).body;

  const edited = (await call("PATCH", `/notes/${n1.id}`, { title: "  Exam rules  ", body: "Bring ID" })).body;
  assert.equal(edited.title, "Exam rules");

  // most recently edited first...
  assert.deepEqual((await call("GET", "/notes")).body.map((n) => n.id), [n1.id, n2.id]);
  // ...pinned always on top, and pinning alone doesn't change updated_at
  const before = (await call("GET", "/notes")).body.find((n) => n.id === n2.id).updated_at;
  const pinned = (await call("PATCH", `/notes/${n2.id}`, { pinned: true })).body;
  assert.equal(pinned.updated_at, before);
  assert.deepEqual((await call("GET", "/notes")).body.map((n) => n.id), [n2.id, n1.id]);

  assert.equal((await call("PATCH", `/notes/${n1.id}`, { body: "x".repeat(50001) })).status, 400);
  assert.equal((await call("PATCH", "/notes/9999", { title: "x" })).status, 404);

  await call("DELETE", `/notes/${n1.id}`);
  assert.equal((await call("GET", "/notes")).body.length, 1);
});
