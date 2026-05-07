import { useMemo } from 'react';
import { formatElapsed } from '../lib/time.js';
import { EVENT_STYLES } from '../styles/eventStyles.js';

export function TimelineDrawer({ open, onClose, events, startTime }) {
  const reversed = useMemo(() => [...events].reverse(), [events]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 right-0 h-full w-96 bg-slate-900 border-l border-slate-800 z-50 transform transition-transform duration-200 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Incident Timeline</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {events.length} event{events.length === 1 ? '' : 's'} · auto-recorded while incident is active
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-lg leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800"
            aria-label="Close timeline"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {events.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-12 px-4">
              No events yet. Once you declare an incident, every checklist toggle, phase switch, and severity change is recorded here with a timestamp.
            </div>
          ) : (
            <ol className="space-y-3">
              {reversed.map((ev) => {
                const style = EVENT_STYLES[ev.type] ?? { dot: 'bg-slate-500', label: ev.type.toUpperCase() };
                const rel = startTime ? formatElapsed(ev.ts - startTime) : '--:--:--';
                const abs = new Date(ev.ts).toLocaleTimeString();
                return (
                  <li key={ev.id} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                      <div className="flex-1 w-px bg-slate-800 mt-1" />
                    </div>
                    <div className="flex-1 pb-2 min-w-0">
                      <div className="flex items-baseline gap-2 text-[11px] uppercase tracking-wider">
                        <span className="text-slate-500">{style.label}</span>
                        <span className="font-mono text-slate-400">T+{rel}</span>
                        <span className="text-slate-600 ml-auto">{abs}</span>
                      </div>
                      <div className="text-sm text-slate-200 mt-0.5 break-words">
                        {ev.message}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </>
  );
}
