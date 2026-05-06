let SEQ = 0;

export function nextEventId() {
  return ++SEQ;
}

// Restore the counter so newly-logged events get ids strictly greater than
// any persisted event. Without this, a hot-reload or rehydrate could collide
// ids and break React's keying on the timeline list.
export function primeEventId(events) {
  if (!Array.isArray(events) || events.length === 0) return;
  SEQ = events.reduce((m, e) => Math.max(m, e?.id ?? 0), 0);
}
