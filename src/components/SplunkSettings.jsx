import { useState } from 'react';
import { CheckCircle2, Plug, ShieldCheck, TriangleAlert } from 'lucide-react';
import { EDITION } from '../license/entitlements.js';
import { clearSplunkConfig, loadSplunkConfig, saveSplunkConfig, testConnection } from '../lib/splunkClient.js';
import { btn, Field, inputCls } from './Modal.jsx';
import { SplunkMark } from './SplunkSearches.jsx';

function OfflineInfo({ connectedBuild }) {
  return (
    <div className="space-y-4 text-[13px] text-ink-2 leading-relaxed">
      <div className="flex items-start gap-3 p-4 rounded-xl border border-line bg-raised">
        <SplunkMark size={20} />
        <div>
          <div className="font-semibold text-ink">Splunk tools in every edition</div>
          <ul className="mt-1.5 space-y-1 list-disc pl-4">
            <li>Ready-to-run SPL in every scenario playbook, with blanks for the values you know.</li>
            <li>Hunting searches built from the incident’s IOCs (Splunk tab in the side panel).</li>
            <li>Start an incident from a pasted Splunk alert, notable event, or CSV export.</li>
            <li>Export IOC lookup tables and the timeline as HTTP Event Collector events.</li>
          </ul>
        </div>
      </div>
      <div className="flex items-start gap-3 p-4 rounded-xl border border-signal/30 bg-signal-soft">
        <Plug size={18} className="text-signal shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-ink">Want to run searches without copy and paste?</div>
          <p className="mt-1">
            {connectedBuild
              ? 'This is the Connected build. Activate a Connected license to run searches, pull notable events, and send the timeline to your Splunk.'
              : 'Triage Desk Connected runs searches in your Splunk, pulls notable events into incidents, and sends the timeline back through HEC. This offline build blocks all network access by design, so live Splunk needs the Connected build and license.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SplunkSettings({ ent, onNotify }) {
  const [cfg, setCfg] = useState(loadSplunkConfig);
  const [state, setState] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  if (!ent?.connected) return <OfflineInfo connectedBuild={EDITION === 'connected'} />;

  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }));
  function save() {
    const ok = saveSplunkConfig(cfg);
    onNotify?.(ok ? 'Splunk settings saved in this browser' : 'Could not save: browser storage is full or disabled', ok ? 'ok' : 'warn');
  }
  async function test() {
    setBusy(true);
    setState(null);
    try {
      const info = await testConnection(cfg);
      saveSplunkConfig(cfg);
      setState({ ok: true, text: `Connected to ${info.serverName}${info.version ? ` (Splunk ${info.version})` : ''}.` });
    } catch (e) {
      setState({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Splunk REST API URL" hint="Management port, usually 8089">
          <input className={inputCls} value={cfg.apiUrl} onChange={set('apiUrl')} placeholder="https://splunk.example.com:8089" />
        </Field>
        <Field label="Authentication token" hint="Settings → Tokens in Splunk Web">
          <input className={inputCls} type="password" autoComplete="off" value={cfg.token} onChange={set('token')} placeholder="eyJraWQi…" />
        </Field>
        <Field label="HEC URL (optional)" hint="Usually port 8088. Needed to send the timeline">
          <input className={inputCls} value={cfg.hecUrl} onChange={set('hecUrl')} placeholder="https://splunk.example.com:8088" />
        </Field>
        <Field label="HEC token (optional)">
          <input className={inputCls} type="password" autoComplete="off" value={cfg.hecToken} onChange={set('hecToken')} placeholder="00000000-0000-…" />
        </Field>
        <Field label="Index for timeline events (optional)">
          <input className={inputCls} value={cfg.index} onChange={set('index')} placeholder="incident_response" />
        </Field>
        <Field label="Default time range">
          <select className={inputCls} value={cfg.earliest} onChange={set('earliest')}>
            {[['-4h', 'Last 4 hours'], ['-24h', 'Last 24 hours'], ['-7d', 'Last 7 days'], ['-30d', 'Last 30 days']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>
      {state && (
        <div role="status" className={`flex items-start gap-2 text-[13px] px-3 py-2.5 rounded-lg border ${state.ok ? 'border-ok/30 bg-ok/10 text-ok' : 'border-danger/30 bg-danger/10 text-danger'}`}>
          {state.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <TriangleAlert size={15} className="mt-0.5 shrink-0" />}
          <span>{state.text}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button className={btn.primary} onClick={test} disabled={busy || !cfg.apiUrl || !cfg.token}>{busy ? 'Testing…' : 'Test connection'}</button>
        <button className={btn.secondary} onClick={save}>Save</button>
        <button className={btn.ghost} onClick={() => { clearSplunkConfig(); setCfg(loadSplunkConfig()); setState(null); }}>Forget credentials</button>
      </div>
      <p className="text-xs text-ink-3 flex items-start gap-2 leading-relaxed">
        <ShieldCheck size={14} className="text-ok shrink-0 mt-0.5" />
        Tokens stay in this browser. They are never included in backups, reports, or exports, and the app only ever contacts the URLs above. Your Splunk must allow this page in crossOriginSharingPolicy (see the Splunk setup guide).
      </p>
    </div>
  );
}
