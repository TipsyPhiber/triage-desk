import { PHASES, SEVERITIES } from '../data.js';

export const STORAGE_KEY = 'triage-desk-state-v1';

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

export function reconcileByPhase(persisted, fallback) {
  const fresh = fallback();
  if (!persisted || typeof persisted !== 'object') return fresh;
  for (const p of PHASES) {
    if (Object.prototype.hasOwnProperty.call(persisted, p.id)) {
      fresh[p.id] = persisted[p.id];
    }
  }
  return fresh;
}

export function isValidSeverity(s) {
  return Boolean(s && SEVERITIES[s]);
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
