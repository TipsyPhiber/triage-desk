# Selling Triage Desk: launch runbook

> Marketing kit: [`marketing/POSITIONING.md`](marketing/POSITIONING.md) (who it's for, what to claim), [`marketing/LAUNCH-PLAN.md`](marketing/LAUNCH-PLAN.md) (six-week plan), and [`marketing/COPY.md`](marketing/COPY.md) (launch posts, store listing, emails).

This is the seller-side guide: everything between "the code works" and "money arrives."

## 0. Before anything else

- [ ] **Make the GitHub repository private.** It's currently public. With no LICENSE file it's legally "all rights reserved," so nobody may use it without permission, but anyone can still read the source and patch out the Pro check. Go to GitHub → Settings → General → Danger Zone → Change visibility.
- [ ] Decide what entity sells it (sole proprietor vs. LLC) and get the EULA reviewed by a lawyer. `EULA.md` is a starting template, not legal advice.
- [ ] Pick a **merchant of record** (see §4). It handles sales tax and VAT for you, which matters a lot for a solo seller with international customers.

## 1. Create your signing keypair (once, ever)

```bash
npm run license:keygen
```

- The private key goes to `~/.triage-desk/license-signing.key` (mode 600; on Windows `%USERPROFILE%\.triage-desk\license-signing.key`). **Back it up offline**, e.g. on an encrypted USB drive and in a password manager. If you lose it, you can't issue keys that work with existing builds. If it leaks, anyone can mint licenses.
- The public key is written into `src/license/publicKey.js`. Commit that file; it's meant to be public.
- Running keygen again refuses to overwrite the key unless you pass `--force`, because replacing it invalidates every license you've ever issued.

## 2. Configure the storefront

Edit `src/config.js`:

```js
export const PURCHASE_URL = 'https://yourstore.lemonsqueezy.com/buy/…';
export const SUPPORT_EMAIL = 'support@yourdomain.com';
```

`PURCHASE_URL` powers the **Buy Pro** button in the app's License panel.

## 3. Build a release

```bash
npm run release
```

This runs the tests, builds both variants, and writes `release/triage-desk-v<version>.zip` containing:

| File | For |
| --- | --- |
| `triage-desk.html` | Double-click to run. Works offline and air-gapped. Most customers want this. |
| `web/` | Static build for teams that want to host it on an internal web server. |
| `EULA.md`, `CUSTOMER-README.md` | Shipped with every download. |

The release step refuses to run without a public key, and warns if the purchase URL or support email is blank.

Builds are stamped with their build date (override with `BUILD_DATE=YYYY-MM-DD` for reproducible builds). That date is what "updates until" licenses are checked against.

**Before each release:** bump `version` in `package.json` and add an entry to `CHANGELOG.md`.

## 4. Payments

The app never phones home, so license keys are signed by you, not by the store. Options, roughly in order of setup effort:

1. **Lemon Squeezy or Paddle (recommended).** They're merchants of record, so they collect and remit sales tax and VAT worldwide. Sell a digital product whose delivery is the release zip, then email the key (step 5).
2. **Gumroad.** Also a merchant of record, simplest to set up, higher fees.
3. **Stripe Payment Links.** Lowest fees, but *you* are responsible for sales tax and VAT compliance.

Upload the release zip as the product file. Every buyer can download the app, and the free tier works without a key, so the key is the only thing you deliver per sale.

## 5. Issue a license key per sale

```bash
npm run license:issue -- \
  --name "Acme Corp SOC" \
  --email buyer@acme.example \
  --seats 5 \
  --updates-until 2027-10-13
```

It prints a `TD1.…` key. Email it to the buyer; they paste it into **Settings & license → License**.

| Flag | Meaning |
| --- | --- |
| `--name` | Licensee shown in the app (person or company) |
| `--email` | Purchaser email (shown in the app; keep it for your records) |
| `--seats` | Analysts covered. This is honor-system and not enforced. |
| `--updates-until YYYY-MM-DD` | Perpetual license that covers every build released on or before this date. Newer builds show "renew for updates," and older builds keep working forever. Omit it for lifetime updates. |
| `--expires YYYY-MM-DD` | Hard expiry. Use it for trials or subscriptions. |
| `--json` | Machine-readable output (`{ lid, token }`), handy for automation |

Each key gets a license ID (`L-YYYYMMDD-xxxxxxxx`). **Keep a ledger** (a spreadsheet is fine) of license ID, buyer, email, seats, dates and order number. You'll need it for support, renewals and refunds.

Check any key a customer sends you with `npm run license:verify -- TD1.…`.

### Automating delivery later

Once sales volume justifies it, put the issue step behind your store's "order created" webhook: a small serverless function holds the private key, calls `signLicense()` from `src/license/license.js`, and emails the result. Until then, manual issuing takes about 30 seconds per sale and keeps the private key off the internet.

## 6. Suggested pricing (starting point)

| Plan | Suggested price | Key flags |
| --- | --- | --- |
| Free | $0 | (no key) |
| Pro, individual | $59 one-time, 12 months of updates | `--seats 1 --updates-until <+1y>` |
| Pro, team (up to 10 analysts) | $349 one-time, 12 months of updates | `--seats 10 --updates-until <+1y>` |
| Update renewal | ~40% of original price per year | reissue with a new `--updates-until` |
| 14-day trial | $0 | `--expires <+14d>` |

The "perpetual license plus a year of updates" model suits offline security tools well. Security teams often can't approve recurring SaaS subscriptions, but they *can* expense a one-time tool purchase, and they appreciate that it keeps working without a license server.

## 7. Landing page

`site/index.html` is a standalone marketing page with no build step. Before deploying, replace the `#buy-pro` and `#buy-team` links with your checkout URLs and copy `triage-desk.html` from the release into `site/` (the Download buttons point at it). Then deploy the `site/` folder to GitHub Pages, Netlify, or Cloudflare Pages. Consider offering a free download of `triage-desk.html` directly from it: the free tier is the best demo you have.

## 8. Honest limits to know about

- **License checks are client-side.** Anyone motivated can patch them out of the JavaScript. This keeps honest customers honest, which is the realistic goal for a $59 tool. Your real protection is that companies buying security tooling generally want the license on file.
- **Data lives in one browser profile.** Customers who clear site data lose their workspace unless they've exported a backup. The app warns about this in Settings → Data and shows a banner if storage writes fail. Mention it in onboarding emails.
- **Not a multi-user system.** Two analysts can't edit the same incident at once. "Seats" means how many people may use it, not concurrent collaboration. A hosted team edition would be the natural v2 upsell.

## 9. Launch checklist

- [ ] Repo private
- [ ] `npm run license:keygen`; private key backed up in two places
- [ ] `src/config.js` purchase URL and support email set
- [ ] EULA reviewed and the `[BRACKETED]` fields in `EULA.md` filled in
- [ ] CI is green on Windows and Linux (GitHub → Actions)
- [ ] `npm run release` succeeds
- [ ] Product created on the store with the release zip attached
- [ ] Test purchase made end to end: buy → issue key → activate in a clean browser
- [ ] Landing page deployed with working buy links
- [ ] License ledger spreadsheet created
