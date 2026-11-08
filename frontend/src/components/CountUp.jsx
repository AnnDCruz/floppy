import React, { useEffect, useRef, useState } from "react";

// Animates a number from wherever it currently is to `value` (so a stat that changes
// after a session counts up from the old figure). Respects "reduce motion".
export default function CountUp({ value, decimals = 0, duration = 900 }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      current.current = target;
      setShown(target);
      return undefined;
    }
    const from = current.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      current.current = from + (target - from) * eased;
      setShown(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <>{shown.toFixed(decimals)}</>;
}
