import { describe, expect, it } from 'vitest';
import * as I from '../src/state/incident.js';
import { BUILTIN_PLAYBOOKS } from '../src/playbooks/builtins.js';

const general = BUILTIN_PLAYBOOKS[0];
const T0 = 1_700_000_000_000;

describe('incident lifecycle', () => {
  it('declares into Identification and starts the timeline', () => {
    const inc = I.declareIncident(I.createIncident({ playbook: general, now: T0 }), T0 + 5);
    expect(inc.activePhase).toBe('identification');
    expect(inc.startTime).toBe(T0 + 5);
    expect(inc.events).toHaveLength(1);
    expect(inc.events[0].type).toBe('declare');
  });

  it('only logs activity while running', () => {
    let inc = I.createIncident({ playbook: general, now: T0 });
    inc = I.toggleCheck(inc, 'preparation', 0, T0);
    expect(inc.checks.preparation[0]).toBe(true);
    expect(inc.events).toHaveLength(0);

    inc = I.declareIncident(inc, T0 + 1);
    inc = I.toggleCheck(inc, 'identification', 2, T0 + 2);
    inc = I.setSeverity(inc, 'Critical', T0 + 3);
    inc = I.addQuickNote(inc, 'identification', '  user confirmed click  ', T0 + 4);
    expect(inc.events.map((e) => e.type)).toEqual(['declare', 'check', 'severity', 'note']);
    expect(inc.events.map((e) => e.id)).toEqual([1, 2, 3, 4]);
    expect(inc.checkedAt.identification[2]).toBe(T0 + 2);
    expect(I.toggleCheck(inc, 'identification', 2, T0 + 9).checkedAt.identification[2]).toBeNull();
    expect(inc.notes.identification).toMatch(/\] user confirmed click$/);

    inc = I.resolveIncident(inc, T0 + 10);
    expect(inc.activePhase).toBe('lessons');
    const before = inc.events.length;
    inc = I.toggleCheck(inc, 'lessons', 0, T0 + 11);
    expect(inc.events).toHaveLength(before);
  });

  it('refuses to switch to a locked phase', () => {
    const inc = I.declareIncident(I.createIncident({ playbook: general, now: T0 }), T0);
    expect(I.setActivePhase(inc, 'preparation', T0)).toBe(inc);
    expect(I.setActivePhase(inc, 'containment', T0).activePhase).toBe('containment');
  });

  it('returns the same object for no-op changes', () => {
    const inc = I.createIncident({ playbook: general, now: T0 });
    expect(I.setSeverity(inc, inc.severity)).toBe(inc);
    expect(I.setSeverity(inc, 'Bogus')).toBe(inc);
    expect(I.toggleCheck(inc, 'preparation', 999)).toBe(inc);
    expect(I.addQuickNote(inc, 'preparation', '   ')).toBe(inc);
  });

  it('reset keeps identity but clears progress', () => {
    let inc = I.createIncident({ playbook: general, name: 'INC-1', now: T0 });
    inc = I.declareIncident(inc, T0);
    inc = I.setNote(inc, 'identification', 'stuff');
    const reset = I.resetIncident(inc, T0 + 100);
    expect(reset.id).toBe(inc.id);
    expect(reset.name).toBe('INC-1');
    expect(reset.createdAt).toBe(T0);
    expect(reset.startTime).toBeNull();
    expect(reset.notes.identification).toBe('');
  });

  it('dedupes IOCs per phase', () => {
    let inc = I.declareIncident(I.createIncident({ playbook: general, now: T0 }), T0);
    inc = I.recordIocs(inc, 'identification', [{ kind: 'ipv4', value: '1.2.3.4' }], T0);
    inc = I.recordIocs(inc, 'identification', [{ kind: 'ipv4', value: '1.2.3.4' }, { kind: 'domain', value: 'evil.test' }], T0);
    expect(inc.iocIndex.identification).toHaveLength(2);
  });
});

describe('sanitizeIncident', () => {
  it('repairs corrupt fields', () => {
    const inc = I.sanitizeIncident({
      id: 'inc-x',
      tasks: { preparation: ['a', 'b', 42, ''], bogus: ['x'] },
      checks: { preparation: [true] },
      severity: 'Apocalyptic',
      endTime: 5,
      events: [{ id: 1, ts: 1, type: 'declare', message: 'ok' }, { id: 1, ts: 2, type: 'declare', message: 'dup' }, { id: 2, ts: 3, type: 'pwn', message: 'x' }],
    });
    expect(inc.tasks.preparation).toEqual(['a', 'b']);
    expect(inc.tasks).not.toHaveProperty('bogus');
    expect(inc.checks.preparation).toEqual([false, false]);
    expect(inc.severity).toBe('Medium');
    expect(inc.endTime).toBeNull();
    expect(inc.events).toHaveLength(1);
  });

  it('rejects incidents without an id', () => {
    expect(I.sanitizeIncident({})).toBeNull();
    expect(I.sanitizeIncident(null)).toBeNull();
  });
});
