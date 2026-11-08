import React, { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { TimerProvider } from "./TimerContext";
import Sidebar from "./components/Sidebar";
import Toast from "./components/Toast";
import Background from "./components/Background";
import Dashboard from "./pages/Dashboard";
import TimerPage from "./pages/TimerPage";
import CalendarPage from "./pages/CalendarPage";
import SubjectsPage from "./pages/SubjectsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ReviewsPage from "./pages/ReviewsPage";
import TasksPage from "./pages/TasksPage";
import NotesPage from "./pages/NotesPage";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [subjects, setSubjects] = useState([]);
  const [projects, setProjects] = useState([]);
  const [streak, setStreak] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [background, setBackground] = useState(() => {
    try {
      return localStorage.getItem("sf-bg") === "plasma" ? "plasma" : "aurora";
    } catch (_) {
      return "aurora";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.bg = background;
    try {
      localStorage.setItem("sf-bg", background);
    } catch (_) {
      /* storage can be unavailable; the choice still applies for this session */
    }
  }, [background]);

  const loadSubjects = useCallback(async () => {
    const s = await api.getSubjects();
    setSubjects(s);
  }, []);

  const loadProjects = useCallback(async () => {
    const p = await api.getProjects();
    setProjects(p);
  }, []);

  const loadStreak = useCallback(async () => {
    const s = await api.getStreak();
    setStreak(s);
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadSubjects(), loadProjects(), loadStreak()]);
      setReady(true);
    })();
  }, [loadSubjects, loadProjects, loadStreak]);

  const handleSessionLogged = useCallback(
    async (session) => {
      setRefreshKey((k) => k + 1);
      const prevStreak = streak?.current_streak ?? 0;
      const prevFreezes = streak?.freezes_used ?? 0;
      const s = await api.getStreak();
      setStreak(s);
      const streakNote =
        s.current_streak > prevStreak
          ? `🔥 Streak: ${s.current_streak}d`
          : s.freezes_used > prevFreezes
          ? "🧊 Streak protected with points"
          : null;
      setToast({
        subjectName: session.subject_name,
        projectName: session.project_name,
        minutes: session.duration_minutes,
        points: session.points_earned,
        streakNote,
      });
    },
    [streak]
  );

  const handleSubjectsChanged = useCallback(() => {
    loadSubjects();
    setRefreshKey((k) => k + 1);
  }, [loadSubjects]);

  const handleProjectsChanged = useCallback(() => {
    loadProjects();
    setRefreshKey((k) => k + 1);
  }, [loadProjects]);

  // Fade the current page out, swap, and let the new page animate in.
  const navigate = useCallback(
    (next) => {
      if (next === page) return;
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        setPage(next);
        return;
      }
      setLeaving(true);
      setTimeout(() => {
        setPage(next);
        setLeaving(false);
        window.scrollTo({ top: 0 });
      }, 170);
    },
    [page]
  );

  if (!ready)
    return (
      <>
        <Background variant={background} />
        <div className="loading-state">Loading StudyForge…</div>
      </>
    );

  return (
    <TimerProvider subjects={subjects} projects={projects} onSessionLogged={handleSessionLogged}>
      <div className="shell">
        <Background variant={background} />
        <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu" title="Menu">
          <span />
          <span />
          <span />
        </button>
        <Sidebar
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          active={page}
          onNavigate={navigate}
          streak={streak}
          background={background}
          onBackgroundChange={setBackground}
        />
        <main className={`main${leaving ? " leaving" : ""}`}>
          {page === "dashboard" && (
            <Dashboard subjects={subjects} projects={projects} refreshKey={refreshKey} onNavigate={navigate} />
          )}
          {page === "timer" && (
            <TimerPage subjects={subjects} projects={projects} refreshKey={refreshKey} />
          )}
          {page === "calendar" && <CalendarPage subjects={subjects} />}
          {page === "subjects" && (
            <SubjectsPage subjects={subjects} onSubjectsChanged={handleSubjectsChanged} refreshKey={refreshKey} />
          )}
          {page === "projects" && <ProjectsPage refreshKey={refreshKey} onProjectsChanged={handleProjectsChanged} />}
          {page === "reviews" && <ReviewsPage subjects={subjects} refreshKey={refreshKey} />}
          {page === "tasks" && <TasksPage refreshKey={refreshKey} />}
          {page === "notes" && <NotesPage />}
        </main>
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </TimerProvider>
  );
}
