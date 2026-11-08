const { api, checkServer } = require("./api-client");

function fmtHours(minutes) {
  return (minutes / 60).toFixed(1);
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

async function main() {
  await checkServer();
  const d = await api("/dashboard");

  const lines = [];
  lines.push(`\n📋  StudyForge — ${fmtDate(d.date)}\n`);
  lines.push(`Level ${d.level.level} — ${d.level.title}  ·  ${d.points_balance} pts  ·  🔥 ${d.streak.current}-day streak`);

  // Week comparison
  if (d.last_week_minutes > 0) {
    const pct = Math.round(((d.week.minutes - d.last_week_minutes) / d.last_week_minutes) * 100);
    const arrow = pct >= 0 ? "↑" : "↓";
    lines.push(`This week: ${fmtHours(d.week.minutes)}h  (${arrow} ${Math.abs(pct)}% vs last week's ${fmtHours(d.last_week_minutes)}h)`);
  } else {
    lines.push(`This week: ${fmtHours(d.week.minutes)}h across ${d.week.sessions} sessions`);
  }

  // Today's mission
  const missionCount = d.mission.deadlines.length + d.mission.reviews.length;
  lines.push(`\n🎯  Today's Mission (${missionCount})`);
  if (missionCount === 0) {
    lines.push("   Nothing due today — clear board.");
  } else {
    d.mission.deadlines.forEach((item) => {
      lines.push(`   [deadline] ${item.title}${item.subject_name ? ` — ${item.subject_name}` : ""} (${item.priority})`);
    });
    d.mission.reviews.forEach((item) => {
      lines.push(`   [review]   ${item.concept}${item.subject_name ? ` — ${item.subject_name}` : ""}`);
    });
  }

  // Upcoming deadlines beyond today
  const laterDeadlines = d.upcoming_deadlines.filter((x) => x.due_date !== d.date);
  if (laterDeadlines.length > 0) {
    lines.push(`\n📅  Coming up`);
    laterDeadlines.forEach((item) => {
      lines.push(`   ${fmtDate(item.due_date)} — ${item.title}${item.subject_name ? ` (${item.subject_name})` : ""}`);
    });
  }

  // Yesterday / today sessions so far
  if (d.recent_sessions.length > 0) {
    lines.push(`\n⏱  Logged today`);
    d.recent_sessions.forEach((s) => {
      const proj = s.project_name ? ` · ${s.project_name}` : "";
      lines.push(`   ${s.subject_name}${proj} — ${s.duration_minutes} min (+${s.points_earned} pts)`);
    });
  } else {
    lines.push(`\n⏱  Nothing logged yet today.`);
  }

  console.log(lines.join("\n") + "\n");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
