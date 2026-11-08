import React, { useEffect, useState } from "react";
import { api } from "../api";

// Centered glass pill used at the top of the Dashboard and Calendar.
export function TopPill({ children, className = "" }) {
  return <div className={`top-pill ${className}`}>{children}</div>;
}

// DATE ........ TIME, ticking once a second without re-rendering the page around it.
export function DateTimePill() {
  const [now, setNow] = useState(() => new Date());
  const [timeZone, setTimeZone] = useState(null);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    api.getClock().then((clock) => setTimeZone(clock.time_zone)).catch(() => {});
    return () => clearInterval(id);
  }, []);
  const date = now.toLocaleDateString(undefined, {
    ...(timeZone ? { timeZone } : {}),
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = now.toLocaleTimeString(undefined, {
    ...(timeZone ? { timeZone } : {}),
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <TopPill>
      <span className="pill-date">{date.toUpperCase()}</span>
      <span className="pill-time mono">{time.toUpperCase()}</span>
    </TopPill>
  );
}
