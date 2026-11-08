const express = require("express");
const db = require("../db/db");
const { getPointsBalance, getTotalPointsEarned, freezeCost } = require("../db/streak");
const { levelForPoints } = require("../db/levels");

const router = express.Router();

router.get("/", (req, res) => {
  const state = db.prepare("SELECT * FROM streak_state WHERE id = 1").get();
  const balance = getPointsBalance();
  const freezesUsed = db.prepare("SELECT COUNT(*) AS c FROM streak_freezes").get().c;
  res.json({
    current_streak: state.current_streak,
    longest_streak: state.longest_streak,
    last_active_date: state.last_active_date,
    points_balance: balance,
    level: levelForPoints(getTotalPointsEarned()),
    next_freeze_cost: freezeCost(state.current_streak),
    freezes_used: freezesUsed,
  });
});

router.get("/freezes", (req, res) => {
  const rows = db.prepare("SELECT * FROM streak_freezes ORDER BY frozen_date DESC").all();
  res.json(rows);
});

module.exports = router;
