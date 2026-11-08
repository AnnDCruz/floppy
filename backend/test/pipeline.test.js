// Run with: npm test   (uses a throwaway database and a stubbed model; no Ollama needed)
const os = require("os");
const path = require("path");
const fs = require("fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sf-")), "test.sqlite3");
process.env.STUDYFORGE_DB = dbFile;

const express = require("express");
const db = require("../db/db");
const llm = require("../ai/llm");
const planner = require("../ai/planner");

const app = express();
app.use(express.json());
app.use("/api/tasks", require("../routes/tasks"));
app.use("/api/proposals", require("../routes/proposals"));
app.use("/api/agent", require("../routes/agent"));

let base;
let server;
test.before(async () => {
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://localhost:${server.address().port}/api`;
});
test.after(() => server.close());

const j = async (p, opts = {}) => {
  const res = await fetch(base + p, { headers: { "Content-Type": "application/json" }, ...opts });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};
const post = (p, body) => j(p, { method: "POST", body: JSON.stringify(body || {}) });

const today = planner.localDate();
const plus = (n) => planner.localDate(new Date(Date.now() + n * 86400000));

test("tasks API validates input", async () => {
  assert.equal((await post("/tasks", {})).status, 400);
  assert.equal((await post("/tasks", { title: "x", due_date: "tomorrow" })).status, 400);
  const ok = await post("/tasks", { title: "Prep Mastercard interview", area: "Internship", due_date: plus(3), est_hours: 3, priority: "high" });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.status, "todo");
});

test("planner drops invalid model output and stores valid proposals", async () => {
  const t = db.prepare("SELECT id FROM tasks LIMIT 1").get();
  db.prepare("INSERT INTO deadlines (title, due_date, type, priority) VALUES (?, ?, 'quiz', 'high')").run("TOC quiz", plus(1));
  const dl = db.prepare("SELECT id FROM deadlines LIMIT 1").get();

  llm.completeJSON = async () => ({
    summary: "Focus on the quiz, then interview prep.",
    today: [
      { ref: `deadline:${dl.id}`, hours: 2, why: "Quiz tomorrow" },
      { ref: "deadline:999", hours: 1, why: "does not exist" }, // unknown ref -> dropped
      { ref: `task:${t.id}`, hours: 9, why: "too much" }, // clamped to remaining hours
    ],
    at_risk: [{ ref: `task:${t.id}`, reason: "Large and due soon" }, { ref: "task:404", reason: "ghost" }],
    proposals: [
      { action: "add_task", title: "Write cover letter", area: "Internship", due_date: "not-a-date", est_hours: 2, priority: "urgent", reason: "Needed for application" },
      { action: "add_task", title: "prep mastercard interview", reason: "duplicate of existing" }, // duplicate title -> dropped
      { action: "update_task", task_id: 4040, priority: "high", reason: "ghost task" }, // unknown id -> dropped
      { action: "update_task", task_id: t.id, due_date: plus(2), reason: "Pull forward" },
      { action: "delete_everything", reason: "nope" }, // unknown action -> dropped
    ],
  });

  const res = await post("/agent/plan", { hours: 4, note: "light day" });
  assert.equal(res.status, 201);
  const plan = res.body;

  assert.deepEqual(plan.today.map((x) => x.kind), ["deadline", "task"]);
  assert.equal(plan.today.reduce((s, x) => s + x.hours, 0), 4); // never exceeds hours_available
  assert.equal(plan.at_risk.length, 1);
  assert.equal(plan.proposals.length, 2);

  const add = plan.proposals.find((p) => p.action === "add_task");
  assert.equal(add.payload.due_date, null); // bad date sanitised
  assert.equal(add.payload.priority, "medium"); // bad priority sanitised
});

test("nothing is written until a proposal is approved", async () => {
  const before = (await j("/tasks")).body.length;
  const { body: pending } = await j("/proposals");
  assert.equal(pending.length, 2);
  assert.equal((await j("/tasks")).body.length, before);

  const add = pending.find((p) => p.action === "add_task");
  assert.equal((await post(`/proposals/${add.id}/approve`)).status, 200);
  assert.equal((await j("/tasks")).body.length, before + 1);
  assert.equal((await post(`/proposals/${add.id}/approve`)).status, 404); // can't apply twice

  const upd = pending.find((p) => p.action === "update_task");
  assert.equal((await post(`/proposals/${upd.id}/reject`)).status, 200);
  const task = (await j("/tasks")).body.find((x) => x.id === upd.payload.task_id);
  assert.notEqual(task.due_date, upd.payload.changes.due_date); // rejected -> unchanged
});

test("approving a stale proposal fails safely", async () => {
  const t = (await post("/tasks", { title: "Temp task", est_hours: 1 })).body;
  llm.completeJSON = async () => ({
    summary: "s",
    today: [{ ref: `task:${t.id}`, hours: 1, why: "w" }],
    at_risk: [],
    proposals: [{ action: "complete_task", task_id: t.id, reason: "looks done" }],
  });
  const plan = (await post("/agent/plan", { hours: 2 })).body;
  await j(`/tasks/${t.id}`, { method: "DELETE" });
  const res = await post(`/proposals/${plan.proposals[0].id}/approve`);
  assert.equal(res.status, 409);
});

test("a new plan expires old pending proposals", async () => {
  const t = (await post("/tasks", { title: "Another", est_hours: 1 })).body;
  llm.completeJSON = async () => ({
    summary: "s", today: [{ ref: `task:${t.id}`, hours: 1, why: "w" }], at_risk: [],
    proposals: [{ action: "complete_task", task_id: t.id, reason: "r" }],
  });
  await post("/agent/plan", { hours: 2 });
  assert.equal((await j("/proposals")).body.length, 1);
  llm.completeJSON = async () => ({ summary: "s", today: [{ ref: `task:${t.id}`, hours: 1, why: "w" }], at_risk: [], proposals: [] });
  await post("/agent/plan", { hours: 2 });
  assert.equal((await j("/proposals")).body.length, 0);
});

test("retries once when the model returns an unusable plan", async () => {
  let calls = 0;
  const t = db.prepare("SELECT id FROM tasks WHERE status='todo' LIMIT 1").get();
  llm.completeJSON = async () => {
    calls++;
    if (calls === 1) return { summary: "", today: [], at_risk: [], proposals: [] };
    return { summary: "ok", today: [{ ref: `task:${t.id}`, hours: 1, why: "w" }], at_risk: [], proposals: [] };
  };
  const res = await post("/agent/plan", { hours: 2 });
  assert.equal(res.status, 201);
  assert.equal(calls, 2);
});

test("returns a clear error when the model is unreachable", async () => {
  llm.completeJSON = async () => { throw new Error("Couldn't reach Ollama"); };
  const res = await post("/agent/plan", { hours: 2 });
  assert.equal(res.status, 502);
  assert.match(res.body.error, /usable plan/);
});
