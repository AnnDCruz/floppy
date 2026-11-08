import React, { useEffect, useState } from "react";
import { api } from "../api";

function daysUntil(dateStr, today) {
  const diff = Math.round(
    (new Date(`${dateStr}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000
  );
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff}d`;
}

export default function ReviewsPage({ subjects, refreshKey }) {
  const [reviews, setReviews] = useState(null);
  const [today, setToday] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ concept: "", subject_id: "", interval_days: 4 });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ concept: "", subject_id: "", interval_days: 4 });

  const load = async () => {
    const [rows, clock] = await Promise.all([api.getReviews(), api.getClock()]);
    setReviews(rows);
    setToday(clock.date);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.concept.trim()) return;
    await api.addReview({
      concept: form.concept.trim(),
      subject_id: form.subject_id || null,
      interval_days: Number(form.interval_days) || 4,
    });
    setForm({ concept: "", subject_id: "", interval_days: 4 });
    setShowAdd(false);
    await load();
  };

  const markReviewed = async (id) => {
    await api.markReviewed(id);
    await load();
  };

  const remove = async (id) => {
    await api.deleteReview(id);
    await load();
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditForm({ concept: r.concept, subject_id: r.subject_id || "", interval_days: r.interval_days });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ concept: "", subject_id: "", interval_days: 4 });
  };

  const saveEdit = async (id) => {
    if (!editForm.concept.trim()) return;
    await api.updateReview(id, {
      concept: editForm.concept.trim(),
      subject_id: editForm.subject_id || null,
      interval_days: Number(editForm.interval_days) || 4,
    });
    cancelEdit();
    await load();
  };

  if (!reviews || !today) return <div className="loading-state">Loading reviews…</div>;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title display">Reviews</div>
          <div className="page-sub">Spaced repetition — concepts worth revisiting, on your own interval</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Concept
        </button>
      </div>

      {showAdd && (
        <form className="panel" onSubmit={submit} style={{ marginBottom: 20 }}>
          <div className="modal-add-form" style={{ marginTop: 0 }}>
            <input
              placeholder="Concept (e.g. DCF Valuation, B+ Trees)"
              value={form.concept}
              onChange={(e) => setForm({ ...form, concept: e.target.value })}
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
              <input
                type="number"
                min={1}
                max={90}
                value={form.interval_days}
                onChange={(e) => setForm({ ...form, interval_days: e.target.value })}
                placeholder="Interval (days)"
              />
            </div>
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
        {reviews.length === 0 ? (
          <div className="empty-hint">
            No review concepts yet — add one after a study session to schedule a revisit.
          </div>
        ) : (
          reviews.map((r) =>
            editingId === r.id ? (
              <div className="review-row" key={r.id} style={{ display: "block" }}>
                <div className="modal-add-form" style={{ marginTop: 0 }}>
                  <input
                    value={editForm.concept}
                    onChange={(e) => setEditForm({ ...editForm, concept: e.target.value })}
                    placeholder="Concept"
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
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={editForm.interval_days}
                      onChange={(e) => setEditForm({ ...editForm, interval_days: e.target.value })}
                      placeholder="Interval (days)"
                    />
                  </div>
                  <div className="form-row">
                    <button className="btn btn-ghost" onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" onClick={() => saveEdit(r.id)}>
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="review-row" key={r.id}>
                <div className="review-dot" style={{ background: r.subject_color || "#8B8F98" }} />
                <div className="review-main">
                  <div className="review-title">{r.concept}</div>
                  <div className="review-meta">
                    {r.subject_name || "No subject"} · every {r.interval_days}d · reviewed {r.review_count}x
                  </div>
                </div>
                <div className={`review-due${r.next_due_date <= today ? " due-today" : ""}`}>
                  {daysUntil(r.next_due_date, today)}
                </div>
                <div className="review-actions">
                  <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 12 }} onClick={() => startEdit(r)}>
                    Edit
                  </button>
                  <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 12 }} onClick={() => markReviewed(r.id)}>
                    Reviewed
                  </button>
                  <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 12 }} onClick={() => remove(r.id)}>
                    Remove
                  </button>
                </div>
              </div>
            )
          )
        )}
      </div>
    </>
  );
}
