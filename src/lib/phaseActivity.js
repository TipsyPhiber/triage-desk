// Lifecycle gating for IR phases.
//
// The phase a responder should be working in is determined by the incident's
// lifecycle position, not by severity. Both PICERL (SANS) and the NIST SP
// 800-61 incident handling lifecycle treat Preparation as a between-incidents
// readiness phase and Lessons Learned (Post-Incident Activity in NIST) as a
// strictly post-resolution phase. Severity is an orthogonal axis — it drives
// time pressure and escalation cadence, not which phase is doctrinally
// appropriate.
//
// Out-of-phase phases remain accessible (the operator may need to edit them
// for accuracy or work ahead) but are visually de-emphasized and carry an
// advisory explaining the doctrinal context.

export function incidentLifecycle(startTime, endTime) {
  if (startTime == null) return 'idle';
  if (endTime == null) return 'active';
  return 'resolved';
}

export function phaseActivity(stage, lifecycle) {
  if (lifecycle === 'idle')     return stage === 'pre-incident'  ? 'in-phase' : 'out-of-phase';
  if (lifecycle === 'active')   return stage === 'response'      ? 'in-phase' : 'out-of-phase';
  if (lifecycle === 'resolved') return stage === 'post-incident' ? 'in-phase' : 'out-of-phase';
  return 'in-phase';
}

export function phaseAdvisory(stage, lifecycle) {
  if (lifecycle === 'idle') {
    if (stage === 'response') {
      return 'This phase activates once an incident is declared.';
    }
    if (stage === 'post-incident') {
      return 'Lessons Learned is a post-incident phase. Open this after the incident is resolved — ideally within two weeks of recovery.';
    }
  }
  if (lifecycle === 'active') {
    if (stage === 'pre-incident') {
      return 'Preparation is a between-incidents phase. In both PICERL and NIST SP 800-61, it represents ongoing readiness work — best completed outside an active response.';
    }
    if (stage === 'post-incident') {
      return 'Lessons Learned is a post-incident phase. Open this once the incident is resolved.';
    }
  }
  if (lifecycle === 'resolved') {
    if (stage === 'pre-incident') {
      return 'Preparation is a between-incidents phase. Readiness updates are best tracked outside any specific incident.';
    }
    if (stage === 'response') {
      return 'Incident is resolved. This phase remains editable for accuracy; new work belongs in Lessons Learned.';
    }
  }
  return null;
}
