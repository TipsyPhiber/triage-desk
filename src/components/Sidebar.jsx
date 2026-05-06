import { PHASES } from '../data.js';

export function Sidebar({ activePhase, onSelect, checks, sev, running }) {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${running ? sev.accent + ' animate-pulse' : 'bg-slate-600'}`} />
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">Triage Desk</h1>
        </div>
        <p className="mt-1 text-xs text-slate-500 uppercase tracking-wider">IR Playbook</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {PHASES.map((p, idx) => {
          const arr = checks[p.id] || [];
          const done = arr.filter(Boolean).length;
          const total = arr.length;
          const complete = done === total && total > 0;
          const isActive = p.id === activePhase;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition border ${
                isActive
                  ? `${sev.accentSoft} ${sev.accentBorder} text-slate-100`
                  : 'border-transparent hover:bg-slate-800/60 text-slate-300'
              }`}
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
                {complete && (
                  <span className={`text-xs ${sev.accentText}`}>✓</span>
                )}
              </div>
              <div className="mt-1.5 ml-7 text-[11px] text-slate-500">
                {done}/{total} tasks
              </div>
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-800 text-[11px] text-slate-500">
        <div>NIST SP 800-61 aligned</div>
        <div className="mt-0.5">v0.2 · saved to browser</div>
      </div>
    </aside>
  );
}
