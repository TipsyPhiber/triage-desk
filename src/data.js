// The six-phase NIST SP 800-61 / PICERL lifecycle. Phase identity and stage
// are fixed — lifecycle gating depends on them — while the task lists live in
// playbooks (see playbooks/builtins.js) so teams can tailor them.
export const PHASES = [
  {
    id: 'preparation',
    name: 'Preparation',
    short: 'Prep',
    stage: 'pre-incident',
    description: 'Ensure people, tooling, and process are ready before an incident occurs.',
  },
  {
    id: 'identification',
    name: 'Identification',
    short: 'Identify',
    stage: 'response',
    description: 'Determine whether an event is a real incident, and document its scope.',
  },
  {
    id: 'containment',
    name: 'Containment',
    short: 'Contain',
    stage: 'response',
    description: 'Limit the blast radius — short-term and long-term containment.',
  },
  {
    id: 'eradication',
    name: 'Eradication',
    short: 'Eradicate',
    stage: 'response',
    description: 'Remove the threat and close the door behind it.',
  },
  {
    id: 'recovery',
    name: 'Recovery',
    short: 'Recover',
    stage: 'response',
    description: 'Bring systems back to production safely and watch for recurrence.',
  },
  {
    id: 'lessons',
    name: 'Lessons Learned',
    short: 'Lessons',
    stage: 'post-incident',
    description: 'Close the loop. Make the next incident shorter than this one.',
  },
];

export const SEVERITIES = {
  Low: {
    label: 'Low',
    accent: 'bg-sky-500',
    accentText: 'text-sky-400',
    accentBorder: 'border-sky-500/40',
    accentSoft: 'bg-sky-500/10',
    ring: 'ring-sky-500/30',
    glow: 'shadow-sky-500/20',
    description: 'Minor impact, no customer effect',
  },
  Medium: {
    label: 'Medium',
    accent: 'bg-amber-500',
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/40',
    accentSoft: 'bg-amber-500/10',
    ring: 'ring-amber-500/30',
    glow: 'shadow-amber-500/20',
    description: 'Limited impact or degraded service',
  },
  High: {
    label: 'High',
    accent: 'bg-orange-500',
    accentText: 'text-orange-400',
    accentBorder: 'border-orange-500/40',
    accentSoft: 'bg-orange-500/10',
    ring: 'ring-orange-500/30',
    glow: 'shadow-orange-500/20',
    description: 'Significant customer or data impact',
  },
  Critical: {
    label: 'Critical',
    accent: 'bg-rose-500',
    accentText: 'text-rose-400',
    accentBorder: 'border-rose-500/40',
    accentSoft: 'bg-rose-500/10',
    ring: 'ring-rose-500/30',
    glow: 'shadow-rose-500/20',
    description: 'Active breach, outage, or regulatory exposure',
  },
};


// FIRST Traffic Light Protocol 2.0 markings, applied to exported reports.
export const TLP_LEVELS = {
  'TLP:CLEAR': 'Disclosure is not limited.',
  'TLP:GREEN': 'Limited disclosure, restricted to the community.',
  'TLP:AMBER': 'Limited disclosure, restricted to participants\' organization and its clients.',
  'TLP:AMBER+STRICT': 'Limited disclosure, restricted to participants\' organization only.',
  'TLP:RED': 'For the eyes and ears of individual recipients only, no further disclosure.',
};

export const PHASE_IDS = PHASES.map((p) => p.id);
