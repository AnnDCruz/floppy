const express = require("express");
const db = require("../db/db");

const router = express.Router();

// Applies one approved proposal. Re-checks that the target still exists and is open,
// because the data may have changed since the plan was made.
function apply(proposal) {
  const payload = JSON.parse(proposal.payload_json);

  if (proposal.action === "add_task") {
    const info = db
      .prepare("INSERT INTO tasks (title, area, due_date, est_hours, priority) VALUES (?, ?, ?, ?, ?)")
      .run(payload.title, payload.area, payload.due_date, payload.est_hours, payload.priority);
    return { task_id: Number(info.lastInsertRowid) };
  }

  const task = db.prepare("SELECT * FROM tasks WHERE id = ? AND status = 'todo'").get(payload.task_id);
  if (!task) throw Object.assign(new Error("That task no longer exists or is already done"), { status: 409 });

  if (proposal.action === "complete_task") {
    db.prepare("UPDATE tasks SET status = 'done', completed_at = ? WHERE id = ?").run(new Date().toISOString(), task.id);
    return { task_id: task.id };
  }

  if (proposal.action === "update_task") {
    const allowed = ["due_date", "est_hours", "priority"];
    const cols = Object.keys(payload.changes).filter((c) => allowed.includes(c));
    if (cols.length === 0) throw Object.assign(new Error("Nothing to change"), { status: 400 });
    db.prepare(`UPDATE tasks SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(
      ...cols.map((c) => payload.changes[c]),
      task.id
    );
    return { task_id: task.id };
  }

  throw Object.assign(new Error("Unknown action"), { status: 400 });
}

function pending(id) {
  const p = db.prepare("SELECT * FROM proposals WHERE id = ?").get(id);
  return p && p.status === "pending" ? p : null;
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM proposals WHERE status = ? ORDER BY id ASC").all(req.query.status || "pending");
  res.json(rows.map((p) => ({ ...p, payload: JSON.parse(p.payload_json), payload_json: undefined })));
});

router.post("/:id/approve", (req, res) => {
  const p = pending(req.params.id);
  if (!p) return res.status(404).json({ error: "No pending proposal with that id" });
  try {
    const result = apply(p);
    db.prepare("UPDATE proposals SET status = 'approved', resolved_at = datetime('now') WHERE id = ?").run(p.id);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post("/:id/reject", (req, res) => {
  const p = pending(req.params.id);
  if (!p) return res.status(404).json({ error: "No pending proposal with that id" });
  db.prepare("UPDATE proposals SET status = 'rejected', resolved_at = datetime('now') WHERE id = ?").run(p.id);
  res.json({ ok: true });
});

module.exports = router;
