// Ctrl/⌘+K: one box to do anything — start from a playbook, jump to an
// incident or phase, export, import from Splunk, switch theme.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CornerDownLeft, FileText, Moon, Plus, Search, Settings, ShieldAlert, Upload } from 'lucide-react';
import { searchPlaybooks, tokenize } from '../lib/playbookSearch.js';
import { Kbd } from './Modal.jsx';
import { SplunkMark } from './SplunkSearches.jsx';

function match(label, tokens) {
  if (!tokens.length) return true;
  const l = label.toLowerCase();
  return tokens.every((t) => l.includes(t));
}

export function CommandPalette({ actions, incidents, playbooks, onClose }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);

  const items = useMemo(() => {
    const tokens = tokenize(q);
    const out = [];
    for (const a of actions) if (match(`${a.label} ${a.keywords || ''}`, tokens)) out.push({ ...a, group: 'Actions' });
    for (const inc of incidents) {
      const label = inc.name?.trim() || 'Untitled incident';
      if (tokens.length && match(label, tokens)) out.push({ id: `inc:${inc.id}`, label, hint: inc.severity, icon: ArrowRight, group: 'Incidents', run: inc.run });
    }
    if (tokens.length) {
      for (const pb of searchPlaybooks(playbooks, q, { limit: 8 })) {
        out.push({ id: `pb:${pb.id}`, label: pb.name, hint: pb.categoryName || 'Custom', icon: ShieldAlert, group: 'Start from playbook', run: pb.run });
      }
    }
    return out;
  }, [q, actions, incidents, playbooks]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { document.getElementById(`cmd-${sel}`)?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === 'Enter' && items[sel]) { e.preventDefault(); onClose(); items[sel].run(); }
  }

  let lastGroup = null;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <div className="fixed inset-0 scrim backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="anim-in relative w-full max-w-xl bg-surface-2 border border-line rounded-2xl shadow-pop overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-line">
          <Search size={16} className="text-ink-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            aria-label="Command"
            placeholder="Type a command, an incident, or what's happening…"
            className="flex-1 bg-transparent py-3.5 text-[15px] text-ink placeholder-ink-4 outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul role="listbox" aria-label="Commands" className="max-h-[52vh] overflow-y-auto p-1.5">
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            const Icon = it.icon || ArrowRight;
            return (
              <li key={it.id}>
                {header && <div className="px-3 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-4">{header}</div>}
                <button
                  id={`cmd-${i}`}
                  role="option"
                  aria-selected={i === sel}
                  onMouseMove={() => setSel(i)}
                  onClick={() => { onClose(); it.run(); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-[13.5px] ${i === sel ? 'bg-signal-soft text-ink' : 'text-ink-2'}`}
                >
                  {it.splunk ? <SplunkMark size={14} /> : <Icon size={15} className={i === sel ? 'text-signal' : 'text-ink-3'} />}
                  <span className="truncate">{it.label}</span>
                  {it.hint && <span className="ml-auto text-[11.5px] text-ink-4 truncate max-w-[40%]">{it.hint}</span>}
                  {i === sel && !it.hint && <CornerDownLeft size={13} className="ml-auto text-ink-4" />}
                </button>
              </li>
            );
          })}
          {!items.length && <li className="px-4 py-8 text-center text-[13px] text-ink-3">Nothing matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  );
}

export const PALETTE_ICONS = { Plus, BookOpen, FileText, Moon, Settings, Upload };
