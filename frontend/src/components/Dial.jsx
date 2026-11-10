import React from "react";

function fmt(seconds) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function Dial({ size = 172, strokeWidth = 9, secondsLeft, totalSeconds, phase, gradId }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const offset = circumference * (1 - pct);
  const isSmall = size <= 200;

  const stateLabel =
    phase === "focus" ? "Focusing" : phase === "break" ? "Break" : phase === "done" ? "Complete" : "Ready";

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        className={isSmall ? "dial-svg" : "big-dial-svg"}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5b9bff" />
            <stop offset="100%" stopColor="#2f66e0" />
          </linearGradient>
        </defs>
        <circle
          className={isSmall ? "dial-track" : "big-dial-track"}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
        />
        <circle
          className={isSmall ? "dial-progress" : "big-dial-progress"}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          stroke={`url(#${gradId})`}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={isSmall ? "dial-center" : "big-dial-center"}>
        <div className={isSmall ? "dial-time mono" : "big-dial-time mono"}>{fmt(secondsLeft)}</div>
        <div className={isSmall ? "dial-state" : "big-dial-state"}>{stateLabel}</div>
      </div>
    </div>
  );
}
