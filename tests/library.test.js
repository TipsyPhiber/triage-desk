import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateLibrary } from '../src/playbooks/validateLibrary.js';
import { LIBRARY_CATEGORIES, LIBRARY_PLAYBOOKS } from '../src/playbooks/library.js';
import { allPlaybooks, findPlaybook } from '../src/state/playbooks.js';
import { searchPlaybooks } from '../src/lib/playbookSearch.js';
import { createIncident, sanitizeIncident } from '../src/state/incident.js';

const DIR = join(import.meta.dirname, '../src/playbooks/library');

describe('scenario library', () => {
  it('passes the content validator', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => [f, JSON.parse(readFileSync(join(DIR, f), 'utf8'))]);
    const { errors, count } = validateLibrary(files);
    expect(errors).toEqual([]);
    expect(count).toBe(LIBRARY_PLAYBOOKS.length);
  });

  it('ships at least 500 playbooks', () => {
    expect(allPlaybooks([]).length).toBeGreaterThanOrEqual(500);
    expect(LIBRARY_CATEGORIES.length).toBeGreaterThanOrEqual(20);
  });

  it('ids are unique across built-ins and library', () => {
    const ids = allPlaybooks([]).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('library playbooks are Pro and findable by id', () => {
    const pb = LIBRARY_PLAYBOOKS[0];
    expect(pb.tier).toBe('pro');
    expect(findPlaybook(pb.id, []).id).toBe(pb.id);
  });

  it('incidents snapshot Splunk searches and ATT&CK ids, and keep them through sanitize', () => {
    const pb = LIBRARY_PLAYBOOKS.find((p) => p.attack.length && p.splunk.length);
    const inc = createIncident({ playbook: pb, now: 1 });
    expect(inc.searches.length).toBe(pb.splunk.length);
    expect(inc.attack).toEqual([...new Set(pb.attack)]);
    const back = sanitizeIncident(JSON.parse(JSON.stringify(inc)));
    expect(back.searches).toEqual(inc.searches);
    expect(sanitizeIncident({ ...inc, searches: [{ spl: 42 }, { title: 'x', phase: 'nope', spl: 'index=x' }] }).searches)
      .toEqual([{ title: 'x', phase: 'identification', spl: 'index=x' }]);
  });
});

describe('plain-language search', () => {
  const all = allPlaybooks([]);
  const top = (q) => searchPlaybooks(all, q, { limit: 5 }).map((p) => p.category);

  it.each([
    ['user clicked a phishing link and entered password', 'phishing'],
    ['ransomware encrypted the file server', 'ransomware'],
    ['aws access key leaked', 'aws'],
    ['kubernetes privileged pod', 'containers-k8s'],
  ])('%s → %s', (q, cat) => {
    expect(top(q)).toContain(cat);
  });

  it('matches ATT&CK ids exactly', () => {
    const res = searchPlaybooks(all, 'T1486');
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((p) => p.attack.some((a) => a.startsWith('T1486')))).toBe(true);
  });

  it('empty query returns everything in the category', () => {
    expect(searchPlaybooks(all, '', { category: 'aws' }).length).toBe(LIBRARY_CATEGORIES.find((c) => c.id === 'aws').count);
  });
});
