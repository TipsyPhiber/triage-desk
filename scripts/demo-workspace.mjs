// Realistic demo workspace for screenshots, the demo video, and the live
// preview. Built with the app's own pure incident operations. All indicators
// use documentation-reserved ranges (RFC 5737 IPs, .example domains).

import * as I from '../src/state/incident.js';
import { BUILTIN_PLAYBOOKS } from '../src/playbooks/builtins.js';

const pb = (id) => BUILTIN_PLAYBOOKS.find((p) => p.id === `builtin-${id}`);
const MIN = 60_000;

function checkAll(inc, phase, idxs, t0, stepMin) {
  idxs.forEach((idx, k) => { inc = I.toggleCheck(inc, phase, idx, t0 + k * stepMin * MIN); });
  return inc;
}

export function demoWorkspace(now, license) {
  // Active critical ransomware incident — the hero shot.
  let r = I.createIncident({ playbook: pb('ransomware'), name: 'INC-2026-0147 · Ransomware on FS-01 file server', severity: 'High', tlp: 'TLP:RED', now: now - 60 * MIN, id: 'inc-demo-ransomware' });
  let t = now - 52 * MIN;
  r = I.declareIncident(r, t);
  r = I.setSeverity(r, 'Critical', t + 2 * MIN);
  r = checkAll(r, 'identification', [0, 1, 2, 3, 4, 5, 6], t + 3 * MIN, 3);
  r = I.addQuickNote(r, 'identification', 'Ransom note README_RESTORE.txt on \\\\FS-01\\finance; extension .lockd', t + 4 * MIN);
  r = I.recordIocs(r, 'identification', [
    { kind: 'IPv4', value: '203.0.113.47' }, { kind: 'IPv4', value: '198.51.100.23' },
    { kind: 'Domain', value: 'update-cdn.example' }, { kind: 'Domain', value: 'files-sync.example' },
    { kind: 'SHA256', value: '9f2c4b8e1d7a6035c2e4f1b9a8d7c6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9' },
    { kind: 'Email', value: 'recovery@protonmail.example' },
  ], t + 12 * MIN);
  r = I.setNote(r, 'identification', [
    '[14:02] Detection: EDR alert "mass file rename" on FS-01 (Defender ATP)',
    '[14:05] Patient zero: WS-FIN-07 via RDP from 203.0.113.47',
    '[14:09] Exfil suspected: rclone.exe to files-sync.example (38 GB)',
    '[14:15] Backups: Veeam repo intact, last good restore point 02:00',
  ].join('\n'));
  r = I.setActivePhase(r, 'containment', t + 24 * MIN);
  r = checkAll(r, 'containment', [0, 1, 2], t + 26 * MIN, 5);
  r = I.addQuickNote(r, 'containment', 'Backup VLAN isolated; Veeam service account disabled', t + 31 * MIN);
  r = I.addQuickNote(r, 'containment', 'Legal + cyber insurer notified (policy #CY-4471)', t + 40 * MIN);

  // Second active incident.
  let p = I.createIncident({ playbook: pb('phishing'), name: 'INC-2026-0146 · Finance phishing → credential theft', severity: 'High', tlp: 'TLP:AMBER', now: now - 140 * MIN, id: 'inc-demo-phish' });
  p = I.declareIncident(p, now - 133 * MIN);
  p = checkAll(p, 'identification', [0, 1, 2, 3, 4, 5], now - 130 * MIN, 6);
  p = I.setActivePhase(p, 'containment', now - 90 * MIN);
  p = checkAll(p, 'containment', [0, 1, 2, 3], now - 85 * MIN, 8);
  p = I.setActivePhase(p, 'eradication', now - 50 * MIN);
  p = checkAll(p, 'eradication', [0], now - 45 * MIN, 5);

  // Resolved BEC incident.
  let b = I.createIncident({ playbook: pb('bec'), name: 'INC-2026-0139 · Vendor BEC — wire recall', severity: 'Medium', tlp: 'TLP:AMBER', now: now - 3 * 24 * 60 * MIN, id: 'inc-demo-bec' });
  const bt = now - 3 * 24 * 60 * MIN;
  b = I.declareIncident(b, bt);
  for (const phase of ['identification', 'containment', 'eradication', 'recovery']) {
    b = I.setActivePhase(b, phase, bt + MIN);
    b = checkAll(b, phase, b.tasks[phase].map((_, i) => i), bt + 10 * MIN, 9);
  }
  b = I.resolveIncident(b, bt + 342 * MIN);

  // Standby drill.
  const d = I.createIncident({ playbook: pb('cloud-credentials'), name: 'Tabletop · cloud access key leak drill', severity: 'Low', tlp: 'TLP:GREEN', now: now - 10 * MIN, id: 'inc-demo-drill' });

  return {
    version: 2,
    incidents: [d, b, p, r],
    activeIncidentId: r.id,
    customPlaybooks: [],
    settings: { orgName: 'Example Co. Security Operations', preparedBy: 'J. Rivera, Incident Commander', defaultTlp: 'TLP:AMBER' },
    license,
  };
}

