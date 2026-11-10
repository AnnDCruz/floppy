import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useTimer } from "../TimerContext";
import { Dial } from "../components/Dial";
import SessionLogList from "../components/SessionLogList";

const CYCLE_OPTIONS = [2, 3, 4, 6];

function estimatedPoints(minutes) {
  return Math.round(minutes * 1.6);
}

export default function TimerPage({ subjects, projects, refreshKey }) {
  const timer = useTimer();
  const [sessions, setSessions] = useState([]);

  const loadToday = async () => {
    const { date: today } = await api.getClock();
    const rows = await api.getSessions({ date: today });
    setSessions(rows);
  };

  useEffect(() => {
    loadToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, timer.phase, timer.running]);

  const canConfigure = timer.phase === "idle" || timer.phase === "done";

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title display">Focus Timer</div>
          <div className="page-sub">Pomodoro sessions, logged automatically as you go</div>
        </div>
      </div>

      <div className="timer-grid">
        <div className="panel hero-panel">
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(() => {
                const subj = subjects.find((s) => s.id === timer.subjectId);
                return subj ? (
                  <div className="hero-subject">
                    <span className="subject-dot" style={{ background: subj.color }} />
                    {subj.name}
                  </div>
                ) : null;
              })()}
              {(() => {
                const proj = projects.find((p) => p.id === timer.projectId);
                return proj ? (
                  <div className="hero-subject" style={{ color: "var(--violet)", borderColor: "#4d4b8a" }}>
                    <span className="subject-dot" style={{ background: proj.color }} />
                    {proj.name}
                  </div>
                ) : null;
              })()}
            </div>
            <div className="mode-toggle" style={{ marginTop: 0 }}>
              <span className={timer.phase === "focus" || timer.phase === "idle" ? "active" : ""}>Focus</span>
              <span className={timer.phase === "break" ? "active" : ""}>Break</span>
            </div>
          </div>

          <div className="big-dial-wrap">
            <Dial
              size={280}
              strokeWidth={11}
              secondsLeft={timer.secondsLeft}
              totalSeconds={timer.totalSecondsForPhase}
              phase={timer.phase}
              gradId="dialGradBig"
            />
          </div>
          <div className="big-dial-round">
            Round {timer.currentRound} of {timer.totalRounds}
          </div>

          <div className="hero-controls">
            <button className="btn btn-ghost btn-icon-only" title="Restart interval" onClick={timer.restartInterval}>
              ↺
            </button>
            {!timer.running ? (
              <button className="btn btn-primary btn-large" onClick={timer.start}>
                {timer.phase === "idle" || timer.phase === "done" ? "Start" : "Resume"}
              </button>
            ) : (
              <button className="btn btn-primary btn-large" onClick={timer.pause}>
                Pause
              </button>
            )}
            {timer.phase !== "idle" && (
              <button className="btn btn-ghost btn-large" onClick={timer.endAndLog}>
                End &amp; Log
              </button>
            )}
          </div>

          <div className="interval-strip">
            {Array.from({ length: timer.totalRounds }).map((_, i) => (
              <div
                key={i}
                className={`interval-block${i < timer.currentRound - 1 ? " done" : ""}${
                  i === timer.currentRound - 1 && timer.phase !== "idle" ? " current" : ""
                }`}
              />
            ))}
          </div>
          <div className="interval-legend">
            {timer.focusMinutes} min focus / {timer.breakMinutes} min break · {timer.totalRounds} rounds
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Session Setup</div>
            </div>

            <div className="config-row">
              <div className="config-label">Subject</div>
              <div className="subject-select">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    className={`subject-chip${timer.subjectId === s.id ? " selected" : ""}`}
                    onClick={() => canConfigure && timer.setSubjectId(s.id)}
                    disabled={!canConfigure}
                  >
                    <span className="dot" style={{ background: s.color }} />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="config-row">
              <div className="config-label">Project (optional)</div>
              <div className="project-select">
                <button
                  className={`project-chip${!timer.projectId ? " selected" : ""}`}
                  onClick={() => canConfigure && timer.setProjectId(null)}
                  disabled={!canConfigure}
                >
                  No project
                </button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    className={`project-chip${timer.projectId === p.id ? " selected" : ""}`}
                    onClick={() => canConfigure && timer.setProjectId(p.id)}
                    disabled={!canConfigure}
                  >
                    <span className="dot" style={{ background: p.color }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="config-row">
              <div className="config-label">Interval Length</div>
              <div className="interval-config">
                <div className="interval-input">
                  <div className="interval-input-label">Focus (min)</div>
                  <input
                    className="interval-input-value mono"
                    type="number"
                    min={5}
                    max={90}
                    value={timer.focusMinutes}
                    disabled={!canConfigure}
                    onChange={(e) => timer.setFocusMinutes(Number(e.target.value) || 25)}
                  />
                </div>
                <div className="interval-input">
                  <div className="interval-input-label">Break (min)</div>
                  <input
                    className="interval-input-value mono"
                    type="number"
                    min={1}
                    max={30}
                    value={timer.breakMinutes}
                    disabled={!canConfigure}
                    onChange={(e) => timer.setBreakMinutes(Number(e.target.value) || 5)}
                  />
                </div>
              </div>
            </div>

            <div className="config-row">
              <div className="config-label">Rounds</div>
              <div className="cycle-select">
                {CYCLE_OPTIONS.map((n) => (
                  <button
                    key={n}
                    className={`cycle-option${timer.totalRounds === n ? " selected" : ""}`}
                    onClick={() => canConfigure && timer.setTotalRounds(n)}
                    disabled={!canConfigure}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="panel notes-panel">
            <div className="panel-head">
              <div className="panel-title">Session Notes</div>
            </div>
            <textarea
              placeholder="What did you cover this round? Notes save when the round ends."
              value={timer.notesDraft}
              onChange={(e) => timer.setNotesDraft(e.target.value)}
            />
            <div className="notes-meta">
              <div className="notes-points">
                Round {timer.currentRound} will earn <b>+{estimatedPoints(timer.focusMinutes)} pts</b> on completion
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel log-panel">
        <div className="panel-head">
          <div className="panel-title">Today&apos;s Sessions</div>
        </div>
        {sessions.length === 0 ? (
          <div className="empty-hint">No sessions logged yet today.</div>
        ) : (
          <SessionLogList sessions={sessions} onChanged={loadToday} />
        )}
      </div>
    </>
  );
}
