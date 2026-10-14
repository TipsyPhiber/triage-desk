# Triage Desk — Positioning

Use this as the source of truth for every page, post, and email. When copy drifts, come back here.

## One-liner

**Incident response on rails.** 525 hand-written scenario playbooks with Splunk searches built in, an automatic timeline, IOC extraction, and TLP-marked reports, in one HTML file that never touches the network. (The Connected edition talks only to the customer's own Splunk.)

Short tagline: **Run the incident. Not the spreadsheet.**

## Who buys it

| Segment | Who they are | What they care about | Plan |
| --- | --- | --- | --- |
| **SOC analysts and IR leads** at mid-size companies (200–5,000 staff) | Have an IR plan PDF, a ticketing system, and chat. No dedicated IR platform. | A consistent record they can defend to leadership, legal, and the insurer. | Pro, then Team |
| **IR consultants and MSSPs** | Run incidents for many clients, often on client networks. | Client data never on a third-party cloud. Branded, TLP-marked deliverables. Speed. | Pro per consultant |
| **On-call / IT / platform teams** without a SOC | A security incident lands on whoever is on call. | Being told what to do next. Not missing a step. | Free → Pro |
| **Security trainers and tabletop facilitators** | Run drills and exercises. | Realistic scenario playbooks and an after-action timeline. | Pro / Team |

Not a fit: teams already running a SOAR or hosted IR platform with integrations and automation. Don't fight that; position as the lightweight option or the air-gapped fallback.

## The problem, in their words

- "When did we first know?" Leadership, legal, regulators, and the cyber insurer all ask, and the answer is scattered across chat and memory.
- "Did anyone rotate the service account?" There's no shared checklist under pressure, so steps get skipped or duplicated.
- "Where's the report?" The post-incident write-up takes days of reconstruction, so it often never gets written.
- "We can't put incident notes in another SaaS tool." Sensitive data, client contracts, or classified networks rule out hosted tools.

## Value propositions (in priority order)

1. **Your incident data never leaves the machine.** No account, no telemetry, no server, enforced by a strict Content-Security-Policy anyone can verify in DevTools. Works air-gapped.
2. **The timeline writes itself.** Every task, phase change, severity change, and note is stamped T+ from declaration. This answers "when did we know?" exactly.
3. **A playbook for every scenario.** 525 hand-written playbooks across 23 categories (ransomware to Kubernetes to OT), each mapped to ATT&CK, with Splunk searches per phase. Describe what's happening in plain words and get the closest plan.
4. **Works with Splunk.** Paste an alert to start an incident; copy ready-made SPL; export lookups and HEC timelines. Connected runs searches and sends the timeline back.
5. **IOC extraction built in.** Paste logs or emails and get deduplicated, refanged indicators with a one-click blocklist.
6. **A report leadership can read.** TLP-marked, branded, printable to PDF, ready at resolution.
7. **Zero rollout.** One file. No install, no admin rights, no procurement-heavy SaaS review.

## Proof points (all true today; keep it that way)

- Single HTML file, about 2 MB including the whole playbook library, runs from disk in Chrome, Edge, Firefox, and Safari.
- CSP: `default-src 'none'`, `connect-src data:`. No network requests (covered by automated browser tests).
- Tested on every release on Windows and Linux in Chromium, Firefox, WebKit, and Edge.
- Ed25519-signed offline license keys, with no license server.
- 525 playbooks, 10,000+ tasks, 1,250+ Splunk searches; a quality gate in CI rejects filler and near-duplicates.
- Rust/WebAssembly IOC extractor: IPv4, domains, URLs, MD5/SHA1/SHA256, emails, CVEs, defanged input.
- FIRST TLP 2.0 markings on every report.
- Free backup/restore of the whole workspace as JSON. No lock-in.

**Never claim:** compliance ("makes you NIST/ISO compliant"), customer counts or logos you don't have, testimonials you haven't received, automation or integrations, multi-user real-time collaboration.

## Objections and answers

| Objection | Answer |
| --- | --- |
| "We already have an IR plan." | Keep it. Triage Desk turns the plan into a checklist people actually work through, and records what they did. Paste your plan's steps into a custom playbook. |
| "Why not a spreadsheet / Confluence page?" | Neither keeps time for you. The automatic T+ timeline and the report at the end are what save the post-incident week. |
| "Why not a SOAR / hosted IR platform?" | If you have one, use it. Triage Desk is for teams that don't, or that can't put incident data in a vendor cloud, or that need something that works when the network is down. |
| "Browser local storage? What if we lose it?" | One-click backup to a JSON file, free in every edition. The app warns if storage fails. Treat backups as evidence, per the incident's TLP. |
| "Single-user?" | Yes, deliberately. Each analyst runs a workspace; share playbooks as JSON and incidents as backups or reports. |
| "$59 for a checklist app?" | It's the price of one hour of an incident responder's time, paid once. The report alone saves more than that on the first incident. |

## Voice

- Write like a calm incident commander: short sentences, concrete nouns, no hype.
- Use the field's terms correctly: *declare*, *contain*, *eradicate*, *IOC*, *TLP:AMBER*, *T+*, *tabletop*, *IC*.
- Show, don't adjectivize: "stamped T+00:12" beats "powerful timeline".
- No fear-mongering about breaches. The reader already knows.
- No emoji in product or landing copy. Sparing use on social is fine.
