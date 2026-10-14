import { PHASES } from '../data.js';
import { BUILTIN_PLAYBOOKS, GENERAL_PLAYBOOK_ID } from '../playbooks/builtins.js';
import { LIBRARY_PLAYBOOKS } from '../playbooks/library.js';

export const PLAYBOOK_FILE_FORMAT = 'triage-desk-playbook';
const MAX_NAME = 120;
const MAX_DESCRIPTION = 500;
const MAX_TASK = 500;
const MAX_TASKS_PER_PHASE = 60;

function clampString(x, max) {
  return typeof x === 'string' ? x.slice(0, max) : '';
}

// Normalize a phase → tasks map. Unknown phases are dropped, missing phases
// become empty, and each task is trimmed, length-capped, and de-blanked.
export function sanitizeTasks(raw) {
  const out = {};
  for (const p of PHASES) {
    const arr = raw && typeof raw === 'object' ? raw[p.id] : null;
    out[p.id] = Array.isArray(arr)
      ? arr
        .filter((t) => typeof t === 'string')
        .map((t) => t.trim().slice(0, MAX_TASK))
        .filter(Boolean)
        .slice(0, MAX_TASKS_PER_PHASE)
      : [];
  }
  return out;
}

const MAX_SEARCHES = 24;
const PHASE_IDS = new Set(PHASES.map((p) => p.id));

// Saved Splunk searches travel with the incident snapshot, like tasks.
export function sanitizeSearches(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const s of raw) {
    if (out.length >= MAX_SEARCHES) break;
    if (!s || typeof s !== 'object') continue;
    if (typeof s.spl !== 'string' || !s.spl.trim() || s.spl.length > 4000) continue;
    out.push({
      title: typeof s.title === 'string' ? s.title.slice(0, 120) : 'Search',
      phase: PHASE_IDS.has(s.phase) ? s.phase : 'identification',
      spl: s.spl,
    });
  }
  return out;
}

export function newPlaybookId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `custom-${Date.now().toString(36)}-${rand}`;
}

// Custom playbooks come from user edits or imported JSON files, so they're
// treated as untrusted input. Returns null if the payload isn't usable.
export function sanitizePlaybook(raw, { keepId = true } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const name = clampString(raw.name, MAX_NAME).trim();
  if (!name) return null;
  const id = keepId && typeof raw.id === 'string' && raw.id.startsWith('custom-') && raw.id.length <= 80
    ? raw.id
    : newPlaybookId();
  return {
    id,
    name,
    description: clampString(raw.description, MAX_DESCRIPTION).trim(),
    tier: 'pro',
    builtIn: false,
    tasks: sanitizeTasks(raw.tasks),
    splunk: sanitizeSearches(raw.splunk),
    attack: Array.isArray(raw.attack) ? raw.attack.filter((t) => typeof t === 'string' && /^T\d{4}(\.\d{3})?$/.test(t)).slice(0, 20) : [],
  };
}

export function sanitizeCustomPlaybooks(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const pb = sanitizePlaybook(item);
    if (!pb || seen.has(pb.id)) continue;
    seen.add(pb.id);
    out.push(pb);
  }
  return out;
}

export function allPlaybooks(customPlaybooks) {
  return [...BUILTIN_PLAYBOOKS, ...LIBRARY_PLAYBOOKS, ...(customPlaybooks || [])];
}

export function findPlaybook(id, customPlaybooks) {
  return allPlaybooks(customPlaybooks).find((p) => p.id === id)
    ?? BUILTIN_PLAYBOOKS.find((p) => p.id === GENERAL_PLAYBOOK_ID);
}

// Merge the fixed phase definitions with an incident's task snapshot.
export function phasesFor(tasks) {
  return PHASES.map((p) => ({ ...p, tasks: tasks?.[p.id] ?? [] }));
}

export function duplicatePlaybook(pb) {
  return {
    id: newPlaybookId(),
    name: `${pb.name} (copy)`.slice(0, MAX_NAME),
    description: pb.description,
    tier: 'pro',
    builtIn: false,
    tasks: sanitizeTasks(pb.tasks),
    splunk: sanitizeSearches(pb.splunk),
    attack: [...(pb.attack || [])],
  };
}

export function serializePlaybook(pb) {
  return JSON.stringify({
    format: PLAYBOOK_FILE_FORMAT,
    version: 1,
    name: pb.name,
    description: pb.description,
    tasks: pb.tasks,
    splunk: pb.splunk || [],
    attack: pb.attack || [],
  }, null, 2);
}

// Parse an imported playbook file. Imports always get a fresh id so they
// never overwrite an existing playbook.
export function parsePlaybookFile(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('File is not valid JSON.'); }
  if (raw?.format !== PLAYBOOK_FILE_FORMAT) throw new Error('Not a Triage Desk playbook file.');
  const pb = sanitizePlaybook(raw, { keepId: false });
  if (!pb) throw new Error('Playbook is missing a name.');
  return pb;
}
