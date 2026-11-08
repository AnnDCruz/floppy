import React, { useEffect, useState } from "react";
import { api } from "../api";

function initials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function Donut({ subjects, size = 168, strokeWidth = 20 }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;
  const totalMinutes = subjects.reduce((a, s) => a + s.total_minutes, 0);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={strokeWidth} />
      {totalMinutes > 0 &&
        subjects
          .filter((s) => s.total_minutes > 0)
          .map((s) => {
            const frac = s.total_minutes / totalMinutes;
            const dash = frac * circumference;
            const rotation = (cumulative / totalMinutes) * 360 - 90;
            cumulative += s.total_minutes;
            return (
              <circle
                key={s.id}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeLinecap="round"
                transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
              />
            );
          })}
    </svg>
  );
}

const COLOR_OPTIONS = ["#5FA8A0", "#E8A33D", "#D97A6C", "#8E8CD8", "#7FB88A", "#C97FB8"];

export default function SubjectsPage({ subjects, onSubjectsChanged, refreshKey }) {
  const [stats, setStats] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const load = async () => {
    const s = await api.getSubjectStats();
    setStats(s);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const addSubject = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await api.addSubject({ name: newName.trim() });
    setNewName("");
    setShowAdd(false);
    await load();
    onSubjectsChanged && onSubjectsChanged();
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditColor("");
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    await api.updateSubject(id, { name: editName.trim(), color: editColor });
    cancelEdit();
    await load();
    onSubjectsChanged && onSubjectsChanged();
  };

  const removeSubject = async (id) => {
    await api.deleteSubject(id);
    cancelEdit();
    await load();
    onSubjectsChanged && onSubjectsChanged();
  };

  if (!stats) return <div className="loading-state">Loading subjects…</div>;

  const totalHours = (stats.total_minutes / 60).toFixed(1);
  const totalSessions = stats.subjects.reduce((a, s) => a + s.session_count, 0);
  const maxMinutes = Math.max(1, ...stats.subjects.map((s) => s.total_minutes));

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title display">Subjects</div>
          <div className="page-sub">Passive breakdown of where your study time goes</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Subject
        </button>
      </div>

      <div className="top-grid">
        <div className="panel totals-panel">
          <div className="total-hours">
            <div className="stat-label">Total Logged</div>
            <div className="stat-value">
              {totalHours} <span>hrs, all time</span>
            </div>
          </div>
          <div className="mini-stats">
            <div className="mini-stat">
              <div className="mini-stat-label">Sessions</div>
              <div className="mini-stat-value">{totalSessions}</div>
            </div>
            <div className="mini-stat">
              <div className="mini-stat-label">Subjects</div>
              <div className="mini-stat-value">{stats.subjects.length}</div>
            </div>
          </div>
        </div>

        <div className="panel donut-panel">
          <div className="donut-wrap">
            <Donut subjects={stats.subjects} />
            <div className="donut-center">
              <div className="donut-total display">{totalHours}h</div>
              <div className="donut-total-label">all time</div>
            </div>
          </div>
          <div className="donut-legend">
            {stats.subjects.map((s) => (
              <div className="donut-legend-row" key={s.id}>
                <span className="dot" style={{ background: s.color }} />
                <span className="name">{s.name}</span>
                <span className="pct mono">{s.pct_of_total}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-head" style={{ margin: "4px 0 14px" }}>
        <div className="panel-title display">All Subjects</div>
      </div>

      {showAdd && (
        <form
          onSubmit={addSubject}
          style={{ display: "flex", gap: 8, marginBottom: 16 }}
        >
          <input
            className="mono"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
              borderRadius: 9,
              color: "var(--text)",
              padding: "9px 12px",
              flex: 1,
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
            }}
            placeholder="Subject name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary">
            Add
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>
            Cancel
          </button>
        </form>
      )}

      <div className="subject-cards">
        {stats.subjects.map((s) =>
          editingId === s.id ? (
            <div className="subject-card" key={s.id}>
              <div className="modal-add-form" style={{ marginTop: 0 }}>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Subject name"
                  autoFocus
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: c,
                        border: editColor === c ? "2px solid var(--text)" : "2px solid transparent",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
                <div className="form-row">
                  <button className="btn btn-ghost" onClick={cancelEdit}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={() => saveEdit(s.id)}>
                    Save
                  </button>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ color: "var(--coral)", fontSize: 12 }}
                  onClick={() => removeSubject(s.id)}
                >
                  Delete subject
                </button>
              </div>
            </div>
          ) : (
            <div className="subject-card" key={s.id}>
              <div className="subject-card-head">
                <div className="subject-icon" style={{ background: hexToRgba(s.color, 0.15), color: s.color }}>
                  {initials(s.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="subject-card-name">{s.name}</div>
                  <div className="subject-card-sessions">{s.session_count} sessions logged</div>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ padding: "6px 10px", fontSize: 11.5 }}
                  onClick={() => startEdit(s)}
                >
                  Edit
                </button>
              </div>
              <div className="subject-card-stats">
                <div>
                  <div className="card-stat-label">Total</div>
                  <div className="card-stat-value">{(s.total_minutes / 60).toFixed(1)}h</div>
                </div>
                <div>
                  <div className="card-stat-label">Avg / session</div>
                  <div className="card-stat-value">{s.avg_minutes}m</div>
                </div>
                <div>
                  <div className="card-stat-label">Points</div>
                  <div className="card-stat-value">{s.total_points}</div>
                </div>
              </div>
              <div className="subject-track">
                <div
                  className="subject-fill"
                  style={{ width: `${Math.round((s.total_minutes / maxMinutes) * 100)}%`, background: s.color }}
                />
              </div>
              <div className="subject-card-footer">
                <div>{s.pct_of_total}% of total time</div>
              </div>
            </div>
          )
        )}
        <button className="add-subject-card" onClick={() => setShowAdd(true)}>
          <div className="plus">+</div>
          Add a subject
        </button>
      </div>
    </>
  );
}
