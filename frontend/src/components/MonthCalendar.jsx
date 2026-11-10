import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import DayModal from "./DayModal";
import { TopPill } from "./TopPill";
import EventModal from "./EventModal";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PRIORITY_COLOR = { high: "#D97A6C", medium: "#E8A33D", low: "#86B4FF" };

function pad(n) {
  return String(n).padStart(2, "0");
}
function toDateStr(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function todayStr() {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function MonthCalendar({ subjects }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [deadlines, setDeadlines] = useState([]);
  const [sessionDays, setSessionDays] = useState(new Set());
  const [selectedDate, setSelectedDate] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventDraft, setEventDraft] = useState(null);
  const today = todayStr();

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  // Soft spotlight that follows the cursor inside a day cell (read by theme.css).
  const glow = (e) => {
    const cell = e.target.closest && e.target.closest(".cal-cell");
    if (!cell) return;
    const r = cell.getBoundingClientRect();
    cell.style.setProperty("--mx", `${e.clientX - r.left}px`);
    cell.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const load = async () => {
    const monthStr = `${year}-${pad(month + 1)}`;
    const [dl, ev] = await Promise.all([api.getDeadlines({ month: monthStr }), api.getEvents({ month: monthStr })]);
    setDeadlines(dl);
    setEvents(ev);
    // fetch sessions across the month by pulling recent sessions and filtering client-side
    const allSessions = await api.getSessions({ limit: 500 });
    const set = new Set(
      allSessions.filter((s) => s.session_date.startsWith(monthStr)).map((s) => s.session_date)
    );
    setSessionDays(set);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const startDow = (firstOfMonth.getDay() + 6) % 7; // weeks start on Monday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const arr = [];
    for (let i = 0; i < startDow; i++) {
      arr.push({ label: daysInPrevMonth - startDow + 1 + i, muted: true, dateStr: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ label: d, muted: false, dateStr: toDateStr(year, month, d) });
    }
    const remainder = (7 - (arr.length % 7)) % 7;
    for (let i = 1; i <= remainder; i++) {
      arr.push({ label: i, muted: true, dateStr: null });
    }
    return arr;
  }, [year, month]);

  const deadlinesByDate = useMemo(() => {
    const map = {};
    deadlines.forEach((d) => {
      if (!map[d.due_date]) map[d.due_date] = [];
      map[d.due_date].push(d);
    });
    return map;
  }, [deadlines]);

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      if (!map[e.event_date]) map[e.event_date] = [];
      map[e.event_date].push(e);
    });
    return map;
  }, [events]);

  // New events default to today, or the 1st when browsing another month.
  const openAddEvent = () => {
    const inView = today.startsWith(`${year}-${pad(month + 1)}`);
    setEventDraft({ event_date: inView ? today : toDateStr(year, month, 1) });
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  return (
    <div className="cal-wrap">
      <button className="sq-btn sq-add" onClick={openAddEvent} title="Add an event">
        <span className="plus">+</span>
        <span className="label">Add event</span>
      </button>
      <TopPill className="cal-pill">
        <button className="cal-arrow" onClick={prevMonth} aria-label="Previous month">
          ‹
        </button>
        <div className="cal-month">{monthLabel.toUpperCase()}</div>
        <button className="cal-today" onClick={goToday} title="Jump to today">
          Today
        </button>
        <button className="cal-arrow" onClick={nextMonth} aria-label="Next month">
          ›
        </button>
      </TopPill>

      <div className="cal-grid" onMouseMove={glow}>
        {DOW.map((d) => (
          <div className="cal-dow" key={d}>
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          if (c.muted) {
            return (
              <div className="cal-cell muted" key={i}>
                <div className="cal-date">{c.label}</div>
                <div />
              </div>
            );
          }
          const items = deadlinesByDate[c.dateStr] || [];
          const evs = eventsByDate[c.dateStr] || [];
          const hasSession = sessionDays.has(c.dateStr);
          const isToday = c.dateStr === today;
          const isSelected = c.dateStr === selectedDate;
          return (
            <div
              className={`cal-cell${isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
              key={i}
              onClick={() => setSelectedDate(c.dateStr)}
            >
              <div className="cal-date">{c.label}</div>
              <div className="cal-dots">
                {evs.length > 0 && <span className="cal-event-dot" />}
                {items.slice(0, 3).map((it) => (
                  <span key={it.id} className="cal-tag-dot" style={{ background: PRIORITY_COLOR[it.priority] }} />
                ))}
              </div>
              {evs.length > 0 && (
                <div className="cal-event-label">
                  {evs[0].title}
                  {evs.length > 1 ? ` +${evs.length - 1}` : ""}
                </div>
              )}
              {hasSession && <div className="cal-session-mark">●</div>}
            </div>
          );
        })}
      </div>

      <div className="cal-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: PRIORITY_COLOR.high }} />
          High priority
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: PRIORITY_COLOR.medium }} />
          Medium
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: PRIORITY_COLOR.low }} />
          Low
        </div>
        <div className="legend-item">
          <span className="cal-event-dot" />
          Event
        </div>
        <div className="legend-item">
          <span className="cal-session-mark">●</span>
          Study session
        </div>
      </div>

      {eventDraft && <EventModal initial={eventDraft} onClose={() => setEventDraft(null)} onSaved={load} />}

      {selectedDate && (
        <DayModal
          date={selectedDate}
          subjects={subjects}
          onClose={() => setSelectedDate(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
