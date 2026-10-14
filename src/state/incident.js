// Pure incident model. Every operation takes an incident and returns a new
// one (or the same object when nothing changed), so App can feed these
// straight into setState updaters and tests can exercise them directly.

import { PHASES, SEVERITIES, TLP_LEVELS } from '../data.js';
import { incidentLifecycle, phaseLocked } from '../lib/phaseActivity.js';
import { mergeIocs } from './iocIndex.js';
import { phasesFor, sanitizeSearches, sanitizeTasks } from './playbooks.js';

export const EVENT_TYPES = new Set([
  'declare', 'resolve', 'severity', 'phase', 'check', 'uncheck', 'ioc', 'note', 'splunk',
]);
const ATTACK_RE = /^T\d{4}(\.\d{3})?$/;
export const DEFAULT_TLP = 'TLP:AMBER';
const PHASE_IDS = new Set(PHASES.map((p) => p.id));

function isFiniteNumber(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

export function newIncidentId(now = Date.now()) {
  return `inc-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyByPhase(tasks, make) {
  const out = {};
  for (const p of PHASES) out[p.id] = make(tasks[p.id] ?? []);
  return out;
}

function sanitizeAttack(raw) {
  return Array.isArray(raw) ? [...new Set(raw.filter((t) => typeof t === 'string' && ATTACK_RE.test(t)))].slice(0, 20) : [];
}

export function createIncident({ playbook, name = '', severity = 'Medium', tlp = DEFAULT_TLP, now = Date.now(), id } = {}) {
  const tasks = sanitizeTasks(playbook?.tasks);
  return {
    id: id ?? newIncidentId(now),
    createdAt: now,
    playbookId: playbook?.id ?? null,
    playbookName: playbook?.name ?? 'Custom',
    tasks,
    searches: sanitizeSearches(playbook?.splunk),
    attack: sanitizeAttack(playbook?.attack),
    name,
    severity: SEVERITIES[severity] ? severity : 'Medium',
    tlp: TLP_LEVELS[tlp] ? tlp : DEFAULT_TLP,
    activePhase: PHASES[0].id,
    startTime: null,
    endTime: null,
    checks: emptyByPhase(tasks, (t) => t.map(() => false)),
    checkedAt: emptyByPhase(tasks, (t) => t.map(() => null)),
    notes: emptyByPhase(tasks, () => ''),
    iocIndex: emptyByPhase(tasks, () => []),
    events: [],
  };
}

export function lifecycleOf(inc) {
  return incidentLifecycle(inc.startTime, inc.endTime);
}

export function isRunning(inc) {
  return lifecycleOf(inc) === 'active';
}

export function incidentPhases(inc) {
  return phasesFor(inc.tasks);
}

export function incidentTotals(inc) {
  let done = 0;
  let total = 0;
  for (const p of PHASES) {
    const arr = inc.checks[p.id] || [];
    total += arr.length;
    done += arr.filter(Boolean).length;
  }
  return { done, total };
}

function withEvent(inc, type, message, now) {
  const nextId = inc.events.reduce((m, e) => Math.max(m, e.id), 0) + 1;
  return { ...inc, events: [...inc.events, { id: nextId, ts: now, type, message }] };
}

// Only log while the incident clock is running; edits before declaration or
// after resolution are corrections, not response activity.
function logIfRunning(inc, type, message, now) {
  return isRunning(inc) ? withEvent(inc, type, message, now) : inc;
}

export function declareIncident(inc, now = Date.now()) {
  // Declaration is, by definition, entry into Identification (PICERL /
  // NIST SP 800-61). Jump there regardless of where the operator was.
  const entry = PHASES.find((p) => p.stage === 'response');
  return {
    ...inc,
    startTime: now,
    endTime: null,
    activePhase: entry ? entry.id : inc.activePhase,
    events: [{ id: 1, ts: now, type: 'declare', message: `Incident declared — severity ${inc.severity}` }],
  };
}

export function resolveIncident(inc, now = Date.now()) {
  if (!isRunning(inc)) return inc;
  const lessons = PHASES.find((p) => p.stage === 'post-incident');
  const next = withEvent(inc, 'resolve', 'Incident marked resolved', now);
  return { ...next, endTime: now, activePhase: lessons ? lessons.id : inc.activePhase };
}

// Clear progress but keep identity, name, and playbook.
export function resetIncident(inc, now = Date.now()) {
  const fresh = createIncident({
    playbook: { id: inc.playbookId, name: inc.playbookName, tasks: inc.tasks, splunk: inc.searches, attack: inc.attack },
    name: inc.name, severity: inc.severity, tlp: inc.tlp, now, id: inc.id,
  });
  return { ...fresh, createdAt: inc.createdAt };
}

export function setSeverity(inc, severity, now = Date.now()) {
  if (severity === inc.severity || !SEVERITIES[severity]) return inc;
  const logged = logIfRunning(inc, 'severity', `Severity changed: ${inc.severity} → ${severity}`, now);
  return { ...logged, severity };
}

export function setTlp(inc, tlp) {
  if (tlp === inc.tlp || !TLP_LEVELS[tlp]) return inc;
  return { ...inc, tlp };
}

export function renameIncident(inc, name) {
  return name === inc.name ? inc : { ...inc, name };
}

export function setActivePhase(inc, phaseId, now = Date.now()) {
  if (phaseId === inc.activePhase) return inc;
  const target = PHASES.find((p) => p.id === phaseId);
  if (!target || phaseLocked(target.stage, lifecycleOf(inc))) return inc;
  const logged = logIfRunning(inc, 'phase', `Switched to phase: ${target.name}`, now);
  return { ...logged, activePhase: phaseId };
}

export function toggleCheck(inc, phaseId, idx, now = Date.now()) {
  const arr = inc.checks[phaseId];
  if (!arr || idx < 0 || idx >= arr.length) return inc;
  const newVal = !arr[idx];
  const nextArr = [...arr];
  nextArr[idx] = newVal;
  const phase = PHASES.find((p) => p.id === phaseId);
  const taskText = inc.tasks[phaseId]?.[idx] ?? '';
  const logged = logIfRunning(
    inc,
    newVal ? 'check' : 'uncheck',
    `${newVal ? 'Checked' : 'Unchecked'} [${phase?.short ?? ''}]: ${taskText}`,
    now,
  );
  const times = [...(inc.checkedAt?.[phaseId] ?? arr.map(() => null))];
  times[idx] = newVal ? now : null;
  return {
    ...logged,
    checks: { ...inc.checks, [phaseId]: nextArr },
    checkedAt: { ...inc.checkedAt, [phaseId]: times },
  };
}

export function setNote(inc, phaseId, value) {
  if (!PHASE_IDS.has(phaseId) || inc.notes[phaseId] === value) return inc;
  return { ...inc, notes: { ...inc.notes, [phaseId]: value } };
}

export function appendNote(inc, phaseId, text) {
  const existing = inc.notes[phaseId] || '';
  const sep = existing && !existing.endsWith('\n') ? '\n' : '';
  return setNote(inc, phaseId, existing + sep + text);
}

export function addQuickNote(inc, phaseId, text, now = Date.now()) {
  const trimmed = text.trim();
  if (!trimmed) return inc;
  const stamp = new Date(now).toISOString().replace('T', ' ').slice(0, 19);
  const appended = appendNote(inc, phaseId, `[${stamp}] ${trimmed}`);
  return logIfRunning(appended, 'note', trimmed, now);
}

export function recordIocs(inc, phaseId, results, now = Date.now()) {
  if (!PHASE_IDS.has(phaseId)) return inc;
  const prev = inc.iocIndex[phaseId] || [];
  const merged = mergeIocs(prev, results);
  const next = merged === prev ? inc : { ...inc, iocIndex: { ...inc.iocIndex, [phaseId]: merged } };
  const phase = PHASES.find((p) => p.id === phaseId);
  const n = results?.length ?? 0;
  return logIfRunning(next, 'ioc', `Extracted ${n} IOC${n === 1 ? '' : 's'} into ${phase?.name ?? phaseId} notes`, now);
}

// Record Splunk activity (a search run, events sent) on the timeline.
export function logSplunk(inc, message, now = Date.now()) {
  return logIfRunning(inc, 'splunk', message, now);
}

// ---------------------------------------------------------------------------
// Validation for persisted / imported incidents. Anything that fails a shape
// check is replaced with a default, so a partially-corrupt payload still
// produces a usable incident.

function sanitizeChecks(raw, tasks) {
  const out = {};
  for (const p of PHASES) {
    const arr = raw?.[p.id];
    const n = tasks[p.id].length;
    // If the task list doesn't line up, drop just that phase's checklist.
    out[p.id] = Array.isArray(arr) && arr.length === n ? arr.map(Boolean) : Array(n).fill(false);
  }
  return out;
}

function sanitizeCheckedAt(raw, checks) {
  const out = {};
  for (const p of PHASES) {
    const arr = raw?.[p.id];
    out[p.id] = checks[p.id].map((done, i) => (done && Array.isArray(arr) && isFiniteNumber(arr[i]) ? arr[i] : null));
  }
  return out;
}

function sanitizeNotes(raw) {
  const out = {};
  for (const p of PHASES) out[p.id] = typeof raw?.[p.id] === 'string' ? raw[p.id] : '';
  return out;
}

function sanitizeIocIndex(raw) {
  const out = {};
  for (const p of PHASES) {
    const arr = raw?.[p.id];
    const seen = new Set();
    const list = [];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        const { kind, value } = item;
        if (typeof kind !== 'string' || typeof value !== 'string' || !kind || !value) continue;
        const k = `${kind}\0${value}`;
        if (seen.has(k)) continue;
        seen.add(k);
        list.push({ kind, value });
      }
    }
    out[p.id] = list;
  }
  return out;
}

function sanitizeEvents(raw) {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set();
  const out = [];
  for (const e of raw) {
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

export function sanitizeIncident(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id || raw.id.length > 80) return null;
  const tasks = sanitizeTasks(raw.tasks);
  const startTime = isFiniteNumber(raw.startTime) ? raw.startTime : null;
  const checks = sanitizeChecks(raw.checks, tasks);
  const endTime = startTime !== null && isFiniteNumber(raw.endTime) ? raw.endTime : null;
  return {
    id: raw.id,
    createdAt: isFiniteNumber(raw.createdAt) ? raw.createdAt : (startTime ?? Date.now()),
    playbookId: typeof raw.playbookId === 'string' ? raw.playbookId : null,
    playbookName: typeof raw.playbookName === 'string' ? raw.playbookName : 'Custom',
    tasks,
    searches: sanitizeSearches(raw.searches),
    attack: sanitizeAttack(raw.attack),
    name: typeof raw.name === 'string' ? raw.name : '',
    severity: SEVERITIES[raw.severity] ? raw.severity : 'Medium',
    tlp: TLP_LEVELS[raw.tlp] ? raw.tlp : DEFAULT_TLP,
    activePhase: PHASE_IDS.has(raw.activePhase) ? raw.activePhase : PHASES[0].id,
    startTime,
    endTime,
    checks,
    checkedAt: sanitizeCheckedAt(raw.checkedAt, checks),
    notes: sanitizeNotes(raw.notes),
    iocIndex: sanitizeIocIndex(raw.iocIndex),
    events: sanitizeEvents(raw.events),
  };
}
