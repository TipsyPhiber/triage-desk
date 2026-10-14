// Command bar: incident identity, the clock, the primary lifecycle action,
// severity / TLP, and secondary actions.

import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2, ChevronDown, Download, FileCode2, FileText, FileType2,
  MoreHorizontal, PanelRight, RotateCcw, Siren, Trash2,
} from 'lucide-react';
import { SEVERITIES, TLP_LEVELS } from '../data.js';
import { formatElapsed } from '../lib/time.js';
import { REPORT_FORMATS } from '../lib/exportReport.js';
import { btn, Kbd, ProBadge } from './Modal.jsx';

const FORMAT_ICONS = { txt: FileText, md: FileType2, html: FileCode2 };

const TLP_STYLES = {
  'TLP:CLEAR': 'text-ink ring-ink-3/40',
  'TLP:GREEN': 'text-[#33ff00] ring-[#33ff00]/30',
  'TLP:AMBER': 'text-[#ffc000] ring-[#ffc000]/30',
  'TLP:AMBER+STRICT': 'text-[#ffc000] ring-[#ffc000]/30',
  'TLP:RED': 'text-[#ff2b2b] ring-[#ff2b2b]/30',
};

function useDismiss(open, setOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open, setOpen]);
  return ref;
}

function Menu({ trigger, children, align = 'right', width = 'w-64' }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="menu"
          className={`anim-in absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 ${width} z-30 rounded-xl border border-line-2 bg-surface-2 shadow-[0_20px_50px_-15px_rgba(0,0,0,.8)] p-1`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger, right }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full text-left px-2.5 py-2 rounded-lg text-[13px] flex items-center gap-2.5 transition ${danger ? 'text-rose-300 hover:bg-rose-500/10' : 'text-ink-2 hover:text-ink hover:bg-hover'}`}
    >
      {Icon && <Icon size={15} className={danger ? '' : 'text-ink-3'} />}
      {children}
      {right && <span className="ml-auto">{right}</span>}
    </button>
  );
}

const STATUS = {
  idle: { label: 'Standby', cls: 'text-ink-2 bg-raised ring-line-2' },
  active: { label: 'Active', cls: '' },
  resolved: { label: 'Resolved', cls: 'text-ok bg-ok/10 ring-ok/30' },
};

export function TopBar({
  incident, sev, lifecycle, elapsed, ent, totals,
  onRename, onSeverity, onTlp, onDeclare, onResolve, onReset, onDelete, onExport,
  intelOpen, onToggleIntel, eventCount,
}) {
  const status = STATUS[lifecycle];
  const running = lifecycle === 'active';

  return (
    <header className="border-b border-line bg-surface">
      <div className="px-6 pt-3 flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md text-[11px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset shrink-0 ${status.cls}`}
          style={running ? { color: sev.hex, background: `${sev.hex}1a`, '--tw-ring-color': `${sev.hex}55` } : undefined}
        >
          {running && <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: sev.hex, color: sev.hex }} />}
          {status.label}
        </span>
        <span className="text-xs text-ink-3 truncate min-w-0">
          {incident.playbookName}
          {incident.startTime && <> · Declared <span className="text-ink-2 tabular">{new Date(incident.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></>}
        </span>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="flex items-baseline gap-2 mr-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-3">
              {lifecycle === 'resolved' ? 'Time to resolve' : 'Elapsed'}
            </span>
            <span className="font-mono text-[22px] leading-none font-medium tabular text-ink" style={running ? { color: sev.hex } : undefined}>
              {formatElapsed(elapsed)}
            </span>
          </div>

          {lifecycle === 'idle' && (
            <button onClick={onDeclare} className={btn.primary}>
              <Siren size={16} /> Declare Incident
            </button>
          )}
          {running && (
            <button onClick={onResolve} className={btn.ok}>
              <CheckCircle2 size={16} /> Mark Resolved
            </button>
          )}

          <Menu
            trigger={({ toggle }) => (
              <button onClick={toggle} className={btn.secondary} aria-label="Export Report">
                <Download size={15} /> <span className="hidden 2xl:inline">Export Report</span><span className="2xl:hidden">Export</span> <ChevronDown size={14} className="text-ink-3" />
              </button>
            )}
          >
            <div className="px-2.5 pt-1.5 pb-1 text-[11px] uppercase tracking-[0.08em] text-ink-4">Marked {incident.tlp}</div>
            {Object.entries(REPORT_FORMATS).map(([id, f]) => (
              <MenuItem key={id} icon={FORMAT_ICONS[id]} onClick={() => onExport(id)} right={f.pro && !ent.pro ? <ProBadge /> : null}>
                {f.label}
              </MenuItem>
            ))}
          </Menu>

          <Menu
            trigger={({ toggle }) => (
              <button onClick={toggle} aria-label="More actions" className={`${btn.secondary} px-2.5`}>
                <MoreHorizontal size={16} />
              </button>
            )}
            width="w-60"
          >
            {lifecycle !== 'idle' && <MenuItem icon={RotateCcw} onClick={onReset}>Reset incident</MenuItem>}
            <MenuItem icon={Trash2} onClick={onDelete} danger>Delete incident</MenuItem>
          </Menu>
        </div>
      </div>

      <div className="px-6 pt-1.5">
        <input
          value={incident.name}
          onChange={(e) => onRename(e.target.value)}
          placeholder="Name this incident (e.g. INC-2026-0142 Finance phishing)"
          aria-label="Incident name"
          className="w-full bg-transparent outline-none text-[21px] font-semibold tracking-tight text-ink placeholder-ink-4 rounded-md -mx-1.5 px-1.5 py-0.5 hover:bg-surface-2 focus:bg-surface-2 transition"
        />
      </div>

      <div className="px-6 pt-2 pb-3 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-ink-3">Severity</span>
          <div role="radiogroup" aria-label="Severity" className="inline-flex bg-canvas border border-line-2 rounded-lg p-0.5">
            {Object.keys(SEVERITIES).map((s) => {
              const active = s === incident.severity;
              const sv = SEVERITIES[s];
              return (
                <button
                  key={s}
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSeverity(s)}
                  className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition ${active ? 'bg-raised text-ink ring-1 ring-line-2' : 'text-ink-3 hover:text-ink'}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sv.hex, opacity: active ? 1 : 0.6 }} />
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2">
          <span className="text-ink-3">Marking</span>
          <select
            value={incident.tlp}
            onChange={(e) => onTlp(e.target.value)}
            title={TLP_LEVELS[incident.tlp]}
            aria-label="TLP marking"
            className={`bg-canvas rounded-lg pl-2 pr-1 py-1 font-semibold font-mono text-[11.5px] outline-none ring-1 ring-inset cursor-pointer ${TLP_STYLES[incident.tlp]}`}
          >
            {Object.keys(TLP_LEVELS).map((t) => <option key={t} value={t} className="bg-surface text-ink">{t}</option>)}
          </select>
        </label>

        <span className="text-ink-3 hidden lg:inline">
          Tasks <span className="text-ink-2 font-medium tabular">{totals.done}/{totals.total}</span>
        </span>

        <button
          onClick={onToggleIntel}
          aria-pressed={intelOpen}
          className={`ml-auto inline-flex items-center gap-2 px-2.5 py-1 rounded-md transition ${intelOpen ? 'text-ink bg-raised ring-1 ring-line-2' : 'text-ink-3 hover:text-ink'}`}
        >
          <PanelRight size={14} /> Timeline
          <span className="tabular text-[11px] px-1.5 rounded bg-canvas ring-1 ring-line-2">{eventCount}</span>
          <Kbd>T</Kbd>
        </button>
      </div>
    </header>
  );
}
