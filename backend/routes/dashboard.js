const express = require("express");
const db = require("../db/db");
const { getPointsBalance, getTotalPointsEarned } = require("../db/streak");
const { levelForPoints } = require("../db/levels");

const router = express.Router();

function startOfWeek(dateStr) {
  // Monday-start week
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

router.get("/", (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = startOfWeek(today);
  const lastWeekStart = new Date(weekStart + "T00:00:00Z");
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
  const lastWeekStartStr = lastWeekStart.toISOString().slice(0, 10);

  const todayAgg = db
    .prepare(
      `SELECT COALESCE(SUM(duration_minutes),0) AS minutes, COALESCE(SUM(points_earned),0) AS points, COUNT(*) AS sessions
       FROM sessions WHERE session_date = ?`
    )
    .get(today);

  const weekAgg = db
    .prepare(
      `SELECT COALESCE(SUM(duration_minutes),0) AS minutes, COALESCE(SUM(points_earned),0) AS points, COUNT(*) AS sessions
       FROM sessions WHERE session_date >= ?`
    )
    .get(weekStart);

  const lastWeekAgg = db
    .prepare(
      `SELECT COALESCE(SUM(duration_minutes),0) AS minutes
       FROM sessions WHERE session_date >= ? AND session_date < ?`
    )
    .get(lastWeekStartStr, weekStart);

  const streak = db.prepare("SELECT * FROM streak_state WHERE id = 1").get();

  const upcoming = db
    .prepare(
      `SELECT d.*, s.name AS subject_name, s.color AS subject_color
       FROM deadlines d LEFT JOIN subjects s ON s.id = d.subject_id
       WHERE d.due_date >= ? AND d.completed = 0
       ORDER BY d.due_date ASC
       LIMIT 5`
    )
    .all(today);

  const recentSessions = db
    .prepare(
      `SELECT sess.*, subj.name AS subject_name, subj.color AS subject_color,
              proj.name AS project_name, proj.color AS project_color
       FROM sessions sess
       JOIN subjects subj ON subj.id = sess.subject_id
       LEFT JOIN projects proj ON proj.id = sess.project_id
       WHERE sess.session_date = ?
       ORDER BY sess.started_at DESC`
    )
    .all(today);

  // Today's Mission: deadlines due today (not completed) + review items due today or earlier
  const missionDeadlines = db
    .prepare(
      `SELECT d.*, s.name AS subject_name, s.color AS subject_color, 'deadline' AS mission_type
       FROM deadlines d LEFT JOIN subjects s ON s.id = d.subject_id
       WHERE d.due_date = ? AND d.completed = 0
       ORDER BY d.priority ASC`
    )
    .all(today);

  const missionReviews = db
    .prepare(
      `SELECT r.*, s.name AS subject_name, s.color AS subject_color, 'review' AS mission_type
       FROM review_items r LEFT JOIN subjects s ON s.id = r.subject_id
       WHERE r.next_due_date <= ?
       ORDER BY r.next_due_date ASC`
    )
    .all(today);

  const level = levelForPoints(getTotalPointsEarned());

  res.json({
    date: today,
    today: todayAgg,
    week: weekAgg,
    last_week_minutes: lastWeekAgg.minutes,
    points_balance: getPointsBalance(),
    level,
    streak: {
      current: streak.current_streak,
      longest: streak.longest_streak,
      last_active_date: streak.last_active_date,
    },
    upcoming_deadlines: upcoming,
    recent_sessions: recentSessions,
    mission: {
      deadlines: missionDeadlines,
      reviews: missionReviews,
    },
  });
});

module.exports = router;
