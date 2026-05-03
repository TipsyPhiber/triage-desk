import { useEffect, useMemo, useRef, useState } from 'react';
import { PHASES, SEVERITIES } from './data.js';

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

export default function App() {
  const [activePhase, setActivePhase] = useState(PHASES[0].id);
  const [severity, setSeverity] = useState('Medium');
  const [incidentName, setIncidentName] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [checks, setChecks] = useState(buildInitialChecks);
  const [notes, setNotes] = useState(buildInitialNotes);

  const running = startTime !== null && endTime === null;

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
    setStartTime(Date.now());
    setEndTime(null);
    setNow(Date.now());
  }

  function resolveIncident() {
    if (startTime && !endTime) setEndTime(Date.now());
  }

  function resetIncident() {
    if (!confirm('Reset the entire incident? This clears the timer, checklist, and notes.')) return;
    setStartTime(null);
    setEndTime(null);
    setChecks(buildInitialChecks());
    setNotes(buildInitialNotes());
    setIncidentName('');
    setActivePhase(PHASES[0].id);
  }

  function toggleCheck(phaseId, idx) {
    setChecks((prev) => {
      const next = { ...prev, [phaseId]: [...prev[phaseId]] };
      next[phaseId][idx] = !next[phaseId][idx];
      return next;
    });
  }

  function setNote(phaseId, value) {
    setNotes((prev) => ({ ...prev, [phaseId]: value }));
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
        onSelect={setActivePhase}
        checks={checks}
        sev={sev}
        running={running}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          severity={severity}
          setSeverity={setSeverity}
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
        />

        <main className="flex-1 overflow-y-auto p-8">
          <PhaseView
            phase={phase}
            checks={checks[phase.id]}
            note={notes[phase.id]}
            onToggle={(i) => toggleCheck(phase.id, i)}
            onNoteChange={(v) => setNote(phase.id, v)}
            sev={sev}
          />
        </main>
      </div>
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
        <div className="mt-0.5">v0.1 · in-memory only</div>
      </div>
    </aside>
  );
}

function TopBar({
  severity, setSeverity, sev,
  incidentName, setIncidentName,
  running, startTime, endTime, elapsed,
  declareIncident, resolveIncident, resetIncident, exportReport,
  totals,
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

function PhaseView({ phase, checks, note, onToggle, onNoteChange, sev }) {
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
