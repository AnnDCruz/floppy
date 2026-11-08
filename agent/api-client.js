const BASE = process.env.STUDYFORGE_API || "http://localhost:4000/api";

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch (_) {}
    throw new Error(`StudyForge API error: ${msg}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function checkServer() {
  return api("/health").catch(() => {
    console.error(
      `\nCouldn't reach the StudyForge backend at ${BASE}.\nMake sure it's running: cd backend && npm start\n`
    );
    process.exit(1);
  });
}

module.exports = { api, checkServer, BASE };
