# Triage Desk and Splunk

Triage Desk comes in two editions. Both work with Splunk.

| | Offline (Free / Pro) | Connected |
| --- | :-: | :-: |
| SPL searches in every scenario playbook, with fill-in values | ✓ | ✓ |
| Hunting searches generated from the incident's IOCs | ✓ (copy) | ✓ (run) |
| Start an incident from a pasted alert, notable, or CSV/JSON export | ✓ | ✓ |
| IOC lookup table export (`.csv`) | ✓ | ✓ |
| Timeline export as HTTP Event Collector events (`.json`) | ✓ | ✓ |
| Run searches and see results inside the incident | | ✓ |
| Pull recent Enterprise Security notable events | | ✓ |
| Send the incident timeline to Splunk through HEC | | ✓ |
| Network access | **None.** The page's security policy blocks every connection | Only to the Splunk URLs you enter |

The Connected edition is a separate file (`connected/triage-desk-connected.html`, or `connected/web/` for hosting). It needs a Connected license key. The offline file never changes: it still cannot reach the network at all.

## Offline edition: working with Splunk by copy and paste

- **Playbook searches.** Each scenario lists 2–4 searches per phase where they help. Values you need to supply look like `<suspect_user>`. Type them into the boxes above the search and click **Copy**.
- **IOC hunting.** Extract IOCs in any phase, then open the side panel (**T**) → **Splunk**. You get CIM data model searches for network traffic, DNS, web, endpoint hashes and email, plus a raw sweep across all indexes.
- **Import an alert** (**I**, or **Import a Splunk alert**). Paste or open any of these:
  - the JSON body an alert action webhook posts (`search_name`, `result`, `results_link`);
  - an export from the search REST API (JSON lines or `{ "results": [...] }`);
  - a CSV export from a search or Incident Review.

  Triage Desk names the incident after the rule, sets severity from `urgency`, suggests the closest playbook, writes the alert into Identification notes, and extracts its indicators.
- **Send data back.** Side panel → Splunk → **IOC lookup table** gives you a CSV for *Settings → Lookups*. **Timeline as HEC events** gives you newline-delimited events with `sourcetype=triage_desk:timeline`. Post them with `curl` or add them through *Add Data*.

## Connected edition setup

### 1. Create tokens

- **Search token:** in Splunk Web, *Settings → Tokens → New Token*. Use a dedicated user whose role can search the indexes your playbooks reference. A read-only role is enough.
- **HEC token (optional, for sending the timeline):** *Settings → Data inputs → HTTP Event Collector → New Token*. Restrict it to one index, for example `incident_response`.

### 2. Allow the browser to call Splunk (CORS)

Browsers only let a page call another origin's API if that server allows it. Add the origin Triage Desk runs from:

- **Hosted** (`connected/web/` on an internal server): use its origin, for example `https://triage.example.com`.
- **Single file** opened from disk: the browser sends `Origin: null`. Hosting the `web/` folder is strongly recommended over allowing `null`.

`$SPLUNK_HOME/etc/system/local/server.conf` (REST API, port 8089):

```ini
[httpServer]
crossOriginSharingPolicy = https://triage.example.com
crossOriginSharingHeaders = Authorization, Content-Type
```

`$SPLUNK_HOME/etc/apps/splunk_httpinput/local/inputs.conf` (HEC, port 8088):

```ini
[http]
crossOriginSharingPolicy = https://triage.example.com
```

Restart Splunk after the change. On Splunk Cloud, ask Splunk Support to enable REST API access for your IP range and set the CORS policy. HEC on Splunk Cloud is `https://http-inputs-<stack>.splunkcloud.com`.

### 3. Trust the certificate

The browser must trust Splunk's TLS certificate. With the default self-signed certificate, the request fails before it reaches Splunk. Either install a certificate from your internal CA, or open `https://splunk.example.com:8089` once in the same browser and accept it. Plain `http://` is only allowed for `localhost`.

### 4. Connect

In Triage Desk: *Settings → Splunk*. Enter the REST URL (`https://splunk.example.com:8089`), the search token, and optionally the HEC URL and token. Click **Test connection**.

## What the Connected edition sends, and where

- **Search:** `POST {REST URL}/services/search/v2/jobs/export` with `Authorization: Bearer <token>`, the SPL you clicked **Run** on, and the time range. At most 1,000 rows come back.
- **Notables:** the same endpoint with `search index=notable earliest=-24h …`.
- **Timeline:** `POST {HEC URL}/services/collector/event` with `Authorization: Splunk <HEC token>`. One event per timeline entry: incident name and ID, severity, TLP, playbook, event type and message.
- Nothing else is ever sent. Tokens live in this browser's local storage under `triage-desk-splunk-v1`. They are never written to backups, reports, or exports. **Forget credentials** in *Settings → Splunk* removes them.
- Searches and sends are logged on the incident timeline with type `Splunk`.

## Troubleshooting

| Message | Likely cause |
| --- | --- |
| "Could not reach …" | Certificate not trusted, wrong port, firewall, or the CORS policy doesn't list this page's origin |
| "Splunk rejected the token (HTTP 401)" | Token expired or disabled, or token authentication is off (*Settings → Tokens → Enable*) |
| HEC error 4 / 403 | Wrong HEC token, or the token isn't allowed to write to that index |
| Search returns 0 rows | Time range too short (change it in Settings → Splunk), or the data model isn't accelerated; the searches use `summariesonly=false`, so they still work, just more slowly |
