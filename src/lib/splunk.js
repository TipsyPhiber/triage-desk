// Offline Splunk helpers: build hunting SPL from an incident's IOCs, export
// IOC lookups and HEC-format timelines, and parse Splunk alert/notable
// exports into a new incident. Nothing here touches the network.

import { PHASES } from '../data.js';

const q = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const list = (vals) => vals.map(q).join(', ');

export function iocsOf(incident) {
  const seen = new Map();
  for (const p of PHASES) {
    for (const { kind, value } of incident.iocIndex?.[p.id] || []) {
      const k = `${kind}\0${value}`;
      if (!seen.has(k)) seen.set(k, { kind, value, phase: p.id });
    }
  }
  return [...seen.values()];
}

function byKind(iocs) {
  const g = { ip: [], domain: [], url: [], email: [], hash: [] };
  for (const { kind, value } of iocs) {
    if (kind === 'IPv4') g.ip.push(value);
    else if (kind === 'Domain') g.domain.push(value);
    else if (kind === 'URL') g.url.push(value);
    else if (kind === 'Email') g.email.push(value);
    else if (['MD5', 'SHA1', 'SHA256'].includes(kind)) g.hash.push(value);
  }
  return g;
}

// Hunting searches for every indicator kind present, CIM data models first.
export function iocHuntSearches(iocs, { earliest = '-7d' } = {}) {
  const g = byKind(iocs);
  const out = [];
  if (g.ip.length) {
    out.push({
      title: `Network traffic to or from ${g.ip.length} IP${g.ip.length > 1 ? 's' : ''}`,
      spl: `| tstats summariesonly=false count min(_time) as first max(_time) as last from datamodel=Network_Traffic where earliest=${earliest} (All_Traffic.dest_ip IN (${list(g.ip)}) OR All_Traffic.src_ip IN (${list(g.ip)})) by All_Traffic.src_ip All_Traffic.dest_ip All_Traffic.dest_port All_Traffic.action | convert ctime(first) ctime(last) | sort - count`,
    });
  }
  if (g.domain.length || g.url.length) {
    const hosts = [...new Set([...g.domain, ...g.url.map((u) => { try { return new URL(u).hostname; } catch { return null; } }).filter(Boolean)])];
    out.push({
      title: `DNS lookups for ${hosts.length} domain${hosts.length > 1 ? 's' : ''}`,
      spl: `| tstats summariesonly=false count min(_time) as first from datamodel=Network_Resolution where earliest=${earliest} DNS.query IN (${list(hosts.flatMap((h) => [h, `*.${h}`]))}) by DNS.src DNS.query DNS.answer | convert ctime(first) | sort - count`,
    });
    out.push({
      title: 'Web/proxy requests to those domains',
      spl: `| tstats summariesonly=false count from datamodel=Web where earliest=${earliest} (${hosts.map((h) => `Web.url=${q(`*${h}*`)}`).join(' OR ')}) by Web.src Web.user Web.url Web.action | sort - count`,
    });
  }
  if (g.hash.length) {
    out.push({
      title: `Processes and files matching ${g.hash.length} hash${g.hash.length > 1 ? 'es' : ''}`,
      spl: `| tstats summariesonly=false count min(_time) as first from datamodel=Endpoint.Processes where earliest=${earliest} Processes.process_hash IN (${list(g.hash.map((h) => `*${h}*`))}) by Processes.dest Processes.user Processes.process_name Processes.process_hash | convert ctime(first)`,
    });
  }
  if (g.email.length) {
    out.push({
      title: `Mail from or to ${g.email.length} address${g.email.length > 1 ? 'es' : ''}`,
      spl: `| tstats summariesonly=false count from datamodel=Email where earliest=${earliest} (All_Email.src_user IN (${list(g.email)}) OR All_Email.recipient IN (${list(g.email)})) by All_Email.src_user All_Email.recipient All_Email.subject All_Email.action`,
    });
  }
  if (iocs.length) {
    const terms = iocs.filter((i) => i.kind !== 'CVE').map((i) => q(i.value));
    if (terms.length) {
      out.push({
        title: 'Raw search for every indicator (slow, any index)',
        spl: `index=* earliest=${earliest} (${terms.join(' OR ')}) | stats count min(_time) as first max(_time) as last by index sourcetype host | convert ctime(first) ctime(last) | sort - count`,
      });
    }
  }
  return out;
}

const csvCell = (v) => {
  let s = String(v ?? '');
  // Neutralise spreadsheet formula injection from attacker-controlled IOCs.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// A lookup table for `| inputlookup` / automatic lookups.
export function iocLookupCsv(incident) {
  const phaseName = Object.fromEntries(PHASES.map((p) => [p.id, p.name]));
  const rows = [['indicator', 'type', 'first_phase', 'incident', 'tlp']];
  for (const i of iocsOf(incident)) rows.push([i.value, i.kind, phaseName[i.phase], incident.name || 'Untitled incident', incident.tlp]);
  return `${rows.map((r) => r.map(csvCell).join(',')).join('\n')}\n`;
}

// The timeline as HTTP Event Collector events (newline-delimited JSON),
// ready for `/services/collector/event` or a one-off file upload.
export function hecEvents(incident, { index, sourcetype = 'triage_desk:timeline', host = 'triage-desk' } = {}) {
  return incident.events.map((e) => {
    const ev = {
      time: Math.round(e.ts) / 1000,
      host,
      source: 'triage-desk',
      sourcetype,
      event: {
        incident: incident.name || 'Untitled incident',
        incident_id: incident.id,
        severity: incident.severity,
        tlp: incident.tlp,
        playbook: incident.playbookName,
        type: e.type,
        message: e.message,
      },
    };
    if (index) ev.index = index;
    return ev;
  });
}

export function hecPayload(incident, opts) {
  return hecEvents(incident, opts).map((e) => JSON.stringify(e)).join('\n');
}

// Placeholders like <suspect_user> that analysts fill in before running.
export function placeholdersIn(spl) {
  return [...new Set([...spl.matchAll(/<([a-z][a-z0-9_]{1,40})>/gi)].map((m) => m[1]))];
}

export function fillPlaceholders(spl, values) {
  return spl.replace(/<([a-z][a-z0-9_]{1,40})>/gi, (m, k) => (values[k]?.trim() ? values[k].trim().replace(/"/g, '\\"') : m));
}

// ---------------------------------------------------------------------------
// Alert import. Accepts what Splunk actually hands people:
//  - alert action webhook JSON  { search_name, result: {...}, results_link }
//  - REST/export JSON           { results: [...] } or newline-delimited { result }
//  - Enterprise Security notable rows (rule_name, urgency, src, dest, user)
//  - CSV exported from a search or the Incident Review page

const URGENCY = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', informational: 'Low', info: 'Low' };
const NAME_FIELDS = ['rule_name', 'search_name', 'rule_title', 'savedsearch_name', 'ss_name', 'signature', 'name'];
const MAX_ROWS = 500;
const MAX_IMPORT = 2_000_000;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  return body.slice(0, MAX_ROWS).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}

function flat(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (k.startsWith('__mv_')) continue;
    out[k] = Array.isArray(v) ? v.join(', ') : v && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
  }
  return out;
}

export function parseSplunkAlert(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Paste a Splunk alert, notable event, or search export.');
  if (text.length > MAX_IMPORT) throw new Error('That export is too large (2 MB max). Narrow the search and try again.');
  const t = text.trim();
  let rows = [];
  let name = '';
  let link = '';
  if (t.startsWith('{') || t.startsWith('[')) {
    let parsed = null;
    try { parsed = JSON.parse(t); } catch { /* maybe NDJSON */ }
    if (parsed) {
      if (Array.isArray(parsed)) rows = parsed;
      else if (Array.isArray(parsed.results)) rows = parsed.results;
      else if (parsed.result && typeof parsed.result === 'object') rows = [parsed.result];
      else rows = [parsed];
      name = parsed.search_name || parsed.rule_name || '';
      link = parsed.results_link || '';
    } else {
      for (const line of t.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const o = JSON.parse(line);
          if (o.result) rows.push(o.result);
          else if (!('preview' in o && Object.keys(o).length <= 2)) rows.push(o);
        } catch { throw new Error('Could not read that JSON. Paste the whole alert payload or export.'); }
      }
    }
  } else if (t.includes(',') && t.includes('\n')) {
    rows = parseCsv(t);
  } else {
    throw new Error('Expected JSON (alert webhook, REST export) or CSV from Splunk.');
  }
  rows = rows.filter((r) => r && typeof r === 'object').slice(0, MAX_ROWS).map(flat);
  if (!rows.length) throw new Error('No events found in that export.');

  const first = rows[0];
  if (!name) name = NAME_FIELDS.map((f) => first[f]).find(Boolean) || 'Splunk alert';
  const urg = rows.map((r) => URGENCY[(r.urgency || r.severity || '').toLowerCase()]).filter(Boolean);
  const order = ['Low', 'Medium', 'High', 'Critical'];
  const severity = urg.length ? urg.reduce((a, b) => (order.indexOf(b) > order.indexOf(a) ? b : a)) : 'Medium';

  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !k.startsWith('_') || k === '_time' || k === '_raw');
  const rawText = rows.map((r) => Object.values(r).join(' ')).join('\n');
  return { name: String(name).slice(0, 160), severity, rows, keys, link: /^https?:\/\//.test(link) ? link : '', rawText };
}

// A readable Identification note summarising the imported alert.
export function alertNote(alert, now = Date.now()) {
  const stamp = new Date(now).toISOString().replace('T', ' ').slice(0, 19);
  const show = ['_time', 'rule_name', 'search_name', 'urgency', 'severity', 'src', 'src_ip', 'dest', 'dest_ip', 'user', 'signature', 'action', 'host', 'sourcetype']
    .filter((k) => alert.keys.includes(k));
  const fields = show.length ? show : alert.keys.slice(0, 8);
  const lines = [`[${stamp}] Imported from Splunk: ${alert.name} (${alert.rows.length} event${alert.rows.length === 1 ? '' : 's'})`];
  if (alert.link) lines.push(`Results: ${alert.link}`);
  for (const r of alert.rows.slice(0, 20)) {
    lines.push(`- ${fields.map((f) => `${f}=${String(r[f] ?? '').slice(0, 200)}`).filter((x) => !x.endsWith('=')).join('  ')}`);
  }
  if (alert.rows.length > 20) lines.push(`… ${alert.rows.length - 20} more`);
  return lines.join('\n');
}
