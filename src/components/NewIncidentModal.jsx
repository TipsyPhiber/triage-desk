import { useState } from 'react';
import { SEVERITIES } from '../data.js';
import { canUsePlaybook } from '../license/entitlements.js';
import { Modal, ProBadge, btn, inputCls } from './Modal.jsx';

export function NewIncidentModal({ playbooks, ent, onCreate, onClose, onUpgrade }) {
  const firstUsable = playbooks.find((p) => canUsePlaybook(p, ent));
  const [playbookId, setPlaybookId] = useState(firstUsable?.id);
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const selected = playbooks.find((p) => p.id === playbookId);

  function submit() {
    if (!selected || !canUsePlaybook(selected, ent)) return;
    onCreate({ playbook: selected, name: name.trim(), severity });
  }

  return (
    <Modal
      title="New incident"
      subtitle="Pick the playbook that best matches what you're responding to."
      onClose={onClose}
      wide
      footer={(
        <>
          <button className={btn.secondary} onClick={onClose}>Cancel</button>
          <button className={btn.primary} onClick={submit} disabled={!selected || !canUsePlaybook(selected, ent)}>
            Create incident
          </button>
        </>
      )}
    >
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <label className="sm:col-span-2 block">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">Incident name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="e.g. INC-2026-0142 Finance phishing"
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">Initial severity</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={`${inputCls} mt-1`}>
            {Object.keys(SEVERITIES).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Playbook</div>
      <div className="grid sm:grid-cols-2 gap-2">
        {playbooks.map((pb) => {
          const usable = canUsePlaybook(pb, ent);
          const active = pb.id === playbookId;
          const count = Object.values(pb.tasks).reduce((n, t) => n + t.length, 0);
          return (
            <button
              key={pb.id}
              onClick={() => (usable ? setPlaybookId(pb.id) : onUpgrade())}
              className={`text-left p-3 rounded-lg border transition ${
                active ? 'border-slate-400 bg-slate-800/80' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
              } ${usable ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-100">{pb.name}</span>
                {!pb.builtIn && <span className="text-[10px] text-slate-400 border border-slate-700 rounded px-1">CUSTOM</span>}
                {!usable && <ProBadge className="ml-auto" />}
              </div>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{pb.description || 'No description.'}</p>
              <p className="text-[11px] text-slate-500 mt-1.5">{count} tasks</p>
            </button>
          );
        })}
      </div>
      {!ent.pro && (
        <p className="text-xs text-slate-500 mt-4">
          Free includes the General playbook. <button className="text-violet-300 hover:underline" onClick={onUpgrade}>Upgrade to Pro</button> for the ransomware, phishing, BEC, and cloud credential playbooks, and to build your own.
        </p>
      )}
    </Modal>
  );
}
