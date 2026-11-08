const LEVELS = [
  { level: 1, title: "Getting Started", threshold: 0 },
  { level: 2, title: "Building Momentum", threshold: 150 },
  { level: 3, title: "Consistent", threshold: 400 },
  { level: 4, title: "Focused", threshold: 800 },
  { level: 5, title: "Disciplined", threshold: 1400 },
  { level: 6, title: "Sharp", threshold: 2200 },
  { level: 7, title: "Relentless", threshold: 3200 },
  { level: 8, title: "Elite", threshold: 4500 },
  { level: 9, title: "Mastery", threshold: 6000 },
  { level: 10, title: "Academic Weapon", threshold: 8000 },
];
const EXTRA_STEP = 2500; // beyond level 10, each level costs +2500 more points

function levelForPoints(totalPointsEverEarned) {
  const p = Math.max(0, totalPointsEverEarned);
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (p >= l.threshold) current = l;
    else break;
  }

  if (current.level < 10) {
    const idx = LEVELS.findIndex((l) => l.level === current.level);
    const next = LEVELS[idx + 1];
    return {
      level: current.level,
      title: current.title,
      points_into_level: p - current.threshold,
      points_for_next: next.threshold - current.threshold,
      next_title: next.title,
    };
  }

  // Beyond level 10: extrapolate
  const over = p - 8000;
  const extraLevels = Math.floor(over / EXTRA_STEP);
  const level = 10 + extraLevels;
  const levelThreshold = 8000 + extraLevels * EXTRA_STEP;
  return {
    level,
    title: extraLevels === 0 ? "Academic Weapon" : `Academic Weapon +${extraLevels}`,
    points_into_level: p - levelThreshold,
    points_for_next: EXTRA_STEP,
    next_title: `Academic Weapon +${extraLevels + 1}`,
  };
}

module.exports = { levelForPoints };
