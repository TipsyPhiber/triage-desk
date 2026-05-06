import { IocExtractor } from './IocExtractor.jsx';

export function PhaseView({ phase, checks, note, onToggle, onNoteChange, onAppendNote, onIocsExtracted, sev }) {
  const done = (checks || []).filter(Boolean).length;
  const total = phase.tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-2">
          <h2 className="text-2xl font-semibold text-slate-100">{phase.name}</h2>
          <span className={`text-sm ${sev.accentText}`}>{done} / {total} complete</span>
        </div>
        <p className="text-sm text-slate-400">{phase.description}</p>

        <div className="mt-4 h-1.5 w-full bg-slate-800 rounded overflow-hidden">
          <div
            className={`h-full ${sev.accent} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <section className="mb-8">
        <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">Checklist</h3>
        <ul className="space-y-1.5">
          {phase.tasks.map((task, i) => {
            const isChecked = !!checks?.[i];
            return (
              <li key={i}>
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    isChecked
                      ? `${sev.accentSoft} ${sev.accentBorder}`
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggle(i)}
                    className={`mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 ${sev.accentText} focus:ring-0 focus:ring-offset-0 accent-current`}
                  />
                  <span className={`text-sm leading-relaxed ${isChecked ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                    {task}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <IocExtractor sev={sev} onAppend={onAppendNote} onExtracted={onIocsExtracted} />

      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">Notes</h3>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={`Capture observations, IOCs, decisions, or timestamps for the ${phase.name.toLowerCase()} phase...`}
          rows={8}
          className="w-full bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-slate-600 resize-y font-mono"
        />
      </section>
    </div>
  );
}
