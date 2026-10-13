import { describe, expect, it } from 'vitest';
import { buildHtmlReport, buildMarkdownReport, buildTextReport, reportFilename } from '../src/lib/exportReport.js';
import * as I from '../src/state/incident.js';
import { BUILTIN_PLAYBOOKS } from '../src/playbooks/builtins.js';

const T0 = Date.parse('2026-10-13T12:00:00Z');
const XSS = '<img src=x onerror=alert(1)><script>alert(2)</script>';

function sample() {
  let inc = I.createIncident({ playbook: BUILTIN_PLAYBOOKS[0], name: `Phish ${XSS}`, tlp: 'TLP:RED', now: T0 });
  inc = I.declareIncident(inc, T0);
  inc = I.toggleCheck(inc, 'identification', 0, T0 + 1000);
  inc = I.setNote(inc, 'identification', `From: attacker\n${XSS}\n\`\`\`\n[click](javascript:alert(3))`);
  inc = I.recordIocs(inc, 'identification', [{ kind: 'url', value: 'https://evil.test/`x`|y' }], T0 + 2000);
  return inc;
}

describe('reports', () => {
  it('text report includes TLP, progress, IOCs, and timeline', () => {
    const txt = buildTextReport(sample(), { orgName: 'Acme' }, T0 + 60_000);
    expect(txt).toContain('TLP:RED');
    expect(txt).toContain('Organization: Acme');
    expect(txt).toContain('[x] Triage initial alert');
    expect(txt).toContain('IOC INDEX (1 unique)');
    expect(txt).toContain('T+00:00:01');
    expect(txt).toContain('Duration:   00:01:00');
  });

  it('html report escapes hostile content and locks down script', () => {
    const html = buildHtmlReport(sample(), { orgName: `<b>${XSS}</b>` }, T0);
    expect(html).not.toMatch(/<script>alert/);
    expect(html).not.toMatch(/<img src=x/);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain("default-src 'none'");
    // Only the opening of the document should contain real tags we wrote.
    expect((html.match(/<script/g) || []).length).toBe(0);
  });

  it('markdown report fences notes and escapes inline text', () => {
    const md = buildMarkdownReport(sample(), {}, T0);
    // Notes containing ``` must be wrapped in a longer fence.
    expect(md).toMatch(/````text\nFrom: attacker/);
    // Title HTML is escaped, not live.
    expect(md).toContain('\\<img src=x onerror=alert\\(1\\)\\>');
    // IOC with backticks and pipe stays inside a code span and the table.
    expect(md).toContain('``https://evil.test/`x`\\|y``');
  });

  it('builds safe filenames', () => {
    expect(reportFilename('../../etc/passwd', 'md', T0)).toBe('etc-passwd-2026-10-13T12-00-00-000Z.md');
    expect(reportFilename('', 'txt', T0)).toMatch(/^incident-/);
  });
});
