# Triage Desk — Launch Plan

A six-week plan for a solo founder with no budget beyond the store fees. Adjust dates to your launch day (**L**).

Goal for the first 90 days: **50 paying Pro/Team customers** and a list of people who downloaded Free. Learn which segment converts, then double down there.

## What to measure

You have no analytics in the app, by design, and that's a selling point, so measure around it:

| Metric | Where it comes from |
| --- | --- |
| Landing page visits by source | Privacy-friendly analytics on the *marketing site only* (Plausible, Fathom, or Cloudflare Web Analytics). Change the footer line if you add any. |
| Free downloads | Count downloads of `triage-desk.html` on your host, or gate it behind the store's $0 "pay what you want" product so you get an email. |
| Paid conversions | Your store dashboard. |
| Refund rate | Store dashboard. Above 5% means the landing page is promising something the product doesn't do. |
| Feedback | Every reply to your license-delivery email. Read all of them. |

## L−14 to L−7: get ready

- [ ] Finish the selling checklist in `docs/SELLING.md` (private repo, keys, store, EULA).
- [ ] Deploy `site/` to Cloudflare Pages or Netlify on a real domain. Add your checkout links and the free download.
- [ ] Set up the store with three products: Free ($0, collects email), Pro ($59), Team ($349). Use the copy in `COPY.md`.
- [ ] Run `npm run marketing:assets` after your final UI changes, so screenshots match the release.
- [ ] Recruit **5–10 beta users** from your own network: SOC analysts, IR consultants, on-call engineers. Give them free Pro keys (`license:issue --expires` 60 days out) in exchange for 20 minutes of feedback.
- [ ] Ask beta users for permission to quote them. **Only publish quotes you actually receive, with the person's consent.**
- [ ] Write the launch blog post (see "Founding story" in `COPY.md`).

## L−7 to L−1: build the runway

- [ ] Publish one useful, ungated piece of content: **"The first 60 minutes of a ransomware incident: a printable checklist (TLP:CLEAR)"**, built from the Ransomware playbook. It's the lead magnet and your best SEO page.
- [ ] Do the same for phishing and BEC over the following weeks.
- [ ] Line up launch-day posts (drafts in `COPY.md`) and decide posting times. Show HN does best on weekday mornings US Eastern.
- [ ] Tell beta users the launch date and ask them to try the public download and leave honest comments if they want to.

## Launch day (L)

Post in this order, a few hours apart, and stay online to answer every comment:

1. **Show HN.** Lead with the technical angle: zero-network CSP, Rust/WASM extractor, offline Ed25519 licensing, one HTML file. HN rewards "how it's built" and punishes ad copy.
2. **r/blueteamsec** and **r/cybersecurity.** Check each subreddit's self-promotion rules first. Lead with the free edition and the free checklist, not the price.
3. **LinkedIn**, personal profile. This is where IR leads and CISOs actually see things. Tell the "3 a.m." story.
4. **Mastodon (infosec.exchange)** and **Bluesky**. The infosec community there is large and values privacy-first tools.
5. **Product Hunt** (optional, lower intent for this audience). If you do it, launch on a separate day so you're not answering two threads at once.

Don't post product links to **r/netsec**. It's for technical content only. A write-up on "building a browser app with a zero-network CSP" could work there later on its own merits.

## L+1 to L+30: compound

- **Week 1:** reply to everyone. Turn the top three questions into FAQ entries on the landing page. Fix the top bug.
- **Week 2:** publish the phishing checklist. Email Free downloaders a single, useful note: "Here are the five new playbook tasks we added." No hard sell.
- **Week 3:** reach out personally to 20 IR consultancies and MSSPs (LinkedIn or email): offer a free 60-day Team key for their next engagement in exchange for feedback.
- **Week 4:** publish "How to run a 45-minute ransomware tabletop with Triage Desk." Tabletop facilitators are an underserved audience.

## L+30 to L+90: double down

- Look at which segment bought most. Rewrite the landing page hero for that segment.
- Submit a talk to a local **BSides** or OWASP chapter: "Incident timelines that write themselves" (a tooling talk, not a pitch).
- Consider a small newsletter sponsorship in a security newsletter your buyers read, *after* you know your conversion rate.
- Add the most-requested playbook (likely: insider threat, web app compromise, or DDoS).

## SEO targets

Each built-in playbook can become a public, printable checklist page that ranks and converts:

| Page | Target query |
| --- | --- |
| Ransomware first-hour checklist | "ransomware incident response checklist" |
| Phishing response checklist | "phishing incident response checklist" |
| BEC wire fraud response | "business email compromise response steps" |
| Leaked AWS key response | "aws access key exposed what to do" |
| NIST 800-61 incident report template | "incident response report template" |
| Tabletop exercise kit | "ransomware tabletop exercise" |

Each page should be genuinely useful without buying anything, end with "Run this checklist with an automatic timeline: download Triage Desk free," and carry a TLP:CLEAR marking.

## Pricing experiments (after 30 sales)

- Test $79 Pro once you have real testimonials.
- Offer an MSSP plan (unlimited consultants, $999/yr) if consultancies show up in sales.
- Keep Free generous. It's the demo, and it builds trust with a skeptical audience.
