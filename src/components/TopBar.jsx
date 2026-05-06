import { SEVERITIES } from '../data.js';
import { formatElapsed } from '../lib/time.js';

export function TopBar({
  severity, setSeverity, sev,
  incidentName, setIncidentName,
  running, startTime, endTime, elapsed,
  declareIncident, resolveIncident, resetIncident, exportReport,
  totals, eventCount, onToggleTimeline,
}) {
  const status =
    !startTime ? 'STANDBY'
    : running ? 'ACTIVE'
    : 'RESOLVED';

  const statusClass =
    !startTime ? 'bg-slate-700 text-slate-300'
    : running ? `${sev.accent} text-slate-950`
    : 'bg-emerald-500 text-slate-950';

  return (
    <header className={`border-b border-slate-800 bg-slate-900/40 backdrop-blur`}>
      <div className="px-6 py-4 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest ${statusClass}`}>
            {status}
          </span>
          <input
            value={incidentName}
            onChange={(e) => setIncidentName(e.target.value)}
            placeholder="Incident name (e.g. INC-2026-04-Phishing)"
            className="bg-transparent border-b border-slate-700 focus:border-slate-500 outline-none text-slate-100 placeholder-slate-600 text-sm w-72 py-1"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">Severity</span>
          <div className="flex bg-slate-800/60 rounded-lg p-0.5 border border-slate-700">
            {Object.keys(SEVERITIES).map((s) => {
              const isActive = s === severity;
              const sv = SEVERITIES[s];
              return (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    isActive ? `${sv.accent} text-slate-950` : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${sev.accentBorder} ${sev.accentSoft}`}>
          <div className={`w-2 h-2 rounded-full ${running ? sev.accent + ' animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Elapsed</span>
          <span className="font-mono text-lg text-slate-100 tabular-nums">
            {formatElapsed(elapsed)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!startTime && (
            <button
              onClick={declareIncident}
              className={`${sev.accent} text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition`}
            >
              Declare Incident
            </button>
          )}
          {running && (
            <button
              onClick={resolveIncident}
              className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition"
            >
              Mark Resolved
            </button>
          )}
          {startTime && (
            <button
              onClick={resetIncident}
              className="border border-slate-700 text-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-800 transition"
            >
              Reset
            </button>
          )}
          <button
            onClick={onToggleTimeline}
            className="border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition flex items-center gap-2"
          >
            Timeline
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${eventCount > 0 ? sev.accent + ' text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
              {eventCount}
            </span>
          </button>
          <button
            onClick={exportReport}
            className="border border-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
          >
            Export Report
          </button>
        </div>
      </div>

      <div className="px-6 pb-3 flex items-center gap-4 text-[11px] text-slate-500">
        <span>Tasks complete: <span className="text-slate-300 font-medium">{totals.done}/{totals.total}</span></span>
        {startTime && (
          <span>
            Declared: <span className="text-slate-300 font-medium">{new Date(startTime).toLocaleString()}</span>
          </span>
        )}
        {endTime && (
          <span>
            Resolved: <span className="text-slate-300 font-medium">{new Date(endTime).toLocaleString()}</span>
          </span>
        )}
      </div>
    </header>
  );
}
