# Backend Changes Needed

**Last updated:** 2026-09-18 (added **§V** — pre-production security audit findings, backend-owned portion: sponsor feed over-shares applicant PII, public-read image storage, stale Django/deps, plus several medium hardening items)
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> **Open items:** **§V** — security audit (🔴 high, new): a joint frontend+backend read-only audit ahead of App Store submission found no broken authorization or SQL injection (both clean), but the sponsor feed returns applicant phone/DOB/résumé before any match, uploaded images are public-read forever, and Django + a few libs are past their security-support window. Entirely backend-owned — see §V for the full breakdown and fix order. **§F** — feed relevance (🔴 high): signup answers barely shape what users see — the sponsored half of the applicant deck is `ORDER BY random()` and never scored, and the sponsor deck shows every applicant in the DB rather than candidates for the sponsored job (fix order in §F). **§S** — SSO (Apple + Google): **both sides are code-complete** — backend endpoints shipped on their `develop` (PR #152), frontend wired to the implemented contract behind `SSO_ENABLED = false`. What remains is config, not code: Apple/Google console credentials → backend env vars + frontend env vars, backend develop→main deploy, then flip the flag and EAS build (full checklist in §S). **§B** — confirm whether `GET /api/profile/` returns `BIO`; if not, add it (small, but it's silent user-visible data loss on re-login). **§L** — drop/ignore unused profile columns (street/ZIP/country/phone/DOB/LinkedIn — cleanup + PII minimization, low priority, coordinate timing with backend; do **not** drop `PORTFOLIO_URL`, it's still live).
>
> Shipped items are removed to keep this lean; the backend's record now lives in its [`KNOWN_ISSUES.md`](../../Backchannel-backend/BackChannel-backend/docs/KNOWN_ISSUES.md) "Recently fixed" list (their `BACKEND_CHANGES_SHIPPED.md` was retired in the 2026-07 docs overhaul).

## §V — Pre-production security audit: backend-owned findings 🔴 High priority (new section — separate from §S/§B/§L/§F, tracked here for Nico)

**Status (2026-09-18):** a read-only security sweep across both repos, done ahead of App Store submission. Three parallel reviews (mobile frontend, Django backend, repo/CI hygiene) traced every ID-taking endpoint, the raw-SQL query layer, auth/session handling, file storage, and dependency freshness. **Overall backend grade: B.** The important context up front, so this doesn't read as "the backend is insecure" — it isn't:

> The reviewer specifically could **not** find an authorization (IDOR) hole anywhere traced — messaging checks participation on send/history/unmatch and the WebSocket consumer re-checks on connect, referrals/check-ins verify sponsor-or-applicant, every sponsor job mutation is scoped `WHERE JOB_ID = %s AND SPONSOR_ID = %s` plus a service-layer check, and profile updates are self-only. The raw SQL in `queries/` is parameterized throughout — every dynamic fragment is a placeholder, an `int()`-cast limit, or a hardcoded column whitelist. Passwords are bcrypt-hashed with a per-password salt; action tokens (reset/verify) are opaque, single-use, and hashed at rest. This is the stuff that actually gets apps breached, and it's done right.

**What's actually wrong is over-sharing data you already hold, not broken access control.** Findings below, grouped by severity, each with file:line from the current backend checkout.

### High

1. **Sponsor feed returns applicants' phone number, DOB, and full parsed résumé before any match.** `bc_microservices/queries/profiles.py:225-231` selects `PHONE_NUMBER`, `DATE_OF_BIRTH`, and `RESUME_DATA::TEXT` into `GET /api/profiles/pack/` (`services/profiles.py:316-357`, `views_profiles.py:186-191`). Authorization on that endpoint is only "you own this job" — and anyone can self-register as a Sponsor via `/api/register-sponsor/` with no work-email verification required to post a job. That combination lets anyone page the entire applicant pool and harvest phone + DOB + résumé contents at will. **Ask:** drop those three columns from `fetch_profile_pack`; surface contact info only after a mutual match (the app already has a match state to gate on).

2. **Uploaded images are `ACL="public-read"` with no expiry — including résumé photos.** `bc_microservices/services/storage.py:45-51` writes images public-read and returns a permanent CDN URL; documents are correctly `ACL="private"` (`:72-78`). `services/documents.py:316-325` explicitly routes "a photo of a resume" down the *image* path, so it inherits the public-read behavior. A `get_presigned_url` helper already exists (`storage.py:134`) but nothing calls it. **Ask:** make image objects private and serve all user uploads (photos included) through short-lived presigned URLs, matching what documents already do. *Can't verify from the repo:* whether the DO Spaces bucket policy also allows listing — worth a manual check in the DO console.

3. **Django and three libraries are past their security-support window.** `requirements.txt:7` pins Django `5.1.7` (5.1.x's extended support window has closed; 5.2 is current LTS). Also stale: `requests==2.32.3` (2.32.4 fixed a netrc credential-leak CVE), `urllib3==2.3.0` (2.5.0 fixed redirect-handling issues), `djangorestframework-simplejwt==5.2.2` (predates the fix for tokens-remain-valid-for-deactivated-users, CVE-2024-22513). **Ask:** bump requests/urllib3/simplejwt now — all drop-in, no code changes expected — and schedule the Django 5.2 LTS upgrade before launch. No venv is set up in the local checkout to run `pip-audit` directly; worth adding as a CI step (see the CI/process items below) rather than a one-off local run.

### Medium

4. **Admin-login throttle keys on a spoofable header and fails open.** `bc_microservices/views_admin.py:24-37` reads the first `X-Forwarded-For` entry for its 10-attempt brute-force window; an attacker can set a fresh header per request and never trip it, and a cache error disables the throttle entirely rather than blocking. The regular API throttles already do this correctly via the trusted edge-IP header (`throttles.py:52-67`). **Ask:** reuse `_RealIPMixin`'s header order in the admin view; fail closed on cache errors.

5. **Registration reveals whether an email is already registered.** `services/auth.py:127-130` returns `"Email already in use"` on conflict, while login (`:280`), forgot-password (`:300`), and resend (`:506`) are all correctly generic. Registration is throttled 10/hour/IP, which limits but doesn't eliminate email enumeration. **Ask:** return a generic "check your email" response and resolve the actual conflict server-side / over email.

6. **Django's password validators are configured but never invoked.** `settings.py:199-212` lists `CommonPasswordValidator` etc., but the custom auth path (`services/auth.py:125-126`, `constants.py:27`) only checks length ≥ 8 — `"password1"` passes today. **Ask:** call `django.contrib.auth.password_validation.validate_password` in registration, reset, and change-password.

7. **Password change doesn't invalidate other sessions; JWTs are signed with `SECRET_KEY`.** `services/auth.py:369-377` only blacklists the *presented* refresh token and clears one cache key — access tokens live 1 day (`settings.py:123`) and every other device's refresh token stays valid after a password reset, so a stolen session survives the victim "fixing" it. Separately, `SIGNING_KEY = SECRET_KEY` (`settings.py:128`) means a leaked Django secret key is full account takeover across every user, not just a Django-internal risk. **Ask:** add a `token_version` (or `password_changed_at`) claim checked in `custom_jwt.py:25` so a password change kills all outstanding tokens; move to a dedicated `JWT_SIGNING_KEY` distinct from `SECRET_KEY`.

8. **Unauthenticated, unthrottled email sender.** `views_landing.py:132-163` (`join_waitlist`) emails any submitted address with no rate limit — a script can mail-bomb third parties from your sending domain and burn deliverability/sender reputation. **Ask:** add the existing `_AnonIPThrottle` base class, same pattern already used elsewhere.

9. **Sponsor's personal login email is returned to every matched applicant.** `queries/matches.py:139` selects `u.EMAIL AS sponsor_email` into `GET /api/matches/`. Nothing in the product surfaces or needs this. **Ask:** drop the column from the query.

10. **`seed_demo_data` has no environment guard and a hardcoded password.** `management/commands/seed_demo_data.py:26` (`DEMO_PASSWORD = "DemoPass123!"`) and `handle()` (`:1107`) runs against whatever database it's pointed at, with no `--execute`/prod check — contrast `seed_personas.py` (dry-run by default, random per-account passwords via `secrets.token_urlsafe`) and `purge_users.py` (properly gated). If this was ever pointed at prod, that's ~20 accounts with a publicly-known password sitting in the production database today. **Ask:** add a guard refusing to run when the environment is prod; as a one-time check, query prod for any `@demo.backchannel.app` accounts and remove them if found.

11. **Unthrottled notification fan-out.** `views_jobs.py:446-449` (`request_sponsor`) has no throttle class and background-notifies every sponsor at a company (`services/jobs.py:1140-1180`); it's idempotent per (user, job) but not rate-limited across jobs, so iterating job IDs can spam a company's sponsors. **Ask:** add a `_UserThrottle` scope, same pattern as the other write endpoints.

12. **Chat access token accepted via WebSocket URL query string — needs a coordinated frontend change.** The consumer authenticates from `?token=`, and the app currently connects with `${WS_BASE_URL}/ws/chat/${id}/?token=${accessToken}` (frontend: `components/MessagesView.tsx:549, 728`). Full JWTs in URLs land in load-balancer/proxy access logs in ways headers don't, and a logged token is a session-takeover risk. **Ask:** support accepting the token via the `Sec-WebSocket-Protocol` header (or issue a short-lived, single-use socket ticket via a small new endpoint) so the frontend can stop putting it in the URL — this needs to ship on your side first since the frontend can't switch until the backend accepts the new mechanism.

### Low / Info

- **OpenAPI spec + Scalar docs are public** (`django_bc/urls.py:78-86, 122-123`) — not a vulnerability, but it hands anyone your full endpoint map. Consider gating behind admin auth in prod.
- **`ALLOWED_HOSTS` defaults to `localhost,127.0.0.1`** (`settings.py:46-49`) — fails safe, but confirm it's actually set in the DO app config, or every prod request 400s.
- **Emails logged at INFO** (`services/email.py:36, 74, 91, 151, 168`) — addresses land in container logs. No tokens, passwords, or message bodies were found logged anywhere.
- **Sentry `traces_sample_rate=1.0`** (`settings.py:550`) — a cost concern, not security; `send_default_pii=False` is already set correctly.
- **Legacy JWT dual-read still enabled** — `ACTION_TOKEN_DUAL_READ` defaults true (`settings.py:63-64`); the migration window this supported is long past. Flip to false and delete `_verify_email_legacy`/`_reset_password_legacy` (`services/auth.py:335, 485`).
- **Logo.dev token embedded in returned/stored URLs** (`services/logos.py:86`) — almost certainly a publishable key already (§ elsewhere in this doc discusses the same key), but worth a one-line confirmation.

### Repo / CI / process (same audit, backend-repo-owned)

- **`.github/workflows/integration.yml:15-61`** runs on `pull_request` into `main` and passes `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `TEST_BYPASS_SECRET` into a 732-line shell script checked out from the PR branch head. Fork PRs don't receive secrets (GitHub's default), so this isn't a classic pwn-request, but any same-repo branch PR — including from a compromised contributor account — executes arbitrary shell with the dev admin password in its environment. **Ask:** gate the job behind a GitHub Environment with required reviewers (or switch to `workflow_dispatch`); confirm `ADMIN_PASSWORD` is scoped to the dev deployment only (it appears to be) and rotate it periodically regardless.
- **No dependency or secret scanning configured** — no Dependabot, no CodeQL, no `pip-audit` step anywhere in CI. This is the same gap that let an old frontend API key sit unrotated in git history (see the frontend repo's own audit trail) — worth closing on both repos, not just this one. **Ask:** enable Dependabot for the `pip` and `github-actions` ecosystems on this repo; add a `pip-audit -r requirements.txt` step to `unit.yml`.
- **Dev Redis published on `0.0.0.0` with no password** — `docker-compose.yml:3-10` maps `"6379:6379"` with no `requirepass`; Docker publishes to all interfaces by default, so on a shared network anyone can reach the dev cache. Local-dev only, no prod exposure. **Ask:** bind `127.0.0.1:6379:6379` or drop the port mapping entirely (the `web` service already reaches it over the compose network).

**Ask, in leverage order:** (1) strip phone/DOB/résumé from the sponsor feed query — smallest change, largest exposure closed; (2) make image uploads private + presigned; (3) bump requests/urllib3/simplejwt now, plan the Django 5.2 move; (4) the medium hardening items (5–11) as time allows, roughly in the order listed; (5) the WebSocket token mechanism (#12) whenever it's convenient to coordinate — the frontend is already aware and waiting on this side.

**Frontend status:** the frontend-owned findings from the same audit (WebView URL whitelisting, unchecked `Linking.openURL` on other users' URLs, iOS privacy manifest, a few logging/config items) were fixed directly in the frontend repo and aren't tracked here. The only two items above that need frontend coordination are #12 (WebSocket token) and, longer-term, moving password-reset/email-verification links from the `backchannelv2://` custom scheme to real Universal Links — not urgent, noted for whenever backend has bandwidth to emit `https://` links instead.

---

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
