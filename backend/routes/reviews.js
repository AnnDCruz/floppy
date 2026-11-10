const express = require("express");
const db = require("../db/db");
const { dateInTimeZone, addDays } = require("../utils/date");

const router = express.Router();

function today() {
  return dateInTimeZone();
}

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, s.name AS subject_name, s.color AS subject_color
       FROM review_items r LEFT JOIN subjects s ON s.id = r.subject_id
       ORDER BY r.next_due_date ASC`
    )
    .all();
  res.json(rows);
});

router.get("/due", (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, s.name AS subject_name, s.color AS subject_color
       FROM review_items r LEFT JOIN subjects s ON s.id = r.subject_id
       WHERE r.next_due_date <= ?
       ORDER BY r.next_due_date ASC`
    )
    .all(today());
  res.json(rows);
});

router.post("/", (req, res) => {
  const { concept, subject_id, interval_days } = req.body;
  if (!concept || !concept.trim()) return res.status(400).json({ error: "concept is required" });
  const interval = Math.max(1, Number(interval_days) || 4);
  const info = db
    .prepare(
      `INSERT INTO review_items (concept, subject_id, interval_days, next_due_date)
       VALUES (?, ?, ?, ?)`
    )
    .run(concept.trim(), subject_id || null, interval, today());
  res.status(201).json(db.prepare("SELECT * FROM review_items WHERE id = ?").get(info.lastInsertRowid));
});

router.post("/:id/mark-reviewed", (req, res) => {
  const item = db.prepare("SELECT * FROM review_items WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  const reviewedOn = today();
  const nextDate = addDays(reviewedOn, item.interval_days);
  db.prepare(
    "UPDATE review_items SET last_reviewed_date = ?, next_due_date = ?, review_count = review_count + 1 WHERE id = ?"
  ).run(reviewedOn, nextDate, req.params.id);
  res.json(db.prepare("SELECT * FROM review_items WHERE id = ?").get(req.params.id));
});

router.patch("/:id", (req, res) => {
  const { concept, subject_id, interval_days } = req.body;
  const updates = [];
  const values = [];
  if (concept !== undefined) { updates.push("concept = ?"); values.push(concept); }
  if (subject_id !== undefined) { updates.push("subject_id = ?"); values.push(subject_id); }
  if (interval_days !== undefined) { updates.push("interval_days = ?"); values.push(Math.max(1, Number(interval_days) || 4)); }
  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
  values.push(req.params.id);
  db.prepare(`UPDATE review_items SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  res.json(db.prepare("SELECT * FROM review_items WHERE id = ?").get(req.params.id));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM review_items WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
