import React, { useEffect, useState } from "react";
import { api } from "../api";

const STATUS_LABEL = { active: "Active", paused: "Paused", done: "Done" };
const COLOR_OPTIONS = ["#8E8CD8", "#5FA8A0", "#E8A33D", "#D97A6C", "#7FB88A", "#C97FB8"];

function fmtDate(dateStr) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ProjectsPage({ refreshKey, onProjectsChanged }) {
  const [projects, setProjects] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const load = async () => {
    const rows = await api.getProjectStats();
    setProjects(rows);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const addProject = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await api.addProject({ name: newName.trim() });
    setNewName("");
    setShowAdd(false);
    await load();
    onProjectsChanged && onProjectsChanged();
  };

  const cycleStatus = async (p) => {
    const order = ["active", "paused", "done"];
    const next = order[(order.indexOf(p.status) + 1) % order.length];
    await api.updateProject(p.id, { status: next });
    await load();
    onProjectsChanged && onProjectsChanged();
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditColor(p.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditColor("");
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    await api.updateProject(id, { name: editName.trim(), color: editColor });
    cancelEdit();
    await load();
    onProjectsChanged && onProjectsChanged();
  };

  const removeProject = async (id) => {
    await api.deleteProject(id);
    cancelEdit();
    await load();
    onProjectsChanged && onProjectsChanged();
  };

  if (!projects) return <div className="loading-state">Loading projects…</div>;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title display">Projects</div>
          <div className="page-sub">Portfolio work, linked to the hours you actually put in</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Project
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addProject} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input
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
            placeholder="Project name (e.g. Trading Strategy Dashboard)"
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

      {projects.length === 0 ? (
        <div className="panel">
          <div className="empty-hint">No projects yet — add one to start linking focus sessions to it.</div>
        </div>
      ) : (
        <div className="subject-cards">
          {projects.map((p) =>
            editingId === p.id ? (
              <div className="subject-card" key={p.id}>
                <div className="modal-add-form" style={{ marginTop: 0 }}>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Project name" autoFocus />
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
                    <button className="btn btn-primary" onClick={() => saveEdit(p.id)}>
                      Save
                    </button>
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ color: "var(--coral)", fontSize: 12 }}
                    onClick={() => removeProject(p.id)}
                  >
                    Delete project
                  </button>
                </div>
              </div>
            ) : (
              <div className="subject-card" key={p.id}>
                <div className="subject-card-head">
                  <div className="subject-icon" style={{ background: `${p.color}26`, color: p.color }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="subject-card-name">{p.name}</div>
                    <div className="subject-card-sessions">Last worked: {fmtDate(p.last_worked)}</div>
                  </div>
                  <button
                    className={`status-badge status-${p.status}`}
                    style={{ border: "none", cursor: "pointer" }}
                    onClick={() => cycleStatus(p)}
                    title="Click to change status"
                  >
                    {STATUS_LABEL[p.status]}
                  </button>
                </div>
                <div className="subject-card-stats">
                  <div>
                    <div className="card-stat-label">Total</div>
                    <div className="card-stat-value">{(p.total_minutes / 60).toFixed(1)}h</div>
                  </div>
                  <div>
                    <div className="card-stat-label">Sessions</div>
                    <div className="card-stat-value">{p.session_count}</div>
                  </div>
                  <div>
                    <div className="card-stat-label">Points</div>
                    <div className="card-stat-value">{p.total_points}</div>
                  </div>
                </div>
                <div className="subject-card-footer">
                  <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => startEdit(p)}>
                    Edit
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}
