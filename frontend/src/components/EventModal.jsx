import React, { useEffect, useState } from "react";
import { api } from "../api";

// Add or edit a calendar event. `initial` has at least { event_date }; with an `id` it edits.
export default function EventModal({ initial, onClose, onSaved }) {
  const editing = Boolean(initial.id);
  const [form, setForm] = useState({
    title: initial.title || "",
    event_date: initial.event_date,
    start_time: initial.start_time || "",
    end_time: initial.end_time || "",
    notes: initial.notes || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError("Give the event a title");
    if (!form.event_date) return setError("Pick a date");
    if (form.start_time && form.end_time && form.end_time < form.start_time) {
      return setError("The end time can't be before the start time");
    }
    setBusy(true);
    setError("");
    const payload = {
      title: form.title.trim(),
      event_date: form.event_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      notes: form.notes,
    };
    try {
      if (editing) await api.updateEvent(initial.id, payload);
      else await api.addEvent(payload);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setBusy(true);
    try {
      await api.deleteEvent(initial.id);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal event-modal" onSubmit={submit}>
        <div className="modal-head">
          <div className="modal-date display">{editing ? "Edit event" : "Add event"}</div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-add-form" style={{ marginTop: 6 }}>
          <input placeholder="What's happening? (e.g. Phone interview)" value={form.title} onChange={set("title")} autoFocus maxLength={200} />

          <label className="field-label">Date</label>
          <input type="date" value={form.event_date} onChange={set("event_date")} />

          <div className="form-row">
            <div style={{ flex: 1 }}>
              <label className="field-label">Starts (optional)</label>
              <input type="time" value={form.start_time} onChange={set("start_time")} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Ends (optional)</label>
              <input type="time" value={form.end_time} onChange={set("end_time")} />
            </div>
          </div>

          <label className="field-label">Notes (optional)</label>
          <textarea placeholder="Location, link, what to bring…" value={form.notes} onChange={set("notes")} maxLength={2000} />

          {error && <div className="plan-error">{error}</div>}

          <div className="form-row">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {editing ? "Save" : "Add event"}
            </button>
          </div>
          {editing && (
            <button type="button" className="btn btn-ghost" style={{ color: "var(--coral)", fontSize: 12 }} onClick={remove} disabled={busy}>
              {confirmDelete ? "Click again to delete" : "Delete event"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function formatEventTime(ev) {
  if (!ev.start_time) return "All day";
  return ev.end_time ? `${ev.start_time}–${ev.end_time}` : ev.start_time;
}
