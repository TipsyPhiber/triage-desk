import { PHASES, TLP_LEVELS } from '../data.js';
import { formatElapsed } from './time.js';
import { aggregateIocs } from '../state/iocIndex.js';
import { incidentPhases, incidentTotals } from '../state/incident.js';

export const REPORT_FORMATS = {
  txt: { label: 'Plain text (.txt)', ext: 'txt', mime: 'text/plain', pro: false },
  md: { label: 'Markdown (.md)', ext: 'md', mime: 'text/markdown', pro: true },
  html: { label: 'Printable HTML / PDF (.html)', ext: 'html', mime: 'text/html', pro: true },
};

// Everything the renderers need, computed once. Notes and IOCs frequently
// contain attacker-controlled text (pasted emails, log lines), so renderers
// must treat every string here as hostile.
export function reportModel(inc, settings = {}, now = Date.now()) {
  const { startTime, endTime } = inc;
  const phases = incidentPhases(inc);
  const iocByKey = aggregateIocs(inc.iocIndex, PHASES);
  const iocGroups = {};
  for (const entry of iocByKey.values()) (iocGroups[entry.kind] ||= []).push(entry);
  for (const k of Object.keys(iocGroups)) iocGroups[k].sort((a, b) => a.value.localeCompare(b.value));

  return {
    title: (inc.name ?? '').trim() || 'Untitled Incident',
    orgName: (settings.orgName ?? '').trim(),
    preparedBy: (settings.preparedBy ?? '').trim(),
    tlp: inc.tlp,
    tlpDescription: TLP_LEVELS[inc.tlp] ?? '',
    severity: inc.severity,
    playbookName: inc.playbookName,
    declared: startTime ? new Date(startTime).toISOString() : 'N/A (not declared)',
    resolved: endTime ? new Date(endTime).toISOString() : (startTime ? 'Ongoing' : 'N/A'),
    duration: startTime ? formatElapsed((endTime ?? now) - startTime) : '00:00:00',
    generated: new Date(now).toISOString(),
    totals: incidentTotals(inc),
    phases: phases.map((p) => ({
      name: p.name,
      tasks: p.tasks.map((text, i) => ({ text, done: !!inc.checks[p.id]?.[i] })),
      note: (inc.notes[p.id] || '').trim(),
    })),
    iocCount: iocByKey.size,
    iocGroups: Object.keys(iocGroups).sort().map((kind) => ({
      kind,
      items: iocGroups[kind].map((e) => ({ value: e.value, phases: [...e.phases] })),
    })),
    timeline: inc.events.map((ev) => ({
      abs: new Date(ev.ts).toISOString(),
      rel: startTime ? formatElapsed(ev.ts - startTime) : '--:--:--',
      message: ev.message,
    })),
  };
}

// ---------------------------------------------------------------------------
// Plain text

export function buildTextReport(inc, settings, now = Date.now()) {
  const m = reportModel(inc, settings, now);
  const lines = [];
  lines.push('========================================');
  lines.push(`  ${m.tlp}`);
  lines.push('  TRIAGE DESK — INCIDENT SUMMARY');
  lines.push('========================================');
  lines.push('');
  if (m.orgName) lines.push(`Organization: ${m.orgName}`);
  lines.push(`Incident:   ${m.title}`);
  lines.push(`Severity:   ${m.severity}`);
  lines.push(`Playbook:   ${m.playbookName}`);
  lines.push(`Declared:   ${m.declared}`);
  lines.push(`Resolved:   ${m.resolved}`);
  lines.push(`Duration:   ${m.duration}`);
  lines.push(`Generated:  ${m.generated}`);
  if (m.preparedBy) lines.push(`Prepared by: ${m.preparedBy}`);
  lines.push(`Progress:   ${m.totals.done} / ${m.totals.total} tasks complete`);
  lines.push('');

  for (const p of m.phases) {
    lines.push('----------------------------------------');
    lines.push(`PHASE: ${p.name.toUpperCase()}`);
    lines.push('----------------------------------------');
    for (const t of p.tasks) lines.push(`  ${t.done ? '[x]' : '[ ]'} ${t.text}`);
    if (p.note) {
      lines.push('');
      lines.push('  Notes:');
      for (const line of p.note.split('\n')) lines.push(`    ${line}`);
    }
    lines.push('');
  }

  if (m.iocCount > 0) {
    lines.push('----------------------------------------');
    lines.push(`IOC INDEX (${m.iocCount} unique)`);
    lines.push('----------------------------------------');
    for (const g of m.iocGroups) {
      lines.push(`  ${g.kind}:`);
      for (const e of g.items) lines.push(`    - ${e.value}  (${e.phases.join(', ')})`);
    }
    lines.push('');
  }

  if (m.timeline.length > 0) {
    lines.push('----------------------------------------');
    lines.push('TIMELINE');
    lines.push('----------------------------------------');
    for (const ev of m.timeline) lines.push(`  ${ev.abs}  T+${ev.rel}  ${ev.message}`);
    lines.push('');
  }

  lines.push('========================================');
  lines.push(`  END OF REPORT · ${m.tlp}`);
  lines.push('========================================');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Markdown

// Escape inline Markdown/HTML so task text and messages render literally.
export function mdEscape(s) {
  return String(s).replace(/[\\`*_{}[\]()#+\-.!|<>&~]/g, (c) => `\\${c}`).replace(/\r?\n/g, ' ');
}

// A code span whose delimiter is longer than any backtick run inside it.
function mdCode(s) {
  const str = String(s).replace(/\r?\n/g, ' ');
  const longest = Math.max(0, ...(str.match(/`+/g) ?? []).map((r) => r.length));
  const fence = '`'.repeat(longest + 1);
  const pad = str.startsWith('`') || str.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${str}${pad}${fence}`;
}

// Notes go in fenced blocks: they're raw analyst text and may contain HTML or
// Markdown from the attacker that some renderers would otherwise execute.
function mdFence(s) {
  const longest = Math.max(2, ...(s.match(/`+/g) ?? []).map((r) => r.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}text\n${s}\n${fence}`;
}

export function buildMarkdownReport(inc, settings, now = Date.now()) {
  const m = reportModel(inc, settings, now);
  const out = [];
  out.push(`**${m.tlp}** — ${mdEscape(m.tlpDescription)}`);
  out.push('');
  out.push(`# ${mdEscape(m.title)}`);
  out.push('');
  out.push('| Field | Value |');
  out.push('| --- | --- |');
  if (m.orgName) out.push(`| Organization | ${mdEscape(m.orgName)} |`);
  out.push(`| Severity | ${m.severity} |`);
  out.push(`| Playbook | ${mdEscape(m.playbookName)} |`);
  out.push(`| Declared | ${m.declared} |`);
  out.push(`| Resolved | ${m.resolved} |`);
  out.push(`| Duration | ${m.duration} |`);
  out.push(`| Progress | ${m.totals.done} / ${m.totals.total} tasks |`);
  if (m.preparedBy) out.push(`| Prepared by | ${mdEscape(m.preparedBy)} |`);
  out.push(`| Generated | ${m.generated} |`);
  out.push('');

  for (const p of m.phases) {
    out.push(`## ${mdEscape(p.name)}`);
    out.push('');
    for (const t of p.tasks) out.push(`- [${t.done ? 'x' : ' '}] ${mdEscape(t.text)}`);
    if (p.note) {
      out.push('');
      out.push('**Notes**');
      out.push('');
      out.push(mdFence(p.note));
    }
    out.push('');
  }

  if (m.iocCount > 0) {
    out.push(`## IOC index (${m.iocCount} unique)`);
    out.push('');
    out.push('| Type | Indicator | Phases |');
    out.push('| --- | --- | --- |');
    for (const g of m.iocGroups) {
      for (const e of g.items) {
        out.push(`| ${mdEscape(g.kind)} | ${mdCode(e.value).replace(/\|/g, '\\|')} | ${e.phases.map(mdEscape).join(', ')} |`);
      }
    }
    out.push('');
  }

  if (m.timeline.length > 0) {
    out.push('## Timeline');
    out.push('');
    out.push('| Time (UTC) | T+ | Event |');
    out.push('| --- | --- | --- |');
    for (const ev of m.timeline) out.push(`| ${ev.abs} | ${ev.rel} | ${mdEscape(ev.message)} |`);
    out.push('');
  }

  out.push('---');
  out.push(`*Generated by Triage Desk · ${m.tlp}*`);
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// HTML (print to PDF from the browser)

export function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TLP_COLORS = {
  'TLP:CLEAR': ['#ffffff', '#000000'],
  'TLP:GREEN': ['#33ff00', '#000000'],
  'TLP:AMBER': ['#ffc000', '#000000'],
  'TLP:AMBER+STRICT': ['#ffc000', '#000000'],
  'TLP:RED': ['#ff2b2b', '#000000'],
};

const HTML_STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 0; padding: 32px; background: #fff; }
  main { max-width: 820px; margin: 0 auto; }
  .tlp { display: inline-block; padding: 2px 10px; font-weight: 700; letter-spacing: .05em; background: #000; border-radius: 3px; }
  .bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 12px; color: #4b5563; }
  h1 { font-size: 26px; margin: 20px 0 4px; }
  h2 { font-size: 17px; margin: 28px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #e5e7eb; break-after: avoid; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { text-align: left; vertical-align: top; padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
  .meta th { width: 140px; }
  ul.tasks { list-style: none; padding: 0; margin: 0; }
  ul.tasks li { padding: 3px 0 3px 24px; position: relative; }
  ul.tasks li::before { content: "☐"; position: absolute; left: 0; color: #6b7280; }
  ul.tasks li.done::before { content: "☑"; color: #059669; }
  pre { white-space: pre-wrap; word-break: break-word; background: #f3f4f6; padding: 10px 12px; border-radius: 6px; font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
  code { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
  .sev { font-weight: 600; }
  footer { margin-top: 40px; font-size: 11px; color: #6b7280; text-align: center; }
  @media print {
    body { padding: 0; }
    tr, li, pre { break-inside: avoid; }
  }
`;

export function buildHtmlReport(inc, settings, now = Date.now()) {
  const m = reportModel(inc, settings, now);
  const e = htmlEscape;
  const [tlpFg] = TLP_COLORS[m.tlp] ?? ['#ffffff'];
  const tlpBadge = `<span class="tlp" style="color:${tlpFg}">${e(m.tlp)}</span>`;
  const row = (k, v) => `<tr><th>${e(k)}</th><td>${e(v)}</td></tr>`;

  const phases = m.phases.map((p) => `
    <section>
      <h2>${e(p.name)}</h2>
      <ul class="tasks">${p.tasks.map((t) => `<li class="${t.done ? 'done' : ''}">${e(t.text)}</li>`).join('')}</ul>
      ${p.note ? `<pre>${e(p.note)}</pre>` : ''}
    </section>`).join('');

  const iocs = m.iocCount === 0 ? '' : `
    <section>
      <h2>IOC index (${m.iocCount} unique)</h2>
      <table><thead><tr><th>Type</th><th>Indicator</th><th>Phases</th></tr></thead><tbody>
      ${m.iocGroups.flatMap((g) => g.items.map((i) => `<tr><td>${e(g.kind)}</td><td><code>${e(i.value)}</code></td><td>${e(i.phases.join(', '))}</td></tr>`)).join('')}
      </tbody></table>
    </section>`;

  const timeline = m.timeline.length === 0 ? '' : `
    <section>
      <h2>Timeline</h2>
      <table><thead><tr><th>Time (UTC)</th><th>T+</th><th>Event</th></tr></thead><tbody>
      ${m.timeline.map((t) => `<tr><td><code>${e(t.abs)}</code></td><td><code>${e(t.rel)}</code></td><td>${e(t.message)}</td></tr>`).join('')}
      </tbody></table>
    </section>`;

  // The report has its own CSP: even if something slipped past escaping,
  // nothing in the file can run script or load remote resources.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(m.title)} — Incident Report</title>
<style>${HTML_STYLE}</style>
</head>
<body>
<main>
  <div class="bar">${tlpBadge}<span>${e(m.orgName || 'Incident Report')}</span></div>
  <h1>${e(m.title)}</h1>
  <div class="bar"><span>${e(m.tlpDescription)}</span></div>
  <table class="meta"><tbody>
    ${m.orgName ? row('Organization', m.orgName) : ''}
    <tr><th>Severity</th><td class="sev">${e(m.severity)}</td></tr>
    ${row('Playbook', m.playbookName)}
    ${row('Declared', m.declared)}
    ${row('Resolved', m.resolved)}
    ${row('Duration', m.duration)}
    ${row('Progress', `${m.totals.done} / ${m.totals.total} tasks complete`)}
    ${m.preparedBy ? row('Prepared by', m.preparedBy) : ''}
    ${row('Generated', m.generated)}
  </tbody></table>
  ${phases}
  ${iocs}
  ${timeline}
  <footer>${tlpBadge} · Generated by Triage Desk</footer>
</main>
</body>
</html>`;
}

export function buildReport(format, inc, settings, now = Date.now()) {
  if (format === 'md') return buildMarkdownReport(inc, settings, now);
  if (format === 'html') return buildHtmlReport(inc, settings, now);
  return buildTextReport(inc, settings, now);
}

export function reportFilename(name, ext, now = Date.now()) {
  const safe = (name || 'incident').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'incident';
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
  return `${safe}-${stamp}.${ext}`;
}

export function downloadFile(text, filename, mime) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
