import { describe, expect, it } from 'vitest';
import { alertNote, fillPlaceholders, hecEvents, iocHuntSearches, iocLookupCsv, parseSplunkAlert, placeholdersIn } from '../src/lib/splunk.js';
import { createIncident, declareIncident, recordIocs } from '../src/state/incident.js';
import { findPlaybook } from '../src/state/playbooks.js';

function incWithIocs() {
  let inc = createIncident({ playbook: findPlaybook('builtin-general', []), name: 'INC-9', now: 1000 });
  inc = declareIncident(inc, 2000);
  return recordIocs(inc, 'identification', [
    { kind: 'IPv4', value: '203.0.113.7' },
    { kind: 'Domain', value: 'evil.example' },
    { kind: 'SHA256', value: 'a'.repeat(64) },
    { kind: 'Email', value: '=cmd@evil.example' },
  ], 3000);
}

describe('IOC hunting SPL', () => {
  it('builds one search per indicator kind plus a raw sweep', () => {
    const titles = iocHuntSearches([{ kind: 'IPv4', value: '203.0.113.7' }, { kind: 'Domain', value: 'evil.example' }]).map((s) => s.title);
    expect(titles.some((t) => /Network traffic/.test(t))).toBe(true);
    expect(titles.some((t) => /DNS/.test(t))).toBe(true);
    expect(titles.some((t) => /Raw search/.test(t))).toBe(true);
  });

  it('quotes values so hostile indicators cannot break out of the search', () => {
    const [s] = iocHuntSearches([{ kind: 'IPv4', value: '1.2.3.4" | delete' }]);
    expect(s.spl).toContain('"1.2.3.4\\" | delete"');
  });

  it('returns nothing without indicators', () => {
    expect(iocHuntSearches([])).toEqual([]);
  });
});

describe('exports', () => {
  it('IOC lookup CSV neutralises formula injection', () => {
    const csv = iocLookupCsv(incWithIocs());
    expect(csv.split('\n')[0]).toBe('indicator,type,first_phase,incident,tlp');
    expect(csv).toContain("'=cmd@evil.example");
  });

  it('HEC events carry epoch seconds and incident context', () => {
    const [ev] = hecEvents(incWithIocs(), { index: 'ir' });
    expect(ev.time).toBe(2);
    expect(ev.index).toBe('ir');
    expect(ev.sourcetype).toBe('triage_desk:timeline');
    expect(ev.event).toMatchObject({ incident: 'INC-9', type: 'declare' });
  });
});

describe('placeholders', () => {
  it('finds and fills <placeholders>, escaping quotes', () => {
    const spl = 'index=x user="<suspect_user>" host=<host>';
    expect(placeholdersIn(spl)).toEqual(['suspect_user', 'host']);
    expect(fillPlaceholders(spl, { suspect_user: 'a"b' })).toBe('index=x user="a\\"b" host=<host>');
  });
});

describe('alert import', () => {
  it('parses an alert-action webhook payload', () => {
    const a = parseSplunkAlert(JSON.stringify({ search_name: 'Brute force', results_link: 'https://s.example/x', result: { urgency: 'high', src: '198.51.100.1' } }));
    expect(a).toMatchObject({ name: 'Brute force', severity: 'High', link: 'https://s.example/x' });
    expect(a.rawText).toContain('198.51.100.1');
  });

  it('parses newline-delimited export JSON and takes the highest urgency', () => {
    const nd = [{ preview: false, result: { rule_name: 'R', urgency: 'low' } }, { preview: false, result: { rule_name: 'R', urgency: 'critical' } }].map((o) => JSON.stringify(o)).join('\n');
    expect(parseSplunkAlert(nd)).toMatchObject({ name: 'R', severity: 'Critical' });
  });

  it('parses CSV exports with quoted fields', () => {
    const a = parseSplunkAlert('rule_name,src,note\n"Odd, rule",203.0.113.9,"said ""hi"""\n');
    expect(a.name).toBe('Odd, rule');
    expect(a.rows[0].note).toBe('said "hi"');
  });

  it('drops non-http result links and rejects junk', () => {
    expect(parseSplunkAlert(JSON.stringify({ results_link: 'javascript:alert(1)', result: { a: 1 } })).link).toBe('');
    expect(() => parseSplunkAlert('hello')).toThrow();
    expect(() => parseSplunkAlert('')).toThrow();
  });

  it('writes a readable note', () => {
    const a = parseSplunkAlert(JSON.stringify({ search_name: 'X', result: { src: '1.1.1.1', user: 'bob' } }));
    expect(alertNote(a, 0)).toMatch(/Imported from Splunk: X[\s\S]*src=1\.1\.1\.1/);
  });
});
