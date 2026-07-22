# Backend Changes Needed

**Last updated:** 2026-07-21 (§P/§Q/§O/§M/§G/§R all shipped by the backend and wired frontend-side same day — removed from this doc; see the backend's `KNOWN_ISSUES.md` "Recently fixed" for the record)
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> **Open items:** **§S** — SSO (Apple + Google only — product green-lit, LinkedIn dropped); the frontend is building against the proposal's `POST /api/auth/sso/` contract now, but that endpoint **does not exist yet**, and one more endpoint is needed beyond what the proposal covers (§S below) before the new-user path can go live — see "Still needed" in §S. **§L** — drop/ignore unused profile columns (street/ZIP/country/phone/DOB/LinkedIn — cleanup + PII minimization, low priority, coordinate timing with backend; do **not** drop `PORTFOLIO_URL`, it's still live).
>
> Shipped items are removed to keep this lean; the backend's record now lives in its [`KNOWN_ISSUES.md`](../../Backchannel-backend/BackChannel-backend/docs/KNOWN_ISSUES.md) "Recently fixed" list (their `BACKEND_CHANGES_SHIPPED.md` was retired in the 2026-07 docs overhaul).

## §S — SSO sign-in (Apple + Google) 🟡 Medium priority — scoped and green-lit, one endpoint gap before launch

**Status (2026-07-21): scoped, frontend build underway on `feature/sso-apple-google`.** Product decision on the proposal's two open questions:

1. **Providers: Apple + Google only.** LinkedIn is dropped — not worth the third integration (flakiest of the three APIs, forces nothing extra on iOS since Apple's mandatory the moment Google ships anyway).
2. **Sponsor work-email flow: unchanged.** An SSO sponsor signs up with their personal Apple/Google account (verified by the provider), then runs the **existing** sponsor questionnaire exactly as a password sponsor does today, including the existing work-email verification step at the end. No new flow needed here — confirmed the frontend's `sendWorkEmailVerification` call already fires unconditionally regardless of how the account was authenticated.

Everything else in the proposal (`docs/SSO_PROPOSAL.md`) stands as designed: `user_info.user_sso_identities` table, `POST /api/auth/sso/` (login-shaped response + `is_new_user`/`needs_onboarding`), nullable `password_hash`, auto-link on provider-verified email, Apple private-relay emails never auto-linking. **Building the frontend against that contract now** — LinkedIn's rows can simply be dropped from the provider enum / verification table.

### Still needed: one endpoint the proposal didn't cover

The proposal's §3/§6 describe SSO creating a **role-less** user and routing the app into "the existing role-choice + questionnaire flow, which ends in the existing role-profile creation queries." Walking that through against the actual frontend code surfaced a gap: **that "end" is `POST /api/register/` / `POST /api/register-sponsor/`, and both require a `password` and create a brand-new user.** They're not usable by an already-authenticated, password-less SSO user who just needs a role attached to the account they already have — calling them would try to create a *second* user.

**Requested:** an authenticated endpoint, e.g. `POST /api/auth/complete-onboarding/`, that takes the same role-specific payload `register`/`register-sponsor` already accept **minus** `username`/`email`/`password` (all already known — the caller is authenticated), sets `ROLE_TYPE`, and creates the role-profile row via the same "already separable" `create_user_profile`/role-profile queries the proposal references. Response can be minimal (`{ "role": "Applicant" | "Sponsor" }` or the same shape `register` returns today, minus new tokens — the caller already has valid tokens from the SSO exchange, no `/api/login/`-shaped re-issue needed).

Two applicant/sponsor fields worth double-checking land correctly through this new path: `industry`/`current_role`/`positions`/`skills`/`insights`/`work_preferences` (applicant) and `company`/`job_title`/`duration`/`open_to_referrals`/`referral_experience`/`financial_reward`/`insights`/`work_email` (sponsor) — i.e. the exact same field sets `authApi.createProfile()` sends today, since the frontend questionnaires are unchanged and will send the identical payload shape to whichever endpoint they're pointed at.

### Acceptance tests

- `POST /api/auth/sso/` with a valid Apple/Google identity token for a brand-new identity → creates a role-less user, returns `is_new_user: true`, `needs_onboarding: true`, valid tokens.
- Same call again (same `sub`) → logs in, `is_new_user: false`.
- `POST /api/auth/sso/` with a provider-verified email matching an existing password account → auto-links, logs in, no challenge.
- `POST /api/auth/complete-onboarding/` (authenticated as a role-less SSO user) with an applicant or sponsor payload → sets `ROLE_TYPE`, creates the role-profile row, `GET` on the profile afterward reflects it. Calling it again (role already set) → 400, not a second profile row.

### Frontend status

In progress on `feature/sso-apple-google`: native Apple/Google SDKs, the `lib/auth-api.ts` client methods (`ssoLogin`, `completeSsoOnboarding` — the latter calls the endpoint requested above), the button UI, and the login/signup routing are being built now, all behind a `SSO_ENABLED` feature flag (default `false`, same pattern as `PREMIUM_ENABLED`) so nothing ships live until both this endpoint exists and real Apple/Google console credentials are configured. Nothing here is end-to-end testable until `POST /api/auth/sso/` itself is live — that's the harder blocker; the `complete-onboarding` gap just needs to be known before that day, not necessarily built first.

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
