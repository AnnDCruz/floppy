const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // subjects
  getSubjects: () => request("/subjects"),
  getSubjectStats: () => request("/subjects/stats"),
  addSubject: (data) => request("/subjects", { method: "POST", body: JSON.stringify(data) }),
  updateSubject: (id, data) => request(`/subjects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSubject: (id) => request(`/subjects/${id}`, { method: "DELETE" }),

  // sessions
  getSessions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/sessions${qs ? `?${qs}` : ""}`);
  },
  logSession: (data) => request("/sessions", { method: "POST", body: JSON.stringify(data) }),
  updateSessionNotes: (id, notes) =>
    request(`/sessions/${id}/notes`, { method: "PATCH", body: JSON.stringify({ notes }) }),

  // deadlines
  getDeadlines: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/deadlines${qs ? `?${qs}` : ""}`);
  },
  getDeadlinesForDay: (date) => request(`/deadlines/day/${date}`),
  addDeadline: (data) => request("/deadlines", { method: "POST", body: JSON.stringify(data) }),
  updateDeadline: (id, data) => request(`/deadlines/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteDeadline: (id) => request(`/deadlines/${id}`, { method: "DELETE" }),

  // streak
  getStreak: () => request("/streak"),

  // dashboard
  getDashboard: () => request("/dashboard"),

  // projects
  getProjects: () => request("/projects"),
  getProjectStats: () => request("/projects/stats"),
  addProject: (data) => request("/projects", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: "DELETE" }),

  // review items
  getReviews: () => request("/reviews"),
  getDueReviews: () => request("/reviews/due"),
  addReview: (data) => request("/reviews", { method: "POST", body: JSON.stringify(data) }),
  updateReview: (id, data) => request(`/reviews/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  markReviewed: (id) => request(`/reviews/${id}/mark-reviewed`, { method: "POST" }),
  deleteReview: (id) => request(`/reviews/${id}`, { method: "DELETE" }),

  // tasks
  getTasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tasks${qs ? `?${qs}` : ""}`);
  },
  addTask: (data) => request("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),

  // AI planner (propose-and-approve)
  getAgentStatus: () => request("/agent/status"),
  getLatestPlan: () => request("/agent/latest"),
  planDay: (data) => request("/agent/plan", { method: "POST", body: JSON.stringify(data) }),
  approveProposal: (id) => request(`/proposals/${id}/approve`, { method: "POST" }),
  rejectProposal: (id) => request(`/proposals/${id}/reject`, { method: "POST" }),

  // calendar events
  getEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/events${qs ? `?${qs}` : ""}`);
  },
  addEvent: (data) => request("/events", { method: "POST", body: JSON.stringify(data) }),
  updateEvent: (id, data) => request(`/events/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteEvent: (id) => request(`/events/${id}`, { method: "DELETE" }),

  // notes
  getNotes: () => request("/notes"),
  addNote: (data = {}) => request("/notes", { method: "POST", body: JSON.stringify(data) }),
  updateNote: (id, data) => request(`/notes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteNote: (id) => request(`/notes/${id}`, { method: "DELETE" }),
};
