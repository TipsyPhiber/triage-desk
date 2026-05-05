import { useEffect, useMemo, useRef, useState } from 'react';
import { PHASES, SEVERITIES } from './data.js';
import { loadIocExtractor } from './iocLoader.js';

let EVENT_SEQ = 0;
const nextEventId = () => ++EVENT_SEQ;

const STORAGE_KEY = 'triage-desk-state-v1';

function formatElapsed(ms) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function buildInitialChecks() {
  const out = {};
  for (const phase of PHASES) {
    out[phase.id] = phase.tasks.map(() => false);
  }
  return out;
}

function buildInitialNotes() {
  const out = {};
  for (const phase of PHASES) out[phase.id] = '';
  return out;
}

function buildInitialIocIndex() {
  const out = {};
  for (const phase of PHASES) out[phase.id] = [];
  return out;
}

// Reconcile persisted per-phase data against the current PHASES schema. If
// task lists have changed since the save, drop just the affected phase rather
// than the whole incident.
function reconcileChecks(persisted) {
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

function reconcileByPhase(persisted, fallback) {
  const fresh = fallback();
  if (!persisted || typeof persisted !== 'object') return fresh;
  for (const p of PHASES) {
    if (Object.prototype.hasOwnProperty.call(persisted, p.id)) {
      fresh[p.id] = persisted[p.id];
    }
  }
  return fresh;
}

function loadPersisted() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const PERSISTED = loadPersisted();
if (Array.isArray(PERSISTED?.events) && PERSISTED.events.length > 0) {
  EVENT_SEQ = PERSISTED.events.reduce((m, e) => Math.max(m, e?.id ?? 0), 0);
}

export default function App() {
  const [activePhase, setActivePhase] = useState(() => {
    const id = PERSISTED?.activePhase;
    return PHASES.some((p) => p.id === id) ? id : PHASES[0].id;
  });
  const [severity, setSeverity] = useState(() =>
    PERSISTED?.severity && SEVERITIES[PERSISTED.severity] ? PERSISTED.severity : 'Medium',
  );
  const [incidentName, setIncidentName] = useState(PERSISTED?.incidentName ?? '');
  const [startTime, setStartTime] = useState(PERSISTED?.startTime ?? null);
  const [endTime, setEndTime] = useState(PERSISTED?.endTime ?? null);
  const [now, setNow] = useState(Date.now());
  const [checks, setChecks] = useState(() => reconcileChecks(PERSISTED?.checks));
  const [notes, setNotes] = useState(() => reconcileByPhase(PERSISTED?.notes, buildInitialNotes));
  const [events, setEvents] = useState(() => (Array.isArray(PERSISTED?.events) ? PERSISTED.events : []));
  const [iocIndex, setIocIndex] = useState(() => reconcileByPhase(PERSISTED?.iocIndex, buildInitialIocIndex));
  const [timelineOpen, setTimelineOpen] = useState(false);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activePhase, severity, incidentName, startTime, endTime,
          checks, notes, events, iocIndex,
        }),
      );
    } catch {}
  }, [activePhase, severity, incidentName, startTime, endTime, checks, notes, events, iocIndex]);

  const running = startTime !== null && endTime === null;
  const runningRef = useRef(running);
  useEffect(() => { runningRef.current = running; }, [running]);

  function logEvent(type, message) {
    setEvents((prev) => [
      ...prev,
      { id: nextEventId(), ts: Date.now(), type, message },
    ]);
  }

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const elapsed = startTime
    ? (endTime ?? now) - startTime
    : 0;

  const sev = SEVERITIES[severity];
  const phase = PHASES.find((p) => p.id === activePhase);

  const totals = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const p of PHASES) {
      const arr = checks[p.id] || [];
      total += arr.length;
      done += arr.filter(Boolean).length;
    }
    return { done, total };
  }, [checks]);

  function declareIncident() {
    const t = Date.now();
    setStartTime(t);
    setEndTime(null);
    setNow(t);
    setEvents([{
      id: nextEventId(),
      ts: t,
      type: 'declare',
      message: `Incident declared — severity ${severity}`,
    }]);
  }

  function resolveIncident() {
    if (startTime && !endTime) {
      setEndTime(Date.now());
      logEvent('resolve', 'Incident marked resolved');
    }
  }

  function resetIncident() {
    if (!confirm('Reset the entire incident? This clears the timer, checklist, notes, IOC index, timeline, and saved state.')) return;
    setStartTime(null);
    setEndTime(null);
    setChecks(buildInitialChecks());
    setNotes(buildInitialNotes());
    setEvents([]);
    setIocIndex(buildInitialIocIndex());
    setIncidentName('');
    setActivePhase(PHASES[0].id);
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }

  function changeSeverity(s) {
    if (s === severity) return;
    if (runningRef.current) logEvent('severity', `Severity changed: ${severity} → ${s}`);
    setSeverity(s);
  }

  function changePhase(id) {
    if (id === activePhase) return;
    if (runningRef.current) {
      const target = PHASES.find((p) => p.id === id);
      if (target) logEvent('phase', `Switched to phase: ${target.name}`);
    }
    setActivePhase(id);
  }

  function toggleCheck(phaseId, idx) {
    setChecks((prev) => {
      const next = { ...prev, [phaseId]: [...prev[phaseId]] };
      const newVal = !next[phaseId][idx];
      next[phaseId][idx] = newVal;
      if (runningRef.current) {
        const p = PHASES.find((x) => x.id === phaseId);
        const taskText = p?.tasks[idx] ?? '';
        logEvent(
          newVal ? 'check' : 'uncheck',
          `${newVal ? 'Checked' : 'Unchecked'} [${p?.short ?? ''}]: ${taskText}`,
        );
      }
      return next;
    });
  }

  function setNote(phaseId, value) {
    setNotes((prev) => ({ ...prev, [phaseId]: value }));
  }

  function appendToNote(phaseId, text) {
    setNotes((prev) => {
      const existing = prev[phaseId] || '';
      const sep = existing && !existing.endsWith('\n') ? '\n' : '';
      return { ...prev, [phaseId]: existing + sep + text };
    });
  }

  function recordIocs(phaseId, results) {
    if (!results || results.length === 0) return;
    setIocIndex((prev) => {
      const existing = prev[phaseId] || [];
      const seen = new Set(existing.map((i) => `${i.kind}\0${i.value}`));
      const additions = [];
      for (const r of results) {
        const key = `${r.kind}\0${r.value}`;
        if (!seen.has(key)) {
          seen.add(key);
          additions.push({ kind: r.kind, value: r.value });
        }
      }
      if (additions.length === 0) return prev;
      return { ...prev, [phaseId]: [...existing, ...additions] };
    });
  }

  function exportReport() {
    const lines = [];
    const title = incidentName.trim() || 'Untitled Incident';
    const startedStr = startTime ? new Date(startTime).toISOString() : 'N/A (not declared)';
    const endedStr = endTime ? new Date(endTime).toISOString() : (startTime ? 'Ongoing' : 'N/A');
    const duration = startTime ? formatElapsed((endTime ?? Date.now()) - startTime) : '00:00:00';

    lines.push('========================================');
    lines.push('  TRIAGE DESK — INCIDENT SUMMARY');
    lines.push('========================================');
    lines.push('');
    lines.push(`Incident:   ${title}`);
    lines.push(`Severity:   ${severity}`);
    lines.push(`Declared:   ${startedStr}`);
    lines.push(`Resolved:   ${endedStr}`);
    lines.push(`Duration:   ${duration}`);
    lines.push(`Generated:  ${new Date().toISOString()}`);
    lines.push(`Progress:   ${totals.done} / ${totals.total} tasks complete`);
    lines.push('');

    for (const p of PHASES) {
      lines.push('----------------------------------------');
      lines.push(`PHASE: ${p.name.toUpperCase()}`);
      lines.push('----------------------------------------');
      const arr = checks[p.id] || [];
      p.tasks.forEach((t, i) => {
        const mark = arr[i] ? '[x]' : '[ ]';
        lines.push(`  ${mark} ${t}`);
      });
      const note = (notes[p.id] || '').trim();
      if (note) {
        lines.push('');
        lines.push('  Notes:');
        for (const line of note.split('\n')) {
          lines.push(`    ${line}`);
        }
      }
      lines.push('');
    }

    // Build a deduped IOC index across all phases. Each (kind, value) lists
    // the phases it was seen in, so the report shows where IOCs surfaced.
    const iocByKey = new Map();
    for (const p of PHASES) {
      for (const ioc of iocIndex[p.id] || []) {
        const key = `${ioc.kind}\0${ioc.value}`;
        if (!iocByKey.has(key)) {
          iocByKey.set(key, { kind: ioc.kind, value: ioc.value, phases: new Set() });
        }
        iocByKey.get(key).phases.add(p.short);
      }
    }
    if (iocByKey.size > 0) {
      lines.push('----------------------------------------');
      lines.push(`IOC INDEX (${iocByKey.size} unique)`);
      lines.push('----------------------------------------');
      const grouped = {};
      for (const entry of iocByKey.values()) {
        (grouped[entry.kind] ||= []).push(entry);
      }
      for (const kind of Object.keys(grouped).sort()) {
        lines.push(`  ${kind}:`);
        for (const e of grouped[kind].sort((a, b) => a.value.localeCompare(b.value))) {
          const phaseList = [...e.phases].join(', ');
          lines.push(`    - ${e.value}  (${phaseList})`);
        }
      }
      lines.push('');
    }

    if (events.length > 0) {
      lines.push('----------------------------------------');
      lines.push('TIMELINE');
      lines.push('----------------------------------------');
      for (const ev of events) {
        const abs = new Date(ev.ts).toISOString();
        const rel = startTime ? formatElapsed(ev.ts - startTime) : '--:--:--';
        lines.push(`  ${abs}  T+${rel}  ${ev.message}`);
      }
      lines.push('');
    }

    lines.push('========================================');
    lines.push('  END OF REPORT');
    lines.push('========================================');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = title.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'incident';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `${safeName}-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-200">
      <Sidebar
        activePhase={activePhase}
        onSelect={changePhase}
        checks={checks}
        sev={sev}
        running={running}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          severity={severity}
          setSeverity={changeSeverity}
          sev={sev}
          incidentName={incidentName}
          setIncidentName={setIncidentName}
          running={running}
          startTime={startTime}
          endTime={endTime}
          elapsed={elapsed}
          declareIncident={declareIncident}
          resolveIncident={resolveIncident}
          resetIncident={resetIncident}
          exportReport={exportReport}
          totals={totals}
          eventCount={events.length}
          onToggleTimeline={() => setTimelineOpen((v) => !v)}
        />

        <main className="flex-1 overflow-y-auto p-8">
          <PhaseView
            phase={phase}
            checks={checks[phase.id]}
            note={notes[phase.id]}
            onToggle={(i) => toggleCheck(phase.id, i)}
            onNoteChange={(v) => setNote(phase.id, v)}
            onAppendNote={(text) => appendToNote(phase.id, text)}
            onIocsExtracted={(results) => {
              recordIocs(phase.id, results);
              if (runningRef.current) {
                logEvent('ioc', `Extracted ${results.length} IOC${results.length === 1 ? '' : 's'} into ${phase.name} notes`);
              }
            }}
            sev={sev}
          />
        </main>
      </div>

      <TimelineDrawer
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        events={events}
        startTime={startTime}
        sev={sev}
      />
    </div>
  );
}

function Sidebar({ activePhase, onSelect, checks, sev, running }) {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${running ? sev.accent + ' animate-pulse' : 'bg-slate-600'}`} />
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">Triage Desk</h1>
        </div>
        <p className="mt-1 text-xs text-slate-500 uppercase tracking-wider">IR Playbook</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {PHASES.map((p, idx) => {
          const arr = checks[p.id] || [];
          const done = arr.filter(Boolean).length;
          const total = arr.length;
          const complete = done === total && total > 0;
          const isActive = p.id === activePhase;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition border ${
                isActive
                  ? `${sev.accentSoft} ${sev.accentBorder} text-slate-100`
                  : 'border-transparent hover:bg-slate-800/60 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`text-xs font-mono w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                    isActive ? sev.accent + ' text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="font-medium text-sm truncate">{p.name}</span>
                </div>
                {complete && (
                  <span className={`text-xs ${sev.accentText}`}>✓</span>
                )}
              </div>
              <div className="mt-1.5 ml-7 text-[11px] text-slate-500">
                {done}/{total} tasks
              </div>
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-800 text-[11px] text-slate-500">
        <div>NIST SP 800-61 aligned</div>
        <div className="mt-0.5">v0.2 · saved to browser</div>
      </div>
    </aside>
  );
}

function TopBar({
  severity, setSeverity, sev,
  incidentName, setIncidentName,
  running, startTime, endTime, elapsed,
  declareIncident, resolveIncident, resetIncident, exportReport,
  totals, eventCount, onToggleTimeline,
}) {
  const status =
    !startTime ? 'STANDBY'
    : running ? 'ACTIVE'
    : 'RESOLVED';

  const statusClass =
    !startTime ? 'bg-slate-700 text-slate-300'
    : running ? `${sev.accent} text-slate-950`
    : 'bg-emerald-500 text-slate-950';

  return (
    <header className={`border-b border-slate-800 bg-slate-900/40 backdrop-blur`}>
      <div className="px-6 py-4 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest ${statusClass}`}>
            {status}
          </span>
          <input
            value={incidentName}
            onChange={(e) => setIncidentName(e.target.value)}
            placeholder="Incident name (e.g. INC-2026-04-Phishing)"
            className="bg-transparent border-b border-slate-700 focus:border-slate-500 outline-none text-slate-100 placeholder-slate-600 text-sm w-72 py-1"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">Severity</span>
          <div className="flex bg-slate-800/60 rounded-lg p-0.5 border border-slate-700">
            {Object.keys(SEVERITIES).map((s) => {
              const isActive = s === severity;
              const sv = SEVERITIES[s];
              return (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    isActive ? `${sv.accent} text-slate-950` : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${sev.accentBorder} ${sev.accentSoft}`}>
          <div className={`w-2 h-2 rounded-full ${running ? sev.accent + ' animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Elapsed</span>
          <span className="font-mono text-lg text-slate-100 tabular-nums">
            {formatElapsed(elapsed)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!startTime && (
            <button
              onClick={declareIncident}
              className={`${sev.accent} text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition`}
            >
              Declare Incident
            </button>
          )}
          {running && (
            <button
              onClick={resolveIncident}
              className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition"
            >
              Mark Resolved
            </button>
          )}
          {startTime && (
            <button
              onClick={resetIncident}
              className="border border-slate-700 text-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-800 transition"
            >
              Reset
            </button>
          )}
          <button
            onClick={onToggleTimeline}
            className="border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition flex items-center gap-2"
          >
            Timeline
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${eventCount > 0 ? sev.accent + ' text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
              {eventCount}
            </span>
          </button>
          <button
            onClick={exportReport}
            className="border border-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
          >
            Export Report
          </button>
        </div>
      </div>

      <div className="px-6 pb-3 flex items-center gap-4 text-[11px] text-slate-500">
        <span>Tasks complete: <span className="text-slate-300 font-medium">{totals.done}/{totals.total}</span></span>
        {startTime && (
          <span>
            Declared: <span className="text-slate-300 font-medium">{new Date(startTime).toLocaleString()}</span>
          </span>
        )}
        {endTime && (
          <span>
            Resolved: <span className="text-slate-300 font-medium">{new Date(endTime).toLocaleString()}</span>
          </span>
        )}
      </div>
    </header>
  );
}

function PhaseView({ phase, checks, note, onToggle, onNoteChange, onAppendNote, onIocsExtracted, sev }) {
  const done = (checks || []).filter(Boolean).length;
  const total = phase.tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-2">
          <h2 className="text-2xl font-semibold text-slate-100">{phase.name}</h2>
          <span className={`text-sm ${sev.accentText}`}>{done} / {total} complete</span>
        </div>
        <p className="text-sm text-slate-400">{phase.description}</p>

        <div className="mt-4 h-1.5 w-full bg-slate-800 rounded overflow-hidden">
          <div
            className={`h-full ${sev.accent} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <section className="mb-8">
        <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">Checklist</h3>
        <ul className="space-y-1.5">
          {phase.tasks.map((task, i) => {
            const isChecked = !!checks?.[i];
            return (
              <li key={i}>
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    isChecked
                      ? `${sev.accentSoft} ${sev.accentBorder}`
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggle(i)}
                    className={`mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 ${sev.accentText} focus:ring-0 focus:ring-offset-0 accent-current`}
                  />
                  <span className={`text-sm leading-relaxed ${isChecked ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                    {task}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <IocExtractor sev={sev} onAppend={onAppendNote} onExtracted={onIocsExtracted} />

      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">Notes</h3>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={`Capture observations, IOCs, decisions, or timestamps for the ${phase.name.toLowerCase()} phase...`}
          rows={8}
          className="w-full bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-slate-600 resize-y font-mono"
        />
      </section>
    </div>
  );
}

const EVENT_STYLES = {
  declare:  { dot: 'bg-rose-500',    label: 'DECLARE'  },
  resolve:  { dot: 'bg-emerald-500', label: 'RESOLVE'  },
  severity: { dot: 'bg-amber-500',   label: 'SEVERITY' },
  phase:    { dot: 'bg-sky-500',     label: 'PHASE'    },
  check:    { dot: 'bg-emerald-400', label: 'CHECK'    },
  uncheck:  { dot: 'bg-slate-500',   label: 'UNCHECK'  },
  ioc:      { dot: 'bg-fuchsia-500', label: 'IOC'      },
};

function TimelineDrawer({ open, onClose, events, startTime, sev }) {
  const reversed = useMemo(() => [...events].reverse(), [events]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 right-0 h-full w-96 bg-slate-900 border-l border-slate-800 z-50 transform transition-transform duration-200 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Incident Timeline</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {events.length} event{events.length === 1 ? '' : 's'} · auto-recorded while incident is active
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-lg leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800"
            aria-label="Close timeline"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {events.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-12 px-4">
              No events yet. Once you declare an incident, every checklist toggle, phase switch, and severity change is recorded here with a timestamp.
            </div>
          ) : (
            <ol className="space-y-3">
              {reversed.map((ev) => {
                const style = EVENT_STYLES[ev.type] ?? { dot: 'bg-slate-500', label: ev.type.toUpperCase() };
                const rel = startTime ? formatElapsed(ev.ts - startTime) : '--:--:--';
                const abs = new Date(ev.ts).toLocaleTimeString();
                return (
                  <li key={ev.id} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                      <div className="flex-1 w-px bg-slate-800 mt-1" />
                    </div>
                    <div className="flex-1 pb-2 min-w-0">
                      <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-wider">
                        <span className="text-slate-500">{style.label}</span>
                        <span className="font-mono text-slate-400">T+{rel}</span>
                        <span className="text-slate-600 ml-auto">{abs}</span>
                      </div>
                      <div className="text-sm text-slate-200 mt-0.5 break-words">
                        {ev.message}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </>
  );
}

const IOC_KIND_STYLES = {
  IPv4:   'border-sky-500/40 bg-sky-500/10 text-sky-300',
  Domain: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  URL:    'border-violet-500/40 bg-violet-500/10 text-violet-300',
  Email:  'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  MD5:    'border-amber-500/40 bg-amber-500/10 text-amber-300',
  SHA1:   'border-amber-500/40 bg-amber-500/10 text-amber-300',
  SHA256: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  CVE:    'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

function IocExtractor({ sev, onAppend, onExtracted }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function runExtract() {
    setBusy(true);
    setError(null);
    try {
      const mod = await loadIocExtractor();
      const found = mod.extract_iocs(input);
      setResults(found);
    } catch (err) {
      setError(String(err?.message ?? err));
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  function appendAll() {
    if (!results || results.length === 0) return;
    const grouped = results.reduce((acc, r) => {
      (acc[r.kind] ||= []).push(r.value);
      return acc;
    }, {});
    const lines = [`--- IOCs extracted ${new Date().toISOString()} ---`];
    for (const kind of Object.keys(grouped).sort()) {
      lines.push(`${kind}:`);
      for (const v of grouped[kind]) lines.push(`  - ${v}`);
    }
    onAppend(lines.join('\n'));
    onExtracted?.(results);
    setResults(null);
    setInput('');
    setOpen(false);
  }

  const grouped = useMemo(() => {
    if (!results) return null;
    return results.reduce((acc, r) => {
      (acc[r.kind] ||= []).push(r.value);
      return acc;
    }, {});
  }, [results]);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] uppercase tracking-wider text-slate-500">
          IOC Extractor
          <span className="ml-2 normal-case tracking-normal text-slate-600">· Rust + WASM</span>
        </h3>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-slate-400 hover:text-slate-200 transition"
        >
          {open ? 'Hide' : 'Open'}
        </button>
      </div>

      {open && (
        <div className="border border-slate-800 rounded-lg bg-slate-900/40 p-4 space-y-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'Paste a log line, alert payload, or phishing email — defanged forms (hxxp, [.], [at]) are normalized.'}
            rows={5}
            className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-slate-600 resize-y font-mono"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={runExtract}
              disabled={!input.trim() || busy}
              className={`${sev.accent} text-slate-950 px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition`}
            >
              {busy ? 'Extracting…' : 'Extract IOCs'}
            </button>
            <button
              onClick={() => { setInput(''); setResults(null); setError(null); }}
              className="border border-slate-700 text-slate-300 px-3 py-1.5 rounded-md text-xs hover:bg-slate-800 transition"
            >
              Clear
            </button>
            {results && (
              <span className="text-[11px] text-slate-500 ml-1">
                {results.length} unique IOC{results.length === 1 ? '' : 's'} found
              </span>
            )}
          </div>

          {error && (
            <div className="text-xs text-rose-400 border border-rose-500/30 bg-rose-500/10 rounded px-3 py-2">
              {error}
            </div>
          )}

          {grouped && results.length === 0 && !error && (
            <div className="text-xs text-slate-500 italic">No IOCs detected in input.</div>
          )}

          {grouped && results.length > 0 && (
            <div className="space-y-2">
              {Object.keys(grouped).sort().map((kind) => (
                <div key={kind}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{kind}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {grouped[kind].map((v) => (
                      <span
                        key={v}
                        className={`text-[11px] font-mono px-2 py-0.5 rounded border ${IOC_KIND_STYLES[kind] ?? 'border-slate-700 bg-slate-800 text-slate-300'}`}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <button
                  onClick={appendAll}
                  className="bg-slate-100 text-slate-900 px-3 py-1.5 rounded-md text-xs font-semibold hover:brightness-95 transition"
                >
                  Append to Notes
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

