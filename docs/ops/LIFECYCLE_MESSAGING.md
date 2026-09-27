# Lifecycle Messaging: Push and Email Sequences

**Written:** 2026-09-26. Grounded in `lib/localNotifications.ts`, `lib/checkInNudges.ts`, `components/shell/usePushSetup.ts`, `components/profile/NotificationsScreen.tsx`, backend `services/notifications.py`, `services/push.py`, `services/email.py`, the live Privacy Policy, and `docs/BACKEND_CHANGES_NEEDED.md` §W.
Event names referenced (Title Case) are from `lib/analytics/mixpanel.ts`; gaps G1..G11 are defined in `ACTIVATION_FUNNEL.md`.

---

## 0. What exists today (do not duplicate it)

| Existing message | Kind | Trigger | Toggle | Source |
|---|---|---|---|---|
| **Daily deck ready** ("Your fresh deck is ready" / "Your applicant deck is ready") | Local, repeating **DAILY** at 9:00 local | Scheduled when push permission is confirmed granted; idempotent | "Daily Deck Reminders" (AsyncStorage `@bc/deckRemindersEnabled`, default on) | `lib/localNotifications.ts` |
| **Unfinished deck** ("Pick up where you left off", "N roles left in today's deck") | Local, one-shot, +6h after the app backgrounds with cards remaining | on background; cancelled when the deck finishes/refreshes | same toggle | `lib/localNotifications.ts`, `usePushSetup.ts:161` |
| **Referral check-in nudge** | Local, one pending per role; cadence **day 3, 7, 14, 21, 28, 35** after each referral, sent-records prevent repeats, goes quiet after the last checkpoint | referral data changes | "Check-in nudges" (`@bc/checkInNudgesEnabled`, default on) | `lib/checkInNudges.ts` |
| **Server pushes**, event-driven, each gated by `notification_preferences[type] === false` | Push (Expo) + `user_info.notifications` row | `match` (both sides), `message`, `referral`, `waitlist`, `job_like` (sponsor: "New Applicant Interest", one **per applicant like**), `profile_like` ("Someone's interested in you"), `sponsor_request` | Six toggles in `NotificationsScreen.tsx` (`match, message, referral, waitlist, job_like, sponsor_request`; note `profile_like` has no toggle of its own in the `NotifKey` union) | `services/notifications.py::create_notification` |
| **Emails** (Resend, transactional) | Email | Welcome (`welcome.html`, sent at registration), verify email, verify work email, password reset, change email, waitlist confirmation, moderation alert (operator) | none needed (transactional) | `services/email.py`, `services/auth.py:192,262` |

**Consequences that shape everything below:**

1. **A welcome email already exists.** Do not send a second "welcome." Day-0 work is improving the first-session experience, not adding a message.
2. **Pre-match users cannot be reached by push at all.** The iOS permission prompt is deliberately deferred until a contextual moment: `onMatchCreated` (`app/(tabs)/home.tsx:23`) or first message sent (`app/(tabs)/messages.tsx:27`). Until the user grants permission, **no local notification is scheduled and no remote push is delivered**, and the daily deck reminder is only scheduled after grant (`usePushSetup.ts:119`). So every "pre-first-match" sequence (profile nudge, no-first-like, sponsor empty deck) can reach a user **only by email** unless we move/add the permission ask. This is the single most important lifecycle fact. Recommendation in section 1.
3. **The 9:00 daily reminder repeats forever** (a `DAILY` trigger cannot cancel itself). A user who stops opening the app keeps getting it every morning until they log out or turn it off. That is the opposite of "non-spammy" and collides with the lapsed sequence. Fix in section 4.
4. **Sponsor `job_like` pushes fire per applicant like.** With volume this becomes a storm on the sponsor; a digest (section 9) is the healthy version.
5. **The backend has no scheduler** except DigitalOcean scheduled jobs running standalone scripts (`scripts/ats_etl.py` every 12h, `ats_staleness_purge.py` daily). Any server-driven sequence needs a **new scheduled script** (e.g. `scripts/lifecycle_messages.py`, hourly) that queries candidates and calls `notif_svc.create_notification` / `email_svc`; Celery is not present (`ARCHITECTURE.md`).
6. **`users.last_login` is not "last active."** It is a login timestamp; users stay signed in on refresh tokens (7 days, rotating). There is **no `last_active_at`**, and **no user timezone** on the server. Lapsed and quiet-hours logic needs those (section 9).
7. **Policy coverage:** the Privacy Policy (Section 4, Resend) discloses only *transactional* email ("email verification, password reset, and work-email verification messages"), and Section 5 covers *notifications* for matches/messages/referrals and "a reminder that a fresh set of profiles or roles is ready ... each of which you can turn off." **Non-transactional lifecycle email is not disclosed.** Update Sections 4 and 5 before sending any (counsel to confirm CAN-SPAM/CASL/GDPR consent for the audience).
8. **Apple 4.5.4:** pushes must not be required for app function and must not be used for promotion/marketing without explicit opt-in. Lifecycle pushes here are product reminders, not ads, and follow the precedent of the existing user-toggleable reminders, but new server pushes **must ship with their own toggle** (see 9, item 3) so we are consistent with what we told Apple and users.

---

## 1. Principles and global caps

**Voice:** short, warm, specific, one action, no guilt, no emoji clutter (0 or 1), no ALL CAPS, never "you're missing out." Use the user's first name in email only where known; push copy stays name-free (lock screens are public).
**Push limits:** title <= 40 chars, body <= 110 chars (iOS truncates ~110-178). One deep link per message.
**Privacy:** push/email copy must never reveal another person's name, photo, or message text on the lock screen ("Someone's interested in you" style, matching existing copy). No counts of a person's private activity beyond what the app shows.

**Frequency caps (enforced in the sender, not per campaign):**

| Cap | Value |
|---|---|
| Lifecycle **push** per user | max **1 per 24 h**, max **3 per rolling 7 days**, across all sequences below (event-driven `match`, `message`, `referral` etc. are **outside** this cap because they are transactional and individually toggleable) |
| Lifecycle **email** per user | max **1 per 72 h**, max **2 per rolling 7 days** (welcome/verify/reset are transactional and excluded) |
| Combined | Never push **and** email the same trigger within 24 h; email is the fallback only when push is impossible (no permission/token) or after a push has gone unopened for 48 h |
| Quiet hours | Local: schedule only between **09:00 and 20:00 user-local**. Server: needs a timezone (see 9); until then, send server pushes only **16:00-23:00 UTC** (roughly 9:00-20:00 across US time zones) |
| Per-sequence | Each step sends **at most once per user, ever**, unless stated |
| Sunset | After the 30-day lapsed message, **send nothing further** until the user returns. No monthly "we still miss you." |

**Universal suppression rules** (any one suppresses):
- The user acted on the goal since the trigger (each sequence lists its exit event); check right before send, not only at enqueue.
- User opened the app within the last **2 hours** (they are already here).
- Account not `is_active` (moderation deactivation, self-deactivation) or pending deletion; any user with an OPEN report filed against them (MODERATION_RUNBOOK).
- Notification type toggled off (`notification_preferences[type] === false`), the OS permission denied, no device token, or `is_tester = true` (unless deliberately testing).
- Email: hard-bounced, unsubscribed, complained; Apple relay address that has bounced.
- Preview/dev environments: never send lifecycle messages from `BACKCHANNEL_ENV != prod`.
- **Moderation:** never send lifecycle messages to a user whose account is under review.

**Where each runs (legend):** **[L]** local notification, frontend-only, OTA-deployable, needs push permission granted; **[S-push]** server push via `create_notification`, needs backend job, a new notification type + toggle; **[S-email]** server email via Resend, needs backend job, unsubscribe, policy update, MX/`reply_to` (§W #5) and, for SSO users on Hide-My-Email, Apple private-relay domain registration (§W #3); **[in-app]** banner/card in the app, no permission needed, OTA-deployable.

**Recommended structural change to unlock the pre-match sequences:** add a *value-first* push-permission ask at **profile completion** (`Profile Completed`, G1) with a pre-permission screen ("Get a heads-up when someone matches with you or answers your message. Notification settings live in Profile."), instead of waiting for the first match. `requestPushPermission()` in `usePushSetup` already exists; call it from the same effect as G1. Expect a meaningful lift in reachable users; measure with F8. Do not cold-ask at launch.

---

## 2. Day-0 welcome

| | |
|---|---|
| **Status** | **Already exists (email).** `welcome.html` is sent at registration by `send_welcome_email` (`services/auth.py:192,262`). Do not add another email or push. |
| **Trigger** | Registration (already fires) |
| **Channel** | Email (existing) + **[in-app]** first-run home intro (`Home Intro Shown` already exists) |
| **Copy (to review, existing template)** | Confirm `welcome.html` says one concrete next step by role, not a tour. Suggested body: *Applicant:* "Welcome to BackChannel, {first_name}. Finish your profile (photo, bio, résumé) so referrers can see you at your best. Then swipe your first deck: 10 roles a day, and a like can turn into a real introduction." *Sponsor:* "Welcome, {first_name}. Two things and you're live: verify your work email, then sponsor a role you'd refer for. Applicants matched to your roles show up right after." |
| **Note** | The existing template's "reply to this email" line bounces (no MX, `noreply@`); §W #5 must land first. |
| **Suppression / cap** | Sent once. Counts toward the lifecycle email cap window for the next 72 h so sequence 3 does not stack on it. |

---

## 3. Incomplete-profile nudge (24 h / 72 h)

Goal: `Profile Completed` (G1). Completeness gates the first like, so this is the highest-value message.

| | 24 h | 72 h |
|---|---|---|
| **Trigger** | `Sign Up Succeeded` + 24 h and profile still incomplete | `Sign Up Succeeded` + 72 h and still incomplete |
| **Exit event** | `Profile Completed` (or account deactivated) | same |
| **Channel** | **[S-email]** primary (pre-permission users are unreachable by push). **[L]** secondary for the (small) subset who already granted push, scheduled at signup and **cancelled** by the G1 handler | **[S-email]** |
| **Push copy** [L] | Title: "Almost there" / Body: "A photo and a short bio are all that's left before you can start swiping." | (none; email only) |
| **Email subject** | "One step from your first deck" | "Your BackChannel profile is waiting" |
| **Email body (applicant)** | "Hi {first_name}, you're close. Referrers decide fast, so a complete profile is what gets you noticed. Still missing: {missing_fields, max 3}. It takes about 3 minutes. [Finish my profile]" | "Hi {first_name}, your profile is still {percentage}% complete, so the deck is locked. Add {missing_fields, max 3} and you can start. If BackChannel isn't for you, no worries; reply to let us know why." |
| **Email body (sponsor)** | "Hi {first_name}, add your skills and a short bio and you can start reviewing applicants who match your roles. [Finish my profile]" | "Sponsors with a complete profile get taken seriously by applicants. [Finish my profile]" |
| **Deep link** | `https://backchannelapp.netlify.app/...` universal link into Profile > Edit (requires §AB #2 and an app build with `associatedDomains`; until then the link opens the site's app-open page `open.html`) | same |
| **Suppression** | Universal rules; skip 72 h if the 24 h email was not delivered/was bounced; skip both if the user opened the profile editor in the last 24 h (`Profile Edit Opened`) | |
| **Data needed** | `user_info.users.created_at`, completeness computed **server-side** (the rule lives only in the client, `utils/profileCompletion.ts`; server needs an equivalent predicate or a client-reported `profile_complete` flag written at G1) | |

---

## 4. Lapsed users: 7 / 14 / 30 days (and fix the forever-daily reminder)

**First, fix the existing behavior.** Replace the repeating DAILY 9:00 trigger with a **rolling window of one-shot notifications for the next 7 mornings**, re-planned on every app open/foreground (`usePushSetup` already runs on auth). A user who stops opening the app then stops being notified after 7 days by construction, at which point the lapsed sequence takes over. This is a change to `lib/localNotifications.ts::scheduleDailyDeckReminder` (identifiers `daily-deck-ready-0..6`; cancel-and-replan on open); the toggle semantics stay the same.

| | 7 days | 14 days | 30 days |
|---|---|---|---|
| **Trigger** | No app open for 7 days | 14 days | 30 days |
| **Exit event** | Any `App Opened` / Core Action | same | same |
| **Channel** | **[L]** (frontend-only: on every open, schedule three one-shots at open+7d, +14d, +30d, cancelled and rescheduled on the next open) | **[L]** | **[L]** + **[S-email]** (only for users who cannot receive push; requires `last_active_at` server-side) |
| **Copy (applicant)** | Title: "Your deck is waiting" / Body: "Fresh roles matched to you are ready. Two minutes is enough." | Title: "New roles since you left" / Body: "See what's new near your target roles." | Title: "Still job hunting?" / Body: "Your profile is still live. Pick up whenever you're ready." |
| **Copy (sponsor)** | Title: "Applicants are waiting" / Body: "New candidates for your roles are in your deck." | Title: "Someone may be waiting on you" / Body: "Check your matches and messages." (only if there is a pending like/match/message; otherwise use the 7d copy) | Title: "Your roles are still open" / Body: "Come back to review applicants whenever you can." |
| **Email (30 d, fallback only)** | Subject: "We'll keep your spot" / Body: "Hi {first_name}, we haven't seen you in a month. Your profile and any matches are just as you left them. If BackChannel isn't for you anymore you can delete your account anytime in Profile > Privacy & Security. [Open BackChannel]" | | |
| **Suppression** | If the user has a pending match or unread message the transactional push already covers it: skip the generic 7 d copy. Never send within 48 h of an event-driven push. Turn off with the existing "Daily Deck Reminders" toggle (these are the same class: deck reminders). | | |
| **Cap** | One lapsed message per step, ever; **nothing after 30 days** (sunset). | | |

A 30-day email is the only lapsed **email** we recommend; a 7/14 d email adds little over push and risks the cap.

---

## 5. No first like (activated the profile but never swiped)

| | |
|---|---|
| **Trigger** | `Profile Completed` (G1) + 24 h with no `Job Liked` / `Profile Liked` |
| **Exit event** | First `Job Liked` / `Profile Liked` |
| **Channel** | **Do not add a separate push.** The daily 9:00 deck reminder already fires every morning for users with push granted. Instead **vary the copy of the existing reminder** for users with zero lifetime likes, for their first 3 mornings: **[L]** change in `scheduleDailyDeckReminder` (read a `@bc/hasLiked` flag written on the first like). For users without push: **[in-app]** a coach mark on the deck ("Swipe right on roles you'd want a referral for") and **[S-email]** once at +48 h (below). |
| **Push copy (replaces the standard daily copy for these mornings)** | Title: "Your first deck is ready" / Body: "Swipe right on roles you'd want a referral for. You get 2 likes a day, so pick the good ones." Sponsors: Title "Applicants are ready" / Body: "Review your first deck and like the ones you'd refer." |
| **Email (single, +48 h, no push permission)** | Subject: "How BackChannel works (30 seconds)" / Body: "Hi {first_name}, each day you get 10 roles. Like the ones you'd want a referral for; when a referrer likes you back, you match and can message. That's it. [Open today's deck]" |
| **Suppression** | Universal; skip if the 24 h profile-complete email/push was sent < 24 h ago (cap); skip if the user hit the like gate (`Like Limit Gate Shown`) since that is a limit, not inactivity; suppress if `Empty Deck Shown` (G5) fired: there is nothing to swipe, and a nudge would be unkind. |
| **Note** | Free daily like cap is **2** (`DAILY_LIKE_LIMITS.free`); the copy above says so honestly. |

---

## 6. Match but no message

| | |
|---|---|
| **Trigger** | A match exists and neither side has sent a message: nudge at **+24 h**, then once more at **+72 h** |
| **Exit event** | `Message Sent` by either side (server: any row in `messaging.messages` for the conversation) or unmatch/report/block |
| **Channel** | **[S-push]** (the device that learned of the match asynchronously does not know; only the server can see `matching.matches` LEFT JOIN `messaging.messages`). A partial **[L]** fallback: when `MatchesView` first renders a match with zero messages, schedule a local +24 h reminder on that device, cancelled by `Message Sent`. |
| **Push copy (applicant, the more common non-initiator)** | Title: "You have a match waiting" / Body: "A good opener is short and specific. Say hello." (+72 h: Title "Say hi before it goes cold" / Body: "Your match is still open.") |
| **Push copy (sponsor)** | Title: "An applicant is waiting to hear from you" / Body: "You matched a few days ago. A quick hello goes a long way." |
| **Email** | Only for users without push, +72 h, single: Subject "Your match is waiting" / Body: "Hi {first_name}, you and someone you matched with haven't said hello yet. Conversations that start within a few days are the ones that turn into referrals. [Open messages]" (never include the counterpart's name). |
| **Type/toggle** | Use the existing `message` toggle? No: the `message` type means a chat message. Introduce a `reminders` notification type (item 3 in section 9) so a user who turns off "reminders" stops these but keeps real messages. |
| **Suppression** | Universal; skip if the counterpart was deactivated/deleted; skip if the conversation is closed (reported/unmatched); do not fire within 24 h of the original `match` push. |
| **Cap** | 2 messages per match max; max 1 such push per 24 h per user across all their matches (batch: "You have 3 matches waiting" rather than three pushes). |

---

## 7. Referral check-in

| | |
|---|---|
| **Status** | **Already exists; do not build.** `lib/checkInNudges.ts`: one pending local nudge per role, cadence day 3/7/14/21/28/35 from each referral, batched by checkpoint, sent-records prevent re-fire, ends at the last checkpoint, opt-out toggle "Check-in nudges", opens the check-in sheet. Server `referral` push fires when a referral is submitted/updated (`services/referrals.py`, `services/checkins.py`). |
| **Possible additions (only if data shows a need)** | (a) **Applicant first referral received**: server `referral` push exists; a celebratory in-app card on first receipt (needs G3). (b) **Email fallback** for the same nudge for users with no push: one email at day 7 only ("Any news on your referral to {company}? A 10-second update helps your referrer help you."). Requires server-side scheduling; low priority. |
| **Do not** | add any other referral-related push; the local cadence is already the frequency cap for this class. |

---

## 8. Sponsor with an empty deck

Goal: `Job Sponsored`. A sponsor without a sponsored job sees the "Build your deck" empty state (`HomeView.tsx` ~2275+) and has nothing to swipe.

| | |
|---|---|
| **Trigger** | Sponsor `Sign Up Succeeded` + 24 h, then +72 h, with zero sponsored/created jobs (`jobs.job_postings` where `sponsor_id = user` is empty) |
| **Exit event** | `Job Sponsored` / `Job Created From URL` |
| **Channel** | **[S-email]** (pre-permission), plus **[L]** scheduled at signup for those with push granted, cancelled at `Job Sponsored` (`JobsView.tsx:617`); **[in-app]** persistent "Add a role" card in the empty deck state (exists as "Build your deck" copy; verify the CTA goes to Browse Jobs). |
| **Push copy [L]** (+24 h) | Title: "Add a role to start" / Body: "Sponsor a job you'd refer for and matched applicants appear in your deck." |
| **Email +24 h** | Subject: "Your deck is empty until you add a role" / Body: "Hi {first_name}, applicants appear once you sponsor a role at {company}. Pick one from the jobs board, or paste a link to a posting. It takes about a minute. [Add a role]" |
| **Email +72 h** | Subject: "Applicants are waiting for a role to match" / Body: "Hi {first_name}, there are applicants interested in roles like {company}'s. Add a role and they can find you. [Add a role]" (only if true: check `matching.sponsor_requests`/`job_waitlist` demand for {company}; otherwise omit the second sentence). |
| **Suppression** | Universal; sponsor not yet verified: send the **verify work email** message instead (same slot; F2 step 3): Subject "Verify your work email to start", body links to the verify flow. Never claim demand you cannot show. |

---

## 9. Sponsor verified but inactive

| | |
|---|---|
| **Trigger** | Sponsor is verified (`sponsor_profiles.work_email_verified = TRUE`) and has >= 1 active sponsored job, **and** there are >= 1 pending applicant likes (`matching.likes` ACTIVE, `like_type='JOB'`, on their jobs) they have not acted on, **and** no Core Action in 72 h. Fire at +72 h of inactivity, then once at +7 d. |
| **Exit event** | `Profile Liked` / `Profile Skipped` / any Core Action |
| **Channel** | **[S-push]** primary, **[S-email]** fallback (no push, +7 d) |
| **Push copy** | Title: "Applicants are waiting on your roles" / Body: "Some people liked your roles. Take a look when you have a minute." (No count and no names on the lock screen.) |
| **Email** | Subject: "Applicants are interested in your roles" / Body: "Hi {first_name}, people have expressed interest in {job_title} at {company}. Each one is waiting for a yes or no; a few minutes usually does it. [Review applicants]" |
| **Suppression** | Universal; skip if the sponsor already received an event-driven `job_like` push in the last 24 h (they know). **Replace** the per-like `job_like` push with a **digest** for sponsors (see below). |
| **Cap** | 2 per sponsor, ever, per "inactive spell" (reset only after they return and act). |

### Backend/product changes to make the server sequences possible (ask for Nico)

1. **Scheduled lifecycle job:** a DO scheduled script (hourly) implementing sections 3, 6, 8, 9 (and 4 email). Reads candidates with indexed queries, applies the global caps from a small table `user_info.lifecycle_sends(user_id, sequence, step, channel, sent_at)` (also the audit/suppression source of truth), then calls `create_notification` / `email_svc`. Idempotent; per-user try/except; a global kill switch env `LIFECYCLE_ENABLED` (default off).
2. **`last_active_at` and timezone:** update `last_active_at` (throttled, e.g. once/hour) from authenticated requests; store `timezone` (IANA) at device registration (`POST /api/devices/register/` body) so send-time windows are correct.
3. **New notification type `reminders` (or `nudge`)** used by all server lifecycle pushes, with its own row in `NotificationsScreen.tsx` ("Reminders and tips", default on) so the toggle promise holds (`prefs.get(type) is False` suppresses; unknown types are **on by default**, so without a UI row users cannot turn them off, which is exactly what we do not want).
4. **Email consent and unsubscribe:** one-click `List-Unsubscribe` header + a footer link to an unauthenticated unsubscribe endpoint (`/api/email/unsubscribe/?token=`), stored in `notification_preferences` (e.g. `lifecycle_email: false`); footer includes the postal address (Bluejay Labs LLC, 5900 Balcones Drive, Ste 100, Austin, TX 78731) per CAN-SPAM; `Reply-To: support@backchannel.app` (§W #5). Update Privacy Policy Sections 4 and 5 first. Track bounces/complaints from Resend webhooks; suppress on hard bounce.
5. **Sponsor `job_like` digest:** collapse per-like pushes into at most 1 per 4 hours ("You have new interest in your roles"), no names; today it is one push per applicant like.
6. **Server-side profile-complete flag** (or port `checkProfileCompleteness` to the backend) so sections 3 and 5 can query it without the client.
7. **Apple Hide-My-Email relay:** register the sending domain (§W #3) or lifecycle email silently never reaches SSO users.

---

## 10. Sequence summary

| Sequence | Trigger | Channel | Runs on | Exists today? | Ships as |
|---|---|---|---|---|---|
| Day-0 welcome | registration | Email + in-app | Backend (existing) + OTA | **Yes (email)** | Fix copy/reply-to only |
| Incomplete profile 24 h / 72 h | signup + 24/72 h, `Profile Completed` absent | Email (+[L] if granted) | Backend job; [L] via OTA; needs G1 | No | Email first |
| No first like | profile complete + 24 h, no like | Vary existing daily reminder; email +48 h; in-app coach mark | OTA + backend | Daily reminder exists | Copy variant, no new push |
| Match but no message | match + 24 h / 72 h | [S-push] (+[L] partial), email fallback | Backend job + new `reminders` type | No (match push exists) | Backend |
| Referral check-in | referral + 3/7/14/21/28/35 d | [L] | Frontend | **Yes** | Nothing |
| Lapsed 7/14/30 d | no open | [L] (+ email at 30 d fallback) | OTA (+ backend for `last_active_at`) | Daily reminder loops forever | Replace DAILY with 7-day rolling + lapsed one-shots |
| Sponsor empty deck | sponsor signup + 24/72 h, no job | Email + [L] + in-app | Backend + OTA | "Build your deck" empty state only | Email first |
| Sponsor verified but inactive | verified + likes waiting + 72 h idle | [S-push], email fallback | Backend | Per-like `job_like` push exists | Backend + digest |

**Frontend-only (OTA-shippable now, no backend):** rolling daily reminder and lapsed one-shots (4); no-first-like copy variant + coach mark (5); the local +24 h profile/sponsor-role nudges for already-permitted users (3, 8); the value-first push-permission ask at `Profile Completed` (1); the local partial fallback for match-no-message (6).
**Needs backend/Resend:** every email above; every server-push sequence (6, 9); `last_active_at`, timezone, unsubscribe, `reminders` type, digest.

---

## 11. Measurement and guardrails

- **Per-sequence report** in Mixpanel: sent (server `lifecycle_sends`), `Push Notification Tapped` (`push_type` = the new type) / `Notification Tapped`, and the goal event within 24 h / 72 h; compare against a **holdout** (5% of eligible users get nothing) so we know the nudge, not the calendar, caused the conversion.
- **Health metrics (must not regress):** OS-level push opt-out rate (`Push Permission Resolved`, and users who flip the "Daily Deck Reminders"/"Reminders" toggles off), unsubscribe rate (< 0.5% per send), email complaint rate (< 0.1%), bounce rate (< 2%), and app deletions (`Account Deleted`). If any worsens after a launch, roll the sequence back first, ask questions after.
- Ship one sequence at a time, at 10% then 100%, with the `LIFECYCLE_ENABLED`/remote flag (`useRemoteFlag`, §AB) as the kill switch.
- **Do not launch lifecycle email until:** MX exists, `Reply-To` is set, unsubscribe works, the policy is updated, Apple relay is registered, and someone has sent a test to a Gmail, an Outlook, and an `@privaterelay.appleid.com` address.
