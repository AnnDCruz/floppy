import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { api } from "./api";

const TimerContext = createContext(null);

function notify(title, body) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: undefined, silent: false });
    } catch (_) {
      // some browsers restrict Notification() outside a service worker on certain platforms — fail silently
    }
  }
}

export function TimerProvider({ subjects, projects, onSessionLogged, children }) {
  const [subjectId, setSubjectId] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [totalRounds, setTotalRounds] = useState(4);
  const [currentRound, setCurrentRound] = useState(1);
  const [phase, setPhase] = useState("idle"); // idle | focus | break | done
  const [running, setRunning] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  // Timestamp-based countdown: instead of decrementing a counter once per tick (which
  // drifts or stalls when the tab is backgrounded/throttled/asleep), we track the real
  // wall-clock deadline and always recompute secondsLeft as (deadline - now). A tick that
  // fires late, or a tab that wakes up after being suspended, self-corrects immediately
  // because it's reading the actual clock, not counting missed ticks.
  const [totalSecondsForPhase, setTotalSecondsForPhase] = useState(focusMinutes * 60);
  const [secondsLeft, setSecondsLeft] = useState(focusMinutes * 60);
  const deadlineRef = useRef(null); // ms timestamp when current phase should hit 0
  const pausedRemainingRef = useRef(null); // seconds left, captured at pause
  const phaseStartRef = useRef(null); // ms timestamp when the current focus phase actually started (for early-end logging)
  const focusPausedElapsedRef = useRef(0); // accumulated elapsed focus seconds across pause/resume within one round

  useEffect(() => {
    if (!subjectId && subjects && subjects.length > 0) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const logCurrentFocus = useCallback(
    async (secondsElapsed, notes) => {
      const minutes = Math.max(1, Math.round(secondsElapsed / 60));
      if (!subjectId) return;
      try {
        const session = await api.logSession({
          subject_id: subjectId,
          project_id: projectId || undefined,
          duration_minutes: minutes,
          notes: notes || "",
        });
        onSessionLogged && onSessionLogged(session);
      } catch (e) {
        console.error("Failed to log session", e);
      }
    },
    [subjectId, projectId, onSessionLogged]
  );

  const advancePhase = useCallback(() => {
    if (phase === "focus") {
      logCurrentFocus(focusMinutes * 60, notesDraft);
      setNotesDraft("");
      focusPausedElapsedRef.current = 0;
      notify("Focus round complete", `+${Math.round(focusMinutes * 60 * 1.6)} pts logged.`);

      if (currentRound < totalRounds) {
        const secs = breakMinutes * 60;
        deadlineRef.current = Date.now() + secs * 1000;
        setTotalSecondsForPhase(secs);
        setSecondsLeft(secs);
        setPhase("break");
        notify("Break started", `${breakMinutes} min — back to it after.`);
      } else {
        setRunning(false);
        deadlineRef.current = null;
        setPhase("done");
        notify("Session complete", `All ${totalRounds} rounds done. Nice work.`);
      }
    } else if (phase === "break") {
      setCurrentRound((r) => r + 1);
      const secs = focusMinutes * 60;
      deadlineRef.current = Date.now() + secs * 1000;
      phaseStartRef.current = Date.now();
      focusPausedElapsedRef.current = 0;
      setTotalSecondsForPhase(secs);
      setSecondsLeft(secs);
      setPhase("focus");
      notify("Break's over", "Back to focus.");
    }
  }, [phase, focusMinutes, breakMinutes, totalRounds, currentRound, notesDraft, logCurrentFocus]);

  // Single ticking interval that recomputes from the real clock every time it fires.
  // Also recomputes immediately on visibility change, so a backgrounded/slept tab
  // catches up the instant it becomes active again instead of waiting for the next tick.
  useEffect(() => {
    if (!running || !deadlineRef.current) return;

    const tick = () => {
      const remainingMs = deadlineRef.current - Date.now();
      const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsLeft(remaining);
      if (phase === "focus" && phaseStartRef.current) {
        focusPausedElapsedRef.current = Math.floor((Date.now() - phaseStartRef.current) / 1000);
      }
      if (remaining <= 0) {
        advancePhase();
      }
    };

    tick(); // immediate correction on mount/resume
    const id = setInterval(tick, 1000);

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [running, phase, advancePhase]);

  const start = () => {
    if (phase === "idle" || phase === "done") {
      const secs = focusMinutes * 60;
      setPhase("focus");
      setTotalSecondsForPhase(secs);
      setSecondsLeft(secs);
      setCurrentRound(1);
      deadlineRef.current = Date.now() + secs * 1000;
      phaseStartRef.current = Date.now();
      focusPausedElapsedRef.current = 0;
    } else if (pausedRemainingRef.current != null) {
      // resuming from pause: shift the deadline forward by the remaining time
      const secs = pausedRemainingRef.current;
      deadlineRef.current = Date.now() + secs * 1000;
      if (phase === "focus") {
        // re-anchor phaseStart so elapsed-so-far accounting stays correct across the pause
        phaseStartRef.current = Date.now() - focusPausedElapsedRef.current * 1000;
      }
      pausedRemainingRef.current = null;
    }
    setRunning(true);
  };

  const pause = () => {
    pausedRemainingRef.current = secondsLeft;
    setRunning(false);
  };

  const restartInterval = () => {
    const secs = phase === "break" ? breakMinutes * 60 : focusMinutes * 60;
    setTotalSecondsForPhase(secs);
    setSecondsLeft(secs);
    deadlineRef.current = Date.now() + secs * 1000;
    pausedRemainingRef.current = running ? null : secs;
    if (phase === "focus") {
      phaseStartRef.current = Date.now();
      focusPausedElapsedRef.current = 0;
    }
  };

  const endAndLog = async () => {
    setRunning(false);
    if (phase === "focus" && focusPausedElapsedRef.current >= 30) {
      await logCurrentFocus(focusPausedElapsedRef.current, notesDraft);
      setNotesDraft("");
    }
    focusPausedElapsedRef.current = 0;
    deadlineRef.current = null;
    pausedRemainingRef.current = null;
    setPhase("idle");
    const secs = focusMinutes * 60;
    setTotalSecondsForPhase(secs);
    setSecondsLeft(secs);
    setCurrentRound(1);
  };

  const value = {
    subjectId,
    setSubjectId,
    projectId,
    setProjectId,
    focusMinutes,
    setFocusMinutes,
    breakMinutes,
    setBreakMinutes,
    totalRounds,
    setTotalRounds,
    currentRound,
    phase,
    secondsLeft,
    running,
    notesDraft,
    setNotesDraft,
    start,
    pause,
    restartInterval,
    endAndLog,
    totalSecondsForPhase,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}
