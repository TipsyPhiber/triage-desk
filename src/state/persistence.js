import { PHASES, SEVERITIES } from '../data.js';

export const STORAGE_KEY = 'triage-desk-state-v1';

const PHASE_IDS = new Set(PHASES.map((p) => p.id));
const EVENT_TYPES = new Set([
  'declare', 'resolve', 'severity', 'phase', 'check', 'uncheck', 'ioc', 'note',
]);

function isFiniteNumber(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

export function buildInitialChecks() {
  const out = {};
  for (const phase of PHASES) {
    out[phase.id] = phase.tasks.map(() => false);
  }
  return out;
}

export function buildInitialNotes() {
  const out = {};
  for (const phase of PHASES) out[phase.id] = '';
  return out;
}

export function buildInitialIocIndex() {
  const out = {};
  for (const phase of PHASES) out[phase.id] = [];
  return out;
}

// If a phase's task list changed since the save, drop just that phase's
// checklist rather than the whole incident.
export function reconcileChecks(persisted) {
  const fresh = buildInitialChecks();
  if (!persisted || typeof persisted !== 'object') return fresh;
  for (const p of PHASES) {
    const arr = persisted[p.id];
    if (Array.isArray(arr) && arr.length === p.tasks.length) {
      fresh[p.id] = arr.map(Boolean);
    }
  }
  return fresh;
}

export function reconcileNotes(persisted) {
  const fresh = buildInitialNotes();
  if (!persisted || typeof persisted !== 'object') return fresh;
  for (const p of PHASES) {
    const v = persisted[p.id];
    if (typeof v === 'string') fresh[p.id] = v;
  }
  return fresh;
}

export function reconcileIocIndex(persisted) {
  const fresh = buildInitialIocIndex();
  if (!persisted || typeof persisted !== 'object') return fresh;
  for (const p of PHASES) {
    const arr = persisted[p.id];
    if (!Array.isArray(arr)) continue;
    const seen = new Set();
    const out = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const { kind, value } = item;
      if (typeof kind !== 'string' || typeof value !== 'string') continue;
      if (!kind || !value) continue;
      const k = `${kind}\0${value}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ kind, value });
    }
    fresh[p.id] = out;
  }
  return fresh;
}

export function sanitizeEvents(persisted) {
  if (!Array.isArray(persisted)) return [];
  const seenIds = new Set();
  const out = [];
  for (const e of persisted) {
    if (!e || typeof e !== 'object') continue;
    if (!isFiniteNumber(e.id) || seenIds.has(e.id)) continue;
    if (!isFiniteNumber(e.ts)) continue;
    if (typeof e.type !== 'string' || !EVENT_TYPES.has(e.type)) continue;
    if (typeof e.message !== 'string') continue;
    seenIds.add(e.id);
    out.push({ id: e.id, ts: e.ts, type: e.type, message: e.message });
  }
  return out;
}

export function sanitizeActivePhase(persisted) {
  return PHASE_IDS.has(persisted) ? persisted : PHASES[0].id;
}

export function sanitizeSeverity(persisted) {
  return persisted && SEVERITIES[persisted] ? persisted : 'Medium';
}

export function sanitizeTimestamp(persisted) {
  return isFiniteNumber(persisted) ? persisted : null;
}

export function sanitizeIncidentName(persisted) {
  return typeof persisted === 'string' ? persisted : '';
}

// Single entry point for both initial load and cross-tab rehydration.
// Anything that doesn't pass shape checks is silently replaced with a default,
// so a partially-corrupt payload still produces a usable incident.
export function hydrate(persisted) {
  return {
    activePhase: sanitizeActivePhase(persisted?.activePhase),
    severity: sanitizeSeverity(persisted?.severity),
    incidentName: sanitizeIncidentName(persisted?.incidentName),
    startTime: sanitizeTimestamp(persisted?.startTime),
    endTime: sanitizeTimestamp(persisted?.endTime),
    checks: reconcileChecks(persisted?.checks),
    notes: reconcileNotes(persisted?.notes),
    events: sanitizeEvents(persisted?.events),
    iocIndex: reconcileIocIndex(persisted?.iocIndex),
  };
}

export function loadPersisted() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function savePersisted(state) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function clearPersisted() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
