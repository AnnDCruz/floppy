const express = require("express");
const planner = require("../ai/planner");
const llm = require("../ai/llm");

const router = express.Router();

router.get("/status", (req, res) => {
  res.json({ provider: llm.provider(), model: llm.modelName() });
});

router.get("/latest", (req, res) => {
  res.json(planner.latestPlanForToday());
});

router.post("/plan", async (req, res) => {
  try {
    const plan = await planner.planDay({ hours: req.body?.hours, note: req.body?.note });
    res.status(201).json(plan);
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

module.exports = router;
