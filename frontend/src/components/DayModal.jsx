import React, { useEffect, useState } from "react";
import { api } from "../api";
import EventModal, { formatEventTime } from "./EventModal";

const PRIORITY_CLASS = { high: "priority-high", medium: "priority-medium", low: "priority-low" };
const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" };

function formatHeader(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  const dow = d.toLocaleDateString(undefined, { weekday: "long" });
  return { month, dow };
}

export default function DayModal({ date, subjects, onClose, onChanged }) {
  const [deadlines, setDeadlines] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventDraft, setEventDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ title: "", subject_id: "", type: "deadline", priority: "medium" });
  const [editingDeadlineId, setEditingDeadlineId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", subject_id: "", type: "deadline", priority: "medium" });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");

  const load = async () => {
    setLoading(true);
    const [dl, sess, ev] = await Promise.all([api.getDeadlinesForDay(date), api.getSessions({ date }), api.getEvents({ date })]);
    setDeadlines(dl);
    setSessions(sess);
    setEvents(ev);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    // while the event form is open, Escape closes only that form
    const onKey = (e) => e.key === "Escape" && !eventDraft && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, eventDraft]);

  const { month, dow } = formatHeader(date);

  const submitDeadline = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await api.addDeadline({
      title: form.title.trim(),
      subject_id: form.subject_id || null,
      due_date: date,
      type: form.type,
      priority: form.priority,
    });
    setForm({ title: "", subject_id: "", type: "deadline", priority: "medium" });
    setShowAddForm(false);
    await load();
    onChanged && onChanged();
  };

  const startEditDeadline = (d) => {
    setEditingDeadlineId(d.id);
    setEditForm({ title: d.title, subject_id: d.subject_id || "", type: d.type, priority: d.priority });
  };

  const cancelEditDeadline = () => setEditingDeadlineId(null);

  const saveEditDeadline = async (id) => {
    if (!editForm.title.trim()) return;
    await api.updateDeadline(id, {
      title: editForm.title.trim(),
      subject_id: editForm.subject_id || null,
      type: editForm.type,
      priority: editForm.priority,
    });
    setEditingDeadlineId(null);
    await load();
    onChanged && onChanged();
  };

  const removeDeadline = async (id) => {
    await api.deleteDeadline(id);
    setEditingDeadlineId(null);
    await load();
    onChanged && onChanged();
  };

  const startEditNote = (s) => {
    setEditingNoteId(s.id);
    setNoteDraft(s.notes || "");
  };

  const saveNote = async (id) => {
    await api.updateSessionNotes(id, noteDraft);
    setEditingNoteId(null);
    await load();
  };

  const afterEventSaved = async () => {
    await load();
    onChanged && onChanged();
  };

  return (
    <>
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <div className="modal-date display">{month}</div>
            <div className="modal-dow">{dow}</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-section-label">Events</div>
        {loading ? (
          <div className="empty-hint">Loading…</div>
        ) : events.length === 0 ? (
          <div className="empty-hint">No events on this day.</div>
        ) : (
          events.map((ev) => (
            <div className="event-row" key={ev.id}>
              <div className="event-tag event-tag-diamond" />
              <div style={{ flex: 1 }}>
                <div className="event-title">{ev.title}</div>
                <div className="event-meta">
                  {formatEventTime(ev)}
                  {ev.notes ? ` · ${ev.notes.length > 60 ? ev.notes.slice(0, 60) + "…" : ev.notes}` : ""}
                </div>
              </div>
              <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => setEventDraft(ev)}>
                Edit
              </button>
            </div>
          ))
        )}
        <button className="btn btn-ghost" style={{ marginTop: 12, fontSize: 12, padding: "8px 14px" }} onClick={() => setEventDraft({ event_date: date })}>
          + Add event
        </button>

        <div className="modal-section-label">Deadlines</div>
        {loading ? (
          <div className="empty-hint">Loading…</div>
        ) : deadlines.length === 0 ? (
          <div className="empty-hint">Nothing scheduled for this day.</div>
        ) : (
          deadlines.map((d) =>
            editingDeadlineId === d.id ? (
              <div key={d.id} className="modal-add-form" style={{ marginTop: 10, marginBottom: 10 }}>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Title"
                  autoFocus
                />
                <div className="form-row">
                  <select
                    value={editForm.subject_id}
                    onChange={(e) => setEditForm({ ...editForm, subject_id: e.target.value })}
                  >
                    <option value="">No subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                    <option value="deadline">Deadline</option>
                    <option value="quiz">Quiz</option>
                    <option value="submission">Submission</option>
                    <option value="exam">Exam</option>
                  </select>
                </div>
                <div className="form-row">
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                  >
                    <option value="high">High priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="low">Low priority</option>
                  </select>
                </div>
                <div className="form-row">
                  <button type="button" className="btn btn-ghost" onClick={cancelEditDeadline}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => saveEditDeadline(d.id)}>
                    Save
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ color: "var(--coral)", fontSize: 12 }}
                  onClick={() => removeDeadline(d.id)}
                >
                  Delete
                </button>
              </div>
            ) : (
              <div className="event-row" key={d.id}>
                <div className="event-tag" style={{ background: d.subject_color || "#8B8F98" }} />
                <div style={{ flex: 1 }}>
                  <div className="event-title">{d.title}</div>
                  <div className="event-meta">
                    {d.type.charAt(0).toUpperCase() + d.type.slice(1)}
                    {d.subject_name ? ` · ${d.subject_name}` : ""}
                    {d.due_time ? ` · ${d.due_time}` : ""}
                  </div>
                </div>
                <div className={`priority-pill ${PRIORITY_CLASS[d.priority]}`}>{PRIORITY_LABEL[d.priority]}</div>
                <button
                  className="btn btn-ghost"
                  style={{ padding: "5px 10px", fontSize: 11, marginLeft: 8 }}
                  onClick={() => startEditDeadline(d)}
                >
                  Edit
                </button>
              </div>
            )
          )
        )}

        {!showAddForm ? (
          <button className="btn btn-ghost" style={{ marginTop: 12, fontSize: 12, padding: "8px 14px" }} onClick={() => setShowAddForm(true)}>
            + Add deadline
          </button>
        ) : (
          <form className="modal-add-form" onSubmit={submitDeadline}>
            <input
              placeholder="Title (e.g. Linear Algebra Quiz)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
            <div className="form-row">
              <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                <option value="">No subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="deadline">Deadline</option>
                <option value="quiz">Quiz</option>
                <option value="submission">Submission</option>
                <option value="exam">Exam</option>
              </select>
            </div>
            <div className="form-row">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="high">High priority</option>
                <option value="medium">Medium priority</option>
                <option value="low">Low priority</option>
              </select>
            </div>
            <div className="form-row">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add
              </button>
            </div>
          </form>
        )}

        <div className="modal-section-label">Logged Sessions</div>
        {loading ? (
          <div className="empty-hint">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="empty-hint">No focus sessions logged this day.</div>
        ) : (
          sessions.map((s) => (
            <div className="session-row" key={s.id}>
              <div className="session-top">
                <div className="event-title">
                  {s.subject_name}
                  {s.project_name ? ` · ${s.project_name}` : ""} — {s.duration_minutes} min
                </div>
                <div className="event-meta mono" style={{ color: "var(--amber)" }}>
                  +{s.points_earned} pts
                </div>
              </div>
              {editingNoteId === s.id ? (
                <div style={{ marginTop: 6 }}>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--surface-raised)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      color: "var(--text)",
                      fontSize: 12.5,
                      padding: "8px 10px",
                      minHeight: 60,
                      fontFamily: "Inter, sans-serif",
                    }}
                    autoFocus
                  />
                  <div className="form-row" style={{ marginTop: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => setEditingNoteId(null)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => saveNote(s.id)}>
                      Save note
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 5 }}>
                  {s.notes && <div className="session-note" style={{ marginTop: 0, flex: 1 }}>{s.notes}</div>}
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "4px 9px", fontSize: 10.5, flexShrink: 0 }}
                    onClick={() => startEditNote(s)}
                  >
                    {s.notes ? "Edit note" : "+ Note"}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
    {eventDraft && <EventModal initial={eventDraft} onClose={() => setEventDraft(null)} onSaved={afterEventSaved} />}
    </>
  );
}
