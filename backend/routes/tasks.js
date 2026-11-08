const express = require("express");
const db = require("../db/db");

const router = express.Router();

const PRIORITIES = ["high", "medium", "low"];
const STATUSES = ["todo", "done"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validate(body, { partial }) {
  const out = {};
  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t) return { error: "title cannot be empty" };
    out.title = t.slice(0, 200);
  } else if (!partial) return { error: "title is required" };

  if (body.area !== undefined) out.area = String(body.area).trim().slice(0, 40) || "General";
  if (body.due_date !== undefined) {
    if (body.due_date === null || body.due_date === "") out.due_date = null;
    else if (DATE_RE.test(body.due_date)) out.due_date = body.due_date;
    else return { error: "due_date must be YYYY-MM-DD" };
  }
  if (body.est_hours !== undefined) {
    const h = Number(body.est_hours);
    if (!Number.isFinite(h) || h <= 0 || h > 100) return { error: "est_hours must be between 0 and 100" };
    out.est_hours = h;
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) return { error: "invalid priority" };
    out.priority = body.priority;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return { error: "invalid status" };
    out.status = body.status;
    out.completed_at = body.status === "done" ? new Date().toISOString() : null;
  }
  if (body.notes !== undefined) out.notes = String(body.notes).slice(0, 2000);
  return { value: out };
}

router.get("/", (req, res) => {
  const { status } = req.query;
  const rows = status
    ? db
        .prepare(
          `SELECT * FROM tasks WHERE status = ?
           ORDER BY due_date IS NULL, due_date ASC, id ASC`
        )
        .all(status)
    : db.prepare(`SELECT * FROM tasks ORDER BY status = 'done', due_date IS NULL, due_date ASC, id ASC`).all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const { value, error } = validate(req.body, { partial: false });
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(value);
  const info = db
    .prepare(`INSERT INTO tasks (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
    .run(...cols.map((c) => value[c]));
  res.status(201).json(db.prepare("SELECT * FROM tasks WHERE id = ?").get(info.lastInsertRowid));
});

router.patch("/:id", (req, res) => {
  const { value, error } = validate(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(value);
  if (cols.length === 0) return res.status(400).json({ error: "No fields to update" });
  const info = db
    .prepare(`UPDATE tasks SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
    .run(...cols.map((c) => value[c]), req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Task not found" });
  res.json(db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
