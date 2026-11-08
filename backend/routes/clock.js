const express = require("express");
const { APP_TIME_ZONE, dateInTimeZone } = require("../utils/date");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    date: dateInTimeZone(),
    time_zone: APP_TIME_ZONE,
  });
});

module.exports = router;
