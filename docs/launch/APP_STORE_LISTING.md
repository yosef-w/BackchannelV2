# App Store Listing: BackChannel 1.0

Paste-ready copy for App Store Connect. Character counts were computed with a script, not by eye (see "Count check" at the bottom). Premium ships on in v1 (`PREMIUM_ENABLED=true` as of 2026-10-05): the description and What's New deliberately don't name prices or daily limits (those live in the app and in App Store Connect's subscription metadata, which is the only place Apple wants them), but the review notes in section 10 describe the subscription. App Store Connect also needs the Terms of Use (EULA) URL set to `https://backchannelapp.netlify.app/terms.html`, whose section 11 now covers auto-renewal, cancellation, and refunds.

Items marked **[CONFIRM]** are assumptions the founder should verify before submitting.

---

## 1. App name (max 30)

```
BackChannel: Job Referrals
```
26 characters. The name carries the category term ("Job Referrals") because the brand word alone has no search meaning yet.

### Subtitle (max 30)

```
Get referred by insiders
```
24 characters.

### Alternate title / subtitle pairs

| # | Name | Subtitle |
|---|------|----------|
| A | `BackChannel` (11) | `Jobs, vouched for by insiders` (29) |
| B | `BackChannel: Get Referred` (25) | `Employees vouch. You get seen.` (30) |

Pair A is cleanest as a brand, but wastes the name field's indexing. Pair B is more voice-forward. Use the primary pair for launch, since the app has no brand awareness yet and needs the search terms.

---

## 2. Promotional text (max 170; editable any time without review)

```
Applicants swipe a daily deck of jobs. Sponsors swipe applicants. When both sides say yes, you can message, and the referral runs from a check-in to an answer.
```
Count checked below. This is the field to rewrite for launches, campus pushes, and seasonal hooks.

---

## 3. Description (max 4000)

The first three lines are all that show before "more", so they carry the hook.

```
A job referral is the most reliable way through the front door, and the hardest to ask for. BackChannel makes it a conversation both sides opted into.

Applicants browse a short daily deck of jobs and express interest in the ones they want. Sponsors, people who work at the company, browse applicants and connect with the ones they'd vouch for. When both sides say yes, it's a match, and the two of you can talk.

HOW IT WORKS

Two sides, one desk.
Pick your role when you sign up. You can be an applicant looking for a way in, or a sponsor, an employee who can refer people into their company.

For applicants
- A daily deck of jobs, one card at a time. Slide through the plates of each listing for the short version, or scroll for the full read.
- Express interest in the roles you want. Pass on the rest.
- Upload your résumé and we'll draft your profile from it, so you're editing, not typing from scratch.
- Track every opportunity in Matches: interested, waitlisted, matched, and referred.

For sponsors
- Verify with your work email, so applicants know they're talking to someone who actually works there.
- Post the roles your company is hiring for and browse applicants for them.
- Connect with the people you'd stand behind.
- When you're ready to refer someone, The Signing walks you through it: a few honest statements about the candidate, then your signature. You get a clean packet to submit through your company's own process.

After the match
- Message directly in your Inbox.
- Check in as the referral moves along. Applicants and sponsors each mark where things stand, so nobody is left guessing.
- Get a gentle reminder when a check-in is due.

BUILT FOR TRUST
- Sponsors verify with a work email.
- Sign in with Apple, or with email. Apple's Hide My Email works.
- Report anyone from the feed, from a profile, or from a conversation. Reports go to a human, and we act on them promptly.
- Unmatch at any time.
- Delete your account and data from inside the app, under Account.

BackChannel doesn't promise you an offer, and it doesn't submit anything on your behalf. Sponsors decide who they'll vouch for, and companies decide who they hire. What it gives you is a real person on the inside who knows your name.

Made by Bluejay Labs LLC in Austin, Texas.

Terms: https://backchannelapp.netlify.app/terms.html
Privacy: https://backchannelapp.netlify.app/privacy.html
```

Notes on truthfulness (each claim mapped to code):

| Claim | Where it lives |
|---|---|
| Daily deck, "plates" and "full read" | `components/home/plates/`, `docs/PLATES_DECK.md`, `HomeView.tsx` |
| Interested / Connect / Waitlist verbs | `components/home/VerdictBar.tsx` |
| Résumé parse drafts the profile | `ApplicantQuestionnaire.tsx` (upload, parse, classify, refetch) |
| Matches tracking | `components/matches/*` |
| Work-email verification for sponsors | `components/home/WorkEmailVerificationModal.tsx` |
| The Signing (statements, hold-to-sign, ATS packet) | `components/messages/ReferralSigningScreen.tsx` |
| Check-ins and reminders | `components/checkin/*`, `lib/checkInNudges.ts`, `lib/localNotifications.ts` |
| Report / unmatch | `components/ui/ReportUserSheet.tsx`, `ThreadMenuSheet.tsx`, `lib/api.ts` |
| Delete account | `components/profile/PrivacySecurityScreen.tsx` |

Resolved 2026-10-03: `privacy.html` and `terms.html` both return 200 at the `PRIVACY_POLICY_URL` / `TERMS_URL` values in `constants/config.ts`; the moderation promise was softened to "promptly" everywhere (no staffed 24h inbox at launch). **[CONFIRM]** (1) "Waitlisted" is user-visible wording in Matches. (2) That the sponsor-side "Post the roles" and "browse applicants for them" matches current behavior (backend feed relevance is still open in `docs/BACKEND_CHANGES_NEEDED.md` §F, so do not promise "the right candidates," and this copy doesn't).

---

## 4. Keywords (max 100, comma-separated, no spaces)

Words already in the name and subtitle (`backchannel`, `job`, `referrals`, `get`, `referred`, `insiders`) are indexed automatically, so they are not repeated. Apple also combines words across name, subtitle, and keywords, so single words are the efficient unit.

```
employee,hiring,career,networking,applicant,sponsor,recruiter,resume,interview,opportunities,vouch
```
Count checked below.

Rationale:
- `employee`, `hiring`, `career`, `networking`, `recruiter`, `resume`, `interview`: the vocabulary of the intent clusters in `ASO_KEYWORD_RESEARCH.md`. Combined with name words they form "employee referral", "job hiring", "job interview", "career networking".
- `applicant`, `sponsor`: the app's own two roles. Low competition guesses; verify in a keyword tool.
- `opportunities`: broad, but it catches "job opportunities" style queries.
- `vouch`: brand-voice word. Low volume, likely low competition. Drop it if a tool shows nothing.
- No competitor names (Apple rejects trademark keywords), no "free", no "app", no "best" (wasted or risky).

Alternates (swap in on the first monthly iteration):

- **Alt 1 (networking-heavy):** `employee,hiring,career,networking,mentor,recruiter,resume,interview,internship,graduate,connect,work`
- **Alt 2 (new-grad and campus angle):** `employee,hiring,career,internship,graduate,student,entry,level,resume,interview,networking,opportunity`

All three are counted below. Do not put volume claims in the store; see the research doc.

---

## 5. What's New (version 1.0)

```
The first version of BackChannel.

- Applicants: a daily deck of jobs, and a Matches tab to follow each one
- Sponsors: verify your work email, browse applicants, connect, and refer
- Message once you match
- Check-ins that keep every referral moving
- Sign in with Apple or email
- Report and unmatch tools, with every report reviewed by a person

We're a small team and we read every message: support@backchannel.app
```
**[CONFIRM]** `support@backchannel.app` is live. `docs/BACKEND_CHANGES_NEEDED.md` says MX for that domain had not been set up as of 2026-09-22. Do not publish it until a test mail is received. Otherwise use a mailbox that works.

---

## 6. URLs

| Field | Value | Notes |
|---|---|---|
| Support URL (required) | `https://backchannelapp.netlify.app` | Apple requires a real page with contact info. Add a visible "Support" section with the support email and a short FAQ (delete account, report someone, Hide My Email) before submitting. A `/support` page is better than the bare homepage. |
| Marketing URL (optional) | `https://backchannelapp.netlify.app` | Same domain is fine. |
| Privacy Policy URL (required) | `https://backchannelapp.netlify.app/privacy.html` | **[CONFIRM]** exact path from `PRIVACY_POLICY_URL`. |
| Terms | Apple's standard EULA, or custom via the description text | Terms page exists at `/terms.html`. If using it as a custom EULA, paste in the "License Agreement" field. |

Universal links: `applinks:backchannelapp.netlify.app` is in `app.json`. Make sure the AASA file is served from that domain, or deep links will fall back to the website.

---

## 7. Category

- **Primary: Business.** Job search and hiring tools live here. It matches the intent (getting hired, referrals as a professional workflow).
- **Secondary: Social Networking.** Matching and messaging between people is core to the product.

Alternative: primary Social Networking. It gets more casual browsing but is far more crowded, and it can signal a "social app" that invites stricter UGC scrutiny. Business is the honest fit. Do not choose Productivity or Lifestyle just for ranking.

---

## 8. Age rating questionnaire

Answer per the current App Store Connect questionnaire. Values below reflect what the app does.

| Question | Answer | Why |
|---|---|---|
| Violence (cartoon, realistic, graphic) | None | No such content. |
| Sexual content or nudity | None | |
| Profanity or crude humor | None (by the app itself) | Users can type freely in messages, covered under UGC below. |
| Alcohol, tobacco, drug references | None | |
| Mature/suggestive themes | None | |
| Horror/fear | None | |
| Gambling / contests | None | Swiping is not gambling. |
| Medical/treatment info | None | |
| **User-generated content** | **Yes** | Profiles (bio, photo), job posts, and messages are user-authored. |
| **Messaging / chat between users** | **Yes** | Matched users message each other. |
| Unrestricted web access | No | Only specific links open externally (terms, privacy, apply URLs). **[CONFIRM]** |
| In-app purchases | None currently | Premium disabled. Revisit when enabled. |
| Parental controls / age assurance | No | |

Moderation features to state where Apple asks: reporting from the feed card, profile sheets, and message threads; report reasons (harassment, spam or scam, inappropriate content, fake profile, other); unmatch; a reported user is blocked from the reporter server-side; terms acceptance at signup; contact info published.

Expect the computed rating to land around 13+ or 16+ because of UGC and messaging. **[CONFIRM]** the result Apple computes, and that it agrees with the minimum age in the Terms. It is a professional-networking app, so declaring a higher rating is safer than arguing a lower one.

---

## 9. Copyright

```
2026 Bluejay Labs LLC
```
App Store Connect wants the year and owner, and it adds the symbol itself in some views. Some teams type the symbol; either is accepted.

---

## 10. App Review Notes

Paste into "Notes". Fill the bracketed items. Also fill "Sign-in required" with the demo credentials in the dedicated fields.

```
Thank you for reviewing BackChannel.

WHAT IT IS
BackChannel is a two-sided job-referral marketplace. Applicants browse a daily deck of jobs and express interest. Sponsors (employees at a company) browse applicants and connect. A match unlocks messaging and a referral flow.

DEMO ACCOUNTS (fully populated, no verification needed)
Applicant: sarah.chen@demo.backchannel.app / DemoPass123!
Sponsor:   emily.rodriguez@demo.backchannel.app / DemoPass123!
The sponsor account's work email is pre-verified. Real sponsors must verify a work-email link, which our demo bypasses.
Both demo accounts are matched with each other on the sponsor's "Senior Backend Engineer" role, with a message thread and a completed referral, so the Inbox, Matches, check-in, and referral flow can be tested without needing a second device. The two roles see different home screens by design: the applicant browses a deck of jobs, the sponsor browses a deck of applicants.

SIGN IN WITH APPLE
Sign in with Apple is offered alongside email sign-in on the first screen. Hide My Email is supported: the account is created with the private-relay address Apple provides. Sponsors' work email is verified separately (Feed > "Verify your work email"), so a relay address as the login does not block sponsor verification. Transactional mail is sent from our domain so it reaches relay addresses. [CONFIRM: the domain is registered with Apple's private email relay service.]

REPORTING AND BLOCKING (Guideline 1.2)
1. Feed: tap the small flag button over any card. Choose a reason (harassment, spam or scam, inappropriate content, fake profile, other), optionally add detail, and submit. Reporting also blocks the person server-side, so the card is removed from the deck immediately.
2. Profile sheets: open a profile (Matches, Inbox, or a card) and choose Report.
3. Messages: open a conversation, open the menu at the top right, and choose Report or Unmatch. Unmatching permanently ends the match.
Users accept the Terms at signup (linked under the sign-up form). There is no separate stand-alone "block" button: reporting blocks the reported person for the reporter, and unmatching ends an existing match. Either one stops all further contact.

MODERATION
Every report is emailed to our moderation inbox, where a person reviews it and acts on it promptly (removal of content and/or account, and the reporter is already protected from further contact the moment they report). Contact: support@backchannel.app. [CONFIRM before submitting: backend MODERATION_ALERT_EMAIL is set in production and support@backchannel.app receives mail, per docs/BACKEND_CHANGES_NEEDED.md §W #4–5.]

ACCOUNT DELETION (Guideline 5.1.1(v))
Account > Privacy & Security > Delete Account. This removes the account and its data, including for accounts created with Apple / Hide My Email. [CONFIRM: SSO-only deletion works end-to-end on the backend, see §W #3.]

IN-APP PURCHASES (Guideline 3.1.1 / 3.1.2)
One auto-renewable subscription, "BackChannel Pro", for applicants only. The free app is fully usable without it. Pro raises the daily limit on expressions of interest from 2 to 5 and unlocks actions in the job marketplace. Sponsors are never asked to pay.
Where to find it: Account tab > "Upgrade to Premium" opens the plan picker and checkout. The same checkout appears if an applicant reaches the daily limit on the Feed, or taps a gated action in the marketplace. Every paywall shows the price, billing period, auto-renewal terms, and links to Terms of Use and Privacy Policy, and can be dismissed.
Restore: Account tab > "Restore Purchases" (always visible, also on the checkout sheet). Manage: Account tab > "Manage Subscription" opens Apple's subscription settings.
The demo applicant account (Sarah Chen) is on the free tier so the paywall can be reached; purchases in review run through the sandbox. [CONFIRM: subscription products are approved in App Store Connect and attached to the RevenueCat offering before submitting, else the plan picker shows an empty state.]

PERMISSIONS
Photos (profile picture, résumé upload), and notifications (check-in reminders), each requested in context.

Contact for questions during review: Yosef Wolday, yosefwolday@yahoo.com (phone in the App Review Information fields).
```

Decisions taken 2026-10-03: demo pair is Sarah Chen / Emily Rodriguez (the only seeded pair with a match, thread, and referral); the moderation promise is "promptly," not "within 24 hours" (keep `docs/ops/MODERATION_RUNBOOK.md`'s 24h target as the internal goal; tighten the public wording later without a review); ship without a stand-alone Block action and add one only if a reviewer asks. Remaining [CONFIRM] items depend on the backend (§W #3 SSO deletion, §W #4–5 moderation email and MX, Apple private-relay domain registration). The phone number goes only in App Store Connect's required App Review Information fields (not public); switch the contact email to support@backchannel.app once it receives mail.

---

## Count check

Computed by script when this file was generated:

| Field | Chars | Limit |
|---|---|---|
| Name | 26 | 30 |
| Subtitle | 24 | 30 |
| Alt A subtitle | 29 | 30 |
| Alt B name / subtitle | 25 / 30 | 30 |
| Promotional text | 159 | 170 |
| Description | 2388 | 4000 |
| Keywords (primary) | 98 | 100 |
| Keywords alt 1 | 100 | 100 |
| Keywords alt 2 | 90 | 100 |

Re-count after any edit: Apple counts every character including commas.

