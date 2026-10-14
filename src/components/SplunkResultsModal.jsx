// Connected edition: run a search and show the results inline. Analysts can
// pull the results' indicators straight into the incident.

import { useEffect, useState } from 'react';
import { Loader2, Radar, TriangleAlert } from 'lucide-react';
import { loadSplunkConfig, runSearch } from '../lib/splunkClient.js';
import { Modal, btn } from './Modal.jsx';
import { SplCode, SplunkMark } from './SplunkSearches.jsx';

export function ResultsTable({ rows, fields, max = 200 }) {
  const cols = fields.slice(0, 12);
  return (
    <div className="overflow-auto max-h-[50vh] rounded-lg border border-line">
      <table className="min-w-full text-[12px]">
        <thead className="bg-raised sticky top-0">
          <tr>{cols.map((f) => <th key={f} className="text-left font-medium text-ink-2 px-3 py-2 whitespace-nowrap border-b border-line">{f}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, max).map((r, i) => (
            <tr key={i} className="odd:bg-surface even:bg-canvas/50">
              {cols.map((f) => (
                <td key={f} className="px-3 py-1.5 text-ink font-mono align-top max-w-[340px] truncate" title={String(r[f] ?? '')}>
                  {Array.isArray(r[f]) ? r[f].join(', ') : String(r[f] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SplunkResultsModal({ title, spl, onClose, onLogged, onExtract, onOpenSettings }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let live = true;
    const cfg = loadSplunkConfig();
    if (!cfg.apiUrl || !cfg.token) { setState({ error: 'Add your Splunk URL and token first.', setup: true }); return undefined; }
    runSearch(cfg, spl)
      .then((res) => { if (live) { setState({ res }); onLogged?.(`Ran Splunk search “${title}”: ${res.rows.length}${res.truncated ? '+' : ''} result${res.rows.length === 1 ? '' : 's'}`); } })
      .catch((e) => live && setState({ error: e.message }));
    return () => { live = false; };
  }, [spl]); // eslint-disable-line react-hooks/exhaustive-deps

  const { res } = state;
  return (
    <Modal
      title={title}
      subtitle="Results from your Splunk"
      icon={() => <SplunkMark size={17} />}
      onClose={onClose}
      wide
      footer={(
        <>
          {res?.rows.length > 0 && (
            <button className={`${btn.secondary} mr-auto`} onClick={() => onExtract(res.rows.map((r) => Object.values(r).join(' ')).join('\n'))}>
              <Radar size={14} /> Extract IOCs from results
            </button>
          )}
          <button className={btn.primary} onClick={onClose}>Done</button>
        </>
      )}
    >
      <div className="rounded-lg bg-raised border border-line px-3 py-2 mb-4"><SplCode spl={spl} /></div>
      {state.loading && <div className="py-10 flex items-center justify-center gap-2 text-ink-3 text-sm"><Loader2 size={16} className="animate-spin" /> Running search…</div>}
      {state.error && (
        <div className="flex items-start gap-2 text-[13px] px-3 py-2.5 rounded-lg border border-danger/30 bg-danger/10 text-danger">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          <span>{state.error} {state.setup && <button className="underline" onClick={onOpenSettings}>Open Splunk settings</button>}</span>
        </div>
      )}
      {res && (
        <>
          <div className="text-[12px] text-ink-3 mb-2 tabular">{res.rows.length}{res.truncated ? '+' : ''} result{res.rows.length === 1 ? '' : 's'}{res.rows.length > 200 ? ' · showing first 200' : ''}</div>
          {res.rows.length ? <ResultsTable rows={res.rows} fields={res.fields} /> : <div className="py-8 text-center text-sm text-ink-3">No results in this time range.</div>}
          {res.messages.length > 0 && <ul className="mt-3 text-[12px] text-ink-3 space-y-0.5">{res.messages.slice(0, 5).map((m, i) => <li key={i}>{m}</li>)}</ul>}
        </>
      )}
    </Modal>
  );
}
