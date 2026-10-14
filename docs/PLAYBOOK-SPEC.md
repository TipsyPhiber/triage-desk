# Scenario playbook library: authoring spec

Every file in `src/playbooks/library/` is one **category** of hand-written incident scenarios. The app loads them all automatically. `npm run library:check` validates them.

## File shape

```json
{
  "category": {
    "id": "aws",
    "name": "AWS",
    "description": "Incidents in Amazon Web Services accounts: IAM, S3, EC2, Lambda, and organization-level abuse."
  },
  "playbooks": [ { …playbook… } ]
}
```

## Playbook shape

| Field | Rule |
| --- | --- |
| `id` | `lib-<category-id>-<slug>`, lowercase kebab, unique across the whole library |
| `name` | ≤80 chars, the scenario as a responder would say it: "Exposed AWS access key used from unknown IP" |
| `summary` | 40–260 chars: when to use this playbook, in plain language |
| `tags` | 2–8 lowercase kebab tags (`aws`, `iam`, `credential-theft`) |
| `attack` | MITRE ATT&CK technique ids (`T1078.004`); may be empty for non-adversarial incidents |
| `severity` | Suggested starting severity: `Low`, `Medium`, `High`, or `Critical` |
| `tasks` | Object with all six phases: `preparation`, `identification`, `containment`, `eradication`, `recovery`, `lessons`. 3–8 tasks each, 12–160 chars each |
| `splunk` | 2–4 Splunk searches `{ "title", "phase", "spl" }` |

## Quality bar

- **Scenario-specific.** Each task names the actual system, log, console, artifact, or decision for *this* scenario. "Search CloudTrail for `CreateAccessKey` and `AttachUserPolicy` by the leaked key's user since first use" is right. "Investigate the incident" is rejected.
- **Imperative, one action per task**, as a checklist item an analyst ticks off. No numbering, no trailing period needed.
- **Preparation** is what should already exist before this kind of incident (logging enabled, contacts, tooling, access). **Lessons** is the post-incident review specific to this scenario (detections to add, controls that failed, metrics).
- **No two playbooks may share more than 40% of their tasks.** Similar scenarios must differ in substance.
- **Splunk searches** must be realistic SPL that starts with `| tstats`, `index=`, `search `, or a `` `macro` ``. Prefer CIM data models (`Authentication`, `Network_Traffic`, `Web`, `Endpoint.Processes`, `Email`, `Change`) with `summariesonly=false`, or well-known sourcetypes (`aws:cloudtrail`, `o365:management:activity`, `azure:aad:signin`, `WinEventLog:Security`, `XmlWinEventLog:Microsoft-Windows-Sysmon/Operational`, `pan:traffic`, `stream:dns`, `okta:im2`, `gws:reports:login`, `kube:apiserver:audit`). Use `index=*` or a plausible index name. Use placeholders like `<suspect_user>`, `<ioc_ip>`, `<host>` where the analyst fills a value in. JSON strings must escape quotes and backslashes.
- **Safe examples only.** Use RFC 5737 IPs (192.0.2.x, 198.51.100.x, 203.0.113.x) and `.example` domains if you need sample values. No real malware hashes or real company names as victims.
- Defensive content only: detection, response, and recovery steps.
