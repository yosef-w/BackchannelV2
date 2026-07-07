# Backend Changes Needed

**Last updated:** 2026-07-06 (after the `3aa52f8..2856d62` backend drop — moderation/report-block, referral check-in stage, profile-like notification, unsponsor-reason actions, change-email)
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> **Open items:** **§G** — ATS organizations search endpoint (company autocomplete + "did you mean", medium priority); **§M** — reject empty `first_name`/`last_name` server-side (medium priority — the frontend bug that caused this is already fixed and known-affected accounts repaired; this is just the defense-in-depth backend guard); **§L** — drop/ignore unused profile columns (cleanup + PII minimization, low priority — phone's UI is already removed on our side); and the **email deployment checklist** at the bottom (deliverability — SPF/DKIM/DMARC). **§F** (larger deck for premium) is documented but deprioritized — not a current focus.
>
> Shipped items are removed to keep this lean; the backend's record now lives in its [`KNOWN_ISSUES.md`](../../Backchannel-backend/BackChannel-backend/docs/KNOWN_ISSUES.md) "Recently fixed" list (their `BACKEND_CHANGES_SHIPPED.md` was retired in the 2026-07 docs overhaul).

## ✅ Resolved (2026-07-06 second backend drop — was §N1, §N2, §D, §B, change_email)

- **§N1 — report/block a user**: `POST /api/reports/` shipped exactly to our spec (`reported_user_id`/`reason`/`detail`/`conversation_id`, same reason enum), and reporting now implies a full bidirectional block (unmatch, close conversations, withdraw likes, hidden from each other's decks/matches going forward) — no separate "Block" action needed. **Zero frontend changes required** — `reportUser()` already called this exact contract.
- **§N2 — referral check-in stage**: `GET /api/referrals/` (list + detail) now returns `CHECKIN_STAGE`/`CHECKIN_UPDATED_AT` via a join on the latest `referral_checkins` row. **Zero frontend changes required** — `MatchesView.tsx` already preferred `r.CHECKIN_STAGE` over the local mirror; this just lit up automatically.
- **§D — notify applicant on profile like**: backend sends `notif_type='profile_like'` on the non-match path, mirroring `notify_sponsor_of_like`. **Frontend wiring shipped** (commit `8308418`): `MainApp.tsx` now invalidates the Matches cache on this push type, and `NotificationsView.tsx` got an icon + tap-routing to the Matches tab (previously would've silently no-opped).
- **§B — act on unsponsor reason**: `posting_expired`/`role_filled` now skip the waitlist revert, and `posting_expired` additionally deactivates the shared `ats.silver_jobs` row so the dead listing stops surfacing for everyone. **Zero frontend changes required** — the reason was already being sent.
- **`change_email`**: no longer a 501 stub — `POST /api/auth/change-email/` verifies the password, mints a single-use 24h token, and emails a confirmation link to the **new** address (change isn't live until that link is clicked). **Frontend UI shipped too** (commit `9c8f24b`): a "Change Email" step in `PrivacySecurityScreen`, next to Change Password — submits new email + password, then shows a "check your new inbox" confirmation screen instead of an instant success toast.

## ✅ Resolved (2026-07-06 first backend drop — was §C, §E, §H, §I, §J, §K)

§C (real account deletion — **frontend cutover shipped too**: password-confirmed delete step in `PrivacySecurityScreen` → `POST /api/account/delete/`), §E (`POST /api/profiles/like/` 500 — confirmed fixed by the matching rework, re-verified against the originally-failing account), §H (email case normalization + `EMAIL_HOST` prod hard-fail), §I (server-side company lock, 409), §J (self-like, `like_type` discriminator), §K (unsponsor cache invalidation). Details in the backend's `KNOWN_ISSUES.md` "Recently fixed".

Match-state cutover (reading `/api/matches/*` instead of the derived like `STATUS`, per `FRONTEND_MATCH_CUTOVER.md`) is still a pending frontend release — not urgent, no backend action needed.

---

## §M — Reject empty `first_name` / `last_name` in `PATCH /api/profile/update/` 🟡 Medium priority

**Resolved on our side:** the frontend bug that caused this (login seeding an all-blank `personal` group, then syncing it in full) is fixed (`BackchannelV2` commit `3f524bd`), and the two known-affected accounts (`sarah.chen@` and `emily.rodriguez@demo.backchannel.app`) have been manually repaired via the API from their seed data — names, phone, and address all restored.

**Still open:** the backend has no server-side guard against this class of bug — `update_user_profile` will still silently accept and store `first_name: ""` / `last_name: ""` from any client. Requested: in `services/profiles.py` → `update_user_profile`, ignore (or 400) `first_name`/`last_name` when empty/whitespace — there's no legitimate clear-your-name flow, so an empty name from any client is always a bug. (Phone/address/portfolio must keep accepting `""` — those ARE legitimately clearable.) Also worth a one-time sweep for any **non-demo** account that logged into an affected build and is still silently blanked: `SELECT user_id, email FROM user_info.user_profiles WHERE first_name = '' OR last_name = '';`

### Acceptance test

`PATCH /api/profile/update/` with `{"first_name": "", "last_name": ""}` leaves the stored names unchanged (or returns 400); a normal non-empty name update still works.

---

## §G — ATS organizations search endpoint (company autocomplete + "did you mean") 🟡 (data quality)

**Why:** A sponsor's jobs board is filtered by matching their **free-text** company (from `sponsor_profiles.COMPANY`, set at signup) against `ats.silver_jobs.ORGANIZATION` using `UPPER(ORGANIZATION) ILIKE '%' || UPPER(company) || '%'` (`queries/jobs.py:493`, with legal-suffix normalization in `services/jobs.py:_normalize_company`). That handles casing and suffixes, but **not** misspellings, spacing/word-boundary differences ("JP Morgan" vs "JPMorgan Chase"), aliases (Facebook vs Meta), or over-matching short names — and on a mismatch the sponsor just sees an **empty board with no explanation**.

The frontend now fixes this from both ends, but needs one read-only endpoint to do it:
- **Company autocomplete at signup** (`components/ui/CompanyAutocomplete.tsx`) so the stored company is an *exact* ATS organization string (mismatch can't happen).
- **"Did you mean…"** suggestions when the board is empty (`components/JobsView.tsx`) — one tap re-saves the corrected company and reloads.

### Required endpoint

```
GET /api/ats/organizations/?q=<text>&limit=<n>   (auth required; sponsor)
→ 200 { "organizations": [
        { "organization": "Google", "job_count": 42, "logo_url": "https://…" },
        { "organization": "Google Cloud", "job_count": 8, "logo_url": null }
      ] }
```

- Distinct `ORGANIZATION` values from `ats.silver_jobs WHERE is_active = TRUE`, with the **active job count** per org and the org logo (`ORGANIZATION_LOGO`) when available.
- **Matching must serve two needs:**
  1. **Typeahead** — substring/prefix (`ILIKE '%' || q || '%'`) for as-you-type autocomplete.
  2. **Fuzzy "did you mean"** — so a *misspelled* stored company ("Gogle") still surfaces "Google". Use **`pg_trgm` similarity** (`similarity(ORGANIZATION, q) > ~0.3`), ordered by similarity desc, then `job_count` desc. Requires `CREATE EXTENSION pg_trgm;` and ideally a GIN trigram index on `ORGANIZATION` for speed.
- Combine both (substring OR trigram-similar), de-duplicate by `ORGANIZATION`, cap at `limit` (frontend asks for 6–8).

### Frontend status

Shipped and live behind a graceful fallback: `lib/api.ts → searchAtsOrganizations()` returns `null` on 404/error, so until this endpoint exists the company field is plain free-text and the empty board shows the normal empty state — **nothing breaks**. The autocomplete and "did you mean" light up automatically once the endpoint is deployed.

### Optional follow-up (stronger guarantee)

Consider normalizing/validating `sponsor_profiles.COMPANY` against this canonical list on write (or storing a chosen org id), so the browse filter can match on an exact key rather than `ILIKE`.

---

## §F — Larger daily deck (card allotment) for premium users ⚪ Deprioritized (monetization, not a current focus)

**Context:** The Home feed serves a fixed daily deck of **`DECK_SIZE = 10`** cards (`components/HomeView.tsx`), cached per day and rolling over at midnight. The new end-of-deck screen ("You're all caught up") now shows an **"Unlock more cards"** button that opens the existing RevenueCat paywall (`useSubscriptionStore.presentPaywall`, same one ProfileView uses for "Upgrade to Pro").

**What's missing (backend):** there is currently **no larger/unlimited allotment** for users who purchase premium — the deck endpoint caps everyone at the same daily set. So today, after a successful purchase, the app can only `resetNavigation()` (replay the same 10), which isn't real added value.

**Required change (when monetization is turned on):**
- Have the deck/feed endpoint return a larger (or unlimited) daily set for entitled/premium users — i.e. read the user's entitlement and raise the cap server-side.
- Expose the per-user cap (or "has more") so the app can fetch the next batch after purchase instead of replaying.

**Frontend status:** the paywall button is wired and the upsell only shows to non-premium users (`!isPremium`). Once the backend serves more cards to premium accounts, swap the post-purchase `resetNavigation()` for a real "fetch next batch". Gated behind `PREMIUM_ENABLED` (`constants/config.ts`), which is **false** today, so the button is inert until premium is switched on.

---

## §L — Unused profile fields — collected/stored but never read (onboarding rework, Phase 4) 🟢 Low priority (cleanup + PII minimization)

**Context (2026-07-01):** The onboarding/profile rework audited every field the applicant profile collects against the two things that actually consume profile data — the matching algorithm (`services/scoring.py`: skills, role, experience, location) and the sponsor-facing card (name, photo, title, bio, city/state, experience, education, certifications, languages, achievements, skills, insights, industry). Several collected fields feed neither.

**Findings — fields the product does not use:**

| Field | Backend column | Status |
|---|---|---|
| Portfolio URL | `user_profiles.PORTFOLIO_URL` | **Frontend UI removed** (ProfileView, Phase 4). Not scored, not shown on the card. Column now unwritten by the app. |
| Street address | address street | Not scored, not displayed (only city/state feed `LOCATION`). Frontend UI removal pending (coupled to the combined address editor — deferred until the onboarding branch is tested). |
| ZIP | `ZIP` | Same — unused, UI removal pending. |
| Country | address country | Same — unused, UI removal pending. |
| Phone number | `PHONE_NUMBER` | Collected historically; **no longer gated** (Phase 1) and not used by any feature (no call/SMS). UI still present. Product decision to keep for future contact/verification vs. drop. |
| Date of birth | `DATE_OF_BIRTH` | **Dead** — zero UI in the app (never collected or displayed). Column exists only. |
| LinkedIn | `LINKED_IN` | **Dead** — zero UI in the app. Column exists only. |

**Requested backend action (no rush; coordinate with the frontend cleanup):**
- These columns can be considered for **dropping** (or at least never requiring). This aligns with **§C** (account-deletion / PII minimization): `DATE_OF_BIRTH` in particular is sensitive PII that is collected nowhere and read nowhere, so retaining the column is pure liability.
- Do **not** drop anything the ATS-autofill (`services/autofill.py`) or resume-classify (`services/documents.py`) paths write to without checking those first.
- No endpoint contract changes are required for the frontend — `updateGeneralProfile` simply stops sending `portfolio_url` (and, once the UI is removed, `street`/`zip`/`country`). The fields remaining in the PATCH schema are harmless if unused.

**Frontend status:** Phase 4 removed the Portfolio field UI. The address street/ZIP/country fields and the (unused) phone field are documented here for a follow-up pass — deliberately deferred rather than ripped out of the tightly-coupled address editor before the onboarding branch has been run on-device.

---

# 🆕 New Features — Backend Support Needed

> This section tracks backend work for entirely new product features proposed during the post-launch UX audit and its 5-phase improvement plan (safety/relief → pipeline visibility → retention → match-to-referral funnel → agency/growth). **§N1** (report/block, Phase 4) and **§N2** (referral check-in stage, Phase 5) both shipped — see the "✅ Resolved" block near the top. Remaining entries below are the phases that needed no backend work at all.

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

## UX Plan Phase 8 — Agency & growth (8.3 only — see note)

Phase 8's applicant job browse (8.1) and its §N3 backend question moved to its own `applicant-jobs-browse` branch (pending backend confirmation before merging). The share-a-job item (8.2) was descoped by product. This branch carries 8.3 only:

- **8.3 — Sponsor-request follow-through** — the "N employees notified" message a sponsor-request returns is never persisted server-side, so (same shape as §N2's check-in-stage gap) it's mirrored client-side (`utils/sponsorRequestCache.ts`) and shown later on the Waitlisted-job detail in `MatchesView.tsx`, plus a "Nudge again" button that re-sends the request once a waitlisted job has gone 5+ days without being picked up. This is a client-only local mirror with the same limitation as §N2 — it only reflects what THIS device requested, not a durable record. No backend ticket filed for this one since the existing `request-sponsor` endpoint already supports being called again (re-notifying), which is all "nudge again" needs.

---

*(Further entries for later UX-plan phases — agency/growth — will be appended here as those phases are implemented.)*
