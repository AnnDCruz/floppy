const { api, checkServer } = require("./api-client");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--subject") {
      args.subject = argv[++i];
    } else if (argv[i] === "--interval") {
      args.interval = Number(argv[++i]);
    } else {
      args._.push(argv[i]);
    }
  }
  return args;
}

async function main() {
  await checkServer();
  const args = parseArgs(process.argv.slice(2));
  const concept = args._.join(" ").trim();

  if (!concept) {
    console.error('Usage: node add-review.js "Concept Name" [--subject "Subject Name"] [--interval 4]');
    process.exit(1);
  }

  let subjectId = null;
  if (args.subject) {
    const subjects = await api("/subjects");
    const match = subjects.find((s) => s.name.toLowerCase() === args.subject.toLowerCase());
    if (!match) {
      console.error(`No subject found matching "${args.subject}". Available: ${subjects.map((s) => s.name).join(", ")}`);
      process.exit(1);
    }
    subjectId = match.id;
  }

  const review = await api("/reviews", {
    method: "POST",
    body: JSON.stringify({ concept, subject_id: subjectId, interval_days: args.interval || 4 }),
  });

  console.log(`✅  Added review: "${review.concept}" — due ${review.next_due_date} (every ${review.interval_days}d)`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
