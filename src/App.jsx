import { useEffect, useMemo, useRef, useState } from 'react';
import { PHASES, SEVERITIES } from './data.js';
import {
  buildInitialChecks,
  buildInitialNotes,
  buildInitialIocIndex,
  reconcileChecks,
  reconcileByPhase,
  isValidSeverity,
  loadPersisted,
  savePersisted,
  clearPersisted,
} from './state/persistence.js';
import { nextEventId, primeEventId } from './state/eventId.js';
import { mergeIocs } from './state/iocIndex.js';
import { buildReport, downloadReport } from './lib/exportReport.js';
import { Sidebar } from './components/Sidebar.jsx';
import { TopBar } from './components/TopBar.jsx';
import { PhaseView } from './components/PhaseView.jsx';
import { TimelineDrawer } from './components/TimelineDrawer.jsx';

const PERSISTED = loadPersisted();
primeEventId(PERSISTED?.events);

export default function App() {
  const [activePhase, setActivePhase] = useState(() => {
    const id = PERSISTED?.activePhase;
    return PHASES.some((p) => p.id === id) ? id : PHASES[0].id;
  });
  const [severity, setSeverity] = useState(() =>
    isValidSeverity(PERSISTED?.severity) ? PERSISTED.severity : 'Medium',
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
    savePersisted({
      activePhase, severity, incidentName, startTime, endTime,
      checks, notes, events, iocIndex,
    });
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

  const elapsed = startTime ? (endTime ?? now) - startTime : 0;
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
    clearPersisted();
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
      />
    </div>
  );
}
