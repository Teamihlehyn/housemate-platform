# Founder and PM set-up checklist: Peabudy beta

> Status: **draft** (9 Nov 2026, updated 21:30 after the domain purchase). Index: [`README.md`](README.md). This repo is public: **never paste keys, connection strings, personal emails or tester details into it.** Where this file shows `[LIKE THIS]`, fill the value in the place named (Vercel, Resend, Tally), not here.
>
> **Name:** the product is now **Peabudy** (founder, 9 Nov 2026). Domain: **`peabudy.com`, bought on Vercel**. Code identifiers (the `housemate-platform` Vercel project, `housemate_db`, and so on) keep their names.
>
> Assumes D1: real people, London and Lagos, Option B from 11 Nov. All times are UK (Lagos is UK + 1 h).

## Live launch to-do (re-planned 10 Nov; supersedes the fast-track dates below)

**Goal:** a live beta in **Lagos on Fri 13 Nov**, with go/no-go on Thu 12 Nov 18:00 and Mon 16 Nov as the fallback (README "Live launch plan").

**Decided by you on 10 Nov** (README, "Founder decisions, 10 Nov evening"; my earlier "treated as decided" entries are corrected there):
- D4: staff video check at launch.
- D11: publish the AI draft marked "Draft, pending legal review". Reviewer: [LEGAL REVIEWER NAME].
- **D15: invite-only.** People request access; staff pre-check and invite.
- D16: survey opt-in.
- **D17: a branded survey email sent through Resend by a staff action.**
- D18: launch Fri 13 Nov.
- D19: research retired. Deleting its database needs your explicit go-ahead later.
- D21: Lagos first.
- D22: Didit after launch.
- HM-26: an honest busy message.

**Still yours to decide:** D13 (the name). D20 (invite in clusters) is recommended as the rule you use when choosing whom to invite.

**Changes to the list below:**
- Item 6 is now "approve Lagos access requests in a cluster", plus sharing the request-access link with your network.
- Item 19 now uses the "Send survey" button, not a CSV and mail merge.
- New items F-21 and F-22 (below).
- T4 now needs a **low- or mid-range Android at 360 px (Tecno or Infinix)** as the first priority, then an iPhone, then a tablet if you have one.
- **Fri 13 Nov is at risk** because invite-only adds about 2.5 engineer-days. Mon 16 Nov is likely; decide at Thu 18:00.

## F-21: Survey sending subdomain `updates.peabudy.com` (after launch, by Wed 18 Nov, 20 min)

1. Resend → Domains → **Add domain** → `updates.peabudy.com`, region **Ireland (eu-west-1)** → **Auto Configure** with Vercel (as in F-02 part B). DMARC is inherited from `_dmarc.peabudy.com`, so nothing extra is needed.
2. **Verify DNS records** and wait for **Verified**.
3. Resend → API Keys → create `peabudy-updates`, **Sending access**, domain **updates.peabudy.com** only.
4. Vercel → housemate-platform → Environment Variables → Production (and Preview `staging` with a separate key): `RESEND_UPDATES_API_KEY`, and `EMAIL_FROM_UPDATES` = `Peabudy <hello@updates.peabudy.com>`.
5. Send yourself a test from the "Survey" panel (ENG-36) and check Gmail "Show original": SPF, DKIM and DMARC all PASS, and an "Unsubscribe" link appears next to the sender.

## F-22: Fill in the legal reviewer (D11)

Put the reviewer's name and expected review date in the draft banner of the notice and terms (privately if they'd prefer: a role such as "independent solicitor" works). Publish with the "Draft, pending legal review" label.

| # | Task | When | Est. | Critical |
|---|---|---|---|---|
| 1 | Remove the `RESEND_API_KEY` that's set for **all** Preview deployments (keep the `staging`-branch one) | Tue 10 Nov, now | 2 min | Yes |
| 2 | **F-03, a real mailbox** for `hello@` with a `privacy@` alias (Google Workspace or Zoho; not forwarding-only). You'll book verification calls and send the survey from it | Tue, by 15:00 | 1 h | Yes |
| 3 | **F-04:** fill every placeholder in `legal/privacy-notice.md` and `legal/terms.md`, including the new survey rows and the mailbox provider | Tue, by 17:00 | 1.5 h | Yes |
| 4 | Set the staging dashboard variables the engineer gives you (ENG-33: the `beta-rehearsal` database, beta mode, `IP_HASH_SALT`, `EMAIL_LINK_SECRET`, `OPEN_CITIES=lagos`), then redeploy staging | Tue, by 18:00 | 20 min | Yes |
| 5 | **F-17:** name knock-out search (Peabody) and social handles | Tue–Wed | 1 h | For D13 |
| 6 | **Lagos invite list** (private, never in the repo): at least 8–20 people, ideally in Yaba, Surulere and Gbagada, moving within the same three months | By Wed 18:00 | 1 h | Yes |
| 7 | **T3 real-inbox test** on staging (F-02 part H) | Wed | 1 h | Yes |
| 8 | Build the Tally survey (DES-07/DES-13 wording); hidden fields `ref`, `city`, `stage` | Wed | 1 h | No (needed by 20 Nov) |
| 9 | Rehearse one verification call (F-08) and one suspension (F-09) on staging | Wed | 1 h | Yes |
| 10 | **F-18:** Didit account (below) | Wed–Thu | 1 h | No (Didit path) |
| 11 | Find a helper with the other phone type (iPhone or Android) for the T4 phone pass | Wed | — | Yes |
| 12 | **T4 phone pass** with the helper | Thu 10:00–14:00 | 4 h | Yes |
| 13 | D11 and D13 in writing | Thu, by 12:00 | 15 min | Yes |
| 14 | **Go/no-go** against README L6's criteria | **Thu 12 Nov, 18:00** | 15 min | — |
| 15 | Run `switch-to-beta.sh` with the production values (Resend production key, `EMAIL_FROM`, `IP_HASH_SALT`, `EMAIL_LINK_SECRET`, `ADMIN_EMAILS`, `NEXT_PUBLIC_CONTACT_EMAIL`, `OPEN_CITIES=lagos`), then the smoke test | Fri 13 Nov, 09:00 | 45 min | Yes |
| 16 | Sign up for real with the helper, verify each other, check you see each other, then delete those accounts | Fri, 10:00 | 30 min | Yes |
| 17 | **Send the personal invites** (DES-16 message) | Fri, 12:00 UK / 13:00 Lagos | 1 h | Launch |
| 18 | Check the verification queue at about 09:00, 13:00 and 19:00 daily; contact within 24 h; decide within 72 h | From Fri | about 15 min per person | — |
| 19 | **First survey send** from `hello@`, one person per email, using the ENG-30 export (`unsubscribe_url` in every email); delete the file afterwards | Fri 20 Nov (one reminder on Mon 23 Nov) | 1 h | — |
| 20 | **F-19:** counsel on biometric consent, Nigeria → EU transfer and the DPIA (add to the F-05 booking) | Book this week; answer by 25 Nov | — | Didit path |

**Not needed any more:**
- F-06's waitlist as the entry point (the survey part stays).
- The F-12/F-13 11 Nov dates.
- F-14's public announcement (personal invites now).
- `switch-to-research.sh` as a rollback. Never use Vercel Instant Rollback to a deployment from before the beta switch.

## F-18: Didit account, DPA and retention (do this on the day you sign up, because its terms reportedly changed on 1 Nov 2026)

1. Sign up at didit.me with `hello@peabudy.com`, on the **Free** plan (no card). Turn on two-factor authentication.
2. **Check and write down privately (not in this repo):**
   - the date and version of the terms;
   - the **data storage region** (we want EU);
   - whether a **DPA** is available on Free (sign it);
   - the **shortest retention** you can set for images and session data (set it as short as allowed);
   - whether sessions can be **deleted via the API**;
   - whether **UK documents** are supported (for London later);
   - that **Nigerian documents** (NIN slip or card, passport, driver's licence, voter's card) are supported.
3. Build one workflow with **ID verification + passive liveness + face match only**. Turn off NIN, BVN, phone, AML and any database checks (D22).
4. Create sandbox API and webhook secrets and hand them to the engineer **through the Vercel dashboard only** (`DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET`, `DIDIT_WORKFLOW_ID`).
5. Budget: $10 of free credit a month ≈ 33 checks at list prices (checked 10 Nov). The app caps at 25 a month (ENG-35) unless you raise it.
6. Give the PM the region and retention values for the privacy notice and DPIA (README L9).

## Today and tomorrow (fast-track; historical, superseded by the live launch to-do above)

| ID | Task | Owner | Due | Done when |
|---|---|---|---|---|
| F-01 | ~~Buy a sending domain and add it to Vercel~~ | Founder | Mon 9 Nov | **Done 9 Nov:** `peabudy.com` bought on Vercel (Vercel DNS) |
| F-02 | Set up `peabudy.com` for email in Resend; set the env vars; optionally point the site at it; test real inboxes | Founder | Parts A–E **tonight, Mon 9 Nov**; part H by **Tue 10 Nov 16:00** | Resend shows `peabudy.com` **Verified**; a code from `hello@peabudy.com` reaches Gmail, Outlook and Yahoo test inboxes with SPF, DKIM and DMARC passing (pass rules in part H) |
| F-03 | Contact mailbox (`hello@peabudy.com`) and staff accounts | Founder | Tue 10 Nov 10:00 | Mail sent to `hello@peabudy.com` reaches you; `ADMIN_EMAILS` is set in Vercel |
| F-04 | Fill the legal draft placeholders and publish the interim notice and terms | Founder (PM drafted) | Tue 10 Nov 12:00 | No `[PLACEHOLDER]` left in [`legal/privacy-notice.md`](legal/privacy-notice.md) or [`legal/terms.md`](legal/terms.md); the engineer wires them in (ENG-25) |
| F-05 | Book legal advice (UK + Nigeria), now including the trade mark question (F-17) | Founder | Book by Wed 11 Nov; written advice by **Fri 4 Dec** | Advice received on the notice, terms, DPIA, letting-agent position, gender preference and the name |
| F-06 | Tally account, DPA, waitlist form | Founder (content: DES-07) | Tue 10 Nov 15:00 | The waitlist link works on a phone; the DPA is signed or confirmed |
| F-07 | Check registrations (ICO fee, NDPC) | Founder | Fri 13 Nov | The outcome is recorded (see below) |
| F-08 | Verification SOP rehearsed | Founder + PM | Tue 10 Nov 16:00 | One mock call done on `beta-rehearsal` |
| F-09 | Moderation runbook + SQL suspension stopgap rehearsed | Founder + PM | Tue 10 Nov 16:00 | One mock suspension done on `beta-rehearsal` |
| F-10 | Deletion and purge SOP | Founder + engineer | Fri 20 Nov | The SOP is rehearsed on `beta-rehearsal` |
| F-11 | Rehearsal with real inboxes (ENG-10) | Founder + engineer | **Tue 10 Nov 16:00** | F-02 part H's pass rules are met on staging-as-beta |
| F-12 | Written go / no-go | Founder | **Tue 10 Nov 18:00** | Go = Option B on 11 Nov; No-go = Option C (waitlist only) and the product opens on Mon 16 Nov |
| F-13 | Run `scripts/switch-to-beta.sh` and the smoke test | Founder (agents can't push to `main`; `CLAUDE.md` §2.12) | **Wed 11 Nov 09:00** | Every smoke-test item ticked |
| F-14 | Announcement and cohort-1 invites | Founder | Wed 11 Nov 12:00 | The announcement is out with `?source=` links; up to 20 invites per city sent |
| F-15 | A second verifier and moderator (D9) | Founder | Fri 13 Nov | Named; has `verifier`/`moderator` role; has rehearsed the SOP |
| F-16 | Founder decisions D3–D14 and the D11 risk acceptance | Founder | D11 and D13 by Tue 10 Nov 18:00; the rest by Fri 13 Nov | Recorded in `docs/product/` (no personal data) |
| **F-17** | **Name check for "Peabudy" (UK + Nigeria) and secure the social handles** | Founder | Knock-out search and handles by **Tue 10 Nov 12:00** (before the 11 Nov announcement); counsel's view with F-05 | Search results recorded privately; D13 decided; handles secured with 2FA |

---

## F-01: Buy a domain (done)

**Done on Mon 9 Nov 2026:** `peabudy.com`, bought through Vercel, so Vercel manages its DNS.

Why we needed it, for the record:
- Resend only sends from a domain whose DNS you control (it needs SPF and DKIM records), and nobody can add records to `vercel.app`.
- Resend's test sender, `onboarding@resend.dev`, only delivers to the Resend account owner.
- On-screen codes for real people would let anyone sign in as any email address, so they're not an option in beta. That's why `DEMO_MODE` is forced off there (`lib/env.ts`).

## F-02: Set up `peabudy.com` for email (and, optionally, the website): click by click

About 45 minutes of clicking, plus waiting for verification. Do parts A–E tonight so verification can finish overnight.

**Decision for you (my recommendation in bold):** which address sends the codes?

| | **1. `Peabudy <hello@peabudy.com>` (root domain, your suggestion; recommended)** | 2. `Peabudy <hello@mail.peabudy.com>` (sending subdomain) |
|---|---|---|
| What Resend says | Recommends sending from subdomains, to keep reputations separate ([Resend: domains](https://resend.com/docs/dashboard/domains/introduction), fetched 9 Nov 2026) | Follows Resend's advice |
| For us | The domain is a day old with no reputation to protect yet, and the only mail is sign-in codes. A From address that exactly matches the website looks more trustworthy to a nervous new member | Slightly odder-looking address |
| Later | Send any future newsletters or marketing from a separate subdomain (e.g. `news.peabudy.com`), never from the root | Already separated |

The steps below use option 1. For option 2, enter `mail.peabudy.com` in A3 and use `hello@mail.peabudy.com` in E2; the record names gain `.mail` (e.g. `send.mail`).

### Part A: add the domain in Resend (5 min)

1. Go to **resend.com** and sign in (create an account if needed). In your account settings, **turn on two-factor authentication**: this account can send email as Peabudy.
2. Left sidebar → **Domains** → **Add domain**.
3. **Domain:** `peabudy.com`.
4. **Region:** choose **Ireland (eu-west-1)** if offered. Your members are in the UK and Nigeria, and keeping processing in the EU is simpler for the privacy notice. *Assumption (not checked):* the region can't be changed later without removing and re-adding the domain, so choose now.
5. Click **Add**. Resend shows the domain as **Not started / Pending** with a list of DNS records. Leave this tab open.

### Part B: put the DNS records on Vercel (10 min)

**Option 1, Auto Configure (try this first).** Resend's Vercel guide calls it the recommended route ([Resend: Vercel](https://resend.com/docs/knowledge-base/vercel), fetched 9 Nov 2026).

1. On the Resend domain page, click **Auto Configure**.
2. A Vercel window opens. Sign in, choose the team **teamihlehyns-projects** (the one that owns `peabudy.com`), and click to **authorise** Resend.
3. You return to Resend, which adds the records for you.
4. **Don't** turn on "Receiving" for this domain. Your contact mailbox (F-03) uses different records.

**Option 2, by hand (only if Auto Configure isn't offered or fails).**

1. In a new tab: **vercel.com** → team **teamihlehyns-projects** → **Domains** (top navigation) → **peabudy.com** → **DNS Records**.
2. For each row below, click **Add Record**, choose the type, type the **Name** exactly as shown (just the part before `peabudy.com`; Vercel adds the rest), paste the **Value** using the copy button in Resend, leave TTL as default, and save:

   | Type | Name | Value | Priority |
   |---|---|---|---|
   | MX | `send` | copy from Resend (looks like `feedback-smtp.<region>.amazonses.com`) | `10` |
   | TXT | `send` | copy from Resend (starts `v=spf1 include:`) | — |
   | TXT | `resend._domainkey` | copy from Resend (starts `p=`) | — |

3. Common mistake: typing `send.peabudy.com` as the name creates `send.peabudy.com.peabudy.com`, and verification fails.

**DMARC (both options; Resend's Vercel guide doesn't add it for you).** In Vercel → Domains → peabudy.com → DNS Records → **Add Record**:

| Type | Name | Value |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@peabudy.com` |

- `p=none` means "report, don't block" while you watch the reports. After 2–4 weeks of clean reports, change it to `p=quarantine`.
- The reports go to `hello@peabudy.com`, so they need F-03's forwarding working. They're machine-readable XML; you can ignore them day to day.
- *Assumption, from memory and not re-checked today:* Gmail and Yahoo require DMARC from bulk senders, and treat its presence as a good sign for everyone else. Adding it costs nothing.

### Part C: verify (1 min, then wait)

1. Back in Resend → **Domains** → `peabudy.com` → **Verify DNS records**.
2. Each record turns **Verified**. With Auto Configure it's often minutes. Resend says it can take a few hours, and to use its troubleshooting guide if it's still pending after 72 hours.
3. If it isn't verified by the time you go to bed, check again at 07:00. **If it isn't verified by Tue 10 Nov 12:00,** tell the engineer: Option C becomes likely.

### Part D: create the API keys (3 min)

1. Resend → **API Keys** → **Create API key**.
2. Name: `peabudy-production`. Permission: **Sending access**. Domain: **peabudy.com**. Click **Add**.
3. The key is shown **once**. Copy it straight into Vercel (part E). Don't paste it into chat, email, notes or this repo.
4. Repeat for a second key, `peabudy-staging`, for the rehearsal. Separate keys mean you can revoke one without breaking the other.

### Part E: set the email variables in Vercel (5 min)

1. vercel.com → **teamihlehyns-projects** → project **housemate-platform** → **Settings** → **Environment Variables**.
2. Add, for the **Preview** environment, **branch `staging`** only (use the dashboard: the CLI is unreliable for branch-scoped Preview variables, `CLAUDE.md` §10):
   - `RESEND_API_KEY` = the `peabudy-staging` key. Tick **Sensitive** if offered.
   - `EMAIL_FROM` = `Peabudy <hello@peabudy.com>`
3. For **Production**, add the same two (with the `peabudy-production` key) **only after part C shows Verified.** Why: production is in research mode today, where staff accounts (`ADMIN_EMAILS`) always get real emailed codes (`CLAUDE.md` §2.9). If `EMAIL_FROM` points at an unverified domain, your own staff sign-in breaks at the next build.
4. These take effect at the next deployment. On 11 Nov, the switch script (ENG-08) checks them and refuses an unverified domain.

### Part F (optional, recommended): point `peabudy.com` and `www` at the app (10 min)

1. vercel.com → **housemate-platform** → **Settings** → **Domains** → **Add Domain**.
2. Type `peabudy.com` → **Add**. When Vercel offers to also add `www.peabudy.com`, accept the recommended set-up: **`peabudy.com` is primary and `www.peabudy.com` redirects to it.**
3. Because Vercel already runs the DNS, both should show **Valid Configuration** within minutes, and HTTPS certificates are issued automatically.
4. **Keep `gethousemate.vercel.app` working** (don't redirect it yet), so research testers' existing links keep working. Redirect it after the beta switch.
5. Know what visitors will see: until the 11 Nov switch, `peabudy.com` shows today's research prototype, with sample people and the old "Housemate" name (until ENG-28 ships). Nobody knows the address yet, so that's acceptable; just don't share it before 11 Nov.

### Part G: set `NEXT_PUBLIC_SITE_URL` (2 min, only if you did part F)

1. Same Environment Variables page → **Production** → `NEXT_PUBLIC_SITE_URL` = `https://peabudy.com` (edit the existing value).
2. It's baked in at build time, so it changes nothing until a rebuild: **Deployments** → latest Production deployment → **⋯** → **Redeploy**.
3. **Warning (Fact):** `scripts/switch-to-research.sh` currently sets it back to `https://gethousemate.vercel.app` (line 42). Don't run that script until the engineer has updated it (ENG-08). The new `switch-to-beta.sh` sets `https://peabudy.com`.
4. Check: paste `https://peabudy.com` into a WhatsApp chat with yourself. The preview should load (it will say "Housemate" until ENG-28 ships).

### Part H: test real inboxes, and look after a brand-new domain

**Tonight (after part E production values + a redeploy):** sign in to production with your `ADMIN_EMAILS` address. Staff always get a real emailed code, so this is a free end-to-end test. Check the code arrives from `hello@peabudy.com`.

**Tomorrow, in the rehearsal (F-11 / ENG-10, staging running as beta):**

1. Create three **fresh** personal accounts tonight: one each at **Gmail**, **Outlook.com** and **Yahoo Mail**. Fresh accounts are the strictest test. Also use one long-used Gmail address if you have one.
2. On staging, request a sign-in code for each address. For each, record privately: minutes to arrive; folder (Inbox, Promotions, Spam/Junk); and the authentication results:
   - Gmail: open the email → **⋮** → **Show original** → SPF, DKIM and DMARC all say **PASS**.
   - Outlook.com: open the email → **⋯** → **View** → **View message source** → look for `spf=pass`, `dkim=pass`, `dmarc=pass` in `Authentication-Results`.
   - Yahoo: open the email → **⋯** → **View raw message** → the same three passes.
3. **Pass rules for the 16:00 gate** (revised 9 Nov, see README):
   - **Must:** Resend verified; every code delivered within 2 minutes; SPF, DKIM and DMARC pass at all three; Gmail lands in the **Inbox**.
   - **Acceptable with mitigation:** Outlook or Yahoo puts it in Junk. Mitigation: the sign-in screen tells people to check junk (ENG-03 copy), and your cohort-1 invite says "your code comes from hello@peabudy.com; check junk and add us to your contacts".
   - **Fail (go to Option C):** a code doesn't arrive at all, bounces, or Gmail files it as spam.

**Looking after a new domain.** A domain registered today has no sending history, and mailbox providers are cautious with new domains. Real warm-up takes weeks, so it can't be finished by 11 Nov. What helps now:

1. **Low, steady volume.** Only sign-in codes, only for the invited cohort (up to 40 people in week 1). No bulk email from `peabudy.com`: announce on social media and WhatsApp, not by mass email.
2. **Plain, consistent emails.** Always the same From address; no link shorteners, images or attachments in the code email (*Fact:* today's code email has no links, `lib/email.ts`).
3. **Positive signals.** Ask cohort members to add `hello@peabudy.com` to their contacts and to click "Not spam" if it lands in junk. Replies are good signals too.
4. **Watch.** Check the Resend dashboard's bounces and complaints daily in week 1. Optionally add `peabudy.com` to Google Postmaster Tools (it verifies with one more TXT record in Vercel); it only shows data once volume is higher.
5. **Grow slowly.** Raise volume gradually as areas open (late November). Keep activity emails (ENG-12) and any future newsletters on their own subdomain if volumes grow.

## F-03: Contact mailbox and staff accounts

- **`hello@peabudy.com`** should reach your inbox. Vercel doesn't host mailboxes, so choose one:
  - **Forwarding only** (free options exist, e.g. ImprovMX; *not checked today, confirm the current plan*): add the provider's MX and SPF records at the **root** (`@`) in Vercel DNS. They don't clash with Resend's records, which sit on `send`. You can receive but not send as `hello@` from your mail app.
  - **A real mailbox** (e.g. Google Workspace or Zoho; paid or limited free tiers, *not checked today*): lets you reply as `hello@peabudy.com`, which is better for verification bookings (F-08) and helps the domain's reputation. If the provider gives you an SPF record for the root, it's separate from Resend's.
  - Add `privacy@peabudy.com` as an alias of `hello@` for the privacy notice.
- **Vercel env (Production + Preview `staging`):**
  - `ADMIN_EMAILS` = your staff address(es), comma-separated. They become admin on sign-in.
  - `NEXT_PUBLIC_CONTACT_EMAIL` = `hello@peabudy.com` (ENG-06, ENG-25).
  - `EMAIL_LINK_SECRET` = a long random string, generated locally and never shared (needed by ENG-12 and ENG-15).
- The second staff member (F-15) gets the `verifier` or `moderator` role set by an admin (until ENG-24 adds a UI, the engineer provides the one-line SQL).

## F-04: Fill in the legal drafts and publish the interim versions

- Fill every placeholder in [`legal/privacy-notice.md`](legal/privacy-notice.md) and [`legal/terms.md`](legal/terms.md): controller name, address, contact email (`hello@peabudy.com` / `privacy@peabudy.com`), ICO and NDPC status, governing law, retention choices, the Resend sending region (part A4), the emergency numbers (confirm **999** for the UK and **112** for Nigeria).
- The drafts now say "Peabudy". If the legal entity has a different name, the notice must name the entity as controller and can say "trading as Peabudy".
- Give the filled text to the engineer **privately** if it contains your home address. Better: use a business or registered-office address.
- **D11, in writing:** "I accept publishing the AI-drafted, not-yet-reviewed privacy notice and terms for an invite-led cohort from 11 Nov, until advice is received."

## F-05: Legal advice to book

- **Scope for counsel:**
  - the privacy notice and terms
  - the DPIA ([`legal/dpia.md`](legal/dpia.md))
  - UK GDPR, DPA 2018, PECR (cookies/Clarity)
  - **Nigeria Data Protection Act 2023** and any NDPC implementing rules
  - cross-border transfers (Neon, Vercel and Resend regions)
  - whether Peabudy is a letting agent or property manager in England or Lagos (and what follows if so)
  - the Equality Act 2010 shared-accommodation basis for the gender preference, and the Nigerian position
  - the age policy
  - whether staff seeing photo ID on a video call (not stored) needs anything further
  - **the name "Peabudy"**: clearance and registration in the UK and Nigeria, given F-17's findings
- **Ask for:** marked-up text, plus a short memo of the must-fixes before open sign-up on 7 Dec.

## F-06: Tally account, DPA and forms

- Create a Tally account (free plan; Pro isn't needed). Use `hello@peabudy.com` as the account email once F-03 works.
- Ask Tally for, or sign, its **data processing agreement**. I couldn't confirm the free-plan terms on 9 Nov 2026. Tally BV is in Ghent, Belgium, and says it's EU-hosted ([tally.so/privacy](https://tally.so/privacy)).
- Build the **waitlist** (DES-07), branded Peabudy. Add a short privacy statement and link to `https://peabudy.com/privacy`. Turn on email notifications for new submissions.
- Connect the responses to a **private** Google Sheet or Notion page. Never to the repo.
- Build the **survey** (S1) with hidden fields `ref`, `city`, `stage`, `source`. Then give the engineer the share URL for `NEXT_PUBLIC_SURVEY_URL`.

## F-07: Registrations to check (not legal advice; confirm with counsel)

| Jurisdiction | Check | Why |
|---|---|---|
| UK | **ICO data protection fee.** Most UK-established controllers must pay it unless exempt. Use the ICO's self-assessment tool | It applies if Peabudy's controller is UK-based, or possibly to processing UK residents' data |
| UK | Does a non-UK controller need a **UK representative** (UK GDPR Art. 27)? | Only if the controller isn't established in the UK |
| Nigeria | **NDPC registration** as a "data controller of major importance". Check the threshold and whether Peabudy meets it now or at scale | NDPA 2023 |
| Nigeria | Does a non-Nigerian controller processing Nigerian residents' data need a local representative, or have other duties? | NDPA's territorial scope |
| Both | Whether a **DPO** is required | Scale and type of processing |

Record the outcomes (yes/no plus a date, no reference numbers needed) in the privacy notice placeholders.

## F-08: Verification SOP (live video ID check)

1. **Book.** Email the member within 24 h of publish (from `hello@peabudy.com`), offering 10-minute slots. Mark the case "Contacted" (ENG-07, S1).
2. **On the call:**
   - The member holds up a government photo ID beside their face.
   - Confirm the name matches their profile's first name (or the explanation they give).
   - Confirm the face matches.
   - Confirm they're **18+** from the date of birth.
   - Confirm they really are looking in the city they gave.
   - **Don't** screenshot, record or write down any ID number or date of birth.
   - If you also confirm their phone number on the call, note "phone confirmed" (DES-02). Otherwise the phone row must be hidden.
3. **Approve or reject** in `/staff`. Choose a rejection reason: `id_mismatch`, `underage`, `no_show`, `other`.
4. **Optional, with explicit consent:** 5–10 minutes of discovery questions (the interview guide in the research kit). Notes are anonymised, with no names.
5. **Capacity:** about 15 minutes each, so about 10 h for 40 people. Two-time-zone cover runs 08:00–22:00 UK.
6. **SLA:** first contact within 24 h; decision within 72 h.

## F-09: Moderation runbook, plus the SQL suspension stopgap (until ENG-11 and ENG-21)

- **Cover:** 08:00–22:00 UK, 7 days a week, from 11 Nov. Check the reports list every 2 hours.
- **Targets:** `threat` and `harassment`: first look within 4 h. Everything else: within 24 h.
- **Immediate suspension** for credible threats, money requests, impersonation or underage users. Then decide.
- **If someone is in danger:** tell the reporter to call **999 (UK) / 112 (Nigeria)**. Peabudy isn't an emergency service.
- **Stopgap suspension** (run with `psql "$(neon connection-string beta)"` from your own machine; replace `<USER_ID>` with the ID from `/staff`):

```sql
BEGIN;
UPDATE "User" SET "accountStatus" = 'suspended' WHERE id = '<USER_ID>';
DELETE FROM "Session" WHERE "userId" = '<USER_ID>';
UPDATE "Search" SET status = 'paused' WHERE "userId" = '<USER_ID>';
UPDATE "Introduction" SET state = 'expired'
  WHERE state = 'pending' AND ("lowUserId" = '<USER_ID>' OR "highUserId" = '<USER_ID>');
UPDATE "Conversation" SET status = 'closed'
  WHERE "userAId" = '<USER_ID>' OR "userBId" = '<USER_ID>';
INSERT INTO "AuditEvent" (id, "eventType", "actorType", "subjectId", "resourceType", "resourceId", action, outcome, "reasonCode")
  VALUES ('manual-' || md5(random()::text), 'staff.account_suspended', 'staff', '<USER_ID>', 'user', '<USER_ID>', 'suspend', 'allowed', '<REASON_CODE>');
COMMIT;
```

  Households aren't closed by this SQL. If the person is in one, close it in the app as the other member, or wait for ENG-11. **Rehearse it on `beta-rehearsal` first (F-09).**
- **Log** each case (category, action, time; no personal details) in a private sheet until ENG-21 ships.

## F-10: Deletion and purge SOP

- `me/delete` only marks the account `deletion_pending` (soft delete). The notice will promise deletion within **[RETENTION: e.g. 30 days]**.
- **Weekly, until a purge job exists:** the engineer provides SQL that removes the user and their rows, including the plain-string references (`Introduction`, `Membership`, `Notification`, `Report` as reporter, `IdempotencyKey`). Model it on the cleanup recipe in `CLAUDE.md` §11, but **scoped to one user ID**, and never truncate.
- Keep the minimum safety record (e.g. a suspension reason code) only if counsel agrees.

## F-12 / F-13: Go-live sequence (Wed 11 Nov)

1. 18:00 Tue: go/no-go (F-12), using the SEC-11 exit criteria, the F-11 inbox results and D13 (the name).
2. 09:00 Wed: `CONTACT=… bash scripts/switch-to-beta.sh` (ENG-08). The script lists the variables it needs.
3. 09:15: the smoke test (ENG-08's items).
4. 10:00: verify yourself and the second staff member as members, and check that two test members see each other. Delete these test accounts afterwards (F-10 SQL).
5. 12:00: announcement (DES-08) and cohort-1 invites (up to 20 per city, in 2–3 areas each, D12), linking to `https://peabudy.com`. The invite tells people their code comes from `hello@peabudy.com` and to check junk.
6. Book verification calls from the afternoon.
7. **Rollback:** `bash scripts/switch-to-research.sh` (restores research mode; the engineer updates its site URL first, ENG-08).

## F-17: Name check for "Peabudy", and social handles

**Why now (before the 11 Nov announcement and before the mascot is built around the name):** renaming after a public launch costs far more than checking today.

**A specific concern to check first (Fact, plus my assessment):**
- **Fact:** "Peabody" is one of London's oldest and largest housing associations, with over 100,000 homes in London and the home counties ([Wikipedia: Peabody Trust](https://en.wikipedia.org/wiki/Peabody_Trust), accessed 9 Nov 2026; Peabody's own pages cite 104,000–110,000).
- **Fact:** a web search for the exact string "Peabudy" on 9 Nov 2026 returned no business using it; results were about "Peabody".
- **Assessment (not legal advice):** "Peabudy" differs from "Peabody" by one letter, sounds almost the same, and we operate in the same field (housing) in the same city. That raises three risks for counsel to judge: a trade mark objection or passing-off claim; people confusing us with a social landlord (or assuming an endorsement); and search results and spoken referrals ("look up Peabudy") sending people to Peabody. It also makes lookalike phishing easier.

**Knock-out search (about 45 minutes, by Tue 10 Nov 12:00):**
1. **UK:** the UK IPO's free trade mark search (gov.uk → "Search for a trade mark"). Search `PEABUDY`, `PEABODY`, `PEA BUDDY` and `PEABUDDY`. Note any live marks in these classes: **9** (apps), **35** (online marketplaces), **36** (real estate and letting services), **42** (software as a service), **45** (social introduction and networking services).
2. **Nigeria:** the Trademarks, Patents and Designs Registry (Federal Ministry of Industry, Trade and Investment) has an online search. *I couldn't verify the current search route today; counsel can run it.*
3. **International:** WIPO's Global Brand Database, same terms.
4. **Company names:** Companies House (UK) and the Corporate Affairs Commission (Nigeria) name searches, if you'll trade through a company.
5. Record what you find **privately** (not in this repo), and bring it to counsel (F-05).

**Social handles (30 minutes, today or tomorrow):** claim the same handle everywhere, in order of importance for London and Lagos renters (*Assumption*): **Instagram, TikTok, X, WhatsApp Business, LinkedIn (company page), Facebook page**, then YouTube and Threads. First choice `@peabudy`; fallbacks `@peabudyhq` or `@getpeabudy`, used consistently. Register each with `hello@peabudy.com` (after F-03), turn on two-factor authentication, and keep the passwords in a password manager, not in this repo.

**Optional defensive domains** (cheap; not needed for launch): `peabudy.co.uk` and `peabudy.ng` / `peabudy.com.ng`, redirected to `peabudy.com`.

**Decision D13 (yours, by Tue 10 Nov 18:00):** launch publicly as Peabudy on 11 Nov, or hold the public announcement until counsel has looked at the name?
- **My recommendation:** if the knock-out search finds **no live "Peabody" mark covering classes 36 or 45** (or anything similar), go ahead with the invite-only cohort as Peabudy and get counsel's view within two weeks. If it finds one, keep the **invite-only cohort** (no public announcement) until counsel advises, which is Option B without the announcement. The cohort is small and private, so a later rename stays cheap.

## Later dates

- Fri 13 Nov: D3–D14, the second verifier, the registration checks.
- Fri 20 Nov: purge SOP; the cohort-1 interim metrics review.
- Fri 27 Nov: go/no-go for 30 Nov area opening and 7 Dec open sign-up.
- Fri 4 Dec: legal advice in (including the name); final notice and terms (ENG-25 S2).
- Mon 7 Dec: open sign-up, both cities, area by area.
