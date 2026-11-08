const express = require("express");
const db = require("../db/db");

const router = express.Router();

const PALETTE = ["#5FA8A0", "#E8A33D", "#D97A6C", "#8E8CD8", "#7FB88A", "#C97FB8"];

router.get("/", (req, res) => {
  const subjects = db.prepare("SELECT * FROM subjects ORDER BY name ASC").all();
  res.json(subjects);
});

router.post("/", (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  const existingCount = db.prepare("SELECT COUNT(*) AS c FROM subjects").get().c;
  const chosenColor = color || PALETTE[existingCount % PALETTE.length];
  try {
    const info = db
      .prepare("INSERT INTO subjects (name, color) VALUES (?, ?)")
      .run(name.trim(), chosenColor);
    const subject = db.prepare("SELECT * FROM subjects WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(subject);
  } catch (e) {
    res.status(400).json({ error: "A subject with that name already exists" });
  }
});

router.patch("/:id", (req, res) => {
  const { name, color } = req.body;
  const updates = [];
  const values = [];
  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: "Name cannot be empty" });
    updates.push("name = ?");
    values.push(name.trim());
  }
  if (color !== undefined) {
    updates.push("color = ?");
    values.push(color);
  }
  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
  values.push(req.params.id);
  try {
    db.prepare(`UPDATE subjects SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  } catch (e) {
    return res.status(400).json({ error: "A subject with that name already exists" });
  }
  res.json(db.prepare("SELECT * FROM subjects WHERE id = ?").get(req.params.id));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM subjects WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// Aggregated stats per subject: total minutes, session count, avg session, points
router.get("/stats", (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.id, s.name, s.color,
              COUNT(sess.id) AS session_count,
              COALESCE(SUM(sess.duration_minutes),0) AS total_minutes,
              COALESCE(SUM(sess.points_earned),0) AS total_points
       FROM subjects s
       LEFT JOIN sessions sess ON sess.subject_id = s.id
       GROUP BY s.id
       ORDER BY total_minutes DESC`
    )
    .all();

  const grandTotal = rows.reduce((a, r) => a + r.total_minutes, 0);

  const withPct = rows.map((r) => ({
    ...r,
    avg_minutes: r.session_count ? Math.round(r.total_minutes / r.session_count) : 0,
    pct_of_total: grandTotal ? Math.round((r.total_minutes / grandTotal) * 100) : 0,
  }));

  res.json({ subjects: withPct, total_minutes: grandTotal });
});

module.exports = router;
