import React, { useEffect, useState } from "react";

// Centered glass pill used at the top of the Dashboard and Calendar.
export function TopPill({ children, className = "" }) {
  return <div className={`top-pill ${className}`}>{children}</div>;
}

// DATE ........ TIME, ticking once a second without re-rendering the page around it.
export function DateTimePill() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const date = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <TopPill>
      <span className="pill-date">{date.toUpperCase()}</span>
      <span className="pill-time mono">{time.toUpperCase()}</span>
    </TopPill>
  );
}
