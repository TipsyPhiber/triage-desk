import { useRef, useState } from 'react';
import { PHASES } from '../data.js';
import { duplicatePlaybook, parsePlaybookFile, sanitizePlaybook, serializePlaybook } from '../state/playbooks.js';
import { downloadFile, reportFilename } from '../lib/exportReport.js';
import { Modal, ProBadge, btn, inputCls } from './Modal.jsx';

function toDraft(pb) {
  const tasks = {};
  for (const p of PHASES) tasks[p.id] = (pb.tasks[p.id] || []).join('\n');
  return { id: pb.id, name: pb.name, description: pb.description, tasks };
}

function fromDraft(d) {
  const tasks = {};
  for (const p of PHASES) tasks[p.id] = d.tasks[p.id].split('\n');
  return sanitizePlaybook({ ...d, tasks });
}

export function PlaybooksModal({ playbooks, ent, onSave, onDelete, onClose, onUpgrade }) {
  const [selectedId, setSelectedId] = useState(playbooks[0]?.id);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const selected = playbooks.find((p) => p.id === selectedId) ?? playbooks[0];
  const editable = ent.customPlaybooks;

  function select(id) {
    if (draft && !confirm('Discard unsaved playbook changes?')) return;
    setDraft(null);
    setError(null);
    setSelectedId(id);
  }

  function duplicate() {
    if (!editable) return onUpgrade();
    const copy = duplicatePlaybook(selected);
    onSave(copy);
    setSelectedId(copy.id);
    setDraft(toDraft(copy));
  }

  function save() {
    const pb = fromDraft(draft);
    if (!pb) { setError('Playbook needs a name.'); return; }
    onSave(pb);
    setDraft(null);
    setError(null);
  }

  function remove() {
    if (!confirm(`Delete playbook "${selected.name}"? Existing incidents that used it keep their own copy of its tasks.`)) return;
    onDelete(selected.id);
    setDraft(null);
    setSelectedId(playbooks[0]?.id);
  }

  async function importFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!editable) return onUpgrade();
    try {
      const pb = parsePlaybookFile(await file.text());
      onSave(pb);
      setSelectedId(pb.id);
      setDraft(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function exportSelected() {
    downloadFile(serializePlaybook(selected), reportFilename(`playbook-${selected.name}`, 'json'), 'application/json');
  }

  return (
    <Modal
      title="Playbooks"
      subtitle="New incidents copy their playbook's tasks, so edits here never change incidents already in progress."
      onClose={onClose}
      wide
    >
      <div className="grid sm:grid-cols-[220px_1fr] gap-5">
        <div>
          <ul className="space-y-1">
            {playbooks.map((pb) => (
              <li key={pb.id}>
                <button
                  onClick={() => select(pb.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition flex items-center gap-2 ${
                    pb.id === selected?.id ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="truncate">{pb.name}</span>
                  {pb.builtIn && pb.tier === 'pro' && !ent.pro && <ProBadge className="ml-auto" />}
                  {!pb.builtIn && <span className="ml-auto text-[10px] text-slate-500">custom</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
            <button className={`${btn.secondary} w-full flex items-center justify-center gap-2`} onClick={() => (editable ? fileRef.current?.click() : onUpgrade())}>
              Import playbook… {!editable && <ProBadge />}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importFile} />
          </div>
        </div>

        {selected && (
          <div className="min-w-0">
            {error && (
              <div className="mb-3 text-sm text-rose-400 border border-rose-500/30 bg-rose-500/10 rounded px-3 py-2">{error}</div>
            )}

            {draft ? (
              <div className="space-y-3">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Playbook name"
                  className={inputCls}
                />
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="When should responders use this playbook?"
                  rows={2}
                  className={inputCls}
                />
                <p className="text-xs text-slate-500">One task per line.</p>
                {PHASES.map((p) => (
                  <label key={p.id} className="block">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500">{p.name}</span>
                    <textarea
                      value={draft.tasks[p.id]}
                      onChange={(e) => setDraft({ ...draft, tasks: { ...draft.tasks, [p.id]: e.target.value } })}
                      rows={Math.max(3, draft.tasks[p.id].split('\n').length + 1)}
                      className={`${inputCls} mt-1 font-mono text-xs leading-relaxed`}
                    />
                  </label>
                ))}
                <div className="flex gap-2 justify-end pt-2">
                  <button className={btn.secondary} onClick={() => { setDraft(null); setError(null); }}>Cancel</button>
                  <button className={btn.primary} onClick={save}>Save playbook</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start gap-3 mb-1">
                  <h3 className="text-lg font-semibold text-slate-100 flex-1">{selected.name}</h3>
                  <div className="flex gap-2 shrink-0">
                    <button className={btn.secondary} onClick={exportSelected}>Export</button>
                    <button className={`${btn.secondary} flex items-center gap-2`} onClick={duplicate}>
                      Duplicate {!editable && <ProBadge />}
                    </button>
                    {!selected.builtIn && editable && (
                      <>
                        <button className={btn.secondary} onClick={() => setDraft(toDraft(selected))}>Edit</button>
                        <button className={btn.danger} onClick={remove}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-400 mb-4">{selected.description}</p>
                {selected.builtIn && (
                  <p className="text-xs text-slate-500 mb-4">Built-in playbooks are read-only. Duplicate one to tailor it to your environment.</p>
                )}
                {PHASES.map((p) => (
                  <div key={p.id} className="mb-4">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{p.name}</div>
                    {(selected.tasks[p.id] || []).length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No tasks.</p>
                    ) : (
                      <ul className="text-sm text-slate-300 space-y-0.5 list-disc pl-5">
                        {selected.tasks[p.id].map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
