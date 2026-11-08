process.removeAllListeners("warning"); // silence node:sqlite's experimental-feature warning noise

const express = require("express");
const cors = require("cors");

const subjectsRouter = require("./routes/subjects");
const sessionsRouter = require("./routes/sessions");
const deadlinesRouter = require("./routes/deadlines");
const streakRouter = require("./routes/streak");
const dashboardRouter = require("./routes/dashboard");
const projectsRouter = require("./routes/projects");
const reviewsRouter = require("./routes/reviews");
const tasksRouter = require("./routes/tasks");
const proposalsRouter = require("./routes/proposals");
const agentRouter = require("./routes/agent");
const eventsRouter = require("./routes/events");
const notesRouter = require("./routes/notes");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/subjects", subjectsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/deadlines", deadlinesRouter);
app.use("/api/streak", streakRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/proposals", proposalsRouter);
app.use("/api/agent", agentRouter);
app.use("/api/events", eventsRouter);
app.use("/api/notes", notesRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`StudyForge backend running on http://localhost:${PORT}`);
});
