// Left rail: every incident in the workspace, grouped by lifecycle, plus
// navigation to playbooks and settings.

import { BookOpen, Keyboard, Plus, Search, Settings, Trash2 } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.jsx';
import { SplunkMark } from './SplunkSearches.jsx';
import { SEVERITIES } from '../data.js';
import { incidentTotals, lifecycleOf } from '../state/incident.js';
import { formatDuration } from '../lib/time.js';
import { Kbd, Logo, ProBadge } from './Modal.jsx';

const GROUPS = [
  { id: 'active', label: 'Active' },
  { id: 'idle', label: 'Standby' },
  { id: 'resolved', label: 'Resolved' },
];

function IncidentItem({ inc, active, now, onSelect, onDelete }) {
  const lifecycle = lifecycleOf(inc);
  const sev = SEVERITIES[inc.severity];
  const { done, total } = incidentTotals(inc);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const meta = lifecycle === 'active'
    ? formatDuration(now - inc.startTime)
    : lifecycle === 'resolved'
      ? `took ${formatDuration(inc.endTime - inc.startTime)}`
      : 'not declared';
  return (
    <li className="group relative">
      <button
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={`w-full text-left pl-3.5 pr-8 py-2.5 rounded-lg transition relative ${active ? 'bg-raised ring-1 ring-line-2' : 'hover:bg-hover'}`}
      >
        <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full" style={{ background: sev.hex, opacity: lifecycle === 'resolved' ? 0.35 : 1 }} />
        <div className={`text-[13px] font-medium truncate ${active ? 'text-ink' : 'text-ink-2'}`}>
          {inc.name?.trim() || 'Untitled incident'}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-3">
          {lifecycle === 'active' && <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: sev.hex, color: sev.hex }} />}
          <span className="tabular truncate">{inc.severity} · {meta}</span>
          <span className="ml-auto tabular">{pct}%</span>
        </div>
        <div className="mt-1.5 h-[3px] rounded-full bg-line overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: lifecycle === 'resolved' ? 'var(--color-ok)' : sev.hex }} />
        </div>
      </button>
      <button
        onClick={onDelete}
        title="Delete incident"
        aria-label={`Delete ${inc.name || 'incident'}`}
        className="absolute right-1.5 top-2 p-1.5 rounded-md text-ink-4 hover:text-danger hover:bg-hover opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}

export function Sidebar({
  incidents, activeId, now, onSwitch, onNew, onImport, onPalette, onDelete, atLimit,
  ent, license, onOpenPlaybooks, onOpenSettings, onOpenShortcuts,
}) {
  const grouped = Object.fromEntries(GROUPS.map((g) => [g.id, []]));
  for (const inc of incidents) grouped[lifecycleOf(inc)].push(inc);
  grouped.resolved.sort((a, b) => b.endTime - a.endTime);

  return (
    <aside className="w-[264px] shrink-0 border-r border-line bg-surface flex flex-col min-h-0">
      <div className="h-14 px-4 flex items-center gap-2.5 border-b border-line">
        <Logo />
        <span className="text-[15px] font-semibold tracking-tight text-ink">Triage Desk</span>
        {ent.pro && <ProBadge className="ml-auto" />}
      </div>

      <div className="p-3 space-y-1.5">
        <button
          onClick={onPalette}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-canvas border border-line text-[13px] text-ink-3 hover:text-ink-2 hover:border-line-2 transition"
        >
          <Search size={14} />
          Search…
          <span className="ml-auto flex items-center gap-0.5"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
        </button>
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-line-2 bg-raised text-sm text-ink hover:bg-hover hover:border-ink-4 transition"
        >
          <Plus size={15} className="text-ink-2" />
          New incident
          <span className="ml-auto flex items-center gap-1.5">
            {atLimit && <ProBadge />}
            <Kbd>C</Kbd>
          </span>
        </button>
      </div>

      <nav aria-label="Incidents" className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-4">
        {GROUPS.map((g) => grouped[g.id].length > 0 && (
          <section key={g.id}>
            <h3 className="px-1.5 mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-4 flex items-center justify-between">
              {g.label}
              <span className="tabular">{grouped[g.id].length}</span>
            </h3>
            <ul className="space-y-1">
              {grouped[g.id].map((inc) => (
                <IncidentItem
                  key={inc.id}
                  inc={inc}
                  now={now}
                  active={inc.id === activeId}
                  onSelect={() => onSwitch(inc.id)}
                  onDelete={() => onDelete(inc.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="p-2 border-t border-line">
        <button onClick={onImport} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-ink-2 hover:text-ink hover:bg-hover transition">
          <SplunkMark size={15} />
          Import Splunk alert
          <span className="ml-auto"><Kbd>I</Kbd></span>
        </button>
        {[
          { label: 'Playbooks', icon: BookOpen, onClick: onOpenPlaybooks },
          { label: 'Settings & license', icon: Settings, onClick: onOpenSettings },
          { label: 'Keyboard shortcuts', icon: Keyboard, onClick: onOpenShortcuts, kbd: '?' },
        ].map(({ label, icon: Icon, onClick, kbd }) => (
          <button key={label} onClick={onClick} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-ink-2 hover:text-ink hover:bg-hover transition">
            <Icon size={15} className="text-ink-3" />
            {label}
            {kbd && <span className="ml-auto"><Kbd>{kbd}</Kbd></span>}
          </button>
        ))}
      </div>
      <div className="px-3 py-2.5 border-t border-line text-[11px] text-ink-4 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-ok shrink-0" />
        <span className="truncate">{ent.connected ? 'Connected' : ent.pro ? 'Pro' : 'Free'}{license?.name ? ` · ${license.name}` : ''} · v{__APP_VERSION__}</span>
        <ThemeToggle className="ml-auto shrink-0" />
      </div>
    </aside>
  );
}
