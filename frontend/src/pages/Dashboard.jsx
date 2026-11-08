import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useTimer } from "../TimerContext";
import { Dial } from "../components/Dial";
import SessionLogList from "../components/SessionLogList";
import PlanPanel from "../components/PlanPanel";
import { DateTimePill } from "../components/TopPill";
import CountUp from "../components/CountUp";

const PRIORITY_CLASS = { high: "priority-high", medium: "priority-medium", low: "priority-low" };
const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" };

function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function buildOneLiner(data) {
  const hasSessionsToday = data.today.sessions > 0;
  const missionTotal = data.mission.deadlines.length + data.mission.reviews.length;

  if (!hasSessionsToday && missionTotal > 0) {
    return `${missionTotal} thing${missionTotal > 1 ? "s" : ""} on today's list — nothing logged yet.`;
  }
  if (hasSessionsToday && data.today.minutes >= 60) {
    return `Solid start — ${(data.today.minutes / 60).toFixed(1)}h logged today already.`;
  }
  if (data.last_week_minutes > 0 && data.week.minutes > data.last_week_minutes) {
    const pct = Math.round(((data.week.minutes - data.last_week_minutes) / data.last_week_minutes) * 100);
    return `Ahead of last week's pace by ${pct}%.`;
  }
  if (data.streak.current >= 3) {
    return `${data.streak.current}-day streak going — keep it alive today.`;
  }
  if (missionTotal === 0 && !hasSessionsToday) {
    return "Clear day — a good time to get ahead.";
  }
  return null;
}

export default function Dashboard({ subjects, projects, refreshKey, onNavigate }) {
  const [data, setData] = useState(null);
  const timer = useTimer();

  const load = async () => {
    const d = await api.getDashboard();
    setData(d);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const completeMissionDeadline = async (id) => {
    await api.updateDeadline(id, { completed: 1 });
    await load();
  };

  const completeMissionReview = async (id) => {
    await api.markReviewed(id);
    await load();
  };

  if (!data) return <div className="loading-state">Loading your dashboard…</div>;

  const todayHours = (data.today.minutes / 60).toFixed(1);
  const weekHours = (data.week.minutes / 60).toFixed(1);
  const lastWeekHours = (data.last_week_minutes / 60).toFixed(1);
  const weekDeltaPct =
    data.last_week_minutes > 0
      ? Math.round(((data.week.minutes - data.last_week_minutes) / data.last_week_minutes) * 100)
      : null;
  const currentSubject = subjects.find((s) => s.id === timer.subjectId);
  const missionItems = [
    ...data.mission.deadlines.map((d) => ({ ...d, mission_type: "deadline" })),
    ...data.mission.reviews.map((r) => ({ ...r, mission_type: "review" })),
  ];
  const oneLiner = buildOneLiner(data);

  return (
    <>
      <DateTimePill />

      <div className="dash-greeting">
        <div className="dash-hello">
          Good to see you · Level {data.level.level} — {data.level.title}
        </div>
        {oneLiner && <div className="one-liner">{oneLiner}</div>}
      </div>

      <div className="summary-strip">
        <div className="stat-card">
          <div className="stat-label">Today</div>
          <div className="stat-value">
            <CountUp value={data.today.minutes / 60} decimals={1} /> <span>hrs</span>
          </div>
          <div className="stat-delta">{data.today.sessions} sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This Week</div>
          <div className="stat-value">
            <CountUp value={data.week.minutes / 60} decimals={1} /> <span>hrs</span>
          </div>
          <div className={`stat-delta${weekDeltaPct !== null && weekDeltaPct < 0 ? " warn" : ""}`}>
            {weekDeltaPct === null
              ? `${data.week.sessions} sessions`
              : `${weekDeltaPct >= 0 ? "+" : ""}${weekDeltaPct}% vs last week (${lastWeekHours}h)`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Points</div>
          <div className="stat-value">
            <CountUp value={data.points_balance} />
          </div>
          <div className="stat-delta">+{data.today.points} today</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Streak</div>
          <div className="stat-value">
            <CountUp value={data.streak.current} /> <span>days</span>
          </div>
          <div className="stat-delta">Longest: {data.streak.longest}</div>
        </div>
      </div>

      <div className="grid hero">
        <div className="panel timer-panel">
          <Dial
            size={172}
            strokeWidth={9}
            secondsLeft={timer.secondsLeft}
            totalSeconds={timer.totalSecondsForPhase}
            phase={timer.phase}
            gradId="dialGrad"
          />
          <div className="timer-right">
            {currentSubject && (
              <div className="subject-tag">
                <span className="subject-dot" style={{ background: currentSubject.color }} />
                {currentSubject.name}
              </div>
            )}
            <div className="timer-meta">
              Round {timer.currentRound} of {timer.totalRounds} · {timer.focusMinutes} min focus /{" "}
              {timer.breakMinutes} min break
            </div>
            <div className="timer-controls">
              {!timer.running ? (
                <button className="btn btn-primary" onClick={timer.start}>
                  {timer.phase === "idle" || timer.phase === "done" ? "Start Session" : "Resume"}
                </button>
              ) : (
                <button className="btn btn-ghost" onClick={timer.pause}>
                  Pause
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => onNavigate("timer")}>
                Open Timer
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Upcoming</div>
            <button className="panel-link" onClick={() => onNavigate("calendar")}>
              View calendar
            </button>
          </div>
          {data.upcoming_deadlines.length === 0 ? (
            <div className="empty-hint">Nothing on the horizon — you&apos;re clear.</div>
          ) : (
            data.upcoming_deadlines.map((d) => (
              <div className="event-row" key={d.id}>
                <div className="event-tag" style={{ background: d.subject_color || "#8B8F98" }} />
                <div style={{ flex: 1 }}>
                  <div className="event-title">{d.title}</div>
                  <div className="event-meta">{fmtDate(d.due_date)}</div>
                </div>
                <div className={`priority-pill ${PRIORITY_CLASS[d.priority]}`}>{PRIORITY_LABEL[d.priority]}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid">
      <div className="panel mission-card">
        <div className="panel-head">
          <div className="panel-title">Today&apos;s Mission</div>
        </div>
        {missionItems.length === 0 ? (
          <div className="mission-empty">Nothing due today — clear board.</div>
        ) : (
          <>
            <div className="mission-intro">
              {missionItems.length} thing{missionItems.length > 1 ? "s" : ""} to clear today.
            </div>
            {missionItems.map((item) => (
              <div className="mission-row" key={`${item.mission_type}-${item.id}`}>
                <button
                  className="mission-check"
                  onClick={() =>
                    item.mission_type === "deadline"
                      ? completeMissionDeadline(item.id)
                      : completeMissionReview(item.id)
                  }
                  title="Mark done"
                >
                  ✓
                </button>
                <div style={{ flex: 1 }}>
                  <div className="mission-title">{item.mission_type === "deadline" ? item.title : item.concept}</div>
                  <div className="mission-meta">
                    {item.subject_name || "No subject"}
                    {item.mission_type === "deadline" && item.type ? ` · ${item.type}` : ""}
                  </div>
                </div>
                <span className={`mission-badge ${item.mission_type}`}>
                  {item.mission_type === "deadline" ? "Deadline" : "Review"}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      <PlanPanel onApplied={load} refreshKey={refreshKey} />
      </div>

      <div className="panel log-panel">
        <div className="panel-head">
          <div className="panel-title">Today&apos;s Sessions</div>
          <button className="panel-link" onClick={() => onNavigate("timer")}>
            View all history
          </button>
        </div>
        {data.recent_sessions.length === 0 ? (
          <div className="empty-hint">No sessions logged yet today — start the timer to begin.</div>
        ) : (
          <SessionLogList sessions={data.recent_sessions} onChanged={load} />
        )}
      </div>

    </>
  );
}
