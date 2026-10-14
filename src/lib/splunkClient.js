// Connected edition: talk to the customer's own Splunk from the browser.
//
//  - Search:  POST {apiUrl}/services/search/v2/jobs/export   (Bearer token)
//  - Send:    POST {hecUrl}/services/collector/event         (Splunk <HEC token>)
//
// Connection settings live in this browser only (never in backups or
// reports). Splunk must allow the app's origin via crossOriginSharingPolicy;
// see docs/SPLUNK.md.

import { EDITION } from '../license/entitlements.js';

const KEY = 'triage-desk-splunk-v1';
export const DEFAULT_SPLUNK = { apiUrl: '', token: '', hecUrl: '', hecToken: '', index: '', earliest: '-24h' };

export function loadSplunkConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const out = { ...DEFAULT_SPLUNK };
    for (const k of Object.keys(DEFAULT_SPLUNK)) if (typeof raw[k] === 'string') out[k] = raw[k].slice(0, 4000);
    return out;
  } catch {
    return { ...DEFAULT_SPLUNK };
  }
}

export function saveSplunkConfig(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); return true; } catch { return false; }
}

export function clearSplunkConfig() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function normalizeBase(url) {
  const u = new URL(String(url).trim());
  if (u.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(u.hostname)) {
    throw new Error('Use https:// (plain http is only allowed for localhost).');
  }
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

function explain(err, base) {
  if (err?.name === 'AbortError') return new Error('Splunk did not answer within the time limit.');
  if (err instanceof TypeError) {
    return new Error(`Could not reach ${base}. Check the URL, that the certificate is trusted by this browser, and that Splunk's crossOriginSharingPolicy allows this page (see docs/SPLUNK.md).`);
  }
  return err;
}

async function call(url, init, { timeoutMs = 60000 } = {}) {
  if (EDITION !== 'connected') throw new Error('Live Splunk is only available in Triage Desk Connected.');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (res.status === 401 || res.status === 403) throw new Error('Splunk rejected the token (HTTP ' + res.status + ').');
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      throw new Error(`Splunk returned HTTP ${res.status}${body ? `: ${body}` : ''}`);
    }
    return res;
  } catch (e) {
    throw explain(e, new URL(url).origin);
  } finally {
    clearTimeout(timer);
  }
}

export async function testConnection(cfg) {
  const base = normalizeBase(cfg.apiUrl);
  const res = await call(`${base}/services/server/info?output_mode=json`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
  }, { timeoutMs: 15000 });
  const data = await res.json();
  const c = data?.entry?.[0]?.content || {};
  return { serverName: String(c.serverName || 'Splunk'), version: String(c.version || '') };
}

export const MAX_RESULTS = 1000;

// Run a search and collect up to MAX_RESULTS rows. Export streams one JSON
// object per line: { preview, result } plus optional { messages }.
export async function runSearch(cfg, spl, { earliest = cfg.earliest || '-24h', latest = 'now' } = {}) {
  const base = normalizeBase(cfg.apiUrl);
  const search = /^\s*(\||search\s)/i.test(spl) ? spl.trim() : `search ${spl.trim()}`;
  const body = new URLSearchParams({ search, output_mode: 'json', earliest_time: earliest, latest_time: latest, count: String(MAX_RESULTS) });
  const res = await call(`${base}/services/search/v2/jobs/export`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }, { timeoutMs: 120000 });
  const text = await res.text();
  const rows = [];
  const messages = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.result && !o.preview && rows.length < MAX_RESULTS) rows.push(o.result);
    for (const m of o.messages || []) if (m?.text) messages.push(`${m.type || 'INFO'}: ${m.text}`);
  }
  const fields = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !k.startsWith('_') || k === '_time' || k === '_raw');
  return { rows, fields, messages, truncated: rows.length >= MAX_RESULTS };
}

// Recent Enterprise Security notables, newest first.
export function notablesSearch(earliest = '-24h') {
  return `search index=notable earliest=${earliest} | eval rule_name=coalesce(rule_name, search_name) | table _time rule_name urgency src dest user event_id | sort - _time | head 50`;
}

export async function sendToHec(cfg, events) {
  const base = normalizeBase(cfg.hecUrl || cfg.apiUrl);
  const body = events.map((e) => JSON.stringify(cfg.index ? { ...e, index: cfg.index } : e)).join('\n');
  const res = await call(`${base}/services/collector/event`, {
    method: 'POST',
    headers: { Authorization: `Splunk ${cfg.hecToken}`, 'Content-Type': 'application/json' },
    body,
  }, { timeoutMs: 30000 });
  const data = await res.json().catch(() => ({}));
  if (data.code !== undefined && data.code !== 0) throw new Error(`HEC error ${data.code}: ${data.text || 'unknown'}`);
  return events.length;
}
