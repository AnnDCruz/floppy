const DEFAULT_TIME_ZONE = "Asia/Dubai";
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE;

function dateInTimeZone(date = new Date(), timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function parseDateOnly(dateStr) {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new TypeError("Expected a date in YYYY-MM-DD format");
  }
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateStr) {
    throw new TypeError("Expected a real calendar date");
  }
  return date;
}

function addDays(dateStr, days) {
  if (!Number.isInteger(days)) throw new TypeError("days must be an integer");
  const date = parseDateOnly(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(dateStr) {
  const day = parseDateOnly(dateStr).getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return addDays(dateStr, -daysSinceMonday);
}

module.exports = { APP_TIME_ZONE, dateInTimeZone, addDays, startOfWeek };
