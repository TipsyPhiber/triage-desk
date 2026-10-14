import { useState } from 'react';
import { SEVERITIES } from '../data.js';
import { canUsePlaybook } from '../license/entitlements.js';
import { Plus } from 'lucide-react';
import { GENERAL_PLAYBOOK_ID } from '../playbooks/builtins.js';
import { Modal, btn, inputCls, labelCls } from './Modal.jsx';
import { PlaybookFinder } from './PlaybookFinder.jsx';

export function NewIncidentModal({ playbooks, ent, onCreate, onClose, onUpgrade, initialQuery = '', initialPlaybookId = null, initialName = '', initialSeverity = null }) {
  const [playbookId, setPlaybookId] = useState(initialPlaybookId || GENERAL_PLAYBOOK_ID);
  const [name, setName] = useState(initialName);
  const [severity, setSeverity] = useState(initialSeverity || playbooks.find((p) => p.id === initialPlaybookId)?.severity || 'Medium');
  const [severityTouched, setSeverityTouched] = useState(!!initialSeverity);
  const selected = playbooks.find((p) => p.id === playbookId);
  const usable = selected && canUsePlaybook(selected, ent);

  function select(id) {
    setPlaybookId(id);
    const pb = playbooks.find((p) => p.id === id);
    if (!severityTouched && pb?.severity) setSeverity(pb.severity);
  }

  function submit() {
    if (!selected) return;
    if (!usable) { onUpgrade(); return; }
    onCreate({ playbook: selected, name: name.trim(), severity });
  }

  return (
    <Modal
      title="New incident"
      subtitle="Describe what's happening and pick the closest playbook. You can rename and change severity later."
      icon={Plus}
      onClose={onClose}
      wide="xl"
      footer={(
        <>
          <span className="mr-auto self-center text-[12px] text-ink-3 truncate">
            {selected ? <>Using <span className="text-ink font-medium">{selected.name}</span></> : 'Pick a playbook'}
          </span>
          <button className={btn.secondary} onClick={onClose}>Cancel</button>
          <button className={usable ? btn.primary : btn.pro} onClick={submit} disabled={!selected}>
            {usable ? 'Create incident' : 'Unlock with Pro'}
          </button>
        </>
      )}
    >
      <div className="grid sm:grid-cols-[minmax(0,1fr)_200px] gap-3 mb-4">
        <label className="block">
          <span className={labelCls}>Incident name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="e.g. INC-2026-0142 Finance phishing"
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Initial severity</span>
          <select value={severity} onChange={(e) => { setSeverity(e.target.value); setSeverityTouched(true); }} className={`${inputCls} mt-1`}>
            {Object.keys(SEVERITIES).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <PlaybookFinder
        playbooks={playbooks}
        ent={ent}
        selectedId={playbookId}
        onSelect={select}
        onConfirm={submit}
        onUpgrade={onUpgrade}
        initialQuery={initialQuery}
      />
      {!ent.pro && (
        <p className="text-xs text-ink-3 mt-3">
          Free includes the General playbook. <button className="text-pro hover:underline" onClick={onUpgrade}>Upgrade to Pro</button> to run any of the {playbooks.length - 1}+ scenario playbooks and build your own.
        </p>
      )}
    </Modal>
  );
}
