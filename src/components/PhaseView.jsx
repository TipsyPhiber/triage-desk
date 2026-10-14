import { useState } from 'react';
import { Check, CornerDownLeft, Info, NotebookPen } from 'lucide-react';
import { formatClock, formatElapsed } from '../lib/time.js';
import { IocExtractor } from './IocExtractor.jsx';
import { Kbd, labelCls } from './Modal.jsx';

export function PhaseView({
  phase, index, count, checks, checkedAt, note, startTime,
  onToggle, onNoteChange, onAppendNote, onQuickNote, onIocsExtracted,
  sev, phaseStatus, advisory, running,
}) {
  const done = (checks || []).filter(Boolean).length;
  const total = phase.tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const outOfPhase = phaseStatus === 'out-of-phase';

  const [quick, setQuick] = useState('');
  function submitQuick() {
    if (!quick.trim()) return;
    onQuickNote(quick);
    setQuick('');
  }

  return (
    <div className="max-w-[860px] mx-auto px-8 py-8">
      <div className="mb-7">
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">
          Phase {index + 1} of {count}
        </div>
        <div className="mt-1.5 flex items-end gap-4">
          <h2 className="text-[26px] font-semibold tracking-tight text-ink leading-tight">{phase.name}</h2>
          <span className="mb-1 text-sm tabular" style={{ color: sev.hex }}>{done} of {total} done</span>
        </div>
        <p className="mt-1.5 text-[14px] text-ink-2">{phase.description}</p>
        <div className="mt-4 h-1 w-full bg-line rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--color-ok)' : sev.hex }} />
        </div>
      </div>

      {outOfPhase && advisory && (
        <div className="mb-6 flex gap-3 px-4 py-3 rounded-xl border border-line-2 bg-surface text-[13px] text-ink-2">
          <Info size={16} className="text-ink-3 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-ink mb-0.5">Lifecycle advisory</div>
            {advisory}
          </div>
        </div>
      )}

      <section className="mb-8">
        <h3 className={`${labelCls} mb-2.5`}>Checklist</h3>
        <ul className="rounded-xl border border-line bg-surface divide-y divide-line overflow-hidden">
          {phase.tasks.map((task, i) => {
            const isChecked = !!checks?.[i];
            const at = checkedAt?.[i];
            return (
              <li key={i}>
                <button
                  role="checkbox"
                  aria-checked={isChecked}
                  onClick={() => onToggle(i)}
                  className={`group w-full text-left flex items-start gap-3.5 px-4 py-3 transition ${isChecked ? 'bg-surface-2/60' : 'hover:bg-surface-2'}`}
                >
                  <span
                    className={`mt-[1px] w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition ${isChecked ? 'border-transparent' : 'border-line-2 group-hover:border-ink-3'}`}
                    style={isChecked ? { background: sev.hex } : undefined}
                  >
                    {isChecked && <Check size={13} strokeWidth={3} className="text-canvas" />}
                  </span>
                  <span className={`flex-1 text-[14px] leading-relaxed ${isChecked ? 'text-ink-3 line-through decoration-ink-4' : 'text-ink'}`}>
                    {task}
                  </span>
                  {isChecked && at && (
                    <span className="shrink-0 text-right font-mono text-[11px] leading-tight text-ink-3 tabular mt-0.5">
                      {startTime && at >= startTime && <span className="block text-ink-2">T+{formatElapsed(at - startTime)}</span>}
                      <span className="block">{formatClock(at)}</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {total === 0 && <li className="px-4 py-6 text-sm text-ink-3 text-center">This playbook has no tasks for this phase.</li>}
        </ul>
      </section>

      {phase.stage !== 'pre-incident' && (
        <IocExtractor sev={sev} onAppend={onAppendNote} onExtracted={onIocsExtracted} />
      )}

      <section className="mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className={labelCls}>Quick note</h3>
          <span className="text-xs text-ink-3 flex items-center gap-1.5">
            Timestamped · {running ? 'logged to timeline' : 'added to notes'} · <Kbd>N</Kbd>
          </span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <NotebookPen size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
            <input
              id="quick-note"
              type="text"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitQuick(); }}
              placeholder="One-line observation (e.g. user confirmed the email landed in spam)"
              className="w-full bg-surface border border-line-2 rounded-lg pl-9 pr-3 py-2.5 text-sm text-ink placeholder-ink-4 outline-none focus:border-ink-3 transition"
            />
          </div>
          <button
            onClick={submitQuick}
            disabled={!quick.trim()}
            className="inline-flex items-center gap-2 px-4 rounded-lg text-sm font-semibold text-canvas disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 transition"
            style={{ background: sev.hex }}
          >
            Add <CornerDownLeft size={14} />
          </button>
        </div>
      </section>

      <section>
        <h3 className={`${labelCls} mb-2.5`}>Notes</h3>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          aria-label={`${phase.name} notes`}
          placeholder={`Observations, decisions, and evidence for ${phase.name.toLowerCase()}…`}
          rows={9}
          className="w-full bg-surface border border-line-2 rounded-xl p-4 text-[13px] leading-relaxed text-ink placeholder-ink-4 outline-none focus:border-ink-3 resize-y font-mono transition"
        />
      </section>
    </div>
  );
}
