import { btn, ProBadge } from './Modal.jsx';

const POINTS = [
  ['Structured response', 'Walk every incident through Preparation → Lessons Learned with checklists that lock to the incident lifecycle.'],
  ['Evidence that writes itself', 'Every check, phase change, severity bump, and note is timestamped onto the incident timeline automatically.'],
  ['IOC extraction', 'Paste logs or phishing emails; a Rust/WASM extractor pulls and refangs IPs, domains, URLs, hashes, emails, and CVEs.'],
  ['Nothing leaves your machine', 'No accounts, no telemetry, no server. Runs from a single HTML file, even on an air-gapped analyst workstation.'],
];

export function Welcome({ ent, onQuickStart, onNew, onOpenSettings }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Triage Desk</h1>
          {ent.pro && <ProBadge />}
        </div>
        <p className="text-slate-400 mb-8">An offline incident response workspace for SOC analysts and on-call engineers.</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          {POINTS.map(([title, body]) => (
            <div key={title} className="p-4 rounded-lg border border-slate-800 bg-slate-900/40">
              <div className="text-sm font-medium text-slate-100 mb-1">{title}</div>
              <div className="text-xs text-slate-400 leading-relaxed">{body}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button className={`${btn.primary} px-4 py-2`} onClick={onNew}>Start an incident</button>
          <button className={`${btn.secondary} px-4 py-2`} onClick={onQuickStart}>Quick start (General playbook)</button>
          <button className={`${btn.secondary} px-4 py-2`} onClick={onOpenSettings}>Restore a backup…</button>
        </div>
      </div>
    </div>
  );
}
