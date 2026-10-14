import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Clock3, FileCheck2, Radar, Search, ShieldAlert, ShieldCheck, Upload } from 'lucide-react';
import { canUsePlaybook, EDITION } from '../license/entitlements.js';
import { LIBRARY_CATEGORIES } from '../playbooks/library.js';
import { searchPlaybooks } from '../lib/playbookSearch.js';
import { btn, Kbd, Logo, ProBadge } from './Modal.jsx';
import { SplunkMark } from './SplunkSearches.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';

const STEPS = [
  { icon: Search, title: 'Describe it', body: 'Type what you’re seeing. Triage Desk finds the closest scenario playbook.' },
  { icon: Clock3, title: 'Declare it', body: 'The clock starts and every action lands on a T+ timeline automatically.' },
  { icon: Radar, title: 'Work the checklist', body: 'Tick tasks, run the included Splunk searches, extract IOCs from logs.' },
  { icon: FileCheck2, title: 'Hand it off', body: 'Export a TLP-marked report your leadership and auditors can read.' },
];

const PROMPTS = ['A user entered their password on a phishing page', 'Files on the file server are being renamed', 'AWS access key posted on GitHub', 'Impossible travel sign-in for an admin', 'Our website is down under a flood of traffic'];

export function Welcome({ ent, playbooks, onQuickStart, onNew, onSearch, onPick, onImport, onOpenSettings }) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => (q.trim() ? searchPlaybooks(playbooks, q, { limit: 5 }) : []), [q, playbooks]);
  const searchCount = playbooks.reduce((n, p) => n + (p.splunk?.length || 0), 0);

  return (
    <div className="min-h-screen bg-canvas text-ink relative overflow-x-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 w-[1100px] h-[620px] rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, var(--td-glow), transparent)' }} />

      <header className="relative max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">
        <Logo size={28} />
        <span className="text-[15px] font-semibold tracking-tight">Triage Desk</span>
        {ent.pro && <ProBadge />}
        {EDITION === 'connected' && <span className="text-[10px] font-bold tracking-[0.1em] px-1.5 py-[3px] rounded-md bg-ok/10 text-ok ring-1 ring-inset ring-ok/30">CONNECTED</span>}
        <span className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <button className={btn.ghost} onClick={onOpenSettings}><Upload size={14} /> Restore a backup…</button>
        </span>
      </header>

      <main className="relative max-w-3xl mx-auto px-6 pt-14 pb-20">
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 text-[12px] text-ink-2 px-3 py-1 rounded-full border border-line bg-surface shadow-card">
            <ShieldCheck size={13} className="text-ok" />
            {EDITION === 'connected' ? 'Runs locally · connects only to your Splunk' : 'Runs 100% offline · nothing leaves this machine'}
          </span>
        </div>
        <h1 className="mt-6 text-center text-[40px] sm:text-[54px] leading-[1.04] font-semibold tracking-[-0.035em]">
          What’s happening?
        </h1>
        <p className="mt-4 text-center text-[17px] text-ink-2 max-w-xl mx-auto leading-relaxed">
          Describe the incident in plain words. We’ll hand you a step-by-step response plan, with Splunk searches included.
        </p>

        <form
          className="mt-8 relative"
          onSubmit={(e) => { e.preventDefault(); onSearch(q); }}
        >
          <div className="relative rounded-2xl bg-surface border border-line-2 shadow-pop focus-within:border-signal focus-within:ring-4 focus-within:ring-signal/10 transition">
            <Search size={18} className="absolute left-4 top-[22px] text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Describe what's happening"
              placeholder="e.g. user clicked a link and entered their password"
              className="w-full bg-transparent pl-12 pr-36 py-4 text-[16px] text-ink placeholder-ink-4 outline-none"
            />
            <button type="submit" className={`${btn.primary} absolute right-2 top-2 py-2.5`}>
              Find playbook <ArrowRight size={15} />
            </button>
            {hits.length > 0 && (
              <ul className="border-t border-line p-1.5" aria-label="Suggested playbooks">
                {hits.map((pb) => (
                  <li key={pb.id}>
                    <button type="button" onClick={() => onPick(pb.id, q)} className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-hover">
                      <ShieldAlert size={15} className="text-signal shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-medium text-ink truncate">{pb.name}</span>
                        <span className="block text-[12px] text-ink-3 truncate">{pb.categoryName} · {pb.description}</span>
                      </span>
                      {!canUsePlaybook(pb, ent) && <ProBadge className="ml-auto shrink-0" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </form>
        {!q && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {PROMPTS.map((p) => (
              <button key={p} onClick={() => setQ(p)} className="text-[12.5px] px-3 py-1.5 rounded-full border border-line bg-surface text-ink-2 hover:text-ink hover:border-line-2 transition">{p}</button>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <button className={btn.secondary} onClick={onNew}><BookOpen size={15} /> Start an incident</button>
          <button className={btn.secondary} onClick={onImport}><SplunkMark size={14} /> Import a Splunk alert</button>
          <button className={btn.ghost} onClick={onQuickStart}>Quick start (General playbook)</button>
        </div>
        <p className="mt-4 text-center text-xs text-ink-3 flex items-center justify-center gap-1.5">
          <Kbd>Ctrl</Kbd><Kbd>K</Kbd> opens the command palette anywhere. <Kbd>?</Kbd> lists shortcuts.
        </p>

        <div className="mt-14 grid grid-cols-3 gap-3 text-center">
          {[[playbooks.length, 'scenario playbooks'], [LIBRARY_CATEGORIES.length + 1, 'categories'], [searchCount, 'Splunk searches']].map(([n, l]) => (
            <div key={l} className="py-4 rounded-xl border border-line bg-surface shadow-card">
              <div className="text-[26px] font-semibold tracking-tight tabular">{n.toLocaleString()}</div>
              <div className="text-[12px] text-ink-3">{l}</div>
            </div>
          ))}
        </div>

        <section className="mt-14">
          <h2 className="text-center text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">How it works</h2>
          <ol className="mt-5 grid sm:grid-cols-2 gap-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="p-5 rounded-xl border border-line bg-surface shadow-card flex gap-4">
                <span className="w-9 h-9 rounded-lg bg-signal-soft text-signal flex items-center justify-center shrink-0 font-semibold text-sm">{i + 1}</span>
                <span>
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-ink"><Icon size={14} className="text-ink-3" />{title}</span>
                  <span className="block mt-1 text-[13px] text-ink-2 leading-relaxed">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
