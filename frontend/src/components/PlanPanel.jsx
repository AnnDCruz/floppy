import React, { useEffect, useState } from "react";
import { api } from "../api";

const KIND_LABEL = { deadline: "Deadline", quiz: "Quiz", exam: "Exam", submission: "Submission", task: "Task", review: "Review" };

function badgeClass(kind) {
  if (kind === "review") return "review";
  if (kind === "task") return "task";
  return "deadline";
}

function describe(p) {
  const d = p.payload;
  if (p.action === "add_task") {
    const bits = [d.area, d.due_date ? `due ${d.due_date}` : null, `${d.est_hours}h`, d.priority].filter(Boolean);
    return { label: "Add task", title: d.title, meta: bits.join(" · ") };
  }
  if (p.action === "complete_task") return { label: "Mark done", title: d.title, meta: "" };
  const c = d.changes || {};
  const bits = [c.due_date && `due → ${c.due_date}`, c.est_hours && `estimate → ${c.est_hours}h`, c.priority && `priority → ${c.priority}`];
  return { label: "Update task", title: d.title, meta: bits.filter(Boolean).join(" · ") };
}

export default function PlanPanel({ onApplied, refreshKey }) {
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState(null);
  const [hours, setHours] = useState(5);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api.getAgentStatus().then(setStatus).catch(() => {});
    api.getLatestPlan().then(setPlan).catch(() => {});
  }, [refreshKey]);

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const p = await api.planDay({ hours: Number(hours) || 5, note });
      setPlan(p);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resolve = async (proposal, approve) => {
    setBusyId(proposal.id);
    setError("");
    try {
      if (approve) await api.approveProposal(proposal.id);
      else await api.rejectProposal(proposal.id);
      setPlan((prev) => ({ ...prev, proposals: prev.proposals.filter((x) => x.id !== proposal.id) }));
      if (approve && onApplied) await onApplied();
    } catch (e) {
      setError(e.message);
      // A stale proposal can't be applied; drop it from view.
      setPlan((prev) => ({ ...prev, proposals: prev.proposals.filter((x) => x.id !== proposal.id) }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="panel plan-panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <div className="panel-title">Plan my day</div>
        {status && <div className="plan-model">{status.provider}:{status.model}</div>}
      </div>

      <div className="plan-controls">
        <label className="plan-hours">
          <span>Hours today</span>
          <input type="number" min={0.5} max={16} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <input
          className="plan-note"
          placeholder="Optional note, e.g. tired today, keep it light"
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {loading ? "Thinking…" : plan ? "Re-plan" : "Plan my day"}
        </button>
      </div>

      {error && <div className="plan-error">{error}</div>}

      {plan && (
        <>
          {plan.summary && <div className="plan-summary">{plan.summary}</div>}

          <div className="plan-section">Do today ({plan.today.reduce((s, x) => s + x.hours, 0)}h of {plan.hours_available}h)</div>
          {plan.today.map((item) => (
            <div className="mission-row" key={item.ref}>
              <div style={{ flex: 1 }}>
                <div className="mission-title">{item.title}</div>
                <div className="mission-meta">{item.why}</div>
              </div>
              <span className={`mission-badge ${badgeClass(item.kind)}`}>{KIND_LABEL[item.kind] || item.kind}</span>
              <span className="plan-hours-chip">{item.hours}h</span>
            </div>
          ))}

          {plan.at_risk.length > 0 && (
            <>
              <div className="plan-section warn">At risk</div>
              {plan.at_risk.map((item) => (
                <div className="mission-row" key={item.ref}>
                  <div style={{ flex: 1 }}>
                    <div className="mission-title">{item.title}</div>
                    <div className="mission-meta">{item.reason}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {plan.proposals.length > 0 && (
            <>
              <div className="plan-section">Suggested changes (nothing is saved until you approve)</div>
              {plan.proposals.map((p) => {
                const d = describe(p);
                return (
                  <div className="mission-row" key={p.id}>
                    <div style={{ flex: 1 }}>
                      <div className="mission-title">
                        <span className="plan-action">{d.label}:</span> {d.title}
                      </div>
                      {d.meta && <div className="mission-meta">{d.meta}</div>}
                      {p.reason && <div className="mission-meta">{p.reason}</div>}
                    </div>
                    <button className="btn btn-ghost plan-btn" disabled={busyId === p.id} onClick={() => resolve(p, false)}>
                      Reject
                    </button>
                    <button className="btn btn-primary plan-btn" disabled={busyId === p.id} onClick={() => resolve(p, true)}>
                      Approve
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
      {!plan && !loading && !error && (
        <div className="empty-hint">Ask for a plan built from your deadlines, tasks and due reviews. It suggests; you decide.</div>
      )}
    </div>
  );
}
