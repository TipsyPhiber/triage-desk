import { describe, expect, it } from 'vitest';
import { hydrateWorkspace, migrateV1, parseBackup, serializeBackup } from '../src/state/workspace.js';
import { parsePlaybookFile, sanitizePlaybook, serializePlaybook } from '../src/state/playbooks.js';
import { createIncident } from '../src/state/incident.js';
import { BUILTIN_PLAYBOOKS } from '../src/playbooks/builtins.js';

describe('v1 migration', () => {
  it('carries a v0.x incident into the workspace', () => {
    const v1 = {
      activePhase: 'containment',
      severity: 'High',
      incidentName: 'INC-OLD',
      startTime: 1000,
      endTime: null,
      checks: { identification: [true, false, false, false, false, false, false] },
      notes: { containment: 'blocked 1.2.3.4' },
      events: [{ id: 1, ts: 1000, type: 'declare', message: 'Incident declared' }],
      iocIndex: { containment: [{ kind: 'ipv4', value: '1.2.3.4' }] },
    };
    const ws = migrateV1(v1, 5000);
    expect(ws.incidents).toHaveLength(1);
    const inc = ws.incidents[0];
    expect(ws.activeIncidentId).toBe(inc.id);
    expect(inc).toMatchObject({ name: 'INC-OLD', severity: 'High', activePhase: 'containment', startTime: 1000, playbookName: 'General Incident' });
    expect(inc.checks.identification[0]).toBe(true);
    expect(inc.notes.containment).toBe('blocked 1.2.3.4');
    expect(inc.iocIndex.containment).toHaveLength(1);
    expect(inc.events).toHaveLength(1);
  });
});

describe('workspace hydration', () => {
  it('survives garbage', () => {
    for (const junk of [null, 42, 'x', { incidents: 'no' }, { incidents: [null, {}], settings: 7, license: 99 }]) {
      const ws = hydrateWorkspace(junk);
      expect(ws.incidents).toEqual([]);
      expect(ws.license).toBeNull();
      expect(ws.settings.defaultTlp).toBe('TLP:AMBER');
    }
  });

  it('fixes a dangling activeIncidentId and drops duplicate incidents', () => {
    const a = createIncident({ playbook: BUILTIN_PLAYBOOKS[0], id: 'inc-a' });
    const ws = hydrateWorkspace({ incidents: [a, a], activeIncidentId: 'inc-missing' });
    expect(ws.incidents).toHaveLength(1);
    expect(ws.activeIncidentId).toBe('inc-a');
  });

  it('round-trips a backup', () => {
    const a = createIncident({ playbook: BUILTIN_PLAYBOOKS[1], name: 'R', id: 'inc-a' });
    const ws = hydrateWorkspace({ incidents: [a], activeIncidentId: 'inc-a', settings: { orgName: 'Acme' }, license: 'TD1.x.y' });
    const back = parseBackup(serializeBackup(ws));
    expect(back).toEqual(ws);
  });

  it('rejects non-backup files', () => {
    expect(() => parseBackup('{')).toThrow(/JSON/);
    expect(() => parseBackup('{"format":"other"}')).toThrow(/backup/);
  });
});

describe('playbook files', () => {
  it('round-trips and assigns a fresh id on import', () => {
    const src = { ...BUILTIN_PLAYBOOKS[2], id: 'custom-abc', builtIn: false };
    const imported = parsePlaybookFile(serializePlaybook(src));
    expect(imported.name).toBe(src.name);
    expect(imported.tasks).toEqual(src.tasks);
    expect(imported.id).not.toBe('custom-abc');
    expect(imported.builtIn).toBe(false);
  });

  it('cannot masquerade as a built-in', () => {
    const pb = sanitizePlaybook({ id: 'builtin-general', name: 'Evil', builtIn: true, tier: 'free', tasks: {} });
    expect(pb.id).toMatch(/^custom-/);
    expect(pb.builtIn).toBe(false);
    expect(pb.tier).toBe('pro');
  });

  it('caps oversized input', () => {
    const pb = sanitizePlaybook({ name: 'x'.repeat(1000), tasks: { preparation: Array(500).fill('y'.repeat(2000)) } });
    expect(pb.name.length).toBe(120);
    expect(pb.tasks.preparation).toHaveLength(60);
    expect(pb.tasks.preparation[0].length).toBe(500);
  });
});

describe('built-in playbooks', () => {
  it('cover every phase', () => {
    for (const pb of BUILTIN_PLAYBOOKS) {
      for (const phase of ['preparation', 'identification', 'containment', 'eradication', 'recovery', 'lessons']) {
        expect(pb.tasks[phase]?.length, `${pb.id}/${phase}`).toBeGreaterThan(0);
      }
    }
  });
});
