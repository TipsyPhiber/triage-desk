// Find the right playbook among hundreds: plain-language search, category
// filter, and a preview of exactly what the responder will be asked to do.

import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Search, ShieldAlert } from 'lucide-react';
import { PHASES, SEVERITIES } from '../data.js';
import { LIBRARY_CATEGORIES } from '../playbooks/library.js';
import { canUsePlaybook } from '../license/entitlements.js';
import { searchPlaybooks } from '../lib/playbookSearch.js';
import { ProBadge } from './Modal.jsx';
import { SplunkMark } from './SplunkSearches.jsx';

const EXAMPLES = ['user clicked a phishing link', 'ransomware on file server', 'aws key leaked on github', 'okta admin compromised', 'T1003', 'lost laptop'];

export function taskCount(pb) {
  return Object.values(pb.tasks || {}).reduce((n, t) => n + t.length, 0);
}

function Preview({ pb, ent, onUpgrade }) {
  if (!pb) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-ink-3 text-sm p-8">
        <BookOpen size={22} className="mb-3 text-ink-4" />
        Pick a playbook to preview its checklist and Splunk searches.
      </div>
    );
  }
  const usable = canUsePlaybook(pb, ent);
  return (
    <div className="p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{pb.categoryName || (pb.builtIn ? 'Essentials' : 'Your playbooks')}</div>
      <h3 className="mt-1 text-[16px] font-semibold text-ink leading-snug">{pb.name}</h3>
      <p className="mt-1.5 text-[13px] text-ink-2 leading-relaxed">{pb.description || 'No description.'}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {pb.severity && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${SEVERITIES[pb.severity].accentBorder} ${SEVERITIES[pb.severity].accentText}`}>
            Suggested: {pb.severity}
          </span>
        )}
        {(pb.attack || []).slice(0, 6).map((t) => (
          <span key={t} className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-raised border border-line text-ink-2">{t}</span>
        ))}
        {!usable && <ProBadge />}
      </div>
      <div className="mt-4 space-y-3">
        {PHASES.map((ph) => {
          const tasks = pb.tasks?.[ph.id] || [];
          if (!tasks.length) return null;
          return (
            <div key={ph.id}>
              <div className="text-[11px] font-semibold text-ink-3 mb-1">{ph.name} <span className="font-normal">· {tasks.length}</span></div>
              <ul className="space-y-1">
                {tasks.slice(0, 3).map((t, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] text-ink-2 leading-snug">
                    <span className="mt-[7px] w-1 h-1 rounded-full bg-ink-4 shrink-0" />{t}
                  </li>
                ))}
                {tasks.length > 3 && <li className="text-[12px] text-ink-4 pl-3">+{tasks.length - 3} more</li>}
              </ul>
            </div>
          );
        })}
      </div>
      {pb.splunk?.length > 0 && (
        <div className="mt-4 rounded-lg border border-line bg-raised px-3 py-2.5">
          <div className="flex items-center gap-2 text-[12px] font-medium text-ink"><SplunkMark size={13} /> {pb.splunk.length} Splunk searches included</div>
          <ul className="mt-1.5 space-y-0.5">
            {pb.splunk.map((s, i) => <li key={i} className="text-[12px] text-ink-3 truncate">· {s.title}</li>)}
          </ul>
        </div>
      )}
      {!usable && (
        <button onClick={onUpgrade} className="mt-4 w-full text-[13px] font-medium text-pro border border-pro/30 bg-pro/5 rounded-lg py-2 hover:bg-pro/10">
          Unlock all playbooks with Pro
        </button>
      )}
    </div>
  );
}

export function PlaybookFinder({ playbooks, ent, selectedId, onSelect, onConfirm, onUpgrade, initialQuery = '', autoFocus = true }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(null);
  const input = useRef(null);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);

  const categories = useMemo(() => {
    const custom = playbooks.filter((p) => !p.builtIn).length;
    return [
      { id: null, name: 'All playbooks', count: playbooks.length },
      { id: 'essentials', name: 'Essentials', count: playbooks.filter((p) => p.category === 'essentials').length },
      ...LIBRARY_CATEGORIES,
      ...(custom ? [{ id: 'custom', name: 'Your playbooks', count: custom }] : []),
    ];
  }, [playbooks]);

  const results = useMemo(() => searchPlaybooks(playbooks, query, { category }), [playbooks, query, category]);
  const selected = playbooks.find((p) => p.id === selectedId) ?? null;

  // Keep the selection on the best match while typing.
  useEffect(() => {
    if (query.trim() && results.length && !results.some((r) => r.id === selectedId)) onSelect(results[0].id);
  }, [query, results]); // eslint-disable-line react-hooks/exhaustive-deps

  function onKey(e) {
    if (!results.length) return;
    const i = results.findIndex((r) => r.id === selectedId);
    if (e.key === 'ArrowDown') { e.preventDefault(); onSelect(results[Math.min(results.length - 1, i + 1)].id); }
    if (e.key === 'ArrowUp') { e.preventDefault(); onSelect(results[Math.max(0, i - 1)].id); }
    if (e.key === 'Enter') { e.preventDefault(); onConfirm?.(); }
  }
  useEffect(() => {
    document.getElementById(`pb-${selectedId}`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)_minmax(0,1.1fr)] gap-0 border border-line rounded-xl overflow-hidden bg-surface h-[min(62vh,620px)]">
      <nav aria-label="Playbook categories" className="hidden md:block border-r border-line bg-canvas/60 overflow-y-auto p-2">
        {categories.map((c) => (
          <button
            key={c.id ?? 'all'}
            onClick={() => setCategory(c.id)}
            aria-pressed={category === c.id}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-[12.5px] transition ${category === c.id ? 'bg-surface text-ink font-medium shadow-card ring-1 ring-line' : 'text-ink-2 hover:text-ink hover:bg-hover'}`}
          >
            <span className="truncate">{c.name}</span>
            <span className="ml-auto text-[11px] text-ink-4 tabular">{c.count}</span>
          </button>
        ))}
      </nav>

      <div className="flex flex-col min-h-0 border-r border-line">
        <div className="p-3 border-b border-line">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
            <input
              ref={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              aria-label="Search playbooks"
              placeholder="Describe what's happening, or search by ATT&CK id"
              className="w-full bg-canvas border border-line-2 rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder-ink-4 outline-none focus:border-signal focus:ring-2 focus:ring-signal/15"
            />
          </div>
          {!query && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => setQuery(ex)} className="text-[11px] px-2 py-0.5 rounded-full border border-line text-ink-3 hover:text-ink hover:border-line-2">{ex}</button>
              ))}
            </div>
          )}
        </div>
        <ul role="listbox" aria-label="Playbooks" className="flex-1 overflow-y-auto p-1.5">
          {results.map((pb) => {
            const usable = canUsePlaybook(pb, ent);
            const active = pb.id === selectedId;
            return (
              <li key={pb.id}>
                <button
                  id={`pb-${pb.id}`}
                  role="option"
                  aria-selected={active}
                  onClick={() => onSelect(pb.id)}
                  onDoubleClick={() => onConfirm?.()}
                  className={`w-full text-left px-3 py-2 rounded-lg transition flex items-start gap-2.5 ${active ? 'bg-signal-soft ring-1 ring-signal/30' : 'hover:bg-hover'}`}
                >
                  <ShieldAlert size={14} className={`mt-0.5 shrink-0 ${active ? 'text-signal' : 'text-ink-4'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-ink truncate">{pb.name}</span>
                      {!usable && <ProBadge className="shrink-0" />}
                      {!pb.builtIn && <span className="text-[10px] text-ink-3 border border-line-2 rounded px-1 shrink-0">CUSTOM</span>}
                    </span>
                    <span className="block text-[11.5px] text-ink-3 truncate">{pb.categoryName || 'Custom'} · {taskCount(pb)} tasks{pb.splunk?.length ? ` · ${pb.splunk.length} searches` : ''}</span>
                  </span>
                  {active && <Check size={14} className="text-signal mt-0.5 shrink-0" />}
                </button>
              </li>
            );
          })}
          {!results.length && (
            <li className="p-6 text-center text-[13px] text-ink-3">
              No playbook matches “{query}”. Try fewer words, or start with the <button className="text-signal hover:underline" onClick={() => { setQuery(''); setCategory('essentials'); }}>General playbook</button>.
            </li>
          )}
        </ul>
        <div className="px-3 py-2 border-t border-line text-[11px] text-ink-4 tabular">{results.length} playbook{results.length === 1 ? '' : 's'} · ↑↓ to browse · Enter to choose</div>
      </div>

      <div className="hidden md:block overflow-y-auto bg-surface">
        <Preview pb={selected} ent={ent} onUpgrade={onUpgrade} />
      </div>
    </div>
  );
}
