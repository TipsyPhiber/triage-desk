function key(ioc) {
  return `${ioc.kind}\0${ioc.value}`;
}

// Returns the original array unchanged if nothing new would be added, so the
// caller can rely on referential equality to skip a state update.
export function mergeIocs(existing, additions) {
  if (!additions || additions.length === 0) return existing;
  const seen = new Set(existing.map(key));
  const next = [];
  for (const r of additions) {
    const k = key(r);
    if (!seen.has(k)) {
      seen.add(k);
      next.push({ kind: r.kind, value: r.value });
    }
  }
  if (next.length === 0) return existing;
  return [...existing, ...next];
}

// Roll the per-phase index into a single map keyed by (kind, value), where
// each entry tracks the set of phase shortcodes the IOC appeared in.
export function aggregateIocs(iocIndexByPhase, phases) {
  const out = new Map();
  for (const p of phases) {
    for (const ioc of iocIndexByPhase[p.id] || []) {
      const k = key(ioc);
      if (!out.has(k)) {
        out.set(k, { kind: ioc.kind, value: ioc.value, phases: new Set() });
      }
      out.get(k).phases.add(p.short);
    }
  }
  return out;
}
