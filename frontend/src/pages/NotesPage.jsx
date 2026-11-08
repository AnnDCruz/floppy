import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

const SAVE_DELAY_MS = 700;

function sortNotes(list) {
  return [...list].sort(
    (a, b) => b.pinned - a.pinned || (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : b.id - a.id)
  );
}

function timeAgo(iso) {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const SAVE_LABEL = {
  saved: "Saved",
  saving: "Saving…",
  dirty: "Unsaved changes…",
  error: "Couldn't save. Will retry when you type",
};

export default function NotesPage() {
  const [notes, setNotes] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [saveState, setSaveState] = useState("saved");
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const titleRef = useRef(null);
  const timer = useRef(null);
  const dirty = useRef(false);
  const latest = useRef({ id: null, title: "", body: "" }); // what the editor currently holds

  // Save whatever is pending right now (used by the debounce, note switching and leaving the page).
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!dirty.current || latest.current.id == null) return;
    dirty.current = false;
    const { id, title, body } = latest.current;
    setSaveState("saving");
    try {
      const saved = await api.updateNote(id, { title, body });
      setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? saved : n))));
      setSaveState(dirty.current ? "dirty" : "saved");
    } catch (e) {
      dirty.current = true;
      setSaveState("error");
    }
  }, []);

  // Load notes and open the first one.
  useEffect(() => {
    api
      .getNotes()
      .then((list) => {
        const sorted = sortNotes(list);
        setNotes(sorted);
        if (sorted[0]) open(sorted[0]);
      })
      .catch((e) => setError(e.message));
    // Leaving the page: write out anything still unsaved.
    return () => {
      clearTimeout(timer.current);
      if (dirty.current) {
        const { id, title, body } = latest.current;
        api.updateNote(id, { title, body }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open(note) {
    setActiveId(note.id);
    setDraft({ title: note.title, body: note.body });
    latest.current = { id: note.id, title: note.title, body: note.body };
    dirty.current = false;
    setSaveState("saved");
    setConfirmDelete(false);
  }

  const select = async (note) => {
    if (note.id === activeId) return;
    await flush();
    open(note);
  };

  const edit = (field) => (e) => {
    const value = e.target.value;
    setDraft((d) => ({ ...d, [field]: value }));
    latest.current = { ...latest.current, [field]: value };
    dirty.current = true;
    setSaveState("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  const create = async () => {
    setError("");
    await flush();
    try {
      const n = await api.addNote({ title: "Untitled", body: "" });
      setNotes((prev) => sortNotes([n, ...(prev || [])]));
      setQuery("");
      open(n);
      setTimeout(() => titleRef.current && titleRef.current.select(), 30);
    } catch (e) {
      setError(e.message);
    }
  };

  const togglePin = async () => {
    const note = notes.find((n) => n.id === activeId);
    if (!note) return;
    try {
      const saved = await api.updateNote(note.id, { pinned: !note.pinned });
      setNotes((prev) => sortNotes(prev.map((n) => (n.id === note.id ? { ...n, pinned: saved.pinned } : n))));
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    clearTimeout(timer.current);
    dirty.current = false;
    const id = activeId;
    try {
      await api.deleteNote(id);
      const rest = notes.filter((n) => n.id !== id);
      setNotes(rest);
      if (rest[0]) open(rest[0]);
      else {
        setActiveId(null);
        latest.current = { id: null, title: "", body: "" };
        setDraft({ title: "", body: "" });
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const visible = useMemo(() => {
    if (!notes) return [];
    const q = query.trim().toLowerCase();
    return q ? notes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)) : notes;
  }, [notes, query]);

  if (!notes) return <div className="loading-state">{error || "Loading notes…"}</div>;

  const active = notes.find((n) => n.id === activeId);
  const words = draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title display">Notes</div>
          <div className="page-sub">Write down anything important. It saves as you type.</div>
        </div>
      </div>

      {error && <div className="plan-error">{error}</div>}

      <div className="notes-layout">
        <div className="panel notes-list">
          <div className="notes-list-head">
            <input className="notes-search" placeholder="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="btn btn-primary" onClick={create}>
              + New
            </button>
          </div>
          <div className="notes-items">
            {visible.length === 0 ? (
              <div className="empty-hint">{notes.length === 0 ? "No notes yet. Tap + New to write your first." : "No notes match your search."}</div>
            ) : (
              visible.map((n) => {
                const isActive = n.id === activeId;
                // show live text for the open note so the list matches the editor
                const title = isActive ? draft.title : n.title;
                const body = isActive ? draft.body : n.body;
                return (
                  <button key={n.id} className={`note-item${isActive ? " active" : ""}`} onClick={() => select(n)}>
                    <div className="note-item-title">
                      {n.pinned ? <span className="pin-mark">★</span> : null}
                      {title.trim() || "Untitled"}
                    </div>
                    <div className="note-item-preview">{body.replace(/\s+/g, " ").trim().slice(0, 90) || "No content yet"}</div>
                    <div className="note-item-time">{timeAgo(n.updated_at)}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="panel notes-editor">
          {active ? (
            <>
              <input
                ref={titleRef}
                className="note-title-input"
                placeholder="Title"
                value={draft.title}
                onChange={edit("title")}
                maxLength={200}
              />
              <textarea className="note-body" placeholder="Start typing…" value={draft.body} onChange={edit("body")} maxLength={50000} />
              <div className="note-footer">
                <div>
                  <span className={`save-state ${saveState}`}>{SAVE_LABEL[saveState]}</span>
                  <span className="note-count">
                    {words} {words === 1 ? "word" : "words"}
                  </span>
                </div>
                <div className="note-actions">
                  <button className="btn btn-ghost plan-btn" onClick={togglePin}>
                    {active.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button className="btn btn-ghost plan-btn" style={{ color: "var(--coral)" }} onClick={remove}>
                    {confirmDelete ? "Click again to delete" : "Delete"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="notes-empty">
              <div className="notes-empty-title">Nothing open</div>
              <div>Create a note for the details you don't want to forget: links, rules, contact names, checklists.</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={create}>
                + New note
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
