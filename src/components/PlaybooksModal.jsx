import { useRef, useState } from 'react';
import { askConfirm } from './ConfirmDialog.jsx';
import { PHASES } from '../data.js';
import { duplicatePlaybook, parsePlaybookFile, sanitizePlaybook, serializePlaybook } from '../state/playbooks.js';
import { downloadFile, reportFilename } from '../lib/exportReport.js';
import { BookOpen as HeaderIcon, Search } from 'lucide-react';
import { LIBRARY_CATEGORIES } from '../playbooks/library.js';
import { searchPlaybooks } from '../lib/playbookSearch.js';
import { SplunkSearches } from './SplunkSearches.jsx';
import { Modal, ProBadge, btn, inputCls } from './Modal.jsx';

function toDraft(pb) {
  const tasks = {};
  for (const p of PHASES) tasks[p.id] = (pb.tasks[p.id] || []).join('\n');
  return { id: pb.id, name: pb.name, description: pb.description, tasks, splunk: pb.splunk, attack: pb.attack };
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
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const fileRef = useRef(null);
  const shown = searchPlaybooks(playbooks, q, { category: cat || null });
  const selected = playbooks.find((p) => p.id === selectedId) ?? playbooks[0];
  const editable = ent.customPlaybooks;

  async function select(id) {
    if (draft && !(await askConfirm({ title: 'Discard unsaved changes?', body: 'Your edits to this playbook have not been saved.', confirmLabel: 'Discard', danger: true }))) return;
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

  async function remove() {
    if (!(await askConfirm({ title: `Delete “${selected.name}”?`, body: 'Incidents that already use this playbook keep their own copy of its tasks.', confirmLabel: 'Delete playbook', danger: true }))) return;
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
      icon={HeaderIcon}
      onClose={onClose}
      wide="xl"
    >
      <div className="grid sm:grid-cols-[280px_1fr] gap-6">
        <div>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4" />
            <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter playbooks" placeholder={`Search ${playbooks.length} playbooks`} className={`${inputCls} pl-8 py-1.5`} />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category" className={`${inputCls} py-1.5 mb-2`}>
            <option value="">All categories</option>
            <option value="essentials">Essentials</option>
            {LIBRARY_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}
            {playbooks.some((p) => !p.builtIn) && <option value="custom">Your playbooks</option>}
          </select>
          <ul className="space-y-0.5 max-h-[52vh] overflow-y-auto pr-1">
            {shown.map((pb) => (
              <li key={pb.id}>
                <button
                  onClick={() => select(pb.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition flex items-center gap-2 ${
                    pb.id === selected?.id ? 'bg-raised text-ink' : 'text-ink-2 hover:bg-hover'
                  }`}
                >
                  <span className="truncate">{pb.name}</span>
                  {pb.builtIn && pb.tier === 'pro' && !ent.pro && <ProBadge className="ml-auto" />}
                  {!pb.builtIn && <span className="ml-auto text-[10px] text-ink-3">custom</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-line space-y-2">
            <button className={`${btn.secondary} w-full flex items-center justify-center gap-2`} onClick={() => (editable ? fileRef.current?.click() : onUpgrade())}>
              Import playbook… {!editable && <ProBadge />}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importFile} />
          </div>
        </div>

        {selected && (
          <div className="min-w-0">
            {error && (
              <div className="mb-3 text-sm text-danger border border-danger/30 bg-danger/10 rounded px-3 py-2">{error}</div>
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
                <p className="text-xs text-ink-3">One task per line.</p>
                {PHASES.map((p) => (
                  <label key={p.id} className="block">
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{p.name}</span>
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
                  <h3 className="text-lg font-semibold text-ink flex-1">{selected.name}</h3>
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
                <p className="text-sm text-ink-2 mb-4">{selected.description}</p>
                {selected.builtIn && (
                  <p className="text-xs text-ink-3 mb-4">Built-in playbooks are read-only. Duplicate one to tailor it to your environment.</p>
                )}
                {selected.attack?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {selected.attack.map((t) => <span key={t} className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-raised border border-line text-ink-2">{t}</span>)}
                  </div>
                )}
                {PHASES.map((p) => (
                  <div key={p.id} className="mb-4">
                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3 mb-1">{p.name}</div>
                    {(selected.tasks[p.id] || []).length === 0 ? (
                      <p className="text-xs text-ink-4 italic">No tasks.</p>
                    ) : (
                      <ul className="text-sm text-ink-2 space-y-0.5 list-disc pl-5">
                        {selected.tasks[p.id].map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
                <SplunkSearches searches={selected.splunk} />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
