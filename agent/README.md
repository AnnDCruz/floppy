# StudyForge Agent Scripts

Scripts that talk to your StudyForge backend's API. All except `plan-day.js` use no AI model; `plan-day.js` uses the local model configured in the backend (free by default). They just read and write the same data the web app uses.

**Requires the backend to be running** (`cd ../backend && npm start`).

## Setup

Nothing to install — these use Node's built-in `fetch`, no dependencies. Just make sure you're on Node 18+.

## Commands

Run from this `agent/` folder:

```bash
# Morning briefing — today's mission, streak, week comparison, what's logged so far
node morning-briefing.js

# Weekly rebalance check — flags subjects with an upcoming deadline that got zero time this week
node weekly-rebalance.js

# AI plan for today (needs Ollama running, see the main README), then approve/reject suggestions
node plan-day.js --hours 5 --note "light day"
node plan-day.js approve 3

# Quickly add a project without opening the app
node add-project.js "Trading Strategy Dashboard"

# Quickly add a review item (concept you want to revisit) without opening the app
node add-review.js "DCF Valuation" --subject "Quant Finance" --interval 4
```

Or, via npm:

```bash
npm run briefing
npm run rebalance
npm run add-project -- "Trading Strategy Dashboard"
npm run add-review -- "DCF Valuation" --subject "Quant Finance" --interval 4
```

## Using this with your Claude/AI teaching sessions

Since concept-extraction is a prompting task, not something these scripts do:

1. After a Claude teaching session, ask Claude something like: *"Give me a short concept name, the subject it belongs to, and a suggested review interval in days for what we just covered."*
2. Take that output and run `add-review.js` with it — one line, no context-switching into the app.

## Pointing at a different backend port/host

If your backend isn't on the default `http://localhost:4000`, set an env var:

```bash
STUDYFORGE_API=http://localhost:5000/api node morning-briefing.js
```
