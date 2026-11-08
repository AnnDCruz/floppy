const express = require("express");
const db = require("../db/db");

const router = express.Router();

const MAX_BODY = 50000;

function validate(body, { partial }) {
  const out = {};
  if (body.title !== undefined) out.title = String(body.title).trim().slice(0, 200) || "Untitled";
  else if (!partial) out.title = "Untitled";
  if (body.body !== undefined) {
    const b = String(body.body);
    if (b.length > MAX_BODY) return { error: `A note can hold up to ${MAX_BODY} characters` };
    out.body = b;
  }
  if (body.pinned !== undefined) out.pinned = body.pinned ? 1 : 0;
  return { value: out };
}

router.get("/", (req, res) => {
  res.json(db.prepare("SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC, id DESC").all());
});

router.post("/", (req, res) => {
  const { value, error } = validate(req.body || {}, { partial: false });
  if (error) return res.status(400).json({ error });
  const now = new Date().toISOString();
  const info = db
    .prepare("INSERT INTO notes (title, body, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(value.title, value.body ?? "", value.pinned ?? 0, now, now);
  res.status(201).json(db.prepare("SELECT * FROM notes WHERE id = ?").get(info.lastInsertRowid));
});

router.patch("/:id", (req, res) => {
  const { value, error } = validate(req.body || {}, { partial: true });
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(value);
  if (cols.length === 0) return res.status(400).json({ error: "No fields to update" });
  // Pinning alone shouldn't bump a note to "recently edited".
  const touchesContent = cols.some((c) => c === "title" || c === "body");
  if (touchesContent) {
    value.updated_at = new Date().toISOString();
    cols.push("updated_at");
  }
  const info = db
    .prepare(`UPDATE notes SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
    .run(...cols.map((c) => value[c]), req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Note not found" });
  res.json(db.prepare("SELECT * FROM notes WHERE id = ?").get(req.params.id));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM notes WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
