> **Draft written by AI. Not legal advice. Have a qualified UK and Nigerian data-protection adviser review before relying on it.**
>
> A short data protection impact assessment (UK GDPR Art. 35; NDPA 2023 [SECTION, counsel to confirm]) for Peabudy early access. Drafted by the product-manager agent on 9 Nov 2026 from the code. Risk ratings are **provisional**: the security reviewer completes them in SEC-10. Placeholders are for the founder.

# DPIA: Peabudy early access (beta)

| | |
|---|---|
| Controller | [CONTROLLER NAME] |
| Owner | [FOUNDER NAME, ROLE] |
| Reviewers | security-reviewer agent (SEC-10); [UK COUNSEL]; [NIGERIAN COUNSEL] |
| Status | Draft v0.1, 9 Nov 2026. **Must be reviewed before open sign-up (7 Dec)** |

## 1. Why a DPIA

- Peabudy matches **strangers** to live together.
- It uses **gender and housemate preference**, runs **identity checks** over video, and holds **private messages**.
- It covers people in **two jurisdictions** (UK and Nigeria), with processors abroad.

Systematic matching of individuals, combined with a safety risk from offline meetings, makes a DPIA appropriate, even if it isn't strictly mandatory.

## 2. Description of processing

| Item | Detail (from the code, 9 Nov 2026) |
|---|---|
| Data subjects | Adults (18+) seeking shared housing in London or Lagos; waitlist sign-ups; staff |
| Data | See privacy notice §3. Notable: gender and gender preference (private, optional); identity check outcome only (no documents, `CLAUDE.md` rule 8); message text (HTML-escaped, stored in `Message.body`); report text; IP and technical logs |
| Volumes | Cohort 1 up to 40 people; [EXPECTED AT 7 DEC] |
| Systems | Next.js on Vercel ([VERCEL REGION]); Postgres on Neon (`beta` branch, [NEON REGION]); Resend (email, sending domain `peabudy.com`, region [RESEND SENDING REGION]); Tally (waitlist and survey); Microsoft Clarity (off in beta until consent ships) |
| Access | Members see checked members' public profiles only (ENG-02). Staff roles: verifier, moderator, admin (ENG-24). Staff can't read chats |
| Retention | Privacy notice §7. Deletion is soft in the app, and purged by hand weekly (founder.md F-10) |

## 3. Necessity and proportionality

| Question | Answer |
|---|---|
| Is each item needed? | Matching data: yes, it's the core service. Gender: optional, and used only to honour stated preferences. Preferred postcode (`Search.locationDetail`): **collected but unused**. *Recommendation:* stop collecting it in beta, or explain why it's kept |
| ID check without storage | Video check with the outcome recorded only. This is the least-data option that still blocks fake and underage profiles |
| Could less be shared? | Public profiles show no contact details, gender, preference or address (`CLAUDE.md` rule 6) |
| Transparency | Privacy notice v2 (this pack) and re-consent (ENG-06) |
| Rights | Export (incomplete until ENG-17); deletion (soft, plus a manual purge) |

## 4. Risks and mitigations (provisional ratings)

| # | Risk to individuals | Likelihood | Severity | Mitigations | Residual |
|---|---|---|---|---|---|
| R1 | Unverified person browses real members (stalking, scraping) | High today (Fact: `recommendations` and `users/[id]` don't check the viewer in beta) | High | **ENG-02** (verified-only browsing), the ID check, rate limits (ENG-18) | Low after ENG-02 |
| R2 | Harm when strangers meet (assault, harassment) | Low–medium | Severe | ID check; safety card (DES-03); no home or viewing features in beta (ENG-01); block and report; suspension (ENG-11); emergency signposting | Medium (inherent to the service) |
| R3 | Rent, deposit or romance scams | Medium | High (financial) | Terms ban money requests; chat caution; safety card; scam reporting category; suspension | Medium |
| R4 | Fake or underage profiles | Medium | High | Staff video ID and age check; 18+ declaration (ENG-05) | Low |
| R5 | Disclosure of gender or gender preference | Low | Medium–high | Never in public DTOs; matching gives generic 404s; not in audit logs | Low |
| R6 | Staff misuse of access | Low | High | Role matrix; staff reads and actions audited (ENG-24, ENG-22); no chat access | Low |
| R7 | Transfer of Nigerian and UK data abroad without safeguards | Medium | Medium | Confirm the mechanisms (privacy notice §6); processor DPAs | **Open: counsel** |
| R8 | Deletion not completed on time | Medium | Medium | Weekly manual purge SOP (F-10); purge job later | Medium |
| R9 | Analytics cookies without consent | High if Clarity is on | Low–medium | Clarity off in beta until ENG-14 | Low |
| R10 | Email account takeover gives account access (OTP) | Low | High | 6-digit codes, 10 minutes, 5 attempts; `crypto.randomInt` (ENG-06); IP limits (ENG-18) | Low–medium |
| R11 | Discrimination through preferences | Low | High | Only gender is offered (legal review pending); no other protected characteristics; terms ban discriminatory use | **Open: counsel** |
| R12 | Unreviewed legal text published on 11 Nov | Certain (fast-track) | Medium | Accurate interim notice; small invite-led cohort; legal review by 4 Dec | Accepted by the founder (D11) |

## 5. Outcome

- **Fast-track (11 Nov):** proceed with Option B only if R1 is mitigated (ENG-02), R9 is mitigated (Clarity off), and the founder accepts R12 in writing.
- **Before 7 Dec:** close R7 and R11 with counsel; reduce R8 (purge SOP rehearsed); ship ENG-11/21 for R2 and R3.

| Sign-off | Name | Date |
|---|---|---|
| Founder | [NAME] | [DATE] |
| Adviser | [NAME] | [DATE] |
