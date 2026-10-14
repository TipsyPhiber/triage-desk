// Plain-language playbook search. Analysts type what they see ("user clicked
// a phishing link", "aws key on github", "T1003"), and this ranks playbooks
// by name, tags, category, ATT&CK ids, and summary.

const SYNONYMS = {
  ransom: ['ransomware', 'encrypt', 'extortion'],
  encrypted: ['ransomware', 'encrypt'],
  phish: ['phishing'],
  phished: ['phishing'],
  clicked: ['phishing', 'link'],
  email: ['email', 'mailbox', 'phishing'],
  mail: ['email', 'mailbox'],
  creds: ['credential', 'credentials', 'password'],
  password: ['credential', 'password'],
  key: ['key', 'secret', 'token', 'credential'],
  leaked: ['leak', 'leaked', 'exposed'],
  o365: ['m365', 'microsoft', 'office'],
  office365: ['m365', 'microsoft'],
  m365: ['m365', 'microsoft', 'exchange'],
  ad: ['active-directory', 'domain', 'kerberos'],
  dc: ['domain', 'active-directory'],
  k8s: ['kubernetes', 'containers'],
  kube: ['kubernetes'],
  docker: ['container', 'containers'],
  ddos: ['ddos', 'flood', 'availability'],
  dos: ['ddos', 'flood'],
  wire: ['payment', 'bec', 'fraud'],
  invoice: ['payment', 'bec', 'vendor'],
  insider: ['insider', 'employee'],
  employee: ['insider', 'employee'],
  laptop: ['laptop', 'device', 'lost'],
  phone: ['mobile', 'phone', 'device'],
  stolen: ['lost', 'stolen', 'theft'],
  github: ['github', 'repo', 'secret'],
  ci: ['ci-cd', 'pipeline', 'devsecrets'],
  scada: ['ot', 'ics', 'scada'],
  plc: ['ot', 'ics', 'plc'],
  miner: ['cryptomining', 'miner'],
  mining: ['cryptomining'],
  webshell: ['web-shell', 'webshell'],
  sqli: ['sql-injection', 'sql'],
  vpn: ['vpn', 'edge'],
  mfa: ['mfa', 'push', 'authentication'],
  okta: ['okta'],
  entra: ['entra', 'azure-ad', 'aad'],
  aad: ['entra'],
  gdpr: ['gdpr', 'privacy', 'notification'],
  hipaa: ['hipaa', 'phi', 'privacy'],
  pii: ['pii', 'privacy', 'data'],
  exfil: ['exfiltration', 'exfil', 'data'],
  c2: ['c2', 'beacon', 'command-and-control'],
  beacon: ['beaconing', 'c2'],
  malware: ['malware'],
  virus: ['malware'],
};

const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'was', 'we', 'our', 'my', 'i', 'it', 'with', 'from', 'by', 'at', 'has', 'have', 'been', 'are', 'got', 'some', 'someone', 'something', 'there']);

export function tokenize(q) {
  return (q || '').toLowerCase().split(/[^a-z0-9.]+/).filter((t) => t && !STOP.has(t));
}

function prep(p) {
  if (p._search) return p._search;
  const tags = (p.tags || []).join(' ');
  p._search = {
    name: p.name.toLowerCase(),
    tags: ` ${tags.replace(/-/g, ' ')} ${tags} `,
    cat: `${p.categoryName || ''} ${p.category || ''}`.toLowerCase(),
    desc: (p.description || '').toLowerCase(),
    attack: (p.attack || []).map((t) => t.toLowerCase()),
  };
  return p._search;
}

function stemMatch(hay, t) {
  if (hay.includes(t)) return true;
  // crude stemming: "phishing" ↔ "phish", "encrypted" ↔ "encrypt"
  if (t.length > 5) {
    const stem = t.replace(/(ing|ed|es|s)$/, '');
    if (stem.length > 3 && hay.includes(stem)) return true;
  }
  return false;
}

export function scorePlaybook(p, tokens) {
  const s = prep(p);
  let score = 0;
  let hits = 0;
  for (const t of tokens) {
    let best = 0;
    if (/^t\d{4}(\.\d{3})?$/.test(t)) {
      if (s.attack.some((a) => a === t || a.startsWith(`${t}.`))) best = 12;
    } else {
      const variants = [t, ...(SYNONYMS[t] || [])];
      for (const v of variants) {
        const w = v === t ? 1 : 0.6;
        if (stemMatch(s.name, v)) best = Math.max(best, 6 * w);
        else if (s.tags.includes(` ${v} `)) best = Math.max(best, 4 * w);
        else if (stemMatch(s.tags, v)) best = Math.max(best, 3 * w);
        else if (stemMatch(s.cat, v)) best = Math.max(best, 2.5 * w);
        else if (stemMatch(s.desc, v)) best = Math.max(best, 1.2 * w);
      }
    }
    if (best > 0) hits++;
    score += best;
  }
  if (!tokens.length) return 0;
  // Reward matching more of what the analyst typed.
  return score * (0.5 + hits / tokens.length / 2) + (hits === tokens.length ? 2 : 0);
}

export function searchPlaybooks(playbooks, query, { category = null, limit = Infinity } = {}) {
  const pool = category ? playbooks.filter((p) => (p.category || 'custom') === category) : playbooks;
  const tokens = tokenize(query);
  if (!tokens.length) return pool.slice(0, limit);
  return pool
    .map((p) => [p, scorePlaybook(p, tokens)])
    .filter(([, s]) => s > 1)
    .sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name))
    .slice(0, limit)
    .map(([p]) => p);
}
