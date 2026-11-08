const express = require("express");
const db = require("../db/db");

const router = express.Router();

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRealDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Returns { value } with only the fields that were supplied, or { error }.
function validate(body, { partial }) {
  const out = {};
  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t) return { error: "title cannot be empty" };
    out.title = t.slice(0, 200);
  } else if (!partial) return { error: "title is required" };

  if (body.event_date !== undefined) {
    if (!isRealDate(body.event_date)) return { error: "event_date must be a real date (YYYY-MM-DD)" };
    out.event_date = body.event_date;
  } else if (!partial) return { error: "event_date is required" };

  for (const k of ["start_time", "end_time"]) {
    if (body[k] === undefined) continue;
    if (body[k] === null || body[k] === "") out[k] = null;
    else if (TIME_RE.test(body[k])) out[k] = body[k];
    else return { error: `${k} must be HH:MM` };
  }
  if (body.notes !== undefined) out.notes = String(body.notes).slice(0, 2000);
  return { value: out };
}

function checkTimes(start, end) {
  if (start && end && end < start) return "end_time can't be before start_time";
  return null;
}

router.get("/", (req, res) => {
  const { month, date, from, limit } = req.query;
  let where = "1=1";
  const params = [];
  if (date) { where = "event_date = ?"; params.push(date); }
  else if (month) { where = "event_date LIKE ?"; params.push(`${month}%`); }
  else if (from) { where = "event_date >= ?"; params.push(from); }
  const cap = Math.min(500, Math.max(1, Number(limit) || 500));
  const rows = db
    .prepare(`SELECT * FROM events WHERE ${where} ORDER BY event_date ASC, start_time IS NULL, start_time ASC, id ASC LIMIT ${cap}`)
    .all(...params);
  res.json(rows);
});

router.post("/", (req, res) => {
  const { value, error } = validate(req.body || {}, { partial: false });
  if (error) return res.status(400).json({ error });
  const timeErr = checkTimes(value.start_time, value.end_time);
  if (timeErr) return res.status(400).json({ error: timeErr });
  value.created_at = new Date().toISOString();
  const cols = Object.keys(value);
  const info = db
    .prepare(`INSERT INTO events (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
    .run(...cols.map((c) => value[c]));
  res.status(201).json(db.prepare("SELECT * FROM events WHERE id = ?").get(info.lastInsertRowid));
});

router.patch("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Event not found" });
  const { value, error } = validate(req.body || {}, { partial: true });
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(value);
  if (cols.length === 0) return res.status(400).json({ error: "No fields to update" });
  const merged = { ...existing, ...value };
  const timeErr = checkTimes(merged.start_time, merged.end_time);
  if (timeErr) return res.status(400).json({ error: timeErr });
  db.prepare(`UPDATE events SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(
    ...cols.map((c) => value[c]),
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
