// Right-hand panel: the auto-recorded timeline and the incident-wide IOC
// index. Static column on wide screens, overlay drawer on narrow ones.

import { useMemo, useState } from 'react';
import {
  ArrowRightLeft, CheckSquare, ClipboardCopy, Flag, Gauge, MessageSquareText,
  Radar, ShieldCheck, Square, X,
} from 'lucide-react';
import { PHASES } from '../data.js';
import { aggregateIocs } from '../state/iocIndex.js';
import { formatClock, formatElapsed } from '../lib/time.js';
import { IOC_KIND_STYLES } from '../styles/eventStyles.js';

const EVENT_META = {
  declare: { icon: Flag, color: '#f43f5e', label: 'Declared' },
  resolve: { icon: ShieldCheck, color: '#3dd68c', label: 'Resolved' },
  severity: { icon: Gauge, color: '#f59e0b', label: 'Severity' },
  phase: { icon: ArrowRightLeft, color: '#38bdf8', label: 'Phase' },
  check: { icon: CheckSquare, color: '#3dd68c', label: 'Task' },
  uncheck: { icon: Square, color: '#6e7681', label: 'Task' },
  ioc: { icon: Radar, color: '#c084fc', label: 'IOCs' },
  note: { icon: MessageSquareText, color: '#818cf8', label: 'Note' },
};

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers that block the async clipboard on file://.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

function Timeline({ events, startTime }) {
  const reversed = useMemo(() => [...events].reverse(), [events]);
  if (events.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <Flag size={20} className="mx-auto text-ink-4" />
        <p className="mt-3 text-[13px] text-ink-2 font-medium">No events yet</p>
        <p className="mt-1 text-xs text-ink-3 leading-relaxed">
          Declare the incident and every task, phase change, severity change, and note is timestamped here automatically.
        </p>
      </div>
    );
  }
  return (
    <ol className="px-4 py-4">
      {reversed.map((ev, i) => {
        const meta = EVENT_META[ev.type] ?? EVENT_META.note;
        const Icon = meta.icon;
        const last = i === reversed.length - 1;
        return (
          <li key={ev.id} className="relative flex gap-3 pb-4">
            {!last && <span className="absolute left-[13px] top-7 bottom-0 w-px bg-line" />}
            <span className="relative w-[27px] h-[27px] rounded-lg bg-raised border border-line-2 flex items-center justify-center shrink-0">
              <Icon size={13} style={{ color: meta.color }} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline gap-2 text-[11px]">
                <span className="font-medium text-ink-3 uppercase tracking-[0.08em]">{meta.label}</span>
                <span className="font-mono text-ink-2 tabular">T+{startTime ? formatElapsed(ev.ts - startTime) : '--:--:--'}</span>
                <span className="ml-auto font-mono text-ink-4 tabular">{formatClock(ev.ts)}</span>
              </div>
              <div className="text-[13px] text-ink mt-0.5 break-words leading-snug">{ev.message}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function IocIndex({ iocIndex, onCopied }) {
  const groups = useMemo(() => {
    const agg = aggregateIocs(iocIndex, PHASES);
    const out = {};
    for (const e of agg.values()) (out[e.kind] ||= []).push(e);
    return Object.keys(out).sort().map((kind) => ({ kind, items: out[kind].sort((a, b) => a.value.localeCompare(b.value)) }));
  }, [iocIndex]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  async function copy(text, what) {
    if (await copyText(text)) onCopied(`Copied ${what}`);
  }

  if (total === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <Radar size={20} className="mx-auto text-ink-4" />
        <p className="mt-3 text-[13px] text-ink-2 font-medium">No indicators yet</p>
        <p className="mt-1 text-xs text-ink-3 leading-relaxed">
          Run the IOC extractor in any response phase. Indicators are deduplicated here across the whole incident.
        </p>
      </div>
    );
  }
  return (
    <div className="px-4 py-4 space-y-5">
      <button
        onClick={() => copy(groups.flatMap((g) => g.items.map((i) => i.value)).join('\n'), `${total} indicators`)}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-line-2 bg-raised text-[13px] text-ink hover:bg-hover transition"
      >
        <ClipboardCopy size={14} /> Copy all {total} as a list
      </button>
      {groups.map((g) => (
        <section key={g.kind}>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{g.kind} <span className="text-ink-4 tabular">· {g.items.length}</span></h4>
            <button onClick={() => copy(g.items.map((i) => i.value).join('\n'), `${g.items.length} ${g.kind}`)} className="text-[11px] text-ink-3 hover:text-ink">
              Copy
            </button>
          </div>
          <ul className="space-y-1">
            {g.items.map((i) => (
              <li key={i.value}>
                <button
                  onClick={() => copy(i.value, i.value)}
                  title="Click to copy"
                  className={`w-full text-left text-[11.5px] font-mono px-2 py-1.5 rounded-md border break-all transition hover:brightness-125 ${IOC_KIND_STYLES[g.kind] ?? 'border-line-2 bg-raised text-ink-2'}`}
                >
                  {i.value}
                  <span className="block mt-0.5 text-[10px] font-sans opacity-60">{[...i.phases].join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function IntelPanel({ open, onClose, tab, onTab, incident, onCopied }) {
  if (!open) return null;
  const iocCount = aggregateIocs(incident.iocIndex, PHASES).size;
  const tabs = [
    { id: 'timeline', label: 'Timeline', count: incident.events.length },
    { id: 'iocs', label: 'IOCs', count: iocCount },
  ];
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/50 xl:hidden" onClick={onClose} />
      <aside
        aria-label="Incident intel"
        className="anim-in fixed right-0 inset-y-0 z-40 w-[360px] max-w-[90vw] xl:static xl:z-auto xl:w-[340px] shrink-0 border-l border-line bg-surface flex flex-col min-h-0"
      >
        <div className="h-14 px-3 flex items-center gap-1 border-b border-line">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              aria-pressed={tab === t.id}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-2 transition ${tab === t.id ? 'bg-raised text-ink ring-1 ring-line-2' : 'text-ink-3 hover:text-ink'}`}
            >
              {t.label}
              <span className="tabular text-[11px] text-ink-3">{t.count}</span>
            </button>
          ))}
          <button onClick={onClose} aria-label="Close timeline" className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink hover:bg-hover">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === 'timeline'
            ? <Timeline events={incident.events} startTime={incident.startTime} />
            : <IocIndex iocIndex={incident.iocIndex} onCopied={onCopied} />}
        </div>
      </aside>
    </>
  );
}
