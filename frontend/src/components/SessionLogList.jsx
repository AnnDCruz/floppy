import React, { useState } from "react";
import { api } from "../api";

export default function SessionLogList({ sessions, onChanged }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");

  const startEdit = (s) => {
    setEditingId(s.id);
    setDraft(s.notes || "");
  };

  const save = async (id) => {
    await api.updateSessionNotes(id, draft);
    setEditingId(null);
    onChanged && onChanged();
  };

  if (sessions.length === 0) {
    return <div className="empty-hint">No sessions logged yet today.</div>;
  }

  return (
    <>
      {sessions.map((s) => (
        <div className="log-row" key={s.id}>
          <div className="log-subject-dot" style={{ background: s.subject_color }} />
          <div className="log-main">
            <div className="log-title-row">
              <div className="log-title">
                {s.subject_name}
                {s.project_name && <span style={{ color: "var(--violet)", fontWeight: 500 }}> · {s.project_name}</span>}
              </div>
              <div className="log-duration">{s.duration_minutes} min</div>
            </div>
            {editingId === s.id ? (
              <div style={{ marginTop: 6 }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    color: "var(--text)",
                    fontSize: 12.5,
                    padding: "8px 10px",
                    minHeight: 56,
                    fontFamily: "Inter, sans-serif",
                  }}
                />
                <div className="form-row" style={{ marginTop: 6 }}>
                  <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => save(s.id)}>
                    Save note
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                {s.notes && <div className="log-note" style={{ flex: 1 }}>{s.notes}</div>}
                <button
                  className="btn btn-ghost"
                  style={{ padding: "3px 8px", fontSize: 10.5, flexShrink: 0, marginTop: s.notes ? 3 : 0 }}
                  onClick={() => startEdit(s)}
                >
                  {s.notes ? "Edit" : "+ Note"}
                </button>
              </div>
            )}
          </div>
          <div className="log-meta">
            <div className="log-time">
              {new Date(s.started_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </div>
            <div className="log-points mono">+{s.points_earned} pts</div>
          </div>
        </div>
      ))}
    </>
  );
}
