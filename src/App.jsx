import { useCallback, useEffect, useMemo, useState } from 'react';
import { PHASES, SEVERITIES } from './data.js';
import { GENERAL_PLAYBOOK_ID } from './playbooks/builtins.js';
import {
  STORAGE_KEY, hydrateWorkspace, loadWorkspace, saveWorkspace,
} from './state/workspace.js';
import * as I from './state/incident.js';
import { allPlaybooks, findPlaybook } from './state/playbooks.js';
import { buildReport, downloadFile, reportFilename, REPORT_FORMATS } from './lib/exportReport.js';
import { phaseActivity, phaseAdvisory, phaseLocked } from './lib/phaseActivity.js';
import { checkLicense, entitlementsFor } from './license/entitlements.js';
import { Sidebar } from './components/Sidebar.jsx';
import { TopBar } from './components/TopBar.jsx';
import { PhaseView } from './components/PhaseView.jsx';
import { TimelineDrawer } from './components/TimelineDrawer.jsx';
import { NewIncidentModal } from './components/NewIncidentModal.jsx';
import { PlaybooksModal } from './components/PlaybooksModal.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { Welcome } from './components/Welcome.jsx';

export default function App() {
  const [ws, setWs] = useState(loadWorkspace);
  const [saveOk, setSaveOk] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [modal, setModal] = useState(null); // { kind: 'new' | 'playbooks' | 'settings', tab? }
  const [toast, setToast] = useState(null);

  const licenseStatus = useMemo(() => checkLicense(ws.license), [ws.license]);
  const ent = entitlementsFor(licenseStatus);
  const playbooks = useMemo(() => allPlaybooks(ws.customPlaybooks), [ws.customPlaybooks]);
  const incident = ws.incidents.find((i) => i.id === ws.activeIncidentId) ?? null;
  const atLimit = ws.incidents.length >= ent.incidentLimit;

  useEffect(() => { setSaveOk(saveWorkspace(ws)); }, [ws]);

  // Cross-tab sync: the `storage` event only fires in tabs other than the
  // writer, so rehydrating here doesn't loop back through our own save.
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== STORAGE_KEY || e.newValue == null) return;
      try { setWs(hydrateWorkspace(JSON.parse(e.newValue))); } catch {}
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const running = incident ? I.isRunning(incident) : false;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const updateIncident = useCallback((fn) => {
    setWs((w) => {
      let changed = false;
      const incidents = w.incidents.map((i) => {
        if (i.id !== w.activeIncidentId) return i;
        const next = fn(i);
        if (next !== i) changed = true;
        return next;
      });
      return changed ? { ...w, incidents } : w;
    });
  }, []);

  // If a lifecycle change leaves us on a now-locked phase, slide to the first
  // in-phase phase rather than rendering a locked view.
  const lifecycle = incident ? I.lifecycleOf(incident) : 'idle';
  const activeStage = incident ? PHASES.find((p) => p.id === incident.activePhase)?.stage : null;
  useEffect(() => {
    if (!activeStage || !phaseLocked(activeStage, lifecycle)) return;
    const fallback = PHASES.find((p) => phaseActivity(p.stage, lifecycle) === 'in-phase');
    if (fallback) updateIncident((i) => ({ ...i, activePhase: fallback.id }));
  }, [activeStage, lifecycle, updateIncident]);

  const openUpgrade = () => setModal({ kind: 'settings', tab: 'license' });

  function requestNewIncident() {
    if (atLimit) {
      setToast('Free edition holds one incident at a time — upgrade to Pro for unlimited.');
      openUpgrade();
      return;
    }
    setModal({ kind: 'new' });
  }

  function createIncident({ playbook, name, severity }) {
    const inc = I.createIncident({ playbook, name, severity, tlp: ws.settings.defaultTlp });
    setWs((w) => ({ ...w, incidents: [...w.incidents, inc], activeIncidentId: inc.id }));
    setModal(null);
  }

  function quickStart() {
    createIncident({ playbook: findPlaybook(GENERAL_PLAYBOOK_ID, []), name: '', severity: 'Medium' });
  }

  function deleteIncident(id) {
    const inc = ws.incidents.find((i) => i.id === id);
    if (!inc) return;
    if (!confirm(`Delete "${inc.name || 'Untitled incident'}" permanently? Export a report or backup first if you need a record.`)) return;
    setWs((w) => {
      const incidents = w.incidents.filter((i) => i.id !== id);
      const activeIncidentId = w.activeIncidentId === id ? (incidents[incidents.length - 1]?.id ?? null) : w.activeIncidentId;
      return { ...w, incidents, activeIncidentId };
    });
  }

  function exportReport(format) {
    const f = REPORT_FORMATS[format];
    if (f.pro && !ent.richReports) { openUpgrade(); return; }
    const text = buildReport(format, incident, ws.settings);
    downloadFile(text, reportFilename(incident.name, f.ext), f.mime);
  }

  function savePlaybook(pb) {
    setWs((w) => {
      const exists = w.customPlaybooks.some((p) => p.id === pb.id);
      const customPlaybooks = exists
        ? w.customPlaybooks.map((p) => (p.id === pb.id ? pb : p))
        : [...w.customPlaybooks, pb];
      return { ...w, customPlaybooks };
    });
  }

  const modals = (
    <>
      {modal?.kind === 'new' && (
        <NewIncidentModal playbooks={playbooks} ent={ent} onCreate={createIncident} onClose={() => setModal(null)} onUpgrade={openUpgrade} />
      )}
      {modal?.kind === 'playbooks' && (
        <PlaybooksModal
          playbooks={playbooks}
          ent={ent}
          onSave={savePlaybook}
          onDelete={(id) => setWs((w) => ({ ...w, customPlaybooks: w.customPlaybooks.filter((p) => p.id !== id) }))}
          onClose={() => setModal(null)}
          onUpgrade={openUpgrade}
        />
      )}
      {modal?.kind === 'settings' && (
        <SettingsModal
          initialTab={modal.tab}
          workspace={ws}
          licenseStatus={licenseStatus}
          onSettings={(settings) => setWs((w) => ({ ...w, settings }))}
          onLicense={(license) => setWs((w) => ({ ...w, license }))}
          onRestore={(restored) => setWs(restored)}
          onClose={() => setModal(null)}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 shadow-lg">
          {toast}
        </div>
      )}
    </>
  );

  if (!incident) {
    return (
      <>
        <Welcome
          ent={ent}
          onQuickStart={quickStart}
          onNew={requestNewIncident}
          onOpenSettings={() => setModal({ kind: 'settings', tab: 'data' })}
        />
        {modals}
      </>
    );
  }

  const phases = I.incidentPhases(incident);
  const phase = phases.find((p) => p.id === incident.activePhase) ?? phases[0];
  const sev = SEVERITIES[incident.severity];
  const elapsed = incident.startTime ? (incident.endTime ?? now) - incident.startTime : 0;

  return (
    <div className="h-screen overflow-hidden flex bg-slate-950 text-slate-200">
      <Sidebar
        incident={incident}
        phases={phases}
        onSelect={(id) => updateIncident((i) => I.setActivePhase(i, id))}
        sev={sev}
        incidents={ws.incidents}
        onSwitch={(id) => setWs((w) => ({ ...w, activeIncidentId: id }))}
        onNew={requestNewIncident}
        onDelete={deleteIncident}
        atLimit={atLimit}
        ent={ent}
        license={licenseStatus.license}
        onOpenPlaybooks={() => setModal({ kind: 'playbooks' })}
        onOpenSettings={() => setModal({ kind: 'settings' })}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {!saveOk && (
          <div className="px-6 py-2 bg-rose-500/15 border-b border-rose-500/40 text-sm text-rose-200">
            Browser storage is full or disabled — changes are <strong>not being saved</strong>. Export a backup from Settings → Data now.
          </div>
        )}
        <TopBar
          severity={incident.severity}
          setSeverity={(s) => updateIncident((i) => I.setSeverity(i, s))}
          sev={sev}
          tlp={incident.tlp}
          setTlp={(t) => updateIncident((i) => I.setTlp(i, t))}
          ent={ent}
          incidentName={incident.name}
          setIncidentName={(n) => updateIncident((i) => I.renameIncident(i, n))}
          running={running}
          startTime={incident.startTime}
          endTime={incident.endTime}
          elapsed={elapsed}
          declareIncident={() => {
            const t = Date.now();
            setNow(t);
            updateIncident((i) => I.declareIncident(i, t));
            if (incident.activePhase !== 'identification') setToast('→ Identification');
          }}
          resolveIncident={() => {
            if (!confirm('Mark this incident resolved? The timer will stop and the incident will move into Lessons Learned.')) return;
            updateIncident((i) => I.resolveIncident(i));
          }}
          resetIncident={() => {
            if (!confirm('Reset this incident? This clears the timer, checklist, notes, IOC index, and timeline. The name and playbook are kept.')) return;
            updateIncident((i) => I.resetIncident(i));
          }}
          exportReport={exportReport}
          totals={I.incidentTotals(incident)}
          eventCount={incident.events.length}
          onToggleTimeline={() => setTimelineOpen((v) => !v)}
        />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto mb-3 text-xs text-slate-500">
            Playbook: <span className="text-slate-300">{incident.playbookName}</span>
          </div>
          <PhaseView
            key={`${incident.id}:${phase.id}`}
            phase={phase}
            checks={incident.checks[phase.id]}
            note={incident.notes[phase.id]}
            onToggle={(idx) => updateIncident((i) => I.toggleCheck(i, phase.id, idx))}
            onNoteChange={(v) => updateIncident((i) => I.setNote(i, phase.id, v))}
            onAppendNote={(text) => updateIncident((i) => I.appendNote(i, phase.id, text))}
            onQuickNote={(text) => updateIncident((i) => I.addQuickNote(i, phase.id, text))}
            onIocsExtracted={(results) => updateIncident((i) => I.recordIocs(i, phase.id, results))}
            sev={sev}
            phaseStatus={phaseActivity(phase.stage, lifecycle)}
            advisory={phaseAdvisory(phase.stage, lifecycle)}
            running={running}
          />
        </main>
      </div>

      <TimelineDrawer
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        events={incident.events}
        startTime={incident.startTime}
      />
      {modals}
    </div>
  );
}
