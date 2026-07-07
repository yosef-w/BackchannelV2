# Backend Changes Needed

**Last updated:** 2026-07-06 (after the `3aa52f8..2856d62` backend drop — moderation/report-block, referral check-in stage, profile-like notification, unsponsor-reason actions, change-email)
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> **Open items:** **§G** — ATS organizations search endpoint (company autocomplete + "did you mean", medium priority); **§M** — reject empty `first_name`/`last_name` server-side (medium priority — the frontend bug that caused this is already fixed and known-affected accounts repaired; this is just the defense-in-depth backend guard); **§L** — drop/ignore unused profile columns (cleanup + PII minimization, low priority — phone's UI is already removed on our side); **§O** — create-from-URL doesn't reuse a company's known logo (medium priority — same-company jobs created via URL paste get a lower-confidence logo lookup instead of the logo already on file from ATS/other sponsored jobs); **§P** — original posting URL isn't threaded through the ATS-sponsor path or the liked-jobs endpoint (medium priority — the frontend now shows a "View original posting" trust link, but it only lights up for create-from-URL jobs until these two gaps close).
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

## §O — Create-from-URL job creation doesn't reuse a known company logo 🟡 Medium priority (data quality)

**Why:** Two different backend paths resolve a job's logo, and only one of them is good:

- **Sponsoring an existing ATS listing** (`services/jobs.py:765`, `sponsor_job`) checks `silver_job.get('ORGANIZATION_LOGO')` first — the logo already ingested for that ATS organization — and only falls back to `logo_svc.resolve_logo_url()` with a **real domain** (`silver_job['DOMAIN_DERIVED']` / `ORGANIZATION_URL`) if that's missing.
- **Creating a job from a pasted URL** (`services/jobs.py:240`, `create_job_from_url`) does neither: `logo = logo_svc.resolve_logo_url(company_name=company)` — a **name-only** Logo.dev lookup with no domain and no check against any existing logo on file for that company. Concretely: a sponsor who already has a "Google" job (via ATS sponsorship, with a good logo) gets a different, lower-confidence, sometimes-empty logo when they create a *second* "Google" job by pasting a URL — even though the job-posting URL they just pasted (e.g. `jobs.google.com/...`) contains a perfectly good domain that's simply never passed to the resolver, and the already-known-good logo for that company is never looked up at all.

### Check first (ops, 2 minutes): is `LOGO_DEV_TOKEN` set on the deployed API?

`services/logos.py` silently no-ops (`return None`) when `LOGO_DEV_TOKEN` is unset — every created-from-URL job then gets NO logo regardless of company, while ATS-sponsored jobs still look fine (their logos were baked in at ETL time from `ORGANIZATION_LOGO`). This failure mode exactly matches the observed symptom (real example: a "Snowflake" create-from-URL job, `source: structured`, correct company name, empty logo). Verify the DigitalOcean API app's env vars include a Logo.dev **publishable** key (`pk_*`, never `sk_*` — the token is embedded in client-visible image URLs). **Also: `.env.example` doesn't list `LOGO_DEV_TOKEN` at all** — please add it there so fresh environments don't silently ship without logo resolution.

### Requested change (relevant even with a working token)

In `create_job_from_url` (`services/jobs.py`), before calling `logo_svc.resolve_logo_url`:
1. **Reuse an existing logo for the same company**, checking (in order): `ats.silver_jobs.ORGANIZATION_LOGO` for an `ORGANIZATION` match (same `ILIKE`/normalization already used in `browse_silver_jobs`/`_normalize_company`), then any existing `JOB_POSTINGS` row with a non-null `logo_url` for the same company (covers companies with no ATS presence but an existing sponsor-created job, e.g. from this same flow). Besides fixing missing logos, this makes same-company jobs render the *identical* image instead of two independent Logo.dev renders.
2. **Only if no existing logo is found**, fall back to `logo_svc.resolve_logo_url`, but pass a domain: extract it from the pasted job URL itself (the same `_extract_domain` helper `services/logos.py:31` already has, just unused on this path) via `organization_url=url`, not just `company_name=company`. Two caveats for the extraction: prefer the registrable root domain (`careers.snowflake.com` → `snowflake.com`, since Logo.dev indexes by root domain), and skip known ATS hosts entirely (`greenhouse.io`, `lever.co`, `myworkdayjobs.com`, …) rather than serve the ATS vendor's logo — fall through to today's name-only lookup in that case.

This is the same company-name-matching infrastructure §G already needs (fuzzy/ILIKE matching against `ats.silver_jobs.ORGANIZATION`) — worth building together if §G is picked up, since §G's proposed `GET /api/ats/organizations/` endpoint already returns `logo_url` per organization and could double as the lookup this needs.

### Frontend status

No frontend change needed (verified 2026-07-08): the app never resolves logos itself — both job lists render whatever `LOGO_URL` the backend persisted (via the `getMyJobs()` refetch after creation) with a shared stock-image fallback, and sponsors already have a manual escape hatch: the job menu's "Replace Company Logo" editor (PR #62, `logo_url` on `PATCH /api/jobs/<id>/edit/`) can paste a correct logo onto any affected job today. Once the backend reuses/resolves logos properly, they appear on the same refetch with zero app changes.

---

## §P — Original posting URL isn't threaded through every job-creation/read path 🟡 Medium priority (trust/data quality)

**Why:** The frontend now shows a "View original posting: `<domain>`" link on every job detail screen (applicant Home deck, applicant liked-job detail, sponsor's own job detail) — a deliberate anti-embellishment signal: since sponsors can freely edit a create-from-URL job's fields before publishing (title, salary, description — necessary, since scrapes are unreliable), the one thing that's hard to fake is the link to the real posting. A mismatch between what's published and what the link actually shows becomes visible to the applicant. This only works where `job_postings.URL` is actually populated and returned, and today that's inconsistent:

| Path | URL populated? | Where |
|---|---|---|
| Create job from pasted URL | ✅ Yes | `create_job_from_url` (`services/jobs.py:254`) passes `url=url` |
| Sponsor an ATS listing | ❌ **No** | `sponsor_job` (`services/jobs.py:771`) never passes a `url=` to `create_sponsored_job`, even though `ats.silver_jobs.job_url` has the real per-listing URL (confirmed in `docs/schemas/migrations/postgres/001_initial_schema.sql:401` — distinct column from `organization_url`, which is the company's general site, not the listing) |
| Applicant's liked-jobs list | ❌ **No** | `get_liked_jobs_for_user` (`queries/likes.py:150`) doesn't `SELECT j.URL` from `jobs.job_postings` at all, even for jobs where it's populated |

### Requested change

1. **`sponsor_job`**: add `JOB_URL` to `find_silver_job`'s SELECT (`queries/jobs.py:337`, alongside the existing `ORGANIZATION_LOGO`/`ORGANIZATION_URL`/`DOMAIN_DERIVED`), and pass `url=silver_job.get('JOB_URL')` through to `create_sponsored_job` (`services/jobs.py:771`) the same way `logo_url` already is.
2. **`get_liked_jobs_for_user`**: add `j.URL` to the SELECT list (`queries/likes.py:150-163`) and thread it through `services/matching.py:get_liked_jobs`'s row formatting to the frontend response.

Both are narrow, additive column selections — no schema change, no new endpoint, low risk.

### Frontend status

Shipped (2026-07-08) and waiting on the backend: `components/jobs/jobTransforms.ts`'s `extractDisplayDomain()` renders the link wherever `job.url` is present; `matches/matchesQueries.ts`'s `JobOpportunity.url` is already wired defensively (reads `likedJob.URL || likedJob.url`, same pattern as the existing `companyLogoUrl` field) so the applicant liked-job detail link lights up the moment change #2 ships, with zero further app changes. Same for #1 — `getMyJobs()`/`Job.url` already exists on the type, it's just empty today for ATS-sponsored jobs.

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
