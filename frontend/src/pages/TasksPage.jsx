import React, { useEffect, useState } from "react";
import { api } from "../api";

const AREAS = ["Coursework", "Internship", "CoE", "Projects", "Personal"];
const PRIORITY_CLASS = { high: "priority-high", medium: "priority-medium", low: "priority-low" };
const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" };
const EMPTY = { title: "", area: "Coursework", due_date: "", est_hours: 1, priority: "medium" };

function localToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dueLabel(dateStr, today) {
  if (!dateStr) return "No due date";
  const diff = Math.round((new Date(dateStr + "T00:00:00Z") - new Date(today + "T00:00:00Z")) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff}d`;
}

export default function TasksPage({ refreshKey }) {
  const [tasks, setTasks] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [showAdd, setShowAdd] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState("");

  const load = async () => setTasks(await api.getTasks());

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setError("");
    try {
      await api.addTask({
        title: form.title.trim(),
        area: form.area.trim() || "General",
        due_date: form.due_date || null,
        est_hours: Number(form.est_hours) || 1,
        priority: form.priority,
      });
      setForm(EMPTY);
      setShowAdd(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggle = async (t) => {
    await api.updateTask(t.id, { status: t.status === "done" ? "todo" : "done" });
    await load();
  };

  const remove = async (id) => {
    await api.deleteTask(id);
    await load();
  };

  if (!tasks) return <div className="loading-state">Loading tasks…</div>;

  const today = localToday();
  const open = tasks.filter((t) => t.status === "todo");
  const done = tasks.filter((t) => t.status === "done");
  const openHours = open.reduce((s, t) => s + t.est_hours, 0);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title display">Tasks</div>
          <div className="page-sub">
            Everything outside fixed deadlines: applications, projects, errands · {open.length} open · ~{openHours.toFixed(1)}h of work
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Task
        </button>
      </div>

      {showAdd && (
        <form className="panel" onSubmit={submit} style={{ marginBottom: 20 }}>
          <div className="modal-add-form" style={{ marginTop: 0 }}>
            <input
              placeholder="Task (e.g. Prepare for Mastercard phone interview)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
            <div className="form-row">
              <input list="task-areas" placeholder="Area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
              <datalist id="task-areas">
                {AREAS.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="form-row">
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={form.est_hours}
                onChange={(e) => setForm({ ...form, est_hours: e.target.value })}
                placeholder="Estimated hours"
              />
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="high">High priority</option>
                <option value="medium">Medium priority</option>
                <option value="low">Low priority</option>
              </select>
            </div>
            {error && <div className="plan-error">{error}</div>}
            <div className="form-row">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="panel">
        {open.length === 0 ? (
          <div className="empty-hint">No open tasks. Add things that aren't fixed deadlines so the planner can account for them.</div>
        ) : (
          open.map((t) => (
            <div className="mission-row" key={t.id}>
              <button className="mission-check" onClick={() => toggle(t)} title="Mark done" />
              <div style={{ flex: 1 }}>
                <div className="mission-title">{t.title}</div>
                <div className="mission-meta">
                  {t.area} · {dueLabel(t.due_date, today)} · {t.est_hours}h
                </div>
              </div>
              <div className={`priority-pill ${PRIORITY_CLASS[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</div>
              <button className="btn btn-ghost plan-btn" onClick={() => remove(t.id)}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {done.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button className="panel-link" onClick={() => setShowDone(!showDone)}>
            {showDone ? "Hide" : "Show"} {done.length} completed
          </button>
          {showDone && (
            <div className="panel" style={{ marginTop: 10 }}>
              {done.map((t) => (
                <div className="mission-row" key={t.id}>
                  <button className="mission-check" onClick={() => toggle(t)} title="Mark not done">
                    ✓
                  </button>
                  <div style={{ flex: 1 }}>
                    <div className="mission-title" style={{ textDecoration: "line-through", opacity: 0.6 }}>
                      {t.title}
                    </div>
                    <div className="mission-meta">{t.area}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
