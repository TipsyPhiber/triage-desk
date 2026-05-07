import { useEffect, useMemo, useRef, useState } from 'react';
import { PHASES, SEVERITIES } from './data.js';
import {
  buildInitialChecks,
  buildInitialNotes,
  buildInitialIocIndex,
  hydrate,
  loadPersisted,
  savePersisted,
  clearPersisted,
  STORAGE_KEY,
} from './state/persistence.js';
import { nextEventId, primeEventId } from './state/eventId.js';
import { mergeIocs } from './state/iocIndex.js';
import { buildReport, downloadReport } from './lib/exportReport.js';
import { incidentLifecycle, phaseActivity, phaseAdvisory, phaseLocked } from './lib/phaseActivity.js';
import { Sidebar } from './components/Sidebar.jsx';
import { TopBar } from './components/TopBar.jsx';
import { PhaseView } from './components/PhaseView.jsx';
import { TimelineDrawer } from './components/TimelineDrawer.jsx';

const HYDRATED = hydrate(loadPersisted());
primeEventId(HYDRATED.events);

export default function App() {
  const [activePhase, setActivePhase] = useState(HYDRATED.activePhase);
  const [severity, setSeverity] = useState(HYDRATED.severity);
  const [incidentName, setIncidentName] = useState(HYDRATED.incidentName);
  const [startTime, setStartTime] = useState(HYDRATED.startTime);
  const [endTime, setEndTime] = useState(HYDRATED.endTime);
  const [now, setNow] = useState(Date.now());
  const [checks, setChecks] = useState(HYDRATED.checks);
  const [notes, setNotes] = useState(HYDRATED.notes);
  const [events, setEvents] = useState(HYDRATED.events);
  const [iocIndex, setIocIndex] = useState(HYDRATED.iocIndex);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    savePersisted({
      activePhase, severity, incidentName, startTime, endTime,
      checks, notes, events, iocIndex,
    });
  }, [activePhase, severity, incidentName, startTime, endTime, checks, notes, events, iocIndex]);

  // Cross-tab sync: when another tab writes the incident, rehydrate this one.
  // The `storage` event only fires in tabs other than the writer, so this
  // doesn't loop back through our own save effect.
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== STORAGE_KEY || e.newValue == null) return;
      let parsed;
      try { parsed = JSON.parse(e.newValue); } catch { return; }
      const h = hydrate(parsed);
      primeEventId(h.events);
      setActivePhase(h.activePhase);
      setSeverity(h.severity);
      setIncidentName(h.incidentName);
      setStartTime(h.startTime);
      setEndTime(h.endTime);
      setChecks(h.checks);
      setNotes(h.notes);
      setEvents(h.events);
      setIocIndex(h.iocIndex);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

  const elapsed = startTime ? (endTime ?? now) - startTime : 0;
  const sev = SEVERITIES[severity];
  const phase = PHASES.find((p) => p.id === activePhase);
  const lifecycle = incidentLifecycle(startTime, endTime);
  const phaseStatus = phaseActivity(phase.stage, lifecycle);
  const advisory = phaseAdvisory(phase.stage, lifecycle);

  // If a lifecycle change leaves us on a now-locked phase (e.g. persisted
  // state put us on Preparation but startTime is set), slide to the first
  // in-phase phase rather than rendering a locked view.
  useEffect(() => {
    if (!phaseLocked(phase.stage, lifecycle)) return;
    const fallback = PHASES.find((p) => phaseActivity(p.stage, lifecycle) === 'in-phase');
    if (fallback) setActivePhase(fallback.id);
  }, [phase.stage, lifecycle]);

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
    // Declaration is, by definition, entry into Identification (PICERL /
    // NIST SP 800-61). Jump there regardless of where the operator was.
    const entry = PHASES.find((p) => p.stage === 'response');
    if (entry) {
      setActivePhase(entry.id);
      if (entry.id !== activePhase) setToast(`→ ${entry.name}`);
    }
    setEvents([{
      id: nextEventId(),
      ts: t,
      type: 'declare',
      message: `Incident declared — severity ${severity}`,
    }]);
  }

  function resolveIncident() {
    if (!startTime || endTime) return;
    if (!confirm('Mark this incident resolved? The timer will stop and the incident will move into Lessons Learned.')) return;
    setEndTime(Date.now());
    logEvent('resolve', 'Incident marked resolved');
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
    clearPersisted();
  }

  function changeSeverity(s) {
    if (s === severity) return;
    if (runningRef.current) logEvent('severity', `Severity changed: ${severity} → ${s}`);
    setSeverity(s);
  }

  function changePhase(id) {
    if (id === activePhase) return;
    const target = PHASES.find((p) => p.id === id);
    if (!target) return;
    if (phaseLocked(target.stage, lifecycle)) return;
    if (runningRef.current) logEvent('phase', `Switched to phase: ${target.name}`);
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

  function addQuickNote(phaseId, text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    appendToNote(phaseId, `[${stamp}] ${trimmed}`);
    if (runningRef.current) logEvent('note', trimmed);
  }

  function recordIocs(phaseId, results) {
    setIocIndex((prev) => {
      const merged = mergeIocs(prev[phaseId] || [], results);
      if (merged === prev[phaseId]) return prev;
      return { ...prev, [phaseId]: merged };
    });
  }

  function exportReport() {
    const text = buildReport({
      incidentName, severity, startTime, endTime,
      totals, checks, notes, events, iocIndex,
    });
    downloadReport(text, incidentName);
  }

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-200">
      <Sidebar
        activePhase={activePhase}
        onSelect={changePhase}
        checks={checks}
        sev={sev}
        running={running}
        lifecycle={lifecycle}
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
            onQuickNote={(text) => addQuickNote(phase.id, text)}
            onIocsExtracted={(results) => {
              recordIocs(phase.id, results);
              if (runningRef.current) {
                logEvent('ioc', `Extracted ${results.length} IOC${results.length === 1 ? '' : 's'} into ${phase.name} notes`);
              }
            }}
            sev={sev}
            phaseStatus={phaseStatus}
            advisory={advisory}
            running={running}
          />
        </main>
      </div>

      <TimelineDrawer
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        events={events}
        startTime={startTime}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
