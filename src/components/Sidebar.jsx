import { useState } from 'react';
import { phaseActivity, phaseLocked } from '../lib/phaseActivity.js';
import { lifecycleOf } from '../state/incident.js';
import { ProBadge } from './Modal.jsx';

const STATUS_DOT = {
  idle: 'bg-slate-500',
  active: 'bg-rose-500 animate-pulse',
  resolved: 'bg-emerald-500',
};

function IncidentSwitcher({ incidents, activeId, onSwitch, onNew, onDelete, atLimit }) {
  const [open, setOpen] = useState(false);
  const active = incidents.find((i) => i.id === activeId);
  return (
    <div className="relative px-3 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition"
      >
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Incident {incidents.length > 1 ? `· ${incidents.length} total` : ''}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[active ? lifecycleOf(active) : 'idle']}`} />
          <span className="text-sm text-slate-100 truncate flex-1">{active?.name?.trim() || 'Untitled incident'}</span>
          <span className="text-slate-500 text-xs">{open ? '▴' : '▾'}</span>
        </div>
      </button>
      {open && (
        <div className="absolute left-3 right-3 mt-1 z-30 rounded-lg border border-slate-700 bg-slate-900 shadow-xl overflow-hidden">
          <ul className="max-h-72 overflow-y-auto py-1">
            {incidents.map((inc) => (
              <li key={inc.id} className="group flex items-center">
                <button
                  onClick={() => { onSwitch(inc.id); setOpen(false); }}
                  className={`flex-1 min-w-0 text-left px-3 py-2 text-sm flex items-center gap-2 ${inc.id === activeId ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-800/60'}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[lifecycleOf(inc)]}`} />
                  <span className="truncate">{inc.name?.trim() || 'Untitled incident'}</span>
                  <span className="ml-auto text-[10px] text-slate-500 shrink-0">{inc.playbookName}</span>
                </button>
                <button
                  onClick={() => onDelete(inc.id)}
                  title="Delete incident"
                  aria-label={`Delete ${inc.name || 'incident'}`}
                  className="px-2 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => { onNew(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-slate-200 border-t border-slate-800 hover:bg-slate-800 flex items-center gap-2"
          >
            + New incident {atLimit && <ProBadge className="ml-auto" />}
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  incident, phases, onSelect, sev,
  incidents, onSwitch, onNew, onDelete, atLimit,
  ent, license, onOpenPlaybooks, onOpenSettings,
}) {
  const lifecycle = lifecycleOf(incident);
  const running = lifecycle === 'active';
  return (
    <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${running ? sev.accent + ' animate-pulse' : 'bg-slate-600'}`} />
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">Triage Desk</h1>
          {ent.pro && <ProBadge />}
        </div>
        <p className="mt-1 text-xs text-slate-500 uppercase tracking-wider">IR Playbook</p>
      </div>

      <IncidentSwitcher
        incidents={incidents}
        activeId={incident.id}
        onSwitch={onSwitch}
        onNew={onNew}
        onDelete={onDelete}
        atLimit={atLimit}
      />

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {phases.map((p, idx) => {
          const arr = incident.checks[p.id] || [];
          const done = arr.filter(Boolean).length;
          const total = arr.length;
          const complete = done === total && total > 0;
          const isActive = p.id === incident.activePhase;
          const outOfPhase = phaseActivity(p.stage, lifecycle) === 'out-of-phase';
          const locked = phaseLocked(p.stage, lifecycle);
          const subline = locked ? 'locked' : outOfPhase ? 'out of phase' : `${done}/${total} tasks`;
          return (
            <button
              key={p.id}
              onClick={() => { if (!locked) onSelect(p.id); }}
              disabled={locked}
              title={locked ? 'Locked while incident is open' : (outOfPhase ? 'Out of phase for current incident lifecycle' : undefined)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition border ${
                isActive
                  ? `${sev.accentSoft} ${sev.accentBorder} text-slate-100`
                  : `border-transparent ${locked ? 'cursor-not-allowed' : 'hover:bg-slate-800/60'} ${outOfPhase ? 'text-slate-500' : 'text-slate-300'}`
              } ${locked ? 'opacity-50' : (outOfPhase && !isActive ? 'opacity-60' : '')}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`text-xs font-mono w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                    isActive ? sev.accent + ' text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="font-medium text-sm truncate">{p.name}</span>
                </div>
                {complete && !locked && (
                  <span className={`text-xs ${sev.accentText}`}>✓</span>
                )}
              </div>
              <div className="mt-1.5 ml-7 text-xs text-slate-500">
                {subline}
              </div>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800 space-y-1">
        <button onClick={onOpenPlaybooks} className="w-full text-left px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800/60">
          Playbooks
        </button>
        <button onClick={onOpenSettings} className="w-full text-left px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800/60">
          Settings &amp; license
        </button>
      </div>
      <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-500">
        <div>NIST SP 800-61 aligned · offline</div>
        <div className="mt-0.5 truncate">
          {ent.pro ? `Pro · ${license?.name ?? ''}` : 'Free edition'} · v{__APP_VERSION__}
        </div>
      </div>
    </aside>
  );
}
