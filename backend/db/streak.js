const db = require("./db");

function dateOnly(d) {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  // a, b are 'YYYY-MM-DD' strings. Returns b - a in whole days.
  const da = new Date(a + "T00:00:00Z");
  const db_ = new Date(b + "T00:00:00Z");
  return Math.round((db_ - da) / 86400000);
}

function getTotalPointsEarned() {
  return db.prepare("SELECT COALESCE(SUM(points_earned),0) AS s FROM sessions").get().s;
}

function getPointsBalance() {
  const earned = getTotalPointsEarned();
  const spent = db.prepare("SELECT COALESCE(SUM(cost),0) AS s FROM streak_freezes").get().s;
  return earned - spent;
}

function freezeCost(streakLength) {
  // Scales with streak length: base 30 + 8 per day already in the streak
  return 30 + streakLength * 8;
}

// Called whenever a session is logged for `sessionDate` (YYYY-MM-DD).
// Applies streak increment / auto-freeze-bridge / reset logic.
function registerActivity(sessionDate) {
  const state = db.prepare("SELECT * FROM streak_state WHERE id = 1").get();

  if (!state.last_active_date) {
    const next = 1;
    db.prepare(
      "UPDATE streak_state SET current_streak = ?, longest_streak = MAX(longest_streak, ?), last_active_date = ? WHERE id = 1"
    ).run(next, next, sessionDate);
    return;
  }

  const diff = daysBetween(state.last_active_date, sessionDate);

  if (diff <= 0) {
    // Same day or backfilled earlier date — no streak change, just ensure last_active isn't moved backwards
    if (diff === 0) return;
    return; // ignore sessions logged for past dates for streak purposes
  }

  if (diff === 1) {
    const next = state.current_streak + 1;
    db.prepare(
      "UPDATE streak_state SET current_streak = ?, longest_streak = MAX(longest_streak, ?), last_active_date = ? WHERE id = 1"
    ).run(next, next, sessionDate);
    return;
  }

  // diff >= 2: there's a gap of (diff - 1) missed days. Try to bridge with points, one missed day at a time.
  let streak = state.current_streak;
  let bridgedAll = true;
  const balanceStart = getPointsBalance();
  let spendable = balanceStart;

  for (let i = 1; i < diff; i++) {
    const missedDate = new Date(state.last_active_date + "T00:00:00Z");
    missedDate.setUTCDate(missedDate.getUTCDate() + i);
    const missedStr = dateOnly(missedDate);
    const cost = freezeCost(streak);

    if (spendable >= cost) {
      db.prepare("INSERT INTO streak_freezes (frozen_date, cost) VALUES (?, ?)").run(missedStr, cost);
      spendable -= cost;
      streak += 1;
    } else {
      bridgedAll = false;
      break;
    }
  }

  if (!bridgedAll) {
    streak = 1; // reset — today's session starts a new streak
  } else {
    streak += 1; // today's session itself
  }

  db.prepare(
    "UPDATE streak_state SET current_streak = ?, longest_streak = MAX(longest_streak, ?), last_active_date = ? WHERE id = 1"
  ).run(streak, streak, sessionDate);
}

module.exports = { registerActivity, getPointsBalance, getTotalPointsEarned, freezeCost, daysBetween, dateOnly };
