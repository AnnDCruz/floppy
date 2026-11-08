const { api, checkServer } = require("./api-client");

async function main() {
  await checkServer();
  const name = process.argv.slice(2).join(" ").trim();
  if (!name) {
    console.error('Usage: node add-project.js "Project Name"');
    process.exit(1);
  }
  const project = await api("/projects", { method: "POST", body: JSON.stringify({ name }) });
  console.log(`✅  Added project: ${project.name} (id ${project.id})`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
