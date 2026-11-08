const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dbPath = process.env.STUDYFORGE_DB || path.join(__dirname, "studyforge.sqlite3");
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#5FA8A0',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  session_date TEXT NOT NULL,          -- YYYY-MM-DD (local day the session belongs to)
  started_at TEXT NOT NULL,            -- ISO timestamp
  duration_minutes INTEGER NOT NULL,
  points_earned INTEGER NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  due_date TEXT NOT NULL,              -- YYYY-MM-DD
  due_time TEXT,                       -- optional HH:MM
  type TEXT NOT NULL DEFAULT 'deadline', -- quiz | deadline | submission | exam
  priority TEXT NOT NULL DEFAULT 'medium', -- high | medium | low
  notes TEXT DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS streak_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT
);

CREATE TABLE IF NOT EXISTS streak_freezes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  frozen_date TEXT NOT NULL,           -- the missed day that got bridged
  cost INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active', -- active | paused | done
  color TEXT NOT NULL DEFAULT '#8E8CD8',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept TEXT NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  interval_days INTEGER NOT NULL DEFAULT 4,
  next_due_date TEXT NOT NULL,          -- YYYY-MM-DD
  last_reviewed_date TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO streak_state (id, current_streak, longest_streak, last_active_date)
VALUES (1, 0, 0, NULL);
`);

// Safe migration: add project_id to sessions if it doesn't already exist (older DB files won't have it)
const sessionCols = db.prepare("PRAGMA table_info(sessions)").all();
if (!sessionCols.some((c) => c.name === "project_id")) {
  db.exec("ALTER TABLE sessions ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;");
}

// --- Tasks + AI planning (propose-and-approve) ---------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'General',      -- Coursework | Internship | CoE | Projects | Personal | ...
  due_date TEXT,                             -- YYYY-MM-DD, optional
  est_hours REAL NOT NULL DEFAULT 1,
  priority TEXT NOT NULL DEFAULT 'medium',   -- high | medium | low
  status TEXT NOT NULL DEFAULT 'todo',       -- todo | done
  notes TEXT DEFAULT '',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_date TEXT NOT NULL,                   -- YYYY-MM-DD (local day)
  hours_available REAL NOT NULL,
  model TEXT NOT NULL,
  plan_json TEXT NOT NULL,                   -- summary, today, at_risk (already validated)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER REFERENCES agent_plans(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                      -- add_task | update_task | complete_task
  payload_json TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | rejected | expired
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
`);

// --- Calendar events + free-form notes -----------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,                  -- YYYY-MM-DD
  start_time TEXT,                           -- HH:MM (24h), optional
  end_time TEXT,                             -- HH:MM (24h), optional
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT 'Untitled',
  body TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

// Seed a few default subjects on first run so the app isn't empty
const subjectCount = db.prepare("SELECT COUNT(*) AS c FROM subjects").get().c;
if (subjectCount === 0) {
  const insert = db.prepare("INSERT INTO subjects (name, color) VALUES (?, ?)");
  const defaults = [
    ["Data Structures", "#5FA8A0"],
    ["Quant Finance", "#E8A33D"],
    ["Applied Math", "#D97A6C"],
    ["Blockchain / Web3", "#8E8CD8"],
  ];
  defaults.forEach((r) => insert.run(...r));
}

module.exports = db;
