// Quality gate for the scenario playbook library (src/playbooks/library/*.json).
// Used by tests/library.test.js and `npm run library:check`. It rejects
// structurally broken content and the most common kinds of filler.

export const LIBRARY_PHASES = ['preparation', 'identification', 'containment', 'eradication', 'recovery', 'lessons'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const ATTACK_RE = /^T\d{4}(\.\d{3})?$/;
const ID_RE = /^lib-[a-z0-9]+(-[a-z0-9]+)*$/;
const CAT_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SPL_START = /^(\||index\s*=|search\s|`|\(index)/;

// Generic tasks that belong in the General playbook, not a scenario.
const BANNED = [
  'review and update the incident response plan',
  'verify on-call rotation and escalation paths',
  'follow the incident response plan',
  'remove the threat',
  'contain the incident',
  'investigate the incident',
  'restore systems',
  'document lessons learned',
  'tbd',
  'todo',
  'lorem ipsum',
];

function err(list, where, msg) { list.push(`${where}: ${msg}`); }

function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

export function validateCategoryFile(file, data, errors = []) {
  if (!data || typeof data !== 'object') { err(errors, file, 'not an object'); return errors; }
  const c = data.category;
  if (!c || !CAT_RE.test(c.id || '')) err(errors, file, 'category.id must be kebab-case');
  if (!c?.name || c.name.length > 60) err(errors, file, 'category.name required, ≤60 chars');
  if (!c?.description || c.description.length > 240) err(errors, file, 'category.description required, ≤240 chars');
  if (!Array.isArray(data.playbooks) || data.playbooks.length === 0) { err(errors, file, 'playbooks must be a non-empty array'); return errors; }

  data.playbooks.forEach((p, i) => {
    const at = `${file}#${p?.id || i}`;
    if (!ID_RE.test(p?.id || '')) err(errors, at, 'id must be lib-<kebab-case>');
    if (!p.name || p.name.length > 80) err(errors, at, 'name required, ≤80 chars');
    if (!p.summary || p.summary.length < 40 || p.summary.length > 260) err(errors, at, 'summary must be 40–260 chars');
    if (!Array.isArray(p.tags) || p.tags.length < 2 || p.tags.length > 8 || p.tags.some((t) => typeof t !== 'string' || !/^[a-z0-9][a-z0-9-]{0,30}$/.test(t)))
      err(errors, at, 'tags: 2–8 lowercase kebab strings');
    if (!Array.isArray(p.attack) || p.attack.length > 10 || p.attack.some((t) => !ATTACK_RE.test(t)))
      err(errors, at, 'attack: array of ATT&CK ids like T1566 or T1566.001 (max 10)');
    if (!SEVERITIES.includes(p.severity)) err(errors, at, `severity must be one of ${SEVERITIES.join('/')}`);

    const tasks = p.tasks || {};
    const seen = new Set();
    for (const ph of LIBRARY_PHASES) {
      const list = tasks[ph];
      if (!Array.isArray(list) || list.length < 3 || list.length > 8) { err(errors, at, `tasks.${ph}: 3–8 tasks`); continue; }
      for (const t of list) {
        if (typeof t !== 'string' || t.length < 12 || t.length > 160) { err(errors, at, `tasks.${ph}: each task 12–160 chars (${JSON.stringify(t).slice(0, 50)})`); continue; }
        const n = norm(t);
        if (BANNED.includes(n)) err(errors, at, `tasks.${ph}: generic filler "${t}"`);
        if (seen.has(n)) err(errors, at, `duplicate task "${t}"`);
        seen.add(n);
      }
    }
    for (const k of Object.keys(tasks)) if (!LIBRARY_PHASES.includes(k)) err(errors, at, `unknown phase "${k}"`);

    if (!Array.isArray(p.splunk) || p.splunk.length < 2 || p.splunk.length > 4) err(errors, at, 'splunk: 2–4 searches');
    else p.splunk.forEach((s, j) => {
      const sa = `${at}.splunk[${j}]`;
      if (!s.title || s.title.length > 90) err(errors, sa, 'title required, ≤90 chars');
      if (!LIBRARY_PHASES.includes(s.phase)) err(errors, sa, 'phase must be a phase id');
      if (typeof s.spl !== 'string' || s.spl.length < 30 || s.spl.length > 1200) err(errors, sa, 'spl must be 30–1200 chars');
      else if (!SPL_START.test(s.spl.trim())) err(errors, sa, 'spl must start with "| tstats", "index=", "search ", or a `macro`');
    });
    const extra = Object.keys(p).filter((k) => !['id', 'name', 'summary', 'tags', 'attack', 'severity', 'tasks', 'splunk'].includes(k));
    if (extra.length) err(errors, at, `unknown fields: ${extra.join(', ')}`);
  });
  return errors;
}

// Cross-file checks: unique ids and names, and no near-copies.
export function validateLibrary(files) {
  const errors = [];
  const ids = new Map();
  const names = new Map();
  const cats = new Map();
  const taskSets = [];
  for (const [file, data] of files) {
    validateCategoryFile(file, data, errors);
    const cid = data?.category?.id;
    if (cid) { if (cats.has(cid)) err(errors, file, `category id "${cid}" also in ${cats.get(cid)}`); cats.set(cid, file); }
    for (const p of data?.playbooks || []) {
      if (ids.has(p.id)) err(errors, file, `id ${p.id} also in ${ids.get(p.id)}`);
      ids.set(p.id, file);
      const nn = norm(p.name || '');
      if (names.has(nn)) err(errors, file, `name "${p.name}" also in ${names.get(nn)}`);
      names.set(nn, file);
      const set = new Set(LIBRARY_PHASES.flatMap((ph) => (p.tasks?.[ph] || []).map(norm)));
      taskSets.push([p.id, set]);
    }
  }
  // A scenario playbook must be mostly its own content.
  for (let i = 0; i < taskSets.length; i++) {
    for (let j = i + 1; j < taskSets.length; j++) {
      const [a, sa] = taskSets[i];
      const [b, sb] = taskSets[j];
      let shared = 0;
      for (const t of sa) if (sb.has(t)) shared++;
      const ratio = shared / Math.min(sa.size, sb.size || 1);
      if (ratio > 0.4) err(errors, a, `shares ${Math.round(ratio * 100)}% of its tasks with ${b}; make it scenario-specific`);
    }
  }
  return { errors, count: ids.size, categories: cats.size };
}
