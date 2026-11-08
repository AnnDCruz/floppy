const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { APP_TIME_ZONE, dateInTimeZone, addDays, startOfWeek } = require("../utils/date");

test("Dubai calendar day changes at midnight, not UTC midnight", () => {
  assert.equal(dateInTimeZone(new Date("2026-11-07T19:59:00.000Z"), "Asia/Dubai"), "2026-11-07");
  assert.equal(dateInTimeZone(new Date("2026-11-07T20:00:00.000Z"), "Asia/Dubai"), "2026-11-08");
});

test("date-only arithmetic is stable across week and month boundaries", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(startOfWeek("2026-11-08"), "2026-11-02");
  assert.equal(startOfWeek("2026-11-09"), "2026-11-09");
});

test("date arithmetic rejects invalid dates", () => {
  assert.throws(() => addDays("2026-02-30", 1), /real calendar date/);
});

test("clock endpoint returns the configured app date and timezone", async (t) => {
  const app = express();
  app.use("/api/clock", require("../routes/clock"));
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));

  const response = await fetch(`http://localhost:${server.address().port}/api/clock`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    date: dateInTimeZone(new Date(), APP_TIME_ZONE),
    time_zone: APP_TIME_ZONE,
  });
});
