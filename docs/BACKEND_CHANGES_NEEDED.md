# Backend Changes Needed

**Last updated:** 2026-07-21 (§P/§Q/§O/§M/§G/§R all shipped by the backend and wired frontend-side same day — removed from this doc; see the backend's `KNOWN_ISSUES.md` "Recently fixed" for the record)
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> **Open items:** **§S** — SSO (Apple/Google/LinkedIn) research ticket; the backend delivered a proposal (`docs/SSO_PROPOSAL.md`) but **no endpoint exists** — do not build/wire until product explicitly green-lights against it (App Store Guideline 4.8 means Apple becomes mandatory the moment any third-party login ships, so this is a product+scope call, not just an engineering one). **§L** — drop/ignore unused profile columns (street/ZIP/country/phone/DOB/LinkedIn — cleanup + PII minimization, low priority, coordinate timing with backend; do **not** drop `PORTFOLIO_URL`, it's still live).
>
> Shipped items are removed to keep this lean; the backend's record now lives in its [`KNOWN_ISSUES.md`](../../Backchannel-backend/BackChannel-backend/docs/KNOWN_ISSUES.md) "Recently fixed" list (their `BACKEND_CHANGES_SHIPPED.md` was retired in the 2026-07 docs overhaul).

## §S — SSO sign-in (Apple, Google, LinkedIn) 🔵 Research item — scope what it takes before we commit

**Status (2026-07-21): proposal delivered, not yet actioned.** The backend wrote `docs/SSO_PROPOSAL.md` (in their repo) answering every question below — table design (`user_info.user_sso_identities`), the `POST /api/auth/sso/` contract (login-shaped response + `is_new_user`/`needs_onboarding`), nullable `password_hash`, an account-linking policy (auto-link on provider-verified email; Apple private-relay emails never auto-link), and a ~2–3 eng-week estimate. **No endpoint has been built.** This stays a research/scoping item — do not wire SSO buttons or start frontend work — until product explicitly commits to building it (the App Store 4.8 constraint below makes this a product scope decision, not just a technical one).

**What we want:** let users sign up / log in with **Apple, Google, and LinkedIn** in addition to email+password. This is a research ticket first — come back with a proposed design + effort estimate; the frontend work will be planned against your answer.

**One hard constraint up front:** App Store Guideline 4.8 — if we offer ANY third-party login (Google, LinkedIn), **Sign in with Apple becomes mandatory**. So the realistic scopes are "none" or "Apple + others", never "Google only".

**How the flow would look (standard native pattern, for shared context):**
1. The app runs the provider's native flow on-device (expo-apple-authentication / Google & LinkedIn OAuth) and receives an **identity token** (JWT) from the provider.
2. The app POSTs that token to a new endpoint, e.g. `POST /api/auth/sso/` with `{ provider: "apple" | "google" | "linkedin", identity_token, ...provider extras }`.
3. The backend **verifies the token against the provider's public keys** (issuer, audience = our client id, expiry, signature), extracts the stable provider user id + email, and then finds-or-creates our user.
4. The backend responds with **the exact same shape as `/api/login/`** — `access_token` + `refresh_token` — plus flags the app needs for routing (below). From that point on, nothing else in the app changes: same JWTs, same everything.

**The research questions (what we need answered):**

1. **Account model / database:** where do provider identities live? Presumably a new table (`user_sso_identities`: user_id, provider, provider_user_id, email_at_link_time, created_at) rather than columns on `user_info.user_profiles` — confirm. What does a **password-less** user mean for the current schema/login code (nullable password hash? sentinel?), and for the password-reset flow?
2. **Account linking & collisions:** a user signs up with email+password, later taps "Sign in with Google" using the same email — link silently (email is verified by the provider), or challenge? And the reverse: SSO first, sets a password later? What about **Apple's private relay emails** (`xyz@privaterelay.appleid.com`) — the same human can now exist twice with two different emails; any dedupe story?
3. **Role selection:** our registration is role-specific (`/api/register/` vs `/api/register-sponsor/`, each with its own questionnaire payload). SSO gives us an authenticated identity but NO role/questionnaire data — proposal: SSO creates a bare account and returns `is_new_user: true` + `needs_onboarding: true`, and the app routes them into the existing role-choice + questionnaire, which PATCHes the profile afterwards. Confirm the register services can be split into "create auth user" vs "attach role profile" cleanly.
4. **Provider quirks:** Apple sends the user's **name only on the very first authorization** (never again — must be captured and stored on first pass or it's gone); Apple requires our team id / service id config; LinkedIn's current product is **OpenID Connect** ("Sign In with LinkedIn v2" is sunset) — needs an app in the LinkedIn developer portal and may need a token-exchange server-side since their flow is not fully native. Google needs OAuth client ids per platform (iOS + Android + web/Expo).
5. **Email verification interplay:** we currently send a login-email verification on registration (PR #38). Provider-verified emails should presumably skip that — confirm the flag exists to mark an email pre-verified. (Sponsor WORK-email verification is separate and unaffected.)
6. **Session/security parity:** refresh-token rotation, logout/`unregisterDevice`, and account deletion (§C-era work) all behave the same for SSO users — anything provider-side to revoke on delete (Apple requires token revocation on account deletion per App Store rules — confirm).

**What the frontend needs in the response (whatever the design):** the standard `access_token`/`refresh_token` pair, `is_new_user`, `needs_onboarding` (or equivalent), and the user's email + any name the provider supplied — so the app can route to role selection for new users or straight in for returning ones.

### Deliverable

A short written proposal: chosen table design, the `POST /api/auth/sso/` contract, the account-linking policy, per-provider setup needed (keys/ids we must create in Apple/Google/LinkedIn consoles), and a rough effort estimate. We'll build the app side against it.

---

## §L — Unused profile fields — collected/stored but never read 🟢 Low priority (cleanup + PII minimization)

**Context (updated 2026-07-08 against the current codebase):** The onboarding/profile rework audited every field the applicant profile collects against the two things that actually consume profile data — the matching algorithm (`services/scoring.py`: skills, role, experience, location) and the sponsor-facing card (name, photo, title, bio, city/state, experience, education, certifications, languages, achievements, skills, insights, industry). Several collected fields feed neither.

**Findings — fields the product does not use:**

| Field | Backend column | Status |
|---|---|---|
| Street address | address street | **UI removal complete.** `EditProfileScreen.tsx` and `ApplicantQuestionnaire.tsx` now only collect a single "City, State" location field — confirmed no street/ZIP/country editor exists anywhere in the app. Safe to drop. |
| ZIP | `ZIP` | Same as street — UI removal complete, safe to drop. |
| Country | address country | Same as street — UI removal complete, safe to drop. |
| Phone number | `PHONE_NUMBER` | **UI removal complete.** No phone input exists anywhere in `ProfileView`, `EditProfileScreen`, or either questionnaire — confirmed via full-app search, zero hits. Not used by any feature (no call/SMS). Safe to drop. |
| Date of birth | `DATE_OF_BIRTH` | **Dead** — zero UI in the app (never collected or displayed). Column exists only. |
| LinkedIn | `LINKED_IN` | **Dead** — zero UI in the app. Column exists only. |

**Portfolio URL is NOT in this list — it's still live, do not drop `PORTFOLIO_URL`.** A candidate's portfolio link is read and displayed to sponsors in the referral flow (`components/messages/ReferralFlowModal.tsx`'s candidate review screen), and `lib/auth-api.ts` still forwards it to the backend whenever it's populated by resume-classify/ATS-autofill. An earlier version of this doc incorrectly listed it as dropped/unused — corrected here.

**Requested backend action (no rush; coordinate with the frontend cleanup):**
- The six columns above can be considered for **dropping** (or at least never requiring). This aligns with **§C** (account-deletion / PII minimization): `DATE_OF_BIRTH` in particular is sensitive PII that is collected nowhere and read nowhere, so retaining the column is pure liability.
- Do **not** drop `PORTFOLIO_URL` — see above.
- Do **not** drop anything the ATS-autofill (`services/autofill.py`) or resume-classify (`services/documents.py`) paths write to without checking those first.
- Dropping these columns is safe against the current PATCH payload — `lib/auth-api.ts → updateProfile()` no longer sends `phone_number`/`street`/`zip`/`country` at all (frontend cleanup shipped alongside this doc update), so there's nothing left going out that would clobber the columns with blanks or need accommodating.

**Frontend status:** both the UI (address editor, phone input — confirmed no editor exists anywhere in the app) and the outgoing payload for these four fields are fully removed. Nothing pending on the frontend side for this item.

---

# 🆕 New Features — Backend Support Needed

> This section tracks backend work for entirely new product features proposed during the post-launch UX audit and its 5-phase improvement plan (safety/relief → pipeline visibility → retention → match-to-referral funnel → agency/growth). **§N1** (report/block, Phase 4) and **§N2** (referral check-in stage, Phase 5) both shipped — see the backend's `KNOWN_ISSUES.md` "Recently fixed" for details. Remaining entries below are the phases that needed no backend work at all.

## UX Plan Phase 6 — Retention: no backend work needed

The original 5-phase plan assumed Phase 6 (daily-deck reminder, referral check-in nudges, unfinished-deck reminder) would need backend-scheduled push (cron + push payloads). On implementation, all three turned out to be fully solvable **client-side**, so there's no backend ticket here:

- **Daily deck reminder** — scheduled as an on-device **local** notification (`expo-notifications`' `DAILY` trigger type, not a server push) for 9am local time, right after push permission is confirmed granted. See `lib/localNotifications.ts`. The app already caches the applicant/sponsor deck per calendar day (`HomeView.tsx`'s `isSameDay` check), so a fixed local time is a safe bet that a fresh deck exists by then — no server round-trip needed to know that.
- **Unfinished-deck reminder** — a one-time local notification scheduled when the app backgrounds with cards still left in today's deck (`MainApp.tsx`'s `AppState` listener), canceled the moment the app returns to the foreground.
- **Referral check-in nudge** — an in-app banner on the Matches screen (not a push at all) surfacing referrals stuck at "Referred" for 7+ days, computed entirely from the already-fetched referrals list. See the `staleReferrals` memo in `MatchesView.tsx`.

Worth revisiting if a *server-triggered* push turns out to be wanted later (e.g. to reach users who've disabled the app's local-notification permission specifically but still have push enabled some other way — an edge case, since both share the same OS permission today).

---

## UX Plan Phase 7 — Match-to-referral funnel: no backend work needed (one design constraint discovered)

All three Phase 7 items (conversation starters, in-thread referral prompt, sponsor cold-start fix) shipped client-only. One real constraint surfaced while building the cold-start fix, worth recording:

- **Conversation starters** and **in-thread referral prompt** are pure client logic — templated openers built from data already on the conversation object (`MessagesView.tsx`'s `getConversationStarters`), and a message-count-based nudge toward the existing Refer button (`sponsorReferralPromptEligible`). No new endpoints.
- **Sponsor cold-start fix** — originally planned to show "We found N open roles at {company}" **during** the company question, mid-questionnaire. That's not possible with the current auth model: `GET /api/jobs/browse/` and `GET /api/ats/organizations/` (§G) both require auth, and a sponsor isn't registered until the *last* question of the questionnaire — there's no token yet, and no saved `sponsor_profiles.COMPANY` for the browse endpoint's server-side filter to key off of. Moved the role-picker to run **immediately after registration** instead (`SponsorQuestionnaire.tsx`, right after `setAuthTokens`), which is the earliest point it's actually possible — the practical outcome (exit onboarding with a live deck) is unchanged.
- The role-picker's `sponsorJob()` call uses a simplified insights payload (`insiderInsights` only, one optional text field) rather than the full 4-field wizard (`dayToDay`/`teamCulture`/`idealCandidate`/`insiderInsights`) the Jobs tab's sponsor flow collects. This is a **known quality tradeoff**, not a backend gap — sponsors can enrich the role's insights later from the Jobs tab. Flagging in case product wants the onboarding version to collect the same depth (would mean porting more of `JobsView.tsx`'s sponsor-flow UI into onboarding).

---

## UX Plan Phase 8 — Agency & growth

Phase 8's applicant job browse (**8.1**) is merged to main — `components/ApplicantJobsBrowseView.tsx`, reachable from the Jobs tab (no longer sponsor-only); its backend question (**§R**) shipped 2026-07-21 and is wired frontend-side. The share-a-job item (8.2) was descoped by product.

- **8.3 — Sponsor-request follow-through** — the "N employees notified" message a sponsor-request returns is never persisted server-side, so (same shape as §N2's check-in-stage gap) it's mirrored client-side (`utils/sponsorRequestCache.ts`) and shown later on the Waitlisted-job detail in `MatchesView.tsx`, plus a "Nudge again" button that re-sends the request once a waitlisted job has gone 5+ days without being picked up. This is a client-only local mirror with the same limitation as §N2 — it only reflects what THIS device requested, not a durable record. No backend ticket filed for this one since the existing `request-sponsor` endpoint already supports being called again (re-notifying), which is all "nudge again" needs.

---

*(Further entries for later UX-plan phases — agency/growth — will be appended here as those phases are implemented.)*
