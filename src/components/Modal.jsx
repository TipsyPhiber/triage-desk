// Shared UI primitives. Every screen builds from these so spacing, color,
// and interaction states stay consistent.

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export const btn = {
  primary: 'inline-flex items-center justify-center gap-2 bg-signal text-signal-ink px-3.5 py-2 rounded-lg text-sm font-semibold hover:brightness-110 active:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed',
  solid: 'inline-flex items-center justify-center gap-2 bg-ink text-canvas px-3.5 py-2 rounded-lg text-sm font-semibold hover:bg-white transition disabled:opacity-40 disabled:cursor-not-allowed',
  secondary: 'inline-flex items-center justify-center gap-2 bg-raised border border-line-2 text-ink px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-hover hover:border-ink-4 transition disabled:opacity-40 disabled:cursor-not-allowed',
  ghost: 'inline-flex items-center justify-center gap-2 text-ink-2 px-3 py-2 rounded-lg text-sm hover:bg-hover hover:text-ink transition disabled:opacity-40',
  danger: 'inline-flex items-center justify-center gap-2 border border-rose-500/30 text-rose-300 px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-rose-500/10 transition',
  pro: 'inline-flex items-center justify-center gap-2 bg-pro text-[#160b33] px-3.5 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition',
  ok: 'inline-flex items-center justify-center gap-2 bg-ok text-[#04150c] px-3.5 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition',
};

export const inputCls = 'w-full bg-canvas border border-line-2 rounded-lg px-3 py-2 text-sm text-ink placeholder-ink-4 outline-none focus:border-ink-3 focus:ring-2 focus:ring-white/5 transition';

export const labelCls = 'text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3';

export function Modal({ title, subtitle, icon: Icon, onClose, children, footer, wide = false }) {
  const panel = useRef(null);
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    const prev = document.activeElement;
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
    return () => prev?.focus?.();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-10 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`anim-in relative w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} bg-surface-2 border border-line-2 rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] flex flex-col max-h-[calc(100vh-5rem)] outline-none`}
      >
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {Icon && (
              <div className="mt-0.5 w-9 h-9 rounded-lg bg-raised border border-line-2 flex items-center justify-center shrink-0">
                <Icon size={17} className="text-ink-2" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
              {subtitle && <p className="text-[13px] text-ink-3 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink w-8 h-8 flex items-center justify-center rounded-lg hover:bg-hover shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-line flex justify-end gap-2 bg-surface rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

export function ProBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-bold tracking-[0.1em] px-1.5 py-[3px] leading-none rounded-md bg-pro/15 text-pro ring-1 ring-inset ring-pro/30 ${className}`}>
      PRO
    </span>
  );
}

export function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md border border-line-2 bg-raised text-[10.5px] font-mono text-ink-2 leading-none">
      {children}
    </kbd>
  );
}

export function Segmented({ options, value, onChange, renderOption, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex bg-canvas border border-line-2 rounded-lg p-0.5">
      {options.map((o) => {
        const active = o === value;
        return (
          <button
            key={o}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${active ? 'bg-raised text-ink shadow-sm ring-1 ring-line-2' : 'text-ink-3 hover:text-ink'}`}
          >
            {renderOption ? renderOption(o, active) : o}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="text-xs text-ink-3 mt-1.5 block">{hint}</span>}
    </label>
  );
}

export function Card({ className = '', children }) {
  return <div className={`bg-surface border border-line rounded-xl ${className}`}>{children}</div>;
}

export function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#13161a" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#2a2f36" />
      <path d="M7 17h4l2.5-6 4 11 2.5-5H25" fill="none" stroke="#ffb224" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
