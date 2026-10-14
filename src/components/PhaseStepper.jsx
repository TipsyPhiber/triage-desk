// Horizontal six-phase track. Each step shows completion as a ring and is
// locked or dimmed according to the incident lifecycle.

import { Check, Lock } from 'lucide-react';
import { phaseActivity, phaseLocked } from '../lib/phaseActivity.js';

const STAGE_LABEL = { 'pre-incident': 'Before', response: 'Response', 'post-incident': 'After' };

function Ring({ pct, color, size = 26, children }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line-2)" strokeWidth="2" />
        {pct > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset .3s ease' }}
          />
        )}
      </svg>
      <span className="relative text-[11px] font-mono font-medium">{children}</span>
    </span>
  );
}

export function PhaseStepper({ phases, incident, lifecycle, sev, onSelect }) {
  return (
    <nav aria-label="Phases" className="px-5 py-2.5 border-b border-line bg-canvas">
      <ol className="flex items-stretch gap-1">
        {phases.map((p, idx) => {
          const arr = incident.checks[p.id] || [];
          const done = arr.filter(Boolean).length;
          const total = arr.length;
          const pct = total ? done / total : 0;
          const complete = total > 0 && done === total;
          const isActive = p.id === incident.activePhase;
          const locked = phaseLocked(p.stage, lifecycle);
          const outOfPhase = phaseActivity(p.stage, lifecycle) === 'out-of-phase';
          const firstOfStage = idx === 0 || phases[idx - 1].stage !== p.stage;
          return (
            <li key={p.id} className={`min-w-0 flex-auto ${firstOfStage && idx > 0 ? 'ml-2 pl-2 border-l border-line' : ''}`}>
              <div className="h-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-4 mb-1 truncate">
                {firstOfStage ? STAGE_LABEL[p.stage] : ''}
              </div>
              <button
                onClick={() => { if (!locked) onSelect(p.id); }}
                disabled={locked}
                aria-current={isActive ? 'step' : undefined}
                title={locked ? 'Locked for the current incident lifecycle' : outOfPhase ? 'Out of phase for the current lifecycle' : undefined}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition border ${
                  isActive
                    ? 'bg-surface-2 border-line-2 shadow-[inset_0_-2px_0_0_var(--sev)]'
                    : `border-transparent ${locked ? 'cursor-not-allowed opacity-45' : 'hover:bg-surface'} ${outOfPhase && !locked ? 'opacity-60' : ''}`
                }`}
                style={{ '--sev': sev.hex }}
              >
                <Ring pct={pct} color={complete ? 'var(--color-ok)' : sev.hex}>
                  {locked ? <Lock size={12} className="text-ink-3" /> : complete ? <Check size={14} className="text-ok" /> : <span className={isActive ? 'text-ink' : 'text-ink-3'}>{idx + 1}</span>}
                </Ring>
                <span className="min-w-0">
                  <span className={`block text-[12.5px] font-medium truncate ${isActive ? 'text-ink' : 'text-ink-2'}`}>{p.name}</span>
                  <span className="block text-[11px] text-ink-3 tabular truncate">
                    {locked ? 'Locked' : `${done}/${total}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
