import { useState } from 'react';
import { SEVERITIES } from '../data.js';
import { canUsePlaybook } from '../license/entitlements.js';
import { Banknote, Check, Cloud, FileCog, Lock, MailWarning, Plus, Shield } from 'lucide-react';
import { Modal, ProBadge, btn, inputCls } from './Modal.jsx';

export const PLAYBOOK_ICONS = {
  'builtin-general': Shield,
  'builtin-ransomware': Lock,
  'builtin-phishing': MailWarning,
  'builtin-bec': Banknote,
  'builtin-cloud-credentials': Cloud,
};

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
      icon={Plus}
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
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Incident name</span>
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
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Initial severity</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={`${inputCls} mt-1`}>
            {Object.keys(SEVERITIES).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3 mb-2">Playbook</div>
      <div className="grid sm:grid-cols-2 gap-2">
        {playbooks.map((pb) => {
          const usable = canUsePlaybook(pb, ent);
          const active = pb.id === playbookId;
          const count = Object.values(pb.tasks).reduce((n, t) => n + t.length, 0);
          return (
            <button
              key={pb.id}
              onClick={() => (usable ? setPlaybookId(pb.id) : onUpgrade())}
              aria-pressed={active}
              className={`relative text-left p-4 rounded-xl border transition ${
                active ? 'border-signal/60 bg-raised ring-1 ring-signal/30' : 'border-line bg-surface hover:border-line-2 hover:bg-surface-2'
              } ${usable ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center gap-2.5">
                {(() => { const Icon = PLAYBOOK_ICONS[pb.id] ?? FileCog; return (
                  <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${active ? 'bg-signal/15 border-signal/40' : 'bg-raised border-line-2'}`}>
                    <Icon size={15} className={active ? 'text-signal' : 'text-ink-2'} />
                  </span>
                ); })()}
                <span className="text-sm font-semibold text-ink">{pb.name}</span>
                {active && <Check size={15} className="ml-auto text-signal" />}
                {!pb.builtIn && <span className="text-[10px] text-ink-2 border border-line-2 rounded px-1">CUSTOM</span>}
                {!usable && <ProBadge className={active ? '' : 'ml-auto'} />}
              </div>
              <p className="text-xs text-ink-2 mt-2.5 leading-relaxed line-clamp-2">{pb.description || 'No description.'}</p>
              <p className="text-[11px] text-ink-3 mt-2 tabular">{count} tasks across 6 phases</p>
            </button>
          );
        })}
      </div>
      {!ent.pro && (
        <p className="text-xs text-ink-3 mt-4">
          Free includes the General playbook. <button className="text-pro hover:underline" onClick={onUpgrade}>Upgrade to Pro</button> for the ransomware, phishing, BEC, and cloud credential playbooks, and to build your own.
        </p>
      )}
    </Modal>
  );
}
