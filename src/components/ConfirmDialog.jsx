// In-app confirmation dialog. Replaces window.confirm(), which looks out of
// place and is blocked in some embedded browsers.
//
//   if (!(await askConfirm({ title, body, confirmLabel, danger }))) return;

import { useEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { btn } from './Modal.jsx';

let show = null;

export function askConfirm({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    if (show) show({ title, body, confirmLabel, danger, resolve });
    else resolve(window.confirm(body ? `${title}\n\n${body}` : title));
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    show = setReq;
    return () => { show = null; };
  }, []);

  useEffect(() => {
    if (!req) return;
    confirmRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  function finish(ok) {
    req?.resolve(ok);
    setReq(null);
  }

  if (!req) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 scrim" onClick={() => finish(false)} />
      <div role="alertdialog" aria-modal="true" aria-label={req.title} className="anim-in relative w-full max-w-md bg-surface-2 border border-line-2 rounded-2xl shadow-pop p-6">
        <div className="flex gap-3.5">
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${req.danger ? 'bg-danger/10 text-danger' : 'bg-raised text-ink-2 border border-line-2'}`}>
            <TriangleAlert size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">{req.title}</h2>
            {req.body && <p className="mt-1.5 text-[13px] text-ink-2 leading-relaxed">{req.body}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className={btn.secondary} onClick={() => finish(false)}>Cancel</button>
          <button
            ref={confirmRef}
            className={req.danger ? 'inline-flex items-center justify-center gap-2 bg-danger text-white dark:text-[#2a0710] px-3.5 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition' : btn.primary}
            onClick={() => finish(true)}
          >
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
