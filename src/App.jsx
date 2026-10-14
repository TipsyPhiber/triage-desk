import { useCallback, useEffect, useMemo, useState } from 'react';
import { askConfirm, ConfirmHost } from './components/ConfirmDialog.jsx';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
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
import { PhaseStepper } from './components/PhaseStepper.jsx';
import { PhaseView } from './components/PhaseView.jsx';
import { IntelPanel } from './components/IntelPanel.jsx';
import { NewIncidentModal } from './components/NewIncidentModal.jsx';
import { PlaybooksModal } from './components/PlaybooksModal.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { ShortcutsModal } from './components/ShortcutsModal.jsx';
import { Welcome } from './components/Welcome.jsx';
import { CommandPalette } from './components/CommandPalette.jsx';
import { ImportAlertModal } from './components/ImportAlertModal.jsx';
import { SplunkResultsModal } from './components/SplunkResultsModal.jsx';
import { cycleTheme } from './components/ThemeToggle.jsx';
import { canUsePlaybook } from './license/entitlements.js';
import { alertNote, hecEvents, hecPayload, iocLookupCsv } from './lib/splunk.js';
import { loadSplunkConfig, sendToHec } from './lib/splunkClient.js';
import { loadIocExtractor } from './iocLoader.js';
import { BookOpen, FileText, Moon, Plus, Settings as SettingsIcon, Upload } from 'lucide-react';

function isTyping(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export default function App() {
  const [ws, setWs] = useState(loadWorkspace);
  const [saveOk, setSaveOk] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [intelOpen, setIntelOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1536);
  const [intelTab, setIntelTab] = useState('timeline');
  const [modal, setModal] = useState(null); // { kind: 'new' | 'playbooks' | 'settings' | 'shortcuts' | 'import' | 'results', … }
  const [palette, setPalette] = useState(false);
  const [toast, setToast] = useState(null); // { text, tone }

  const licenseStatus = useMemo(() => checkLicense(ws.license), [ws.license]);
  const ent = entitlementsFor(licenseStatus);
  const playbooks = useMemo(() => allPlaybooks(ws.customPlaybooks), [ws.customPlaybooks]);
  const incident = ws.incidents.find((i) => i.id === ws.activeIncidentId) ?? null;
  const atLimit = ws.incidents.length >= ent.incidentLimit;
  const notify = useCallback((text, tone = 'info') => setToast({ text, tone, id: Date.now() }), []);

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
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  // Tick while any incident is running: the rail shows live durations too.
  const anyRunning = ws.incidents.some(I.isRunning);
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyRunning]);

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

  const openUpgrade = useCallback(() => setModal({ kind: 'settings', tab: 'license' }), []);

  const requestNewIncident = useCallback((opts = {}) => {
    if (atLimit) {
      notify('Free edition holds one incident at a time — upgrade to Pro for unlimited.', 'warn');
      openUpgrade();
      return;
    }
    setModal({ kind: 'new', ...opts });
  }, [atLimit, notify, openUpgrade]);

  const requestImport = useCallback(() => {
    if (atLimit) { requestNewIncident(); return; }
    setModal({ kind: 'import' });
  }, [atLimit, requestNewIncident]);

  // Ctrl/⌘+K opens the command palette from anywhere, even while typing.
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPalette((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Global keyboard shortcuts (ignored while typing or with a dialog open).
  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (modal || palette) return;
      if (e.key === '?') { e.preventDefault(); setModal({ kind: 'shortcuts' }); return; }
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); requestNewIncident(); return; }
      if (e.key === 'i' || e.key === 'I') { e.preventDefault(); requestImport(); return; }
      if (!incident) return;
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); setIntelOpen((v) => !v); return; }
      if (e.key === 'n' || e.key === 'N') {
        const el = document.getElementById('quick-note');
        if (el) { e.preventDefault(); el.focus(); }
        return;
      }
      if (e.key === 'Escape') { setIntelOpen((v) => (window.innerWidth < 1280 ? false : v)); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= PHASES.length) updateIncident((i) => I.setActivePhase(i, PHASES[n - 1].id));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, palette, incident, requestNewIncident, updateIncident]);

  function createIncident({ playbook, name, severity }) {
    const inc = I.createIncident({ playbook, name, severity, tlp: ws.settings.defaultTlp });
    setWs((w) => ({ ...w, incidents: [...w.incidents, inc], activeIncidentId: inc.id }));
    setModal(null);
  }

  // Start an incident from a Splunk alert: suggested playbook (if licensed),
  // alert summary in Identification notes, and its indicators extracted.
  async function importAlert(alert, suggested) {
    const playbook = suggested && canUsePlaybook(suggested, ent) ? suggested : findPlaybook(GENERAL_PLAYBOOK_ID, []);
    let inc = I.createIncident({ playbook, name: alert.name, severity: alert.severity, tlp: ws.settings.defaultTlp });
    inc = I.setActivePhase(I.appendNote(inc, 'identification', alertNote(alert)), 'identification');
    try {
      const mod = await loadIocExtractor();
      const found = mod.extract_iocs(alert.rawText);
      if (found?.length) inc = I.recordIocs(inc, 'identification', found);
    } catch { /* extraction is best effort */ }
    setWs((w) => ({ ...w, incidents: [...w.incidents, inc], activeIncidentId: inc.id }));
    setModal(null);
    notify(`Imported “${alert.name}”. Review it, then declare to start the clock.`, 'ok');
  }

  function exportSplunk(kind) {
    const base = reportFilename(incident.name, 'x').replace(/\.x$/, '');
    if (kind === 'lookup') downloadFile(iocLookupCsv(incident), `${base}-iocs.csv`, 'text/csv');
    else downloadFile(hecPayload(incident), `${base}-timeline-hec.json`, 'application/json');
    notify(kind === 'lookup' ? 'Exported IOC lookup table' : 'Exported timeline as HEC events', 'ok');
  }

  async function sendTimeline() {
    try {
      const n = await sendToHec(loadSplunkConfig(), hecEvents(incident));
      updateIncident((i) => I.logSplunk(i, `Sent ${n} timeline event${n === 1 ? '' : 's'} to Splunk HEC`));
      notify(`Sent ${n} events to Splunk`, 'ok');
    } catch (e) {
      notify(e.message, 'warn');
    }
  }

  const runSearch = ent.connected ? (spl, title) => setModal({ kind: 'results', spl, title }) : undefined;

  function quickStart() {
    createIncident({ playbook: findPlaybook(GENERAL_PLAYBOOK_ID, []), name: '', severity: 'Medium' });
  }

  async function deleteIncident(id) {
    const inc = ws.incidents.find((i) => i.id === id);
    if (!inc) return;
    if (!(await askConfirm({
      title: `Delete “${inc.name || 'Untitled incident'}”?`,
      body: 'This permanently removes the incident, its notes, and its timeline. Export a report or backup first if you need a record.',
      confirmLabel: 'Delete incident',
      danger: true,
    }))) return;
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
    notify(`Exported ${f.label.split(' (')[0].toLowerCase()} report`, 'ok');
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
        <NewIncidentModal playbooks={playbooks} ent={ent} onCreate={createIncident} onClose={() => setModal(null)} onUpgrade={openUpgrade} initialQuery={modal.query} initialPlaybookId={modal.playbookId} />
      )}
      {modal?.kind === 'import' && (
        <ImportAlertModal playbooks={playbooks} ent={ent} onImport={importAlert} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'results' && incident && (
        <SplunkResultsModal
          title={modal.title}
          spl={modal.spl}
          onClose={() => setModal(null)}
          onLogged={(m) => updateIncident((i) => I.logSplunk(i, m))}
          onOpenSettings={() => setModal({ kind: 'settings', tab: 'splunk' })}
          onExtract={async (text) => {
            try {
              const mod = await loadIocExtractor();
              const found = mod.extract_iocs(text);
              updateIncident((i) => I.recordIocs(i, i.activePhase, found));
              notify(`Added ${found.length} indicator${found.length === 1 ? '' : 's'} from Splunk results`, 'ok');
            } catch (e) { notify(String(e?.message ?? e), 'warn'); }
          }}
        />
      )}
      {palette && (
        <CommandPalette
          onClose={() => setPalette(false)}
          actions={[
            { id: 'new', label: 'New incident', keywords: 'create start', icon: Plus, hint: 'C', run: () => requestNewIncident() },
            { id: 'import', label: 'Import a Splunk alert', keywords: 'notable splunk paste', splunk: true, hint: 'I', run: requestImport },
            { id: 'playbooks', label: 'Browse and edit playbooks', keywords: 'library', icon: BookOpen, run: () => setModal({ kind: 'playbooks' }) },
            ...(incident ? [
              { id: 'export', label: 'Export report (Markdown)', keywords: 'download report', icon: FileText, run: () => exportReport('md') },
              { id: 'timeline', label: 'Toggle side panel', keywords: 'timeline iocs splunk', icon: BookOpen, hint: 'T', run: () => setIntelOpen((v) => !v) },
              { id: 'splunk-hunt', label: 'Hunt this incident’s IOCs in Splunk', keywords: 'search spl', splunk: true, run: () => { setIntelOpen(true); setIntelTab('splunk'); } },
              ...I.incidentPhases(incident).map((p, n) => ({ id: `ph:${p.id}`, label: `Go to ${p.name}`, keywords: 'phase', icon: BookOpen, hint: String(n + 1), run: () => updateIncident((i) => I.setActivePhase(i, p.id)) })),
            ] : []),
            { id: 'theme', label: 'Switch theme (light / dark / system)', keywords: 'dark mode appearance', icon: Moon, run: () => notify(`Theme: ${cycleTheme()}`, 'ok') },
            { id: 'splunk-settings', label: 'Splunk settings', keywords: 'connect token hec', splunk: true, run: () => setModal({ kind: 'settings', tab: 'splunk' }) },
            { id: 'settings', label: 'Settings & license', icon: SettingsIcon, run: () => setModal({ kind: 'settings' }) },
            { id: 'backup', label: 'Back up or restore workspace', keywords: 'export import data', icon: Upload, run: () => setModal({ kind: 'settings', tab: 'data' }) },
            { id: 'shortcuts', label: 'Keyboard shortcuts', icon: BookOpen, hint: '?', run: () => setModal({ kind: 'shortcuts' }) },
          ]}
          incidents={ws.incidents.map((inc) => ({ ...inc, run: () => setWs((w) => ({ ...w, activeIncidentId: inc.id })) }))}
          playbooks={playbooks.map((pb) => Object.assign(Object.create(pb), { run: () => requestNewIncident({ playbookId: pb.id, query: '' }) }))}
        />
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
          ent={ent}
          onNotify={notify}
          onSettings={(settings) => setWs((w) => ({ ...w, settings }))}
          onLicense={(license) => setWs((w) => ({ ...w, license }))}
          onRestore={(restored) => setWs(restored)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'shortcuts' && <ShortcutsModal onClose={() => setModal(null)} />}
      <ConfirmHost />
      {toast && (
        <div key={toast.id} role="status" className="anim-in fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-xl bg-raised border border-line-2 text-[13px] text-ink shadow-pop">
          {toast.tone === 'warn' ? <TriangleAlert size={15} className="text-signal" /> : <CheckCircle2 size={15} className="text-ok" />}
          {toast.text}
        </div>
      )}
    </>
  );

  if (!incident) {
    return (
      <>
        <Welcome
          ent={ent}
          playbooks={playbooks}
          onQuickStart={quickStart}
          onNew={() => requestNewIncident()}
          onSearch={(query) => requestNewIncident({ query })}
          onPick={(playbookId, query) => requestNewIncident({ playbookId, query })}
          onImport={requestImport}
          onOpenSettings={() => setModal({ kind: 'settings', tab: 'data' })}
        />
        {modals}
      </>
    );
  }

  const phases = I.incidentPhases(incident);
  const phaseIndex = Math.max(0, phases.findIndex((p) => p.id === incident.activePhase));
  const phase = phases[phaseIndex];
  const sev = SEVERITIES[incident.severity];
  const elapsed = incident.startTime ? (incident.endTime ?? now) - incident.startTime : 0;

  return (
    <div className="h-screen overflow-hidden flex bg-canvas text-ink">
      <Sidebar
        incidents={ws.incidents}
        activeId={incident.id}
        now={now}
        onSwitch={(id) => setWs((w) => ({ ...w, activeIncidentId: id }))}
        onNew={() => requestNewIncident()}
        onImport={requestImport}
        onPalette={() => setPalette(true)}
        onDelete={deleteIncident}
        atLimit={atLimit}
        ent={ent}
        license={licenseStatus.license}
        onOpenPlaybooks={() => setModal({ kind: 'playbooks' })}
        onOpenSettings={() => setModal({ kind: 'settings' })}
        onOpenShortcuts={() => setModal({ kind: 'shortcuts' })}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {!saveOk && (
          <div className="px-6 py-2 bg-danger/10 border-b border-danger/40 text-sm text-danger flex items-center gap-2">
            <TriangleAlert size={15} />
            Browser storage is full or disabled — changes are <strong>not being saved</strong>. Export a backup from Settings → Data now.
          </div>
        )}
        <TopBar
          incident={incident}
          sev={sev}
          lifecycle={lifecycle}
          elapsed={elapsed}
          ent={ent}
          totals={I.incidentTotals(incident)}
          onRename={(n) => updateIncident((i) => I.renameIncident(i, n))}
          onSeverity={(s) => updateIncident((i) => I.setSeverity(i, s))}
          onTlp={(t) => updateIncident((i) => I.setTlp(i, t))}
          onDeclare={() => {
            const t = Date.now();
            setNow(t);
            updateIncident((i) => I.declareIncident(i, t));
            notify('Incident declared — clock started, moved to Identification', 'warn');
          }}
          onResolve={async () => {
            if (!(await askConfirm({
              title: 'Mark this incident resolved?',
              body: 'The clock stops and the incident moves into Lessons Learned. Response phases stay editable for corrections.',
              confirmLabel: 'Mark resolved',
            }))) return;
            updateIncident((i) => I.resolveIncident(i));
            notify('Incident resolved — moved to Lessons Learned', 'ok');
          }}
          onReset={async () => {
            if (!(await askConfirm({
              title: 'Reset this incident?',
              body: 'This clears the clock, checklist, notes, IOC index, and timeline. The name and playbook are kept.',
              confirmLabel: 'Reset incident',
              danger: true,
            }))) return;
            updateIncident((i) => I.resetIncident(i));
          }}
          onDelete={() => deleteIncident(incident.id)}
          onExport={exportReport}
          intelOpen={intelOpen}
          onToggleIntel={() => setIntelOpen((v) => !v)}
          eventCount={incident.events.length}
        />
        <PhaseStepper
          phases={phases}
          incident={incident}
          lifecycle={lifecycle}
          sev={sev}
          onSelect={(id) => updateIncident((i) => I.setActivePhase(i, id))}
        />

        <main className="flex-1 min-h-0 overflow-y-auto">
          <PhaseView
            key={`${incident.id}:${phase.id}`}
            phase={phase}
            index={phaseIndex}
            count={phases.length}
            checks={incident.checks[phase.id]}
            checkedAt={incident.checkedAt?.[phase.id]}
            startTime={incident.startTime}
            note={incident.notes[phase.id]}
            onToggle={(idx) => updateIncident((i) => I.toggleCheck(i, phase.id, idx))}
            onNoteChange={(v) => updateIncident((i) => I.setNote(i, phase.id, v))}
            onAppendNote={(text) => updateIncident((i) => I.appendNote(i, phase.id, text))}
            onQuickNote={(text) => updateIncident((i) => I.addQuickNote(i, phase.id, text))}
            onIocsExtracted={(results) => updateIncident((i) => I.recordIocs(i, phase.id, results))}
            sev={sev}
            phaseStatus={phaseActivity(phase.stage, lifecycle)}
            advisory={phaseAdvisory(phase.stage, lifecycle)}
            running={lifecycle === 'active'}
            searches={(incident.searches || []).filter((x) => x.phase === phase.id)}
            onCopied={(t) => notify(t, 'ok')}
            onRunSearch={runSearch}
          />
        </main>
      </div>

      <IntelPanel
        open={intelOpen}
        onClose={() => setIntelOpen(false)}
        tab={intelTab}
        onTab={setIntelTab}
        incident={incident}
        onCopied={(t) => notify(t, 'ok')}
        splunk={{ connected: ent.connected, onRun: runSearch, onExport: exportSplunk, onSendHec: sendTimeline }}
      />
      {modals}
    </div>
  );
}
