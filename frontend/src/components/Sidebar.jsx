import React, { useEffect } from "react";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "timer", label: "Focus Timer" },
  { key: "calendar", label: "Calendar" },
  { key: "subjects", label: "Subjects" },
  { key: "projects", label: "Projects" },
  { key: "reviews", label: "Reviews" },
  { key: "tasks", label: "Tasks" },
  { key: "notes", label: "Notes" },
];

// The menu slides over the page (opened from the square button, top-left).
export default function Sidebar({ open, onClose, active, onNavigate, streak, background, onBackgroundChange }) {
  const level = streak?.level;
  const pct =
    level && level.points_for_next ? Math.min(100, Math.round((level.points_into_level / level.points_for_next) * 100)) : 0;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`menu-layer${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="menu-scrim" onClick={onClose} />
      <nav className="nav" aria-label="Main menu">
        <div className="nav-section-label">Menu</div>
        <div className="nav-items">
          {NAV_ITEMS.map((item, i) => (
            <button
              key={item.key}
              style={{ "--n": i }}
              tabIndex={open ? 0 : -1}
              className={`nav-item${active === item.key ? " active" : ""}`}
              onClick={() => {
                onNavigate(item.key);
                onClose();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="nav-footer">
          {level && (
            <div className="level-pill">
              <div className="level-top">
                <span className="level-name">Lvl {level.level}</span>
                <span className="level-title">{level.title}</span>
              </div>
              <div className="level-track">
                <div className="level-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <div className="streak-pill">
            <div className="streak-flame">🔥</div>
            <div>
              <div className="streak-count">{streak?.current_streak ?? 0} days</div>
              <div className="streak-label">Current streak</div>
            </div>
          </div>
          <div className="points-pill">
            <span>Points</span>
            <b>{streak?.points_balance ?? 0}</b>
          </div>
          <div className="switch-label">Background</div>
          <div className="bg-switch" role="group" aria-label="Background">
            <button tabIndex={open ? 0 : -1} className={background === "aurora" ? "on" : ""} onClick={() => onBackgroundChange("aurora")}>
              Aurora
            </button>
            <button tabIndex={open ? 0 : -1} className={background === "plasma" ? "on" : ""} onClick={() => onBackgroundChange("plasma")}>
              Plasma
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
