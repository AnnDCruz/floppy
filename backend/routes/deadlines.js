const express = require("express");
const db = require("../db/db");

const router = express.Router();

router.get("/", (req, res) => {
  const { month, from, upcoming } = req.query; // month = 'YYYY-MM'
  let rows;
  if (month) {
    rows = db
      .prepare(
        `SELECT d.*, s.name AS subject_name, s.color AS subject_color
         FROM deadlines d LEFT JOIN subjects s ON s.id = d.subject_id
         WHERE strftime('%Y-%m', d.due_date) = ?
         ORDER BY d.due_date ASC`
      )
      .all(month);
  } else if (upcoming) {
    rows = db
      .prepare(
        `SELECT d.*, s.name AS subject_name, s.color AS subject_color
         FROM deadlines d LEFT JOIN subjects s ON s.id = d.subject_id
         WHERE d.due_date >= ? AND d.completed = 0
         ORDER BY d.due_date ASC
         LIMIT ?`
      )
      .all(from || new Date().toISOString().slice(0, 10), Number(upcoming));
  } else {
    rows = db
      .prepare(
        `SELECT d.*, s.name AS subject_name, s.color AS subject_color
         FROM deadlines d LEFT JOIN subjects s ON s.id = d.subject_id
         ORDER BY d.due_date ASC`
      )
      .all();
  }
  res.json(rows);
});

router.get("/day/:date", (req, res) => {
  const rows = db
    .prepare(
      `SELECT d.*, s.name AS subject_name, s.color AS subject_color
       FROM deadlines d LEFT JOIN subjects s ON s.id = d.subject_id
       WHERE d.due_date = ?
       ORDER BY d.due_time ASC`
    )
    .all(req.params.date);
  res.json(rows);
});

router.post("/", (req, res) => {
  const { title, subject_id, due_date, due_time, type, priority, notes } = req.body;
  if (!title || !due_date) return res.status(400).json({ error: "title and due_date are required" });
  const info = db
    .prepare(
      `INSERT INTO deadlines (title, subject_id, due_date, due_time, type, priority, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title.trim(),
      subject_id || null,
      due_date,
      due_time || null,
      type || "deadline",
      priority || "medium",
      notes || ""
    );
  const deadline = db.prepare("SELECT * FROM deadlines WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(deadline);
});

router.patch("/:id", (req, res) => {
  const fields = ["title", "subject_id", "due_date", "due_time", "type", "priority", "notes", "completed"];
  const updates = [];
  const values = [];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  });
  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
  values.push(req.params.id);
  db.prepare(`UPDATE deadlines SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  const deadline = db.prepare("SELECT * FROM deadlines WHERE id = ?").get(req.params.id);
  res.json(deadline);
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM deadlines WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
