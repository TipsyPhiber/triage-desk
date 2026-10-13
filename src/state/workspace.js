// The workspace is everything Triage Desk stores: incidents, custom
// playbooks, report settings, and the license key. It lives in localStorage
// and can be exported/imported as a JSON backup file.

import { TLP_LEVELS } from '../data.js';
import { BUILTIN_PLAYBOOKS, GENERAL_PLAYBOOK_ID } from '../playbooks/builtins.js';
import { createIncident, sanitizeIncident, DEFAULT_TLP } from './incident.js';
import { sanitizeCustomPlaybooks } from './playbooks.js';

export const STORAGE_KEY = 'triage-desk-workspace-v2';
export const LEGACY_STORAGE_KEY = 'triage-desk-state-v1';
export const BACKUP_FORMAT = 'triage-desk-backup';
const MAX_SETTING = 200;
const MAX_LICENSE = 4096;

export function defaultSettings() {
  return { orgName: '', preparedBy: '', defaultTlp: DEFAULT_TLP };
}

export function emptyWorkspace() {
  return {
    version: 2,
    incidents: [],
    activeIncidentId: null,
    customPlaybooks: [],
    settings: defaultSettings(),
    license: null,
  };
}

function sanitizeSettings(raw) {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const str = (x) => (typeof x === 'string' ? x.slice(0, MAX_SETTING) : '');
  return {
    orgName: str(raw.orgName),
    preparedBy: str(raw.preparedBy),
    defaultTlp: TLP_LEVELS[raw.defaultTlp] ? raw.defaultTlp : d.defaultTlp,
  };
}

export function hydrateWorkspace(raw) {
  const ws = emptyWorkspace();
  if (!raw || typeof raw !== 'object') return ws;
  const seen = new Set();
  for (const item of Array.isArray(raw.incidents) ? raw.incidents : []) {
    const inc = sanitizeIncident(item);
    if (!inc || seen.has(inc.id)) continue;
    seen.add(inc.id);
    ws.incidents.push(inc);
  }
  ws.customPlaybooks = sanitizeCustomPlaybooks(raw.customPlaybooks);
  ws.settings = sanitizeSettings(raw.settings);
  ws.license = typeof raw.license === 'string' && raw.license.length <= MAX_LICENSE ? raw.license : null;
  ws.activeIncidentId = seen.has(raw.activeIncidentId) ? raw.activeIncidentId : (ws.incidents[0]?.id ?? null);
  return ws;
}

// v0.x stored a single incident with the General playbook's task list
// baked in. Wrap it as the first incident of a v2 workspace.
export function migrateV1(v1, now = Date.now()) {
  const general = BUILTIN_PLAYBOOKS.find((p) => p.id === GENERAL_PLAYBOOK_ID);
  const base = createIncident({ playbook: general, now, id: `inc-migrated-${now.toString(36)}` });
  const inc = sanitizeIncident({
    ...base,
    name: v1?.incidentName,
    severity: v1?.severity,
    activePhase: v1?.activePhase,
    startTime: v1?.startTime,
    endTime: v1?.endTime,
    checks: v1?.checks,
    notes: v1?.notes,
    iocIndex: v1?.iocIndex,
    events: v1?.events,
    createdAt: typeof v1?.startTime === 'number' ? v1.startTime : now,
  });
  const ws = emptyWorkspace();
  ws.incidents = [inc];
  ws.activeIncidentId = inc.id;
  return ws;
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadWorkspace() {
  if (typeof localStorage === 'undefined') return emptyWorkspace();
  const v2 = readJson(STORAGE_KEY);
  if (v2) return hydrateWorkspace(v2);
  // The legacy key is left in place so a downgrade never loses data.
  const v1 = readJson(LEGACY_STORAGE_KEY);
  if (v1) return migrateV1(v1);
  return emptyWorkspace();
}

// Returns false if the write failed (quota exceeded, storage disabled) so the
// UI can warn that work isn't being saved.
export function saveWorkspace(ws) {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
    return true;
  } catch {
    return false;
  }
}

export function serializeBackup(ws, now = Date.now()) {
  return JSON.stringify({ format: BACKUP_FORMAT, version: 2, exportedAt: new Date(now).toISOString(), workspace: ws }, null, 2);
}

export function parseBackup(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('File is not valid JSON.'); }
  if (raw?.format !== BACKUP_FORMAT || !raw.workspace) throw new Error('Not a Triage Desk backup file.');
  return hydrateWorkspace(raw.workspace);
}
