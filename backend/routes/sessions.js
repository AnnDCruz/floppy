const express = require("express");
const db = require("../db/db");
const { registerActivity } = require("../db/streak");
const { dateInTimeZone } = require("../utils/date");

const router = express.Router();

// Points formula: ~1.6 pts per minute, rounded — keeps a 25 min session at ~40 pts (matches design ref)
function pointsForDuration(minutes) {
  return Math.round(minutes * 1.6);
}

router.get("/", (req, res) => {
  const { date, limit } = req.query;
  let rows;
  if (date) {
    rows = db
      .prepare(
        `SELECT sess.*, subj.name AS subject_name, subj.color AS subject_color,
                proj.name AS project_name, proj.color AS project_color
         FROM sessions sess
         JOIN subjects subj ON subj.id = sess.subject_id
         LEFT JOIN projects proj ON proj.id = sess.project_id
         WHERE sess.session_date = ?
         ORDER BY sess.started_at DESC`
      )
      .all(date);
  } else {
    rows = db
      .prepare(
        `SELECT sess.*, subj.name AS subject_name, subj.color AS subject_color,
                proj.name AS project_name, proj.color AS project_color
         FROM sessions sess
         JOIN subjects subj ON subj.id = sess.subject_id
         LEFT JOIN projects proj ON proj.id = sess.project_id
         ORDER BY sess.started_at DESC
         LIMIT ?`
      )
      .all(limit ? Number(limit) : 50);
  }
  res.json(rows);
});

router.post("/", (req, res) => {
  const { subject_id, project_id, duration_minutes, notes, session_date, started_at } = req.body;
  if (!subject_id || !duration_minutes) {
    return res.status(400).json({ error: "subject_id and duration_minutes are required" });
  }
  const subj = db.prepare("SELECT * FROM subjects WHERE id = ?").get(subject_id);
  if (!subj) return res.status(400).json({ error: "Unknown subject" });

  const now = new Date();
  const finalDate = session_date || dateInTimeZone(now);
  const finalStartedAt = started_at || now.toISOString();
  const points = pointsForDuration(duration_minutes);

  const info = db
    .prepare(
      `INSERT INTO sessions (subject_id, project_id, session_date, started_at, duration_minutes, points_earned, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(subject_id, project_id || null, finalDate, finalStartedAt, duration_minutes, points, notes || "");

  registerActivity(finalDate);

  const session = db
    .prepare(
      `SELECT sess.*, subj.name AS subject_name, subj.color AS subject_color,
              proj.name AS project_name, proj.color AS project_color
       FROM sessions sess
       JOIN subjects subj ON subj.id = sess.subject_id
       LEFT JOIN projects proj ON proj.id = sess.project_id
       WHERE sess.id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json(session);
});

router.patch("/:id/notes", (req, res) => {
  const { notes } = req.body;
  db.prepare("UPDATE sessions SET notes = ? WHERE id = ?").run(notes || "", req.params.id);
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  res.json(session);
});

module.exports = router;
