const express = require("express");
const db = require("../db/db");

const router = express.Router();
const PALETTE = ["#8E8CD8", "#5FA8A0", "#E8A33D", "#D97A6C", "#7FB88A", "#C97FB8"];

router.get("/", (req, res) => {
  res.json(db.prepare("SELECT * FROM projects ORDER BY status ASC, name ASC").all());
});

router.post("/", (req, res) => {
  const { name, status, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  const existingCount = db.prepare("SELECT COUNT(*) AS c FROM projects").get().c;
  const chosenColor = color || PALETTE[existingCount % PALETTE.length];
  try {
    const info = db
      .prepare("INSERT INTO projects (name, status, color) VALUES (?, ?, ?)")
      .run(name.trim(), status || "active", chosenColor);
    res.status(201).json(db.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: "A project with that name already exists" });
  }
});

router.patch("/:id", (req, res) => {
  const { name, status, color } = req.body;
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push("name = ?"); values.push(name); }
  if (status !== undefined) { updates.push("status = ?"); values.push(status); }
  if (color !== undefined) { updates.push("color = ?"); values.push(color); }
  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
  values.push(req.params.id);
  db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  res.json(db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

router.get("/stats", (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.status, p.color,
              COUNT(s.id) AS session_count,
              COALESCE(SUM(s.duration_minutes),0) AS total_minutes,
              COALESCE(SUM(s.points_earned),0) AS total_points,
              MAX(s.session_date) AS last_worked
       FROM projects p
       LEFT JOIN sessions s ON s.project_id = p.id
       GROUP BY p.id
       ORDER BY p.status ASC, total_minutes DESC`
    )
    .all();
  res.json(rows);
});

module.exports = router;
