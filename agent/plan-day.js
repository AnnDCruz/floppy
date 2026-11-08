const { api, checkServer } = require("./api-client");

// node plan-day.js [--hours 5] [--note "tired, keep it light"]   -> ask the AI planner for today's plan
// node plan-day.js approve <id>                                    -> apply a suggested change
// node plan-day.js reject <id>                                     -> discard a suggested change

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--hours") args.hours = Number(argv[++i]);
    else if (argv[i] === "--note") args.note = argv[++i];
    else args._.push(argv[i]);
  }
  return args;
}

function describe(p) {
  const d = p.payload;
  if (p.action === "add_task") return `Add task "${d.title}" (${d.area}, ${d.due_date || "no date"}, ${d.est_hours}h, ${d.priority})`;
  if (p.action === "complete_task") return `Mark done "${d.title}"`;
  return `Update "${d.title}": ${Object.entries(d.changes).map(([k, v]) => `${k} → ${v}`).join(", ")}`;
}

async function main() {
  await checkServer();
  const args = parseArgs(process.argv.slice(2));
  const [cmd, id] = args._;

  if (cmd === "approve" || cmd === "reject") {
    if (!id) throw new Error(`Usage: node plan-day.js ${cmd} <proposal id>`);
    await api(`/proposals/${id}/${cmd}`, { method: "POST" });
    console.log(cmd === "approve" ? `✅  Applied proposal ${id}` : `🗑  Rejected proposal ${id}`);
    return;
  }

  console.log("\n🧠  Planning your day (a local model can take a little while)…\n");
  const plan = await api("/agent/plan", {
    method: "POST",
    body: JSON.stringify({ hours: args.hours || 5, note: args.note || "" }),
  });

  const total = plan.today.reduce((s, x) => s + x.hours, 0);
  console.log(`${plan.summary}\n`);
  console.log(`📋  Today (${total}h of ${plan.hours_available}h)`);
  plan.today.forEach((t) => console.log(`   [${t.hours}h] ${t.title}  (${t.kind}) — ${t.why}`));

  if (plan.at_risk.length) {
    console.log(`\n⚠️   At risk`);
    plan.at_risk.forEach((t) => console.log(`   ${t.title} — ${t.reason}`));
  }

  if (plan.proposals.length) {
    console.log(`\n💡  Suggested changes (not applied until you approve)`);
    plan.proposals.forEach((p) => console.log(`   #${p.id}  ${describe(p)}\n        why: ${p.reason}`));
    console.log(`\n   node plan-day.js approve <id>   |   node plan-day.js reject <id>`);
  }
  console.log(`\n(model: ${plan.model})\n`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
