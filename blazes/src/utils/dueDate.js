// Assignment deadlines are stored as a separate `due_date` (YYYY-MM-DD) and
// `due_time` (HH:MM). Passing the bare date to `new Date()` parses it as UTC
// midnight and drops the time entirely, so an assignment due 2026-08-20 23:59
// read as overdue from 20:00 EDT on 08-19 — nearly 28 hours early.
//
// Joining the two parts without a 'Z' makes the engine parse it as local time,
// which is what both the teacher who set it and the student reading it expect.

/** Deadline as a Date in local time, or null when no date is set. */
export function assignmentDueAt(assignment) {
  if (!assignment?.due_date) return null;
  const at = new Date(`${assignment.due_date}T${assignment.due_time || '23:59'}`);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** True only once the deadline has actually passed. */
export function isOverdue(assignment, now = Date.now()) {
  const at = assignmentDueAt(assignment);
  return at !== null && at.getTime() < now;
}

/** Local YYYY-MM-DD, for `min`/`max` on <input type="date">, which is local-time. */
export function localDateInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
