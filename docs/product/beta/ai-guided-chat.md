# Peabudy guide: a chat that leads to a solid flatshare agreement

| | |
|---|---|
| Status | **D-G1…D-G4 approved by the founder on 21 Nov 2026, as recommended:** v0 in the pilot; explicit opt-in by both people before any AI reads messages; Anthropic Claude API, subject to SEC-22; the guide only suggests in its panel and never posts. v0 tickets are approved scope; v1 stays gated on v0 pull and SEC-22. Linked from [`usability-round-1.md`](usability-round-1.md) |
| Founder ask | "AI ensures that all the right questions are asked in the chat for all the necessary information that makes up a solid flatsharing agreement. I think this will be a moat in the future." |
| Words | Users, not members. The guide is "Peabudy's guide", never a person |

## 1. The job, and why it could be a moat

**Problem.** Two strangers who matched still have to agree a lot before living together, and most fallings-out come from things nobody discussed.
- SpareRoom's spokesperson names **cleaning, noise, bills and partners** as the main sources of house-share disputes ([Guardian via inkl](https://inkl.com/news/cleaning-noise-bills-how-to-have-a-happy-house-share)).
- Today our agreement covers rent split, dates, stay, notice, bills split and free-text notes (`HouseholdPlan`, `prisma/schema.prisma:303`).
- Nothing helps people **discuss** the rest in chat, or turns what they said into terms.

**The job:** make sure every pair covers the topics that matter for their city, in their own words, and leaves with a **mutually confirmed, versioned record**.

### 1.1 What a solid agreement needs

Mapped to today's fields (*Fact*) and the proposed new structured fields. Sources follow the table.

| Topic | London specifics | Lagos specifics | Today's field | Proposed structured field |
|---|---|---|---|---|
| Rent split | Monthly | **Annual rent paid upfront** is common; who fronts it and how it's repaid | `contributions` (monthly equivalent), `currency` | `rentPayment {payer: each_direct \| lead_pays_landlord, dueDay, upfrontShare per person (NGN), repaymentPlan?}` |
| Whose name is on the tenancy | Joint tenancy means **each tenant is liable for the whole rent** (joint and several), even if shares differ; leaving early doesn't end liability on its own ([Shelter](https://england.shelter.org.uk/housing_advice/private_renting/joint_tenancies), [Citizens Advice](https://www.citizensadvice.org.uk/housing/renting-with-other-people/check-your-rights-if-you-share-accommodation/)). Lodger arrangements differ ([gov.uk Rent a Room](https://www.gov.uk/rent-room-in-your-home/print), [Citizens Advice](https://www.citizensadvice.org.uk/housing/renting-a-home/lodging-index/what-rights-do-lodgers-have/)) | Often one lead tenant on the agreement | — | `tenancyShape: joint \| lead_tenant \| lodger \| not_sure` (informational; prompts "get advice" copy) |
| Deposit | Deposit protection rules apply to tenancies, not to live-in lodgers ([SpareRoom](https://www.spareroom.co.uk/content/info-landlords/deposits-and-lodgers/)) | Caution deposit | — | `deposit {amount, shares, heldBy, returnRule}` |
| One-off fees | — | Agency and legal fees. Reported limits are disputed: some sources say the 2011 Tenancy Law caps advance rent at 1 year (yearly) or 6 months (monthly); fee caps are contested; a 2025 bill proposes a 5% agency fee ([Nairametrics](https://nairametrics.com/2025/10/17/lagos-tenants-pay-double-rent-cost-as-agents-defy-10-rule/), [Nigeria Property Centre](https://nigeriapropertycentre.com/glossary/agency-fee), [Legit.ng](https://www.legit.ng/business-economy/industry/1685987-new-lagos-rent-law-drops-what-means-landlords-tenants-agents-others)). **We never state a legal cap as fact** | — | `oneOffFees[] {type: agency\|legal\|caution\|inspection\|other, amount, shares}`, plus a fixed caution: "Never pay before you've seen the home and confirmed the landlord" |
| Bills | Energy, water, internet, council tax (who's liable: counsel), TV licence | **Electricity** (prepaid meter or estimated billing, and arrears left on the meter), **generator / diesel**, water, internet, **service charge** ([TechCabal](https://techcabal.com/2025/01/03/band-a-tarriffs/), [Nigeria Property Centre: service charge](https://nigeriapropertycentre.com/glossary/service-charge), [Legit.ng sharing example](https://www.legit.ng/business-economy/industry/1730407-how-lagos-residents-crash-rent-costs-pay-n35m-apartment/)) | `billsSplit: equal \| same_as_rent` | `bills[] {item, split: equal\|same_as_rent\|usage\|custom, whoPays, topUpMethod?}`; Lagos adds "check the meter for arrears before moving in" |
| Cleaning and chores | Rota or cleaner ([Ideal Flatmate](https://www.idealflatmate.co.uk/flatmate-HQ/?p=2393), [Rocket Lawyer](https://www.rocketlawyer.com/real-estate/tenants/move-or-find-roommates/legal-guide/how-to-set-boundaries-in-co-living-situations)) | Same, plus shared cleaner or estate cleaning | Habits (`cleaning`, matching only) | `chores {model: rota\|each_own\|cleaner, cleanerCostSplit?}` |
| Guests and overnight stays | Partners staying over is a top dispute | Same | Habits (`guests`) | `guests {overnightPerWeek?, notice: none\|ask_first}` |
| Quiet hours | | | Habits (`quiet`) | `quietHours {from, to}` |
| Smoking, pets | | | Habits | `smoking`, `pets` confirmed as terms |
| Shared items and food | | | — | `sharedItems: share_basics\|all_separate\|custom` |
| Notice and leaving | | | `noticePeriodWeeks` (2–12) | Keep; add `leavingRule: find_replacement\|pay_until_replaced\|notice_only` |
| Replacement housemate | | | — | `replacementRule: both_must_approve\|leaver_finds` |
| If one person can't pay | Joint tenants cover the shortfall in law (Shelter, above) | Same in practice | — | `missedPaymentRule {graceDays, then}` |
| House rules and disputes | | | `notes` (≤ 500) | `disputeRule: talk_first_then_review_after_N_days`; notes stay free text |

**Honesty rule:** Peabudy's agreement is **not a tenancy and not legal advice**. Topics that depend on law (joint liability, deposits, Lagos fees) show "get advice" copy and link to [Shelter](https://england.shelter.org.uk/housing_advice/private_renting/joint_tenancies) or [Citizens Advice](https://www.citizensadvice.org.uk/housing/renting-with-other-people/check-your-rights-if-you-share-accommodation/), or counsel-approved Lagos copy.

### 1.2 Why this could be a moat (*Hypotheses*, to test)
1. **Outcome data nobody else has.** Structured, mutually confirmed, versioned terms per household, linked to what happened next (housed, disputes, reports). Listing sites hold adverts; we'd hold agreements.
2. **Better matching.** If certain uncovered topics predict disputes, matching and the guide can surface them earlier. That's only real once outcome data exists.
3. **Switching cost and trust.** The agreement history lives here, and both people confirmed every version, so leaving means losing the record.
4. **City norms.** Aggregated, anonymised norms per area ("most Yaba pairs split diesel equally") become helpful defaults. Never per person.

**What would disprove it:** pairs with high coverage report disputes as often as pairs without, or people don't use the checklist.

## 2. Benchmarks

| Product | What it does | Lesson for us |
|---|---|---|
| **Hinge Prompt Feedback** | AI feedback on your own profile answers; private; it **doesn't write the text for you**, it gives tips ([Hinge press](https://hinge.co/press/prompt-feedback), [help](https://help.hinge.co/hc/en-us/articles/30558825479315-How-Prompt-Feedback-Works)). Convo Starters suggest openers ([help](https://help.hinge.co/hc/en-us/articles/46735258688659-What-are-Convo-Starters)) | Suggest **questions**, and let people send them **in their own words** |
| **Bumble AI Icebreakers** | Generated openers; a privacy group filed a complaint that it was rolled out in Europe **without explicit consent** ([Euronews](https://www.euronews.com/2025/06/26/swipe-right-but-watch-your-data-dating-app-hit-with-ai-privacy-complaint)) | **Explicit opt-in by both people** before any message is read |
| **EFF on dating-app AI** | Calls for opt-in consent before private messages are used for AI ([EFF](https://www.eff.org/deeplinks/2025/07/dating-apps-need-learn-how-consent-works)). Mozilla found most dating apps data-hungry ([Mozilla](https://www.mozillafoundation.org/en/blog/everything-but-your-mothers-maiden-name-mozilla-research-finds-majority-of-dating-apps-more-data-hungry-and-invasive-than-ever/)) | No training on chats; minimal data; a visible state |
| **Intercom Fin, Airbnb AI support** | AI resolves structured issues, with human fallback. Intercom cites a 51% average resolution ([Anthropic case study](https://www.anthropic.com/customers/intercom)). Airbnb's AI handles about a third of North American support ([TechCrunch](https://techcrunch.com/2026/02/13/airbnb-says-a-third-of-its-customer-support-is-now-handled-by-ai-in-the-u-s-and-canada/)) | AI is best at **structured** tasks with a fallback. Our "fallback" is the static checklist |
| **Flatmate agreement templates** | Ideal Flatmate's template covers bills, cleaning by room, guests, quiet hours, smoking, pets, damage, early move-out and disputes ([Ideal Flatmate](https://www.idealflatmate.co.uk/flatmate-HQ/?p=2393)). LSE halls recommend one ([LSE](https://halls.lse.ac.uk/story/48021318/why-you-need-a-flatmate-agreement)) | The topic list above; ours is **discussed, not just filled in** |

*Not found:* direct Reddit threads on AI in personal chats (searches returned advocacy and press instead). Round 2 should ask participants directly how they'd feel about a guide in their chat.

## 3. Product design

**The model.** A clearly labelled **"Peabudy guide"** panel in each conversation.
- It never poses as a person.
- It never sends messages as either user.
- It never agrees anything on anyone's behalf.

**What it does (v0 = no AI; v1 adds AI):**
1. **Coverage checklist:** the topics in §1.1, filtered by city (Lagos adds generator, service charge, upfront rent and fees). Each topic is shown as "Not discussed", "Discussed" or "Agreed".
2. **Next question:** a tappable prompt ("Ask about splitting generator fuel") puts an **editable draft** in *your* composer. You change it and send it in your own words.
3. **Term capture:** either person taps "We've agreed this" on a topic and fills a short structured form (e.g. diesel: split equally). The other person sees it and **confirms or edits**. A term is agreed only when both confirm. In v1, the AI proposes these drafts from the chat, and **both people still confirm**.
4. **Pre-fill:** "Propose a household" pre-fills the agreement with every confirmed term. The household agreement remains the one place where both accept the versioned plan (`lib/household.ts`, unchanged rules).
5. **Safety:** the money-request caution (HM-11 / ENG-34 patterns) shows to both people. The fixed line stays: "Never pay before you've seen the home and confirmed who the landlord is."

**Consent (v1).**
- The guide reads messages **only when both people have opted in**; until then it stays at v0 behaviour.
- Either person can pause it or turn it off at any time, and the state is always visible ("Guide reading this chat: on / paused / off").
- Turning it off stops reading immediately. Confirmed terms stay, because both people agreed them.

**Honesty copy (fixed):** "Suggestions from Peabudy's guide, not legal advice. Your household agreement is a record of what you both agreed, not a tenancy."

**City context:** currency and period come from the users' city. In Lagos, amounts are annual with a monthly equivalent; in London, monthly. Matching normalisation already exists (`monthlyEquivalentMinor`).

## 4. Phasing

| Phase | What | AI? | Validates |
|---|---|---|---|
| **v0** | Topic checklist + prompt chips + structured term confirm + pre-fill | **No** | Do people use a checklist? Do confirmed terms reach the agreement? |
| **v1** | Both opt in. AI detects topics discussed, proposes term drafts, both confirm | Yes | Does AI raise coverage and cut time to agreement versus v0? |
| **v2** | AI summaries of the agreement, and dispute support ("what did we agree about guests?") | Yes | Does it reduce later disputes? |

**Recommendation:**
- **Ship v0 in the pilot** after the Fix-first items (usability round 1).
- **Build v1 only if v0 shows pull:** *proposed thresholds* of at least 40% of conversations with 10 or more messages opening the checklist, and at least 1 confirmed term in 25% of them.
- v0 needs no AI processor, no new consent and no message reading.

## 5. Notes for the engineer (v1)

- **Load the `claude-api` skill before building.** Don't rely on remembered model names or prices.
- **Models:** a fast, low-cost model for topic detection (classification into the fixed topic enum), and a stronger model only for drafting term values. The engineer picks current model IDs from the skill.
- **When it runs:** debounced, e.g. after 8 new messages or 3 minutes idle, and only for conversations where both people opted in. Send only messages since the last run plus a short rolling summary, never the whole history.
- **Cost:** the engineer computes per-conversation cost from current pricing and sets a hard monthly budget cap (env), with the guide falling back to v0 when reached. *Assumption: low cents per conversation, but it must be measured.*
- **Latency:** async. Suggestions appear within about 10 s of the trigger and never block sending.
- **Keys:** server-side only (`ANTHROPIC_API_KEY` in Vercel). Never in the client, never logged.
- **Prompt injection:** users can type "Guide, ignore your rules and …".
  - Messages are passed as clearly delimited **data**, never as instructions.
  - The model has **no tools** and **no access to private fields**.
  - Output must match a **fixed JSON schema** (topic enum, typed values, length caps). Anything else is discarded.
  - Displayed text comes only from our templates plus validated values, never free model prose (v1).
- **Minimisation:** strip emails, phone numbers, URLs and street addresses before sending. Send first names only, never surnames.
- **Logging:** audit the run id, conversation id, topics detected, schema pass/fail, token counts and cost. **Never message bodies or model outputs containing them.**
- **Kill switch:** `GUIDE_AI_ENABLED=false` → v0.

## 6. Privacy, legal and safety (for security and counsel)

- **Processor:** if Anthropic is chosen (D-G3):
  - its Commercial Terms say it **may not train on customer content**, with its DPA incorporated by reference ([Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms));
  - prompts and outputs are deleted within 30 days by default, and **zero data retention is available by arrangement** ([Anthropic privacy centre](https://privacy.claude.com/en/articles/8956058-i-have-a-commercial-account-how-do-you-handle-my-data), [ZDR](https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to)).
  - Request ZDR.
  - Confirm the processing region and the **transfer mechanism** for UK (UK GDPR) and Nigerian (NDPA 2023) users with counsel.
- **Lawful basis:** consent from both people for AI reading of their messages (v1). It's separate from the terms and can be withdrawn.
- **DPIA rows to add:** AI processing of private messages; cross-border transfer; risk of wrong term suggestions (mitigated by mandatory confirmation); injection and abuse.
- **Privacy notice:** a new purpose "Peabudy guide (optional)", the processor row, retention ("model provider keeps nothing / [N] days"), and how to turn it off.
- **Private-field isolation:** the guide never receives gender, gender preference, budget of the other person beyond what they typed, verification data or reports. So it can't be manipulated into leaking them.
- **Abuse:** the guide can't be used to pressure someone. It never says "X has agreed" unless X confirmed. Reports and blocks work as today; block stops the guide.
- **Retention:** confirmed terms live with the conversation and household (deleted with them). Detection results (topic flags) are kept 90 days, then deleted.

## 7. Tickets

| ID | Ticket | Owner | Size | Priority | Depends on | Acceptance |
|---|---|---|---|---|---|---|
| **ENG-61** | Topic catalogue (`lib/agreementTopics.ts`, city-aware) + checklist API per conversation; prompt chip inserts an editable draft into the sender's composer | E | S | Pilot (v0), after Fix-first | ENG-51 (chat read state) | Tapping a chip fills the composer and sends nothing by itself; Lagos shows generator, service charge and upfront rent; London shows council tax |
| **ENG-62** | `ConversationTerm {conversationId, topic, value JSON, status draft\|confirmed, proposedBy, confirmedBy[], version}` + confirm and edit flow + audit (no message bodies) | E | M | v0 | ENG-61 | A term is "Agreed" only when both confirm; an edit after confirmation resets it to draft for both; blocked pairs → 404 |
| **ENG-63** | Pre-fill the household proposal from confirmed terms; `HouseholdPlan.terms` (JSON, versioned with the plan); show the terms in the household view | E | M | v0 | ENG-62, ENG-52 | Proposing pre-fills every confirmed term; a plan change creates a new version and needs re-acceptance (existing rules) |
| **ENG-64** | Guide consent state per conversation per user (on/paused/off), both-on gate, audit | E | S | v1 | D-G2 | No AI call unless both are "on"; either "off" stops calls within one trigger |
| **ENG-65** | v1 AI pipeline: debounce, minimisation, Claude calls, schema validation, budget cap, kill switch, logging without bodies | E | L | v1 | ENG-64, SEC-20–22, D-G3 | Injection test messages never change output shape or reveal private data; invalid output discarded; cost logged per run |
| **ENG-66** | Metrics events (§8), no PII | E | S | v0 | ENG-58 | Events emitted; admin table shows coverage and time to agreement |
| **DES-34** | Guide panel in chat: label, coverage meter (text + count, not colour alone), topic list, prompt chips; works at 360 px with the keyboard open | D | M | v0 | ENG-61 | Usable one-handed; never looks like a person's message |
| **DES-35** | "We've agreed this" and confirm/edit sheets per topic; the agreed-terms summary; pre-fill review in the household proposal | D | S | v0 | ENG-62 | Both sides see the same state after refresh |
| **DES-36** | Consent, pause and off states and explanation ("what the guide reads, who sees it, how to stop it") | D | S | v1 | D-G2 | A first-time user can say what the guide reads and how to turn it off |
| **SEC-20** | Prompt-injection and output-validation review, with a red-team message set | S | S | v1 | ENG-65 | No private field or other conversation's data appears in any output |
| **SEC-21** | Minimisation and isolation: what's sent, contact-detail stripping, no private fields, logging review | S | XS | v1 | ENG-65 | Payload samples contain no emails, phone numbers or private fields |
| **SEC-22** | Processor review: DPA, ZDR, region, transfers (UK GDPR, NDPA), DPIA rows, privacy-notice text | S + PM + counsel | S | v1 gate | D-G3 | Signed DPA; ZDR confirmed or residual risk accepted; notice updated |

## 8. Metrics (*no baseline yet*)

| Metric | Definition |
|---|---|
| Coverage | Share of conversations with 10+ messages where the essential topics for the city (rent, bills, deposit/fees, cleaning, guests, notice, leaving) are Agreed |
| Time to agreement | Median days from first message to household plan accepted |
| Households formed | Conversations → households formed, v0 vs before |
| Later disputes | 4-week and 12-week survey question "Have you had a disagreement about something you hadn't agreed?" plus reports |
| Opt-in rate (v1) | Conversations where both opted in / eligible |
| Opt-out reasons (v1) | One-tap reason on turning it off (creepy, not useful, too many prompts, other) |

## 9. Founder decisions (all **approved 21 Nov 2026** as recommended)

| ID | Decision | **Recommendation (approved)** |
|---|---|---|
| **D-G1** | v0 in the pilot, or straight to v1 | **v0 in the pilot** (no AI, no message reading). v1 only when v0 shows pull (§4 thresholds) |
| **D-G2** | Explicit opt-in by both, or default-on with opt-out | **Explicit opt-in by both** (private chats between strangers; the Bumble complaint and EFF guidance, §2) |
| **D-G3** | Provider | **Anthropic Claude API**: commercial no-training terms, DPA, ZDR on request. Final after SEC-22 |
| **D-G4** | Can the guide ever post on its own? | **No.** It only suggests, inside its own labelled panel. People always send in their own words, and terms need both confirmations |
