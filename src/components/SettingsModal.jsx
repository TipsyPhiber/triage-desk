import { useRef, useState } from 'react';
import { TLP_LEVELS } from '../data.js';
import { PURCHASE_URL, SUPPORT_EMAIL } from '../config.js';
import { BUILD_DATE, checkLicense } from '../license/entitlements.js';
import { parseBackup, serializeBackup } from '../state/workspace.js';
import { downloadFile, reportFilename } from '../lib/exportReport.js';
import { Modal, ProBadge, btn, inputCls } from './Modal.jsx';

const TABS = [
  { id: 'reports', label: 'Reports' },
  { id: 'license', label: 'License' },
  { id: 'data', label: 'Data' },
];

export function SettingsModal({ initialTab = 'reports', workspace, licenseStatus, onSettings, onLicense, onRestore, onClose }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="flex gap-1 mb-5 bg-slate-800/60 rounded-lg p-0.5 border border-slate-700 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${tab === t.id ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'reports' && <ReportSettings settings={workspace.settings} onChange={onSettings} />}
      {tab === 'license' && <LicensePanel token={workspace.license} status={licenseStatus} onLicense={onLicense} />}
      {tab === 'data' && <DataPanel workspace={workspace} onRestore={onRestore} />}
    </Modal>
  );
}

function ReportSettings({ settings, onChange }) {
  const set = (k) => (e) => onChange({ ...settings, [k]: e.target.value });
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Organization name</span>
        <input value={settings.orgName} onChange={set('orgName')} placeholder="Acme Corp Security Operations" className={`${inputCls} mt-1`} />
      </label>
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Prepared by</span>
        <input value={settings.preparedBy} onChange={set('preparedBy')} placeholder="Name or team shown on reports" className={`${inputCls} mt-1`} />
      </label>
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Default TLP marking for new incidents</span>
        <select value={settings.defaultTlp} onChange={set('defaultTlp')} className={`${inputCls} mt-1`}>
          {Object.keys(TLP_LEVELS).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-slate-500 mt-1 block">{TLP_LEVELS[settings.defaultTlp]}</span>
      </label>
    </div>
  );
}

function LicensePanel({ token, status, onLicense }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const lic = status.license;

  function activate() {
    const res = checkLicense(input);
    if (res.status === 'valid' || res.status === 'not-covered') {
      onLicense(input.trim());
      setInput('');
      setError(res.status === 'valid' ? null : res.reason);
    } else {
      setError(res.reason ?? 'License key not recognized.');
    }
  }

  return (
    <div className="space-y-4">
      {status.status === 'valid' ? (
        <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 p-4">
          <div className="flex items-center gap-2 mb-2"><ProBadge /><span className="text-sm font-semibold text-slate-100">Triage Desk Pro is active</span></div>
          <dl className="text-xs text-slate-300 grid grid-cols-[110px_1fr] gap-y-1">
            <dt className="text-slate-500">Licensed to</dt><dd>{lic.name}</dd>
            <dt className="text-slate-500">Email</dt><dd>{lic.email}</dd>
            <dt className="text-slate-500">Seats</dt><dd>{lic.seats}</dd>
            <dt className="text-slate-500">License ID</dt><dd className="font-mono">{lic.lid}</dd>
            <dt className="text-slate-500">Updates until</dt><dd>{lic.updatesUntil ?? 'Lifetime'}</dd>
            {lic.expires && (<><dt className="text-slate-500">Expires</dt><dd>{lic.expires}</dd></>)}
          </dl>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
          <div className="font-semibold text-slate-100 mb-1">You're on Triage Desk Free</div>
          <ul className="text-xs text-slate-400 list-disc pl-4 space-y-0.5 mb-3">
            <li>Pro adds unlimited incidents, kept side by side</li>
            <li>Ransomware, phishing, BEC, and cloud credential playbooks</li>
            <li>Custom playbooks with JSON import/export</li>
            <li>Branded Markdown and print-ready HTML/PDF reports</li>
          </ul>
          {PURCHASE_URL && (
            <a href={PURCHASE_URL} target="_blank" rel="noopener noreferrer" className={`${btn.pro} inline-block`}>Buy Pro</a>
          )}
        </div>
      )}

      {token && status.status !== 'valid' && status.reason && (
        <div className="text-sm text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded px-3 py-2">{status.reason}</div>
      )}

      <div>
        <span className="text-[11px] uppercase tracking-wider text-slate-500">{token ? 'Replace license key' : 'Enter license key'}</span>
        <textarea
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null); }}
          placeholder="TD1.…"
          rows={3}
          spellCheck={false}
          className={`${inputCls} mt-1 font-mono text-xs break-all`}
        />
        {error && <div className="text-xs text-rose-400 mt-1">{error}</div>}
        <div className="flex gap-2 mt-2">
          <button className={btn.primary} onClick={activate} disabled={!input.trim()}>Activate</button>
          {token && (
            <button className={btn.secondary} onClick={() => { if (confirm('Remove the license key from this browser?')) onLicense(null); }}>
              Remove key
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Keys are verified offline. Nothing is sent anywhere.
        {BUILD_DATE && <> Build {BUILD_DATE}.</>}
        {SUPPORT_EMAIL && <> Support: <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></>}
      </p>
    </div>
  );
}

function DataPanel({ workspace, onRestore }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);

  function backup() {
    downloadFile(serializeBackup(workspace), reportFilename('triage-desk-backup', 'json'), 'application/json');
  }

  async function restore(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const ws = parseBackup(await file.text());
      if (!confirm(`Restore ${ws.incidents.length} incident(s) and ${ws.customPlaybooks.length} custom playbook(s)? This replaces everything currently in this browser.`)) return;
      onRestore(ws);
      setMsg({ ok: true, text: 'Backup restored.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  return (
    <div className="space-y-5 text-sm text-slate-300">
      <div>
        <p className="mb-2">
          Everything is stored only in this browser's local storage. Clearing site data, private windows, or switching browsers will
          lose it, so <strong className="text-slate-100">export a backup regularly</strong>, especially before closing out an incident.
        </p>
        <div className="flex gap-2">
          <button className={btn.primary} onClick={backup}>Export backup</button>
          <button className={btn.secondary} onClick={() => fileRef.current?.click()}>Restore from backup…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={restore} />
        </div>
        {msg && <div className={`text-xs mt-2 ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.text}</div>}
      </div>
      <p className="text-xs text-slate-500">
        Backups contain your license key and all incident notes. Treat them with the same handling as the incident's TLP marking.
      </p>
    </div>
  );
}
