// Start an incident from Splunk: paste or open an alert payload, notable
// event, or search export. Connected edition can also pull recent notables.

import { useMemo, useRef, useState } from 'react';
import { FileUp, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { parseSplunkAlert } from '../lib/splunk.js';
import { searchPlaybooks } from '../lib/playbookSearch.js';
import { loadSplunkConfig, notablesSearch, runSearch } from '../lib/splunkClient.js';
import { Modal, btn, inputCls, labelCls } from './Modal.jsx';
import { SplunkMark } from './SplunkSearches.jsx';
import { ResultsTable } from './SplunkResultsModal.jsx';

const SAMPLE = JSON.stringify({
  search_name: 'Threat - Suspicious PowerShell Download Cradle - Rule',
  results_link: 'https://splunk.example.com/app/search/@go?sid=scheduler_sample',
  result: {
    _time: '2026-10-14T09:12:44.000+00:00', urgency: 'high', dest: 'fin-ws-0412', user: 'EXAMPLE\\j.doe',
    process: 'powershell.exe -nop -w hidden', dest_ip: '203.0.113.77', url: 'hxxp://cdn-update[.]example/stage2', file_hash: 'd41d8cd98f00b204e9800998ecf8427e',
  },
}, null, 2);

export function ImportAlertModal({ playbooks, ent, onImport, onClose }) {
  const [text, setText] = useState('');
  const [notables, setNotables] = useState(null); // { loading } | { rows, fields } | { error }
  const file = useRef(null);

  const { alert, error } = useMemo(() => {
    if (!text.trim()) return { alert: null, error: null };
    try { return { alert: parseSplunkAlert(text), error: null }; } catch (e) { return { alert: null, error: e.message }; }
  }, [text]);
  const suggested = useMemo(() => (alert ? searchPlaybooks(playbooks, alert.name, { limit: 1 })[0] : null), [alert, playbooks]);

  async function pull() {
    setNotables({ loading: true });
    try {
      const res = await runSearch(loadSplunkConfig(), notablesSearch());
      setNotables(res);
    } catch (e) {
      setNotables({ error: e.message });
    }
  }

  return (
    <Modal
      title="Import from Splunk"
      subtitle="Start an incident from an alert. Indicators are extracted and the alert is saved to Identification notes."
      icon={() => <SplunkMark size={17} />}
      onClose={onClose}
      wide
      footer={(
        <>
          <button className={btn.secondary} onClick={onClose}>Cancel</button>
          <button className={btn.primary} disabled={!alert} onClick={() => onImport(alert, suggested)}>Create incident</button>
        </>
      )}
    >
      {ent.connected && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className={labelCls}>Recent notable events</span>
            <button className={btn.ghost} onClick={pull}><RefreshCw size={13} /> {notables ? 'Refresh' : 'Pull from Splunk'}</button>
          </div>
          {notables?.loading && <div className="py-4 text-sm text-ink-3 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Searching index=notable…</div>}
          {notables?.error && <div className="text-[13px] text-danger">{notables.error}</div>}
          {notables?.rows && (notables.rows.length
            ? (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {notables.rows.map((r, i) => (
                  <button key={i} onClick={() => setText(JSON.stringify({ result: r }, null, 2))} className="w-full text-left px-3 py-2 rounded-lg border border-line hover:bg-hover text-[12.5px] flex gap-3">
                    <span className="font-medium text-ink truncate">{r.rule_name || 'Notable'}</span>
                    <span className="text-ink-3 truncate">{[r.urgency, r.src, r.dest, r.user].filter(Boolean).join(' · ')}</span>
                    <span className="ml-auto font-mono text-ink-4 shrink-0">{String(r._time || '').slice(0, 16)}</span>
                  </button>
                ))}
              </div>
            )
            : <div className="text-[13px] text-ink-3">No notable events in the last 24 hours.</div>)}
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <span className={labelCls}>Alert JSON or CSV</span>
        <span className="flex gap-1">
          <button className={btn.ghost} onClick={() => setText(SAMPLE)}>Try sample</button>
          <button className={btn.ghost} onClick={() => file.current?.click()}><FileUp size={13} /> Open file…</button>
          <input ref={file} type="file" accept=".json,.csv,.txt,application/json,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); e.target.value = ''; }} />
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        aria-label="Splunk alert"
        placeholder={'Paste an alert webhook payload, an Enterprise Security notable, or a CSV/JSON search export.'}
        className={`${inputCls} font-mono text-[12px] leading-relaxed`}
      />
      {error && <div className="mt-2 text-[13px] text-danger flex items-center gap-1.5"><TriangleAlert size={14} /> {error}</div>}
      {alert && (
        <div className="mt-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-2 text-[13px]">
            <div className="p-3 rounded-lg bg-raised border border-line"><div className={labelCls}>Alert</div><div className="mt-1 text-ink font-medium">{alert.name}</div></div>
            <div className="p-3 rounded-lg bg-raised border border-line"><div className={labelCls}>Severity</div><div className="mt-1 text-ink font-medium">{alert.severity}</div></div>
            <div className="p-3 rounded-lg bg-raised border border-line"><div className={labelCls}>Suggested playbook</div><div className="mt-1 text-ink font-medium truncate">{suggested?.name || 'General Incident'}</div></div>
          </div>
          <ResultsTable rows={alert.rows} fields={alert.keys} max={20} />
        </div>
      )}
    </Modal>
  );
}
