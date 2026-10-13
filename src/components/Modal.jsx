import { useEffect } from 'react';

export function Modal({ title, subtitle, onClose, children, footer, wide = false }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-10 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[calc(100vh-5rem)]`}
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-lg leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800 shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-slate-800 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ProBadge({ className = '' }) {
  return (
    <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40 ${className}`}>
      PRO
    </span>
  );
}

export const btn = {
  primary: 'bg-slate-100 text-slate-900 px-3 py-1.5 rounded-md text-sm font-semibold hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed',
  secondary: 'border border-slate-700 text-slate-200 px-3 py-1.5 rounded-md text-sm hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed',
  danger: 'border border-rose-500/40 text-rose-300 px-3 py-1.5 rounded-md text-sm hover:bg-rose-500/10 transition',
  pro: 'bg-violet-500 text-white px-3 py-1.5 rounded-md text-sm font-semibold hover:brightness-110 transition',
};

export const inputCls = 'w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-slate-600';
