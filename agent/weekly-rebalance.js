const { api, checkServer } = require("./api-client");

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

function fmtHours(minutes) {
  return (minutes / 60).toFixed(1);
}

async function main() {
  await checkServer();

  const [subjects, sessions, upcoming] = await Promise.all([
    api("/subjects"),
    api("/sessions?limit=1000"),
    api("/deadlines?upcoming=30"),
  ]);

  const today = new Date();
  const thisWeekStart = dateStr(startOfWeek(today));
  const lastWeekStartDate = startOfWeek(today);
  lastWeekStartDate.setDate(lastWeekStartDate.getDate() - 7);
  const lastWeekStart = dateStr(lastWeekStartDate);

  const bySubject = {};
  subjects.forEach((s) => {
    bySubject[s.id] = { name: s.name, thisWeek: 0, lastWeek: 0 };
  });

  sessions.forEach((s) => {
    if (!bySubject[s.subject_id]) return;
    if (s.session_date >= thisWeekStart) {
      bySubject[s.subject_id].thisWeek += s.duration_minutes;
    } else if (s.session_date >= lastWeekStart && s.session_date < thisWeekStart) {
      bySubject[s.subject_id].lastWeek += s.duration_minutes;
    }
  });

  // Deadlines within the next 7 days, grouped by subject
  const soon = upcoming.filter((d) => {
    const days = Math.round((new Date(d.due_date) - today) / 86400000);
    return days >= 0 && days <= 7;
  });
  const deadlineSubjectIds = new Set(soon.filter((d) => d.subject_id).map((d) => d.subject_id));

  console.log("\n📊  Weekly Rebalance Check\n");
  console.log("Subject               This wk   Last wk   Change   Deadline in 7d?");
  console.log("-".repeat(70));

  Object.entries(bySubject)
    .sort((a, b) => a[1].thisWeek - b[1].thisWeek)
    .forEach(([id, s]) => {
      const change =
        s.lastWeek > 0 ? `${s.thisWeek >= s.lastWeek ? "+" : ""}${Math.round(((s.thisWeek - s.lastWeek) / s.lastWeek) * 100)}%` : "—";
      const flag = deadlineSubjectIds.has(Number(id)) ? (s.thisWeek === 0 ? "⚠️  yes, untouched" : "yes") : "";
      console.log(
        `${s.name.padEnd(22)} ${fmtHours(s.thisWeek).padStart(6)}h  ${fmtHours(s.lastWeek).padStart(6)}h   ${change.padStart(6)}   ${flag}`
      );
    });

  const neglectedWithDeadlines = Object.entries(bySubject).filter(
    ([id, s]) => deadlineSubjectIds.has(Number(id)) && s.thisWeek === 0
  );

  if (neglectedWithDeadlines.length > 0) {
    console.log(`\n⚠️  Heads up: ${neglectedWithDeadlines.map(([, s]) => s.name).join(", ")} — deadline within 7 days, no time logged this week.`);
  } else {
    console.log(`\n✅  No subject with an upcoming deadline is currently untouched this week.`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
