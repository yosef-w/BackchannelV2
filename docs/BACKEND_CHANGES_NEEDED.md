# Backend Changes Needed

**Last updated:** 2026-09-18 (added **§F** — feed relevance: both decks are random/PK-ordered pools with scoring applied only as a partial Python re-sort; sponsored jobs never scored, sponsor deck never scoped to the job)
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> **Open items:** **§F** — feed relevance (🔴 high): signup answers barely shape what users see — the sponsored half of the applicant deck is `ORDER BY random()` and never scored, and the sponsor deck shows every applicant in the DB rather than candidates for the sponsored job (fix order in §F). **§S** — SSO (Apple + Google): **both sides are code-complete** — backend endpoints shipped on their `develop` (PR #152), frontend wired to the implemented contract behind `SSO_ENABLED = false`. What remains is config, not code: Apple/Google console credentials → backend env vars + frontend env vars, backend develop→main deploy, then flip the flag and EAS build (full checklist in §S). **§B** — confirm whether `GET /api/profile/` returns `BIO`; if not, add it (small, but it's silent user-visible data loss on re-login). **§L** — drop/ignore unused profile columns (street/ZIP/country/phone/DOB/LinkedIn — cleanup + PII minimization, low priority, coordinate timing with backend; do **not** drop `PORTFOLIO_URL`, it's still live).
>
> Shipped items are removed to keep this lean; the backend's record now lives in its [`KNOWN_ISSUES.md`](../../Backchannel-backend/BackChannel-backend/docs/KNOWN_ISSUES.md) "Recently fixed" list (their `BACKEND_CHANGES_SHIPPED.md` was retired in the 2026-07 docs overhaul).

## §S — SSO sign-in (Apple + Google) ✅ Both sides built — remaining: credentials/env config + deploy

**Status (2026-08-07): backend SHIPPED both endpoints** (their PR #152, `feat/sso-apple-google` → `develop`, commit `04c2bea`, with a frontend handoff at their `docs/FRONTEND_SSO_HANDOFF_2026-08-04.md`) — `POST /api/auth/sso/`, `POST /api/auth/complete-onboarding/`, migration 029 (`user_sso_identities` + nullable `password_hash`), password-gated flows returning 400 for passwordless accounts, and Apple revoke-on-delete. The frontend (branch `feature/sso-apple-google`) is wired to the **implemented** contract, verified against their actual `services/sso.py` rather than the proposal: `has_password` handling + "Set a Password" UX, Apple `authorization_code` forwarded on every sign-in, capitalized `role` values, and `register-sponsor`-matching sponsor field conversions (an earlier note here guessed those were free-text strings — wrong; booleans + `"yes"`/`"no"`, matching what `createProfile()` already sends).

**Remaining launch checklist (nothing left to code on either side):**

1. **Backend/ops:** merge `develop` → `main` and deploy — SSO is live on dev (`https://backchannel-dev-hl72i.ondigitalocean.app`, returns 503-per-provider until creds are set) but **not on production**.
2. **Admin (Apple): ✅ done (2026-08-08)** — the Sign in with Apple `.p8` key exists (key ID `96LV7XHDB4`, in the admin's local Downloads, deliver to backend via a private channel — never commit it), and `app.json` has `usesAppleSignIn: true` so EAS manages the App ID capability + entitlement at build time. Remaining is only the handoff: backend env vars `APPLE_BUNDLE_ID` + `APPLE_TEAM_ID` (`ZWFR8LC25W`) / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` — and the key trio is only for revoke-on-delete, so Apple sign-in itself can go live with just the bundle ID set.
3. **Admin (Google):** create iOS/Android/Web OAuth client IDs in Google Cloud Console. Feeds backend `GOOGLE_OAUTH_CLIENT_IDS` (comma-separated, web ID is the token `aud`) and the frontend `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` env vars; the iOS ID's reversed form also goes into app.json's google-signin plugin as `iosUrlScheme`.
4. **Frontend:** set the env vars from #3, then EAS build (native modules + entitlement must ship in a real build; the config plugin `plugins/withGoogleSigninModularHeaders.js` already handles the Podfile patch on every prebuild). ~~Flip `SSO_ENABLED = true`~~ — **done 2026-08-19**, committed on `main`; the next build ships with SSO buttons rendering, so sequence the backend deploy (#1) before or alongside that build.
5. **E2E test against dev first** — their handoff's §5 has the recipe; test users land in `BACKCHANNEL_DEV`, never prod.

---

## §F — Feed relevance: signup answers barely shape the decks 🔴 High priority (core product — sponsored jobs unscored, sponsor deck unscoped)

**Status (2026-09-18):** traced end-to-end against the local backend checkout after a founder question ("if someone says they want to be a software engineer, do we show them those roles?"). Short answer: only weakly, and not for the part of the product that matters. Nothing is wrong on the frontend side — it sends no filters and renders server order — so this is entirely a backend item.

**What the frontend sends:** `GET /api/jobs/pack/` with **no params** (`lib/api.ts:471`); `GET /api/profiles/pack/?job_id=<sponsored JOB_ID>` with only that one param (`lib/api.ts:808`). All personalization is expected server-side. The applicant questionnaire does collect the right inputs and persists them via `PATCH /api/profile/applicant/update/` — `positions` (the "What position are you seeking?" answer), `skills`, `industry`, `current_role`, `work_preferences`, plus `location` via `updateGeneralProfile` (`ApplicantQuestionnaire.tsx:995-1024`).

**What the backend actually does:**

1. **Applicant deck — sponsored jobs are never scored.** `services/jobs.py:551 get_job_pack` pulls two pools, both `ORDER BY random()` with no profile predicate (`queries/jobs.py:454-459` ATS, `:789-818` sponsored; the only filters are active/not-blocked/not-in-`job_feed_history`). It oversamples ~30, then **scores only `ats_raw`** (`services/jobs.py:574-584`) — `spn_raw` is truncated in random order and interleaved ~50/50 (`:589-607`). So roughly half of every deck — the sponsored jobs, i.e. the referral product — is pure random relative to what the user asked for.
2. **Applicant deck — ranking is a re-sort of a random window, not a filter.** `services/scoring.py` (skills 40 / experience 20 / role 20 / location 10 / recency 10) reads `SKILLS, YEARS_EXPERIENCE, current_role, DESIRED_ROLES, WORK_PREFERENCES, LOCATION` (`queries/profiles.py:341`) — but it can only reorder the ~30 rows `random()` happened to return. A strong-fit job outside that window never surfaces. Scoring failures fall back silently to unranked (`services/jobs.py:571-572`).
3. **Sponsor deck — not scoped to the job at all.** `queries/profiles.py:213 fetch_profile_pack` has no predicate on the sponsored job's title/skills/location or the sponsor's company; `job_id` is used only for the `matching.likes` liker flag (`:239-241`). Order is likers-first, then **primary key** (`:248`). `services/profiles.py:329-344` applies scoring only when the pool exceeds the page limit. Net: a sponsor sponsoring a PM role swipes through every applicant in the database.
4. **Browse/search/likes are unranked.** `/api/jobs/browse/` is newest-first with no profile pre-fill (`services/jobs.py:788`, `queries/jobs.py:658`); `/api/jobs/<id>/likes/applicants/` has no score, so the app's "Top Applicants" is just an unordered likes list.

**Collected but read by no feed/matching query** (distinct from §L — these should be *wired in*, not dropped): applicant `INDUSTRY`, `RANGE_MILES`, `WILLING_TO_RELOCATE`, `REQUIRES_SPONSORSHIP`, `INSIGHTS`, `RESUME_DATA`; sponsor `COMPANIES_CAN_REFER_TO`, `JOB_TITLE`, `REFERRAL_ELIGIBLE`, `OPEN_TO_REFERRALS`. `COMPANIES_CAN_REFER_TO` is the notable one — it's the field that most directly encodes which jobs a sponsor can actually refer into, and nothing reads it (`services/profiles.py:237, 318` write/display only). Sponsor `COMPANY` is the only sponsor field that shapes any query, and only for their own job-browse tab (`services/jobs.py:800`).

**Ask (in leverage order):**
1. **Score `spn_raw` too** — pass the sponsored pool through the same `services/scoring.py` path at `services/jobs.py:574-584` before interleaving. Smallest change, fixes the half of the deck that's currently random.
2. **Scope the sponsor deck to the job** — add title/skills/location predicates to `fetch_profile_pack` from `queries/jobs.py:248 get_job_scoring_criteria`, so sponsors see candidates for the role they sponsored, not the whole table. (`docs/ARCHITECTURE.md:465`'s "finite pool" note still applies — scoping shrinks the pool further, so pair with the replenishment redesign it describes.)
3. **Filter in SQL, not just re-sort in Python** — push at least skills/title predicates into the applicant pack `WHERE` (or widen the oversample) so a good fit isn't lost to the random-30 window.
4. **Emit `relevance_score` consistently.** `docs/API_REFERENCE.md:694, 708` documents a 0–1 score on pack cards; jobs never emit it (`services/jobs.py:615`) and profiles emit 0–100 (`profiles.py:337`), and `docs/FRONTEND_WIRING_GUIDE.md:643` says the opposite. Pick one contract — the app renders a "YOUR FIT — N% match" badge from `relevanceScore` (`types/jobs.ts:369`, `components/home/JobCardContent.tsx:119`), so today that badge is either absent or a client-side skill-overlap figure, not the server's ranking.

**Frontend status:** nothing to change for #1–#3 — the app renders whatever order the server returns and the "YOUR FIT" plate already computes skill overlap locally (`components/home/plates/plateContent.ts:477`). If #4 settles on the server emitting a 0–100 score for jobs, the frontend should drop the local overlap fallback and display the server value. One open question worth answering on-device before then: what the "YOUR FIT — N%" badge actually shows a user right now.

---

## §B — `GET /api/profile/` doesn't return `BIO` — bio can't round-trip 🟠 Medium priority (silent user-visible data loss)

**Status (2026-08-09):** needs a one-line confirmation against the live API, then (if confirmed) a small serializer fix.

**What the frontend observes:** `PATCH /api/profile/update/` accepts and stores `bio` (sponsor onboarding and the profile editor both save through it successfully), but the profile the app reads back via `GET /api/profile/` does not appear to include a `BIO` field — the frontend's response type declares it (`lib/auth-api.ts`) and the store maps it (`stores/useUserProfileStore.ts` → `professional.summary`), but a long-standing code comment there says the field never actually arrives, and the mapping only works today because it falls back to the locally cached value.

**User-visible consequence if confirmed:** the bio survives only in on-device AsyncStorage. Any fresh context — logout → login, reinstall, new device — shows an empty bio even though the server has one stored. The user then either re-types it or (worse) assumes the app lost their data. Photo does NOT have this problem (`PHOTO_URL` round-trips fine); bio is the only affected field found in the 2026-08-09 end-to-end profile-pipeline audit.

**Ask:**
1. Confirm whether the `GET /api/profile/` serializer includes `BIO` for both roles.
2. If missing, add it (same casing convention as the response's other columns, e.g. `PHOTO_URL`).
3. No frontend change needed afterward — the mapping (`summary: profile.BIO || existing…`) is already in place and will simply start receiving real data.

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
