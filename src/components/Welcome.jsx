import { ArrowRight, Clock3, FileCheck2, Radar, ShieldCheck, Upload, Zap } from 'lucide-react';
import { btn, Kbd, Logo, ProBadge } from './Modal.jsx';

const POINTS = [
  { icon: Zap, title: 'Structured from minute one', body: 'Scenario playbooks walk responders through NIST SP 800-61 — phases lock and unlock with the incident lifecycle.' },
  { icon: Clock3, title: 'Evidence that writes itself', body: 'Every task, phase change, severity bump and note lands on a T+ timeline. The post-incident review starts pre-written.' },
  { icon: Radar, title: 'IOC extraction built in', body: 'Paste logs or phishing emails. A Rust/WebAssembly engine pulls and refangs IPs, domains, URLs, hashes, emails and CVEs.' },
  { icon: FileCheck2, title: 'Reports leadership can read', body: 'Export TLP-marked text, Markdown, or a print-ready report with your organization’s name on it.' },
];

export function Welcome({ ent, onQuickStart, onNew, onOpenSettings }) {
  return (
    <div className="min-h-screen bg-canvas text-ink relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)',
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(closest-side, #ffb224, transparent)' }} />

      <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16">
        <div className="flex items-center gap-3">
          <Logo size={34} />
          <span className="text-lg font-semibold tracking-tight">Triage Desk</span>
          {ent.pro && <ProBadge />}
        </div>

        <h1 className="mt-10 text-[40px] sm:text-[48px] leading-[1.05] font-semibold tracking-[-0.03em] max-w-3xl">
          Run the incident.<br />
          <span className="text-ink-3">Not the spreadsheet.</span>
        </h1>
        <p className="mt-5 text-[17px] text-ink-2 max-w-2xl leading-relaxed">
          An offline incident response workspace for SOC analysts and on-call engineers.
          Playbooks, a live timeline, IOC extraction, and reports — in one file that never touches the network.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button className={`${btn.primary} px-5 py-3 text-[15px]`} onClick={onNew}>
            Start an incident <ArrowRight size={16} />
          </button>
          <button className={`${btn.secondary} px-5 py-3 text-[15px]`} onClick={onQuickStart}>
            Quick start (General playbook)
          </button>
          <button className={`${btn.ghost} px-4 py-3`} onClick={onOpenSettings}>
            <Upload size={15} /> Restore a backup…
          </button>
        </div>
        <p className="mt-4 text-xs text-ink-3 flex items-center gap-2">
          Press <Kbd>C</Kbd> any time to start a new incident, <Kbd>?</Kbd> for shortcuts.
        </p>

        <div className="mt-14 grid sm:grid-cols-2 gap-3">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="p-5 rounded-xl border border-line bg-surface/80 backdrop-blur">
              <div className="w-9 h-9 rounded-lg bg-raised border border-line-2 flex items-center justify-center">
                <Icon size={16} className="text-signal" />
              </div>
              <div className="mt-3.5 text-[14px] font-semibold text-ink">{title}</div>
              <div className="mt-1 text-[13px] text-ink-2 leading-relaxed">{body}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-2.5 text-[13px] text-ink-3">
          <ShieldCheck size={16} className="text-ok" />
          Nothing leaves this machine: no accounts, no telemetry, no server. A strict security policy blocks all network access.
        </div>
      </div>
    </div>
  );
}
