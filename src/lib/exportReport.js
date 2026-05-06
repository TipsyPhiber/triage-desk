import { PHASES } from '../data.js';
import { formatElapsed } from './time.js';
import { aggregateIocs } from '../state/iocIndex.js';

export function buildReport({
  incidentName, severity, startTime, endTime,
  totals, checks, notes, events, iocIndex,
}) {
  const lines = [];
  const title = (incidentName ?? '').trim() || 'Untitled Incident';
  const startedStr = startTime ? new Date(startTime).toISOString() : 'N/A (not declared)';
  const endedStr = endTime ? new Date(endTime).toISOString() : (startTime ? 'Ongoing' : 'N/A');
  const duration = startTime ? formatElapsed((endTime ?? Date.now()) - startTime) : '00:00:00';

  lines.push('========================================');
  lines.push('  TRIAGE DESK — INCIDENT SUMMARY');
  lines.push('========================================');
  lines.push('');
  lines.push(`Incident:   ${title}`);
  lines.push(`Severity:   ${severity}`);
  lines.push(`Declared:   ${startedStr}`);
  lines.push(`Resolved:   ${endedStr}`);
  lines.push(`Duration:   ${duration}`);
  lines.push(`Generated:  ${new Date().toISOString()}`);
  lines.push(`Progress:   ${totals.done} / ${totals.total} tasks complete`);
  lines.push('');

  for (const p of PHASES) {
    lines.push('----------------------------------------');
    lines.push(`PHASE: ${p.name.toUpperCase()}`);
    lines.push('----------------------------------------');
    const arr = checks[p.id] || [];
    p.tasks.forEach((t, i) => {
      const mark = arr[i] ? '[x]' : '[ ]';
      lines.push(`  ${mark} ${t}`);
    });
    const note = (notes[p.id] || '').trim();
    if (note) {
      lines.push('');
      lines.push('  Notes:');
      for (const line of note.split('\n')) {
        lines.push(`    ${line}`);
      }
    }
    lines.push('');
  }

  const iocByKey = aggregateIocs(iocIndex, PHASES);
  if (iocByKey.size > 0) {
    lines.push('----------------------------------------');
    lines.push(`IOC INDEX (${iocByKey.size} unique)`);
    lines.push('----------------------------------------');
    const grouped = {};
    for (const entry of iocByKey.values()) {
      (grouped[entry.kind] ||= []).push(entry);
    }
    for (const kind of Object.keys(grouped).sort()) {
      lines.push(`  ${kind}:`);
      for (const e of grouped[kind].sort((a, b) => a.value.localeCompare(b.value))) {
        const phaseList = [...e.phases].join(', ');
        lines.push(`    - ${e.value}  (${phaseList})`);
      }
    }
    lines.push('');
  }

  if (events.length > 0) {
    lines.push('----------------------------------------');
    lines.push('TIMELINE');
    lines.push('----------------------------------------');
    for (const ev of events) {
      const abs = new Date(ev.ts).toISOString();
      const rel = startTime ? formatElapsed(ev.ts - startTime) : '--:--:--';
      lines.push(`  ${abs}  T+${rel}  ${ev.message}`);
    }
    lines.push('');
  }

  lines.push('========================================');
  lines.push('  END OF REPORT');
  lines.push('========================================');

  return lines.join('\n');
}

export function downloadReport(text, filenameBase) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (filenameBase || 'incident').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'incident';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `${safe}-${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
