// Saved Splunk searches for a phase: fill placeholders, copy, or (in the
// Connected edition) run them against the analyst's Splunk.

import { useMemo, useState } from 'react';
import { Check, Copy, Play } from 'lucide-react';
import { fillPlaceholders, placeholdersIn } from '../lib/splunk.js';
import { copyText } from '../lib/clipboard.js';
import { labelCls } from './Modal.jsx';

export function SplunkMark({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <rect width="16" height="16" rx="4" fill="#65a637" />
      <path d="M5 4.5 11 8l-6 3.5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SplCode({ spl }) {
  // Highlight <placeholders> so analysts see what to fill in.
  const parts = spl.split(/(<[a-z][a-z0-9_]{1,40}>)/gi);
  return (
    <code className="block whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-ink-2">
      {parts.map((p, i) => (/^<[a-z]/i.test(p)
        ? <mark key={i} className="bg-signal-soft text-signal rounded px-0.5">{p}</mark>
        : <span key={i}>{p}</span>))}
    </code>
  );
}

export function SearchCard({ search, onCopied, onRun, defaults = {} }) {
  const holes = useMemo(() => placeholdersIn(search.spl), [search.spl]);
  const [values, setValues] = useState(() => Object.fromEntries(holes.map((h) => [h, defaults[h] || ''])));
  const [copied, setCopied] = useState(false);
  const spl = fillPlaceholders(search.spl, values);
  async function copy() {
    await copyText(spl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
    onCopied?.('Search copied, paste it into Splunk');
  }
  return (
    <div className="rounded-xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-line">
        <SplunkMark />
        <span className="text-[13px] font-medium text-ink truncate">{search.title}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {onRun && (
            <button onClick={() => onRun(spl, search.title)} className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-md bg-signal text-signal-ink hover:brightness-110">
              <Play size={12} /> Run
            </button>
          )}
          <button onClick={copy} aria-label={`Copy search: ${search.title}`} className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-md border border-line-2 text-ink-2 hover:text-ink hover:bg-hover">
            {copied ? <Check size={12} className="text-ok" /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </span>
      </div>
      {holes.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {holes.map((h) => (
            <label key={h} className="flex items-center gap-1.5 text-[11px] text-ink-3">
              <span className="font-mono">{h}</span>
              <input
                value={values[h] || ''}
                onChange={(e) => setValues((v) => ({ ...v, [h]: e.target.value }))}
                placeholder="value"
                aria-label={`Value for ${h}`}
                className="w-36 bg-canvas border border-line-2 rounded-md px-2 py-1 text-[12px] text-ink font-mono outline-none focus:border-signal"
              />
            </label>
          ))}
        </div>
      )}
      <div className="px-4 py-3"><SplCode spl={spl} /></div>
    </div>
  );
}

export function SplunkSearches({ searches, onCopied, onRun, defaults, title = 'Splunk searches' }) {
  if (!searches?.length) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className={labelCls}>{title}</h3>
        <span className="text-xs text-ink-3">Fill the highlighted values, then {onRun ? 'run or copy' : 'copy into Splunk'}</span>
      </div>
      <div className="space-y-2.5">
        {searches.map((s, i) => <SearchCard key={`${i}:${s.title}`} search={s} onCopied={onCopied} onRun={onRun} defaults={defaults} />)}
      </div>
    </section>
  );
}
