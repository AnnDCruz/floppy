import React, { useEffect } from "react";

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4200);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="toast-wrap">
      <div className="toast">
        <div className="toast-title">Round complete</div>
        <div className="toast-body">
          {toast.subjectName} · {toast.minutes} min
          {toast.projectName ? ` · ${toast.projectName}` : ""}
        </div>
        <div className="toast-meta">
          <span className="mono" style={{ color: "var(--amber)" }}>
            +{toast.points} pts
          </span>
          {toast.streakNote && <span className="toast-streak">{toast.streakNote}</span>}
        </div>
      </div>
    </div>
  );
}
