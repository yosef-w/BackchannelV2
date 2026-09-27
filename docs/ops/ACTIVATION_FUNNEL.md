# Activation Funnel and Growth Measurement

**Written:** 2026-09-26. Pre-launch closed beta (see memory: launch phase). Every event name below is quoted **exactly** as passed to `safeTrack(...)` in `lib/analytics/mixpanel.ts` (Title Case, with spaces; the exported `trackXxx` function names are not the event names). Property names are the snake_case keys in the same file. Backend tables named below are from `docs/schemas/migrations/postgres`.

---

## 0. Ground rules for reading the data

1. **Every event gets `user_type`** (`applicant` / `sponsor` / `unknown`) from `safeTrack`. It is `unknown` until `identifyUser` runs (after login/signup), so **pre-signup events cannot be split by `user_type`**; use their own role property: `selected_role` on `Sign Up *` events, `film_role` on `Intro Film *`, `onboarding_role` on `Onboarding *`.
2. **Exclude testers:** `Tester Mode Enabled` registers super-property `is_tester: true` and a People property. Every report gets the global filter `is_tester != true` (and exclude internal team ids). Testers currently share the project with real users.
3. **Mixpanel "first" is free.** A funnel counts each user's first path through the steps inside the conversion window, so you do **not** need `first_like`, `first_match` events; "first" is a property of the report, not the event. New named `First ...` events are only worth adding for **server-side lifecycle triggers** (see LIFECYCLE_MESSAGING.md).
4. **Identity merge:** confirm the project uses Simplified ID Merge so anonymous pre-signup events attach to the user after `mixpanel.identify(userId)` (`identifyUser`); otherwise the top of the funnel disconnects from the rest.
5. IP geolocation is off (`setUseIpAddressForGeolocation(false)`), so **no geography breakdown** from IP; use the People property `location` (city, freeform, set in `identifyUser`).
6. Privacy Policy: analytics events must not contain message contents, résumé contents, or search terms. Every proposed property below is an id, boolean, count, or enum.
7. **Two constraints shape the funnel for real users:** (a) swiping is blocked until the profile is complete (`HomeView.tsx` ~1221, modal), and sponsors are blocked until the work email is verified (`HomeView.tsx:1225`, `!workEmailVerified && !isTester`); (b) the free like cap is **2 per day** (`DAILY_LIKE_LIMITS.free` in `constants/config.ts`; premium 5; deck size `DECK_SIZE = 10`).

---

## 1. Stage mapping: applicant

| Stage | Nearest real event(s) | Where it fires | Notes / gap |
|---|---|---|---|
| **signup_started** | `Sign Up Role Selected` (`selected_role`) is the earliest true signal. Alternates on the same path: `Sign Up Form Submitted` (`selected_role`, `auth_method`); `SSO Started` (`auth_method`) for Apple/Google. Pre-signup context: `Intro Film Viewed` (`film_role`), `Intro Film Dismissed` (`film_role`, `action`, `watch_seconds`, `completed_first_play`). | AuthScreen / role selection; SSO flows | Use `Sign Up Role Selected` = step 1 (deduped by user). Not every SSO user passes through the role event; use a merged step "Sign Up Role Selected OR SSO Started OR Sign Up Form Submitted" (Mixpanel: OR step / custom event). |
| **signup_completed** | `Sign Up Succeeded` (`selected_role`, `auth_method`) | `components/ApplicantQuestionnaire.tsx:635` (email) and `:725` (SSO); sponsors `components/SponsorQuestionnaire.tsx:302` | It fires at the **end of the questionnaire**, together with `Onboarding Completed` (`onboarding_role`; `ApplicantQuestionnaire.tsx:426`, `SponsorQuestionnaire.tsx:303`), so this is "account + onboarding finished." Drop-off *inside* the questionnaire is measured by `Onboarding Step Viewed` (`onboarding_role`, `step_index`, `step_name`). Failures: `Sign Up Failed` (`reason`, `auth_method`, `selected_role`), `SSO Failed`, `SSO Cancelled`. |
| **profile_complete** | **No event. Instrumentation gap.** Proxies today: `Resume Uploaded` (`upload_source`), `Profile Photo Uploaded` (`upload_source`), `Profile Field Updated` (`profile_field`), `Tester Mode Enabled` (bypasses the gate, so it *hides* incompleteness). | The rule is `checkProfileCompleteness` (`utils/profileCompletion.ts`), evaluated in `components/HomeView.tsx:479` and `components/ProfileView.tsx:331` | See gap G1. This is the most important missing event: completeness **gates the first like**. |
| **first_like** | `Job Liked` (`job_id`, `is_sponsored`, `matched`) | `HomeView.tsx` (~384 held-likes send, ~1360 swipe), `components/ApplicantJobsBrowseView.tsx:739` (browse/search) | Deck vs browse is not distinguished; add `source` (gap G8) if you care. |
| **first_match** | `Match Created` (`match_origin`: `applicant_swipe`, `job_id`), and `Job Liked` with `matched: true` | `HomeView.tsx:1384` | **Undercounts badly:** `Match Created` fires only on the device of the person whose swipe **completes** the match. The typical applicant match is asynchronous (applicant likes today, sponsor likes back later), so the applicant's device sees no event; they find out via push (`type: match`) or the Matches tab. Related weak signals: `Push Notification Tapped` (`push_type`), `Notification Tapped` (`notification_type`), `Applicant Liked Back` / `Sponsor Liked Back`, `Match Message Tapped`. **Gap G2** + server truth `matching.matches`. |
| **first_message** | `Message Sent` (`conversation_id`, `message_length`) | `components/MessagesView.tsx:1012` (also calls `onFirstMessageSent`, which asks for push permission) | Good. Companion: `Conversation Opened`. Applicants often wait for the sponsor to speak first; measure "opened but never sent" (`Conversation Opened` without `Message Sent`). |
| **first_referral** | `Referral Submitted` (`conversation_id`, `job_id`, `applicant_user_id`) is a **sponsor** action (`components/messages/ReferralSigningScreen.tsx:516`). Applicant side: **no "referral received" event.** Nearest: `Notification Tapped` / `Push Notification Tapped` with type `referral`; later-stage `Applicant Check In Submitted` (`referral_id`, `stage`, `has_note`), `Check In Modal Opened`. | | For an applicant, "activated" means a sponsor referred them: **gap G3**. Until then use server-side `matching.referrals.applicant_user_id`. |

**Applicant activation definition (proposed):** *"Within 7 days of `Sign Up Succeeded`, user has 1 `Job Liked` and 1 match."* Referral is the **outcome**, not activation (it depends on a sponsor).

## 2. Stage mapping: sponsor

Sponsors have two extra gates before the marketplace exists for them: **verify email/work email** and **have a sponsored job** (otherwise the deck is the "Build your deck" empty state, `HomeView.tsx` ~2275+).

| Stage | Nearest real event(s) | Where | Notes / gap |
|---|---|---|---|
| **signup_started** | `Sign Up Role Selected` (`selected_role: sponsor`), `SSO Started` | as above | `Intro Film Viewed` with `film_role: sponsor` for the cinema cohort. |
| **signup_completed** | `Sign Up Succeeded` (`selected_role: sponsor`) + `Onboarding Completed` (`onboarding_role: sponsor`) | `SponsorQuestionnaire.tsx:302-303` | |
| **(sponsor-only) verified** | `Verify Email Succeeded` (`already_verified`); `Work Email Verify Checked` (`verified: true`); friction: `Work Email Resend Requested`, `Work Email Updated`; `Verify Email Opened` (`has_token`), `Verify Email Failed` (`reason`) | `app/verify-email.tsx:82`; `components/home/WorkEmailVerificationModal.tsx:294` | `Work Email Verify Checked` only fires when the user **presses** "I've Verified My Email". A user who clicks the emailed link and just returns to the app is verified server-side with no event: **gap G4**. |
| **(sponsor-only) deck non-empty** | `Job Sponsored` (`silver_job_id`, `new_job_id`, `sponsor_relationship`, `can_refer`, `insights_filled_count`); `Job Sponsor Started` (`silver_job_id`); `Job Created From URL` (`job_id`, `extraction_source`, `has_insights`); friction `Job Create From URL Failed` (`reason`, `rate_limited`), `Browse Jobs Viewed` | `components/JobsView.tsx:598/617` | Empty-deck shown state has no event: **gap G5**. |
| **profile_complete** | **No event.** Same rule (sponsor variant: skills required; experience/education not) | `HomeView.tsx:479`, `ProfileView.tsx:331` | **G1.** |
| **first_like** | `Profile Liked` (`applicant_user_id`, `job_id`, `matched`) | `HomeView.tsx:1411` | Seen-only: `Profile Card Viewed`, `Profile Skipped`. |
| **first_match** | `Match Created` (`match_origin: sponsor_swipe`, `job_id`) at `HomeView.tsx:1443`, and `Profile Liked` with `matched: true`. Also `Applicant Liked Back` (`applicant_user_id`, `job_id`) when a sponsor accepts a received like | | Same asynchronous undercount as applicants (applicant-initiated matches surface via the "received likes" list, `Sponsor Liked Back` / `Applicant Liked Back`). **G2.** |
| **first_message** | `Message Sent` | `MessagesView.tsx:1012` | |
| **first_referral** | `Referral Submitted` | `ReferralSigningScreen.tsx:516` | Sponsor outcome. Withdraw: `Referral Withdrawn` (`referral_id`). |

**Sponsor activation definition (proposed):** *"Within 7 days of `Sign Up Succeeded`: verified + at least 1 `Job Sponsored` + 1 `Profile Liked`."* The sponsor's binding constraint is supply of a sponsored job, not swiping.

**Monetization events sit beside the funnel** (not stages): `Marketplace Gate Shown/Dismissed` (`intent`), `Like Limit Gate Shown/Dismissed`, `Like Held`, `Held Likes Sent`, `Paywall Shown` (`trigger`), `Plan Selected`, `Purchase Succeeded/Pending/Failed`, `Free Sponsor Request Used`. The 2/day free cap is a **deliberate throttle on `first_like` volume**: watch `Like Limit Gate Shown` per active day to see if it suppresses activation.

---

## 3. Instrumentation gaps (exact file/handler for a `track` call)

Add these as new `trackXxx` exports in `lib/analytics/mixpanel.ts` following the file's pattern (`safeTrack("Title Case Name", {...})`), ids/booleans/enums only.

| # | Gap | New event and properties | Where to call |
|---|---|---|---|
| **G1** | **Profile complete** (missing; gates swiping) | `Profile Completed` `{ role, missing_count_at_signup, days_since_signup, source: "onboarding"|"profile_edit" }` and `registerSuperProperties({profile_complete: true})` + People `set`, so it is filterable everywhere. Also `Profile Completion Gate Shown` `{ role, missing_count }` (the swipe-blocking modal) to see how many hit the wall. | `components/HomeView.tsx` near `checkProfileCompleteness(profileData, userType)` (line ~479): a `useEffect` on `profileCompletion.isComplete` false to true, guarded by a persisted `@bc/profileCompleteTracked_<userId>` flag so it fires once. The gate: where `setShowProfileCompletionModal(true)` is called (~1221). Also `components/ProfileView.tsx:331` (result computed after an edit) for completion via edits. |
| **G2** | **Match seen** (async matches invisible; undercounts first_match) | `Match Seen` `{ role, job_id, origin: "push"|"matches_tab"|"swipe" }` fired once per `match_id`/conversation id (persist seen ids in AsyncStorage) | `components/MatchesView.tsx` where the matches list is populated (first time a match id is rendered); and `app/(tabs)/_layout.tsx:295` where `trackPushNotificationTapped({ pushType: type })` already runs (when `type === "match"`). **Best: also compute server-side** from `matching.matches (applicant_user_id, sponsor_user_id, matched_at)` and import to Mixpanel (or query in SQL) for the truth. |
| **G3** | **Referral received** (applicant `first_referral`) | `Referral Received` `{ referral_id, job_id }` once per referral id | `components/MatchesView.tsx` referral list load (the `GET /api/referrals/` consumer) and the `type === "referral"` branch at `app/(tabs)/_layout.tsx` ~295. |
| **G4** | **Work email verified via link** | `Work Email Verified` `{ via: "link"|"check_button" }` once | `stores/useUserProfileStore.ts` when `workEmailVerified` flips false to true after a profile fetch (`HomeView` reads it at line 204), plus keep `trackWorkEmailVerifyChecked`. |
| **G5** | **Empty deck shown** (sponsor with nothing to swipe; applicant with no jobs) | `Empty Deck Shown` `{ role, reason: "no_sponsored_jobs"|"no_applicants"|"no_jobs"|"error" }` | `components/HomeView.tsx`: sponsor "Build your deck" branch (~2275+) and applicant no-jobs branch (`userType === "applicant" && !jobsLoading && jobs.length === 0`, ~2275). Fire once per session per reason. |
| **G6** | **Deck completed** (deck-exhaustion rate) | `Deck Completed` `{ role, cards_seen, likes, skips, hit_like_cap: bool }` | `components/HomeView.tsx` where the deck finishes: `setProgress(DECK_SIZE + 1)` (~1582) / when `isDeckFinished` first becomes true; `DeckDoneCard` mount (`components/home/DeckDoneCard`, rendered ~2014). |
| **G7** | **Profile/`created_at` age for cohorting** | Add `signup_date` (ISO date) to the People properties in `identifyUser` (fields available from the login/signup response) so cohorts do not depend on the first event date; **must not** add sensitive props (policy Section 2 lists exactly which People props exist: name, email, company, job title, city, role, email verified). `signup_date` and `role` are not personal data beyond that. | `identifyUser` in `lib/analytics/mixpanel.ts` (update the policy list if you add more). |
| **G8** | `Job Liked` lacks surface | Add `source: "deck"|"browse"|"detail"` to `Job Liked`; `HomeView.tsx` (deck), `ApplicantJobsBrowseView.tsx:739` (browse). | as listed |
| **G9** | Applicant `Job Liked` lacks "is the sponsor verified" | `sponsor_verified: bool` on `Job Liked` for sponsored jobs, **only if** the deck card already carries it (`job.sponsorInfo`); otherwise compute in SQL (liquidity section). | `HomeView.tsx` ~1360 |
| **G10** | Message reply latency and 2-way conversation | Compute server-side from `messaging.messages` (`sender_user_id`, `created_at`); do **not** log message contents. | SQL |
| **G11** | Push delivered vs opened | Pushes are sent by the backend (`services/push.py` via Expo); there is no delivery event in Mixpanel, only `Push Notification Tapped`. Use `user_info.notifications` (one row per push attempted) as the "sent" side. Approximate open rate = `Push Notification Tapped` / notification rows created (a preference-suppressed notification creates no row, so the denominator excludes them). | SQL + Mixpanel |

Do G1, G2, G5, G6 before launch: without them the two most important funnel steps (profile complete, first match) are unmeasurable or biased low.

---

## 4. Mixpanel reports to build

Global filters on **every** report: `is_tester != true`; exclude internal/team `user_id`s; project timezone = the team's. Time window: last 30 days, weekly cohorts.

### 4.1 Funnels

| Name | Steps (event names exact) | Conversion window | Breakdowns / notes |
|---|---|---|---|
| **F1 Applicant activation** | 1 `Sign Up Role Selected` where `selected_role = applicant` (or OR-step with `SSO Started`) > 2 `Sign Up Succeeded` > 3 **`Profile Completed`** (after G1; before it, use `Onboarding Completed` as a proxy) > 4 `Job Liked` > 5 `Match Created` OR `Match Seen` OR (`Job Liked` where `matched = true`) > 6 `Message Sent` | **7 days** overall (steps in order) | Break down by `auth_method` (email/apple/google), by `Intro Film Viewed` (yes/no) as a cohort, by week. Track step 2 to 3 time-to-convert. |
| **F2 Sponsor activation** | 1 `Sign Up Role Selected` where `selected_role = sponsor` > 2 `Sign Up Succeeded` > 3 (`Verify Email Succeeded` OR `Work Email Verify Checked` where `verified = true` OR `Work Email Verified`) > 4 `Job Sponsored` > 5 `Profile Liked` > 6 `Match Created` OR `Match Seen` > 7 `Message Sent` > 8 `Referral Submitted` | **14 days** (sponsors are slower and depend on supply) | By `auth_method`; by `sponsor_relationship` on `Job Sponsored`; by company size if known. |
| **F3 Onboarding drop-off** | `Onboarding Step Viewed` step by step, then `Onboarding Completed` | Same session (1 day) | Break down by `onboarding_role` and `step_name`/`step_index`: which step loses people. |
| **F4 Sign-up friction** | `Sign Up Form Submitted` > `Sign Up Succeeded` (email); `SSO Started` > `Sign Up Succeeded` (SSO) | 1 hour | By `auth_method`; alongside `Sign Up Failed` and `SSO Failed` counts by `reason`, `SSO Cancelled`. |
| **F5 Verify email** | `Sign Up Succeeded` > `Verify Email Opened` > `Verify Email Succeeded` | 3 days | Also `Resend Verification Requested` (`request_source`), `Verify Email Failed` (`reason`). Watch Apple-relay users: their verification mail may not arrive (§W #3). |
| **F6 Match to conversation to referral** | `Match Created`/`Match Seen` > `Conversation Opened` > `Message Sent` > `Referral Submitted` | 14 days | By `match_origin`; by role. The core value chain. |
| **F7 Deck to like** | `Job Card Viewed` (applicant) / `Profile Card Viewed` (sponsor) > `Job Liked` / `Profile Liked` | Same session | By `is_sponsored`; watch the gate: `Like Limit Gate Shown`. |
| **F8 Push permission** | `Push Permission Prompted` > `Push Permission Resolved` where `granted = true` | 1 hour | Push is the retention lever (lifecycle doc); the native prompt is deliberately deferred to a contextual moment: first match (`onMatchCreated`, `app/(tabs)/home.tsx:23`) or first message sent (`app/(tabs)/messages.tsx:27`), so **users who never get a match on their own device or message never get asked** (and async matches, G2, may not trigger it). Track the share of users ever prompted. |
| **F9 Monetization (later)** | `Marketplace Gate Shown` or `Like Limit Gate Shown` > `Paywall Shown` > `Plan Selected` > `Purchase Succeeded` | 1 day | By `trigger`, `intent`. PREMIUM is not live yet; RevenueCat is sandbox. |

### 4.2 Other reports

- **Insights: Core actions per active user per week** (formula: total core-action events / unique active users), broken down by role.
- **Flow: What happens after `Sign Up Succeeded`** (first 5 events): validates the funnel design.
- **Insights: time between steps** (F1 median time from `Sign Up Succeeded` to first `Job Liked`; and to first match).
- **Insights: `API Error` by `endpoint`, `status_or_reason`** as a quality line under the funnel (a conversion drop with an API spike is an outage, not product).
- **Insights: `User Reported` by `report_reason`** for moderation load.

### 4.3 Retention cohort definition

- **Cohort ("born") event:** `Sign Up Succeeded`, grouped by week, split by `selected_role`.
- **Returning event (the "active day"):** a custom event **Core Action** = ANY of: `Job Card Viewed`, `Job Liked`, `Job Skipped`, `Applicant Browse Viewed`, `Applicant Job Search Performed`, `Profile Card Viewed`, `Profile Liked`, `Profile Skipped`, `Match Message Tapped`, `Conversation Opened`, `Message Sent`, `Referral Submitted`, `Applicant Check In Submitted`, `Sponsor Batch Check In Submitted`, `Job Sponsored`, `Sponsor Liked Back`, `Applicant Liked Back`.
- **Excluded from "active":** `App Opened`, `Screen Viewed`, `Login Succeeded`, `Push Notification Tapped` alone, settings/legal taps (`Privacy Policy Tapped`, `Terms Tapped`, `Contact Support Tapped`), `Paywall Shown`, `API Error`, and any background/OS-triggered events. Rationale: a launch caused by a local reminder with no action is not engagement; keep `App Opened` retention as a separate **"reach"** line.
- **Views:** N-day retention (D1, D3, D7, D14, D30), "on day" (not "on or after"), plus weekly retention by cohort week. Also **"Reach retention"** (`App Opened`) for comparison.
- **Stickiness:** distinct active days per user in the last 7 (DAU/WAU, WAU/MAU). Notification hypothesis: the 9:00 daily deck reminder should raise D1/D7 for users who granted push; break retention down by `Push Permission Resolved granted` (property via cohort).
- **Segment definitions:** *Activated* = met the activation definition in sections 1 and 2; *Resurrected* = active after 14+ days silent.

---

## 5. The weekly growth review: 8 dashboard tiles

One Mixpanel board, Monday review, week-over-week deltas, tester-excluded.

| # | Tile | Definition |
|---|---|---|
| 1 | **New signups by role** | `Sign Up Succeeded`, unique users, by `selected_role` and `auth_method` |
| 2 | **Activation rate (7-day) by role** | F1 and F2 completion at the activation step, cohorted by signup week |
| 3 | **Funnel F1/F2 step conversion** | Mini-funnel bars with the largest drop highlighted (typically profile complete or first match) |
| 4 | **Match rate** | Users with a match within 7 days of signup / signups; plus matches per week (server truth from `matching.matches` if G2 is not yet live) |
| 5 | **Core-action WAU and D7 retention** | Weekly unique users with a Core Action; D7 retention per cohort |
| 6 | **Message-to-referral conversion** | F6, and referrals submitted per week (`Referral Submitted`) |
| 7 | **Marketplace liquidity** | Sponsors with a sponsored job and verified email per open applicant; deck-exhaustion rate; time-to-first-match (median) (section 7) |
| 8 | **Health: crash-free sessions, API error rate, reports** | Sentry crash-free % (linked), `API Error` per 1k `App Opened`, `User Reported` count with open reports older than 24h (MODERATION_RUNBOOK) |

Secondary drill-downs: push permission rate (F8), onboarding step drop-off (F3), `Like Limit Gate Shown` per active day.

## 6. Activation targets: hypotheses to test, not promises

We have no baseline. These are **starting hypotheses** for the closed beta to confirm or refute; revisit after 4 weeks of tester-excluded data and n of at least ~100 per role. If a number is far off, first suspect **instrumentation** (G1, G2) before the product.

| Metric | Hypothesis (what we'd be pleasantly surprised to see) | What would make us change something |
|---|---|---|
| Signup started to signup completed | 55-70% (10-step questionnaire is long; SSO higher) | Below 40%: shorten, or move steps after account creation |
| Signup completed to profile complete (7d) | 60-75% applicants, 70-85% sponsors (gate + the résumé parse helps) | Below 40%: the completeness gate (photo + bio mandatory) is too strict |
| Profile complete to first like (7d) | 70-85% | Below 50%: the deck is not compelling, or the empty-deck state |
| First like to first match (7d) | applicants 20-35%; sponsors higher because applicant likes queue up | Below 10% (applicants): a **supply** problem (few verified sponsors), not a UX one; see liquidity |
| Match to first message (7d) | 45-60% | Below 30%: matches feel dead; add lifecycle nudges |
| Match to referral (14d) | 5-15% | Below 3% after adequate n: the referral ask is too heavy for sponsors |
| Sponsor: verified within 3 days | 50-65% | Below 35%: verification friction (Apple relay emails, mail delivery, universal links) |
| D1 / D7 / D30 (core-action) | 35% / 20% / 10% | Compare with the daily-deck reminder effect (push-granted vs not) |

Framing rule: report the number, the n, and the confidence interval; never report a rate with n < 30 as a trend.

## 7. Marketplace liquidity metrics

Two-sided marketplace: activation is capped by the other side. Track these weekly, mostly from SQL on the prod DB (read-only; via Nico), with Mixpanel for the client-side parts.

| Metric | Definition | Source |
|---|---|---|
| **Sponsor:applicant ratio, per company** | For each company C: verified sponsors at C (`user_info.sponsor_profiles.company`, `work_email_verified = TRUE`, `users.is_active`) vs applicants who liked or requested a sponsor at C (`matching.likes` on `jobs.job_postings.company = C`, `matching.sponsor_requests.company`, `jobs.job_waitlist`). Report the distribution and the top 20 companies by applicant demand with **zero** verified sponsors. | SQL |
| **% of applicant likes that reach a verified sponsor** | `likes` with `like_type='JOB'` where the liked job is a sponsored posting (`jobs.job_postings`) whose sponsor is `work_email_verified = TRUE` and `is_active`, divided by all applicant `JOB` likes in the window; the remainder went to unsponsored ATS listings (they become `Job Waitlist Joined` / `Sponsor Requested`, effectively supply-less). Also the share of likes on jobs whose sponsor is **unverified**: sponsors cannot swipe until verified, so those likes sit unanswered. | SQL; Mixpanel `Job Liked` `is_sponsored` as the client proxy |
| **Time-to-first-match** | Median/p75 of `MIN(matches.matched_at) - users.created_at` per user, by role; also `first like` to `first match`. Use `matching.matches` (`matched_at`, `applicant_user_id`, `sponsor_user_id`); it excludes unmatched via `status`. | SQL (truth); Mixpanel `Match Created` (biased low, G2) |
| **Deck-exhaustion rate** | Share of active days on which a user sees all `DECK_SIZE = 10` cards. Client proxy available today: distinct `Job Card Viewed` (applicant) or `Profile Card Viewed` (sponsor) `>= 10` per user per day / users with any card view that day. Exact after G6 (`Deck Completed`). High exhaustion + low like rate = supply too thin or the deck is too easy to skip; low exhaustion = users bounce mid-deck. | Mixpanel; G6 |
| **Empty-deck rate** | Sessions with `Empty Deck Shown` (G5) / sessions with a deck attempt, by reason. Sponsors with no sponsored job are the largest expected case. | G5 |
| **Response rate and latency** | Share of new conversations where the counterpart replies within 48h; median first-reply time. | SQL on `messaging.messages` (never export content) |
| **Sponsor supply health** | Verified sponsors with at least one active sponsored job; average applicant likes waiting per sponsored job (`matching.likes` ACTIVE, `like_type='JOB'`) and the oldest unanswered like age. A backlog of un-actioned applicant likes is the failure mode for applicant retention. | SQL |
| **Referral velocity** | `matching.referrals` created per week; time from match to `Referral Submitted`; `referral_checkins.stage` progression. | SQL / Mixpanel |

Example SQL to start with (read-only; adjust names to the live schema):
```sql
-- % applicant job-likes that landed on a verified, active sponsor's posting (last 7 days)
SELECT
  count(*) FILTER (WHERE sp.work_email_verified AND u.is_active)::float / NULLIF(count(*),0) AS pct_to_verified_sponsor,
  count(*) AS applicant_job_likes
FROM matching.likes l
JOIN jobs.job_postings j ON j.job_id = l.job_id
JOIN user_info.users u ON u.user_id = j.sponsor_id
LEFT JOIN user_info.sponsor_profiles sp ON sp.user_id = j.sponsor_id
WHERE l.like_type = 'JOB' AND l.created_at >= now() - interval '7 days';

-- time to first match, per applicant (hours), median
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM fm.first_match - u.created_at)/3600) AS median_hours
FROM user_info.users u
JOIN (SELECT applicant_user_id, min(matched_at) AS first_match FROM matching.matches GROUP BY 1) fm
  ON fm.applicant_user_id = u.user_id;
```

---

## 8. Weekly growth review agenda (45 minutes, Monday, both founders)

1. **(5 min) Data trust check.** Did any tracking break (event volume by name vs last week; `Sign Up Succeeded` vs new rows in `user_info.users`)? Any spike in `API Error`? Do not interpret numbers before this passes.
2. **(10 min) Tiles 1-3:** signups, activation rate, funnel. Name the single biggest drop; write one hypothesis for why.
3. **(10 min) Tiles 4-7:** matches, retention, message-to-referral, **liquidity** (is the constraint supply of verified sponsors or demand?).
4. **(5 min) Tile 8: health and trust.** Crash-free, API errors, reports open >24h (moderation SLA), support inbox.
5. **(10 min) Qualitative:** 3 support messages or tester quotes; watch 2 session replays or walk the funnel on a device as a new user (F1 on a fresh install: the lived experience beats any chart).
6. **(5 min) Decide.** Pick at most **two** experiments for the week (owner, metric, success threshold, date). Review last week's experiments: keep, kill, iterate. Log decisions in a running doc.

Standing rules: no metric discussed without its n; segment by role always; compare cohorts by signup week, not calendar week; sub-30-user segments are anecdotes.

---

## 9. Order of work

1. G1, G2, G5, G6 (frontend, small, ship as an OTA: pure JS).
2. Build F1, F2, F3 and the retention report; Core Action custom event.
3. SQL liquidity queries into a saved sheet (needs read access from Nico, or an admin-portal export).
4. G3, G4, G7-G9 when convenient.
5. Weekly review starts the first Monday after launch; until then, review daily.
