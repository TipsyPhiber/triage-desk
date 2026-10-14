import { useMemo, useState } from 'react';
import { loadIocExtractor } from '../iocLoader.js';
import { ChevronDown, Radar, Sparkles } from 'lucide-react';
import { IOC_KIND_STYLES } from '../styles/eventStyles.js';
import { btn, labelCls } from './Modal.jsx';

const SAMPLE_INPUT = `2026-05-06 14:23 [WARN] Outbound connection blocked
src=10.0.5.12 dst=185.220.101[.]45:443
User clicked hxxps://login-paypa1[.]com/verify
Payload SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
Reply-To: support[at]paypa1[.]com
Mentions CVE-2024-23897`;

export function IocExtractor({ sev, onAppend, onExtracted }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function runExtract() {
    setBusy(true);
    setError(null);
    try {
      const mod = await loadIocExtractor();
      const found = mod.extract_iocs(input);
      setResults(found);
    } catch (err) {
      setError(String(err?.message ?? err));
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  function appendAll() {
    if (!results || results.length === 0) return;
    const grouped = results.reduce((acc, r) => {
      (acc[r.kind] ||= []).push(r.value);
      return acc;
    }, {});
    const lines = [`--- IOCs extracted ${new Date().toISOString()} ---`];
    for (const kind of Object.keys(grouped).sort()) {
      lines.push(`${kind}:`);
      for (const v of grouped[kind]) lines.push(`  - ${v}`);
    }
    onAppend(lines.join('\n'));
    onExtracted?.(results);
    setResults(null);
    setInput('');
    setOpen(false);
  }

  const grouped = useMemo(() => {
    if (!results) return null;
    return results.reduce((acc, r) => {
      (acc[r.kind] ||= []).push(r.value);
      return acc;
    }, {});
  }, [results]);

  return (
    <section className="mb-8 rounded-xl border border-line bg-surface overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Hide IOC extractor' : 'Open IOC extractor'}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2 transition"
      >
        <span className="w-8 h-8 rounded-lg bg-raised border border-line-2 flex items-center justify-center shrink-0">
          <Radar size={15} className="text-ink-2" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-ink">IOC extractor</span>
          <span className="block text-xs text-ink-3 mt-0.5 truncate">
            Paste logs, alerts, or emails — pulls IPs, domains, URLs, hashes, emails, and CVEs, even defanged like <span className="font-mono text-ink-2">1.2.3[.]4</span>
          </span>
        </span>
        <ChevronDown size={16} className={`text-ink-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-line p-4 space-y-3 anim-in">
          <div className="flex items-center justify-between">
            <span className={labelCls}>Input</span>
            <button
              onClick={() => { setInput(SAMPLE_INPUT); setResults(null); setError(null); }}
              className="text-xs text-ink-2 hover:text-ink inline-flex items-center gap-1"
            >
              <Sparkles size={12} /> Try sample
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a log line, alert payload, or phishing email here."
            aria-label="IOC extractor input"
            rows={5}
            className="w-full bg-canvas border border-line-2 rounded-lg p-3 text-[12.5px] leading-relaxed text-ink placeholder-ink-4 outline-none focus:border-ink-3 resize-y font-mono"
          />

          <div className="flex items-center gap-2">
            <button onClick={runExtract} disabled={!input.trim() || busy} className={btn.primary}>
              {busy ? 'Extracting…' : 'Extract IOCs'}
            </button>
            <button onClick={() => { setInput(''); setResults(null); setError(null); }} className={btn.ghost}>
              Clear
            </button>
            {results && (
              <span className="text-xs text-ink-3 ml-1 tabular">
                {results.length} unique IOC{results.length === 1 ? '' : 's'} found
              </span>
            )}
          </div>

          {error && (
            <div className="text-sm text-rose-300 border border-rose-500/30 bg-rose-500/10 rounded-lg px-3 py-2">{error}</div>
          )}

          {grouped && results.length === 0 && !error && (
            <div className="text-sm text-ink-3">No IOCs detected in input.</div>
          )}

          {grouped && results.length > 0 && (
            <div className="space-y-3 pt-1">
              {Object.keys(grouped).sort().map((kind) => (
                <div key={kind}>
                  <div className={`${labelCls} mb-1.5`}>{kind}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {grouped[kind].map((v) => (
                      <span
                        key={v}
                        className={`text-xs font-mono px-2 py-1 rounded-md border break-all ${IOC_KIND_STYLES[kind] ?? 'border-line-2 bg-raised text-ink-2'}`}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-1">
                <button onClick={appendAll} className={btn.solid}>Append to Notes</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
