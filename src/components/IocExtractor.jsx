import { useMemo, useState } from 'react';
import { loadIocExtractor } from '../iocLoader.js';
import { IOC_KIND_STYLES } from '../styles/eventStyles.js';

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
    <section className="mb-8">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <h3 className="text-xs uppercase tracking-wider text-slate-500">
            IOC Extractor
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Detects IPs, domains, URLs, hashes (MD5/SHA1/SHA256), CVEs, and emails — including defanged variants like <span className="font-mono text-slate-400">1.2.3[.]4</span> or <span className="font-mono text-slate-400">hxxps://...</span>
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-sm text-slate-400 hover:text-slate-200 transition shrink-0"
        >
          {open ? 'Hide' : 'Open'}
        </button>
      </div>

      {open && (
        <div className="border border-slate-800 rounded-lg bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Input</span>
            <button
              onClick={() => { setInput(SAMPLE_INPUT); setResults(null); setError(null); }}
              className="text-xs text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline transition"
            >
              Try sample
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'Paste a log line, alert payload, or phishing email here.'}
            rows={5}
            className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-slate-600 resize-y font-mono"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={runExtract}
              disabled={!input.trim() || busy}
              className={`${sev.accent} text-slate-950 px-3 py-1.5 rounded-md text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition`}
            >
              {busy ? 'Extracting…' : 'Extract IOCs'}
            </button>
            <button
              onClick={() => { setInput(''); setResults(null); setError(null); }}
              className="border border-slate-700 text-slate-300 px-3 py-1.5 rounded-md text-sm hover:bg-slate-800 transition"
            >
              Clear
            </button>
            {results && (
              <span className="text-xs text-slate-500 ml-1">
                {results.length} unique IOC{results.length === 1 ? '' : 's'} found
              </span>
            )}
          </div>

          {error && (
            <div className="text-sm text-rose-400 border border-rose-500/30 bg-rose-500/10 rounded px-3 py-2">
              {error}
            </div>
          )}

          {grouped && results.length === 0 && !error && (
            <div className="text-sm text-slate-500 italic">No IOCs detected in input.</div>
          )}

          {grouped && results.length > 0 && (
            <div className="space-y-2">
              {Object.keys(grouped).sort().map((kind) => (
                <div key={kind}>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{kind}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {grouped[kind].map((v) => (
                      <span
                        key={v}
                        className={`text-xs font-mono px-2 py-0.5 rounded border ${IOC_KIND_STYLES[kind] ?? 'border-slate-700 bg-slate-800 text-slate-300'}`}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <button
                  onClick={appendAll}
                  className="bg-slate-100 text-slate-900 px-3 py-1.5 rounded-md text-sm font-semibold hover:brightness-95 transition"
                >
                  Append to Notes
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
