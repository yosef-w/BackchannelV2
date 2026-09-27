# Moderation Runbook (App Store 1.2: "act on reports within 24 hours")

**Written:** 2026-09-26. **Owner:** Yosef (ops), backend changes owned by Nico.
**Grounded in:** backend `bc_microservices/services/moderation.py`, `queries/moderation.py`, `views_admin.py`, `services/email.py`, `queries/purge.py`, `docs/schemas/migrations/postgres/027_moderation_reports_blocks.sql`, `docs/API_REFERENCE.md` (Moderation + Admin Portal), and the published Privacy Policy section 7. Backend is read-only for us; every "build" item below is an ask to Nico (put them in `docs/BACKEND_CHANGES_NEEDED.md` when ready).

> **Not legal advice.** Anything marked "counsel to confirm" must be checked with a lawyer before you rely on it. The CSAM section in particular is a legal obligation, not a preference.

**Prod API host** (used as `<API host>` below): `https://oyster-app-4pg5w.ondigitalocean.app` (DO app `oyster-app`, per the backend's `docs/DEV_ENVIRONMENT.md` and the fallback in `constants/config.ts`).

---

## 0. Read this first: what is real and what is not

| Thing a runbook usually assumes | Reality today |
|---|---|
| An alert reaches a human | **Only if `MODERATION_ALERT_EMAIL` is set in the prod DigitalOcean env.** Default is `""` (`settings.py:268`); when empty, `send_report_alert` logs a warning and returns. The report is still stored, nobody is told. Open item §W #4. **Verify it is set before launch.** |
| Someone can receive that email | `backchannel.app` has **no MX record** today (§W #4). Even once the env var is set, an alert to `support@backchannel.app` bounces until MX exists. Until then, point `MODERATION_ALERT_EMAIL` at a real inbox (Yosef's Gmail) instead. |
| The alert has the information needed to act | It contains only: report id, reason, reporter user id, reported user id (`templates/email/report_alert.html`). No names, no detail text, no conversation id, no link that works: `queue_url` is built as `{FRONTEND_URL}/admin/api/reports/` and `FRONTEND_URL` is the **marketing site** (`backchannelapp.netlify.app`), not the API host. The link is wrong. Use the API host (the value of `API_BASE_URL` in `constants/config.ts`) + `/admin/api/reports/`. |
| A moderation admin tool | **A minimal one exists, JSON-only.** `GET /admin/api/reports/?status=OPEN` and `POST /admin/api/reports/<id>/resolve/` (body `{"deactivate_user": bool, "resolution_note": str}`), behind an admin cookie session (`/admin/login/`, user must have `users.is_admin = TRUE`). There is **no HTML reports page** (templates are only dashboard, login, personas, users). There is an HTML **Users** page (`/admin/users/`) with deactivate/reactivate. `django.contrib.admin` is **not installed**, so there is no Django-admin UI; do not look for one. |
| A ban tool | **There is no "ban."** There is a reversible **deactivate** (`users.is_active = FALSE`). Nothing prevents the same person registering a new account with a different email. |
| Evidence you can read | Message text is only viewable via **direct SQL** on `messaging.messages`. The admin persona console shows conversations only for `@persona.backchannel.app` accounts. |
| Evidence that survives | **It does not survive account deletion.** `queries/purge.py` deletes `moderation.reports` rows where the user is reporter, reported, or resolver, and deletes all messages and conversations the user took part in, for both sides. A reported user who deletes their account erases the report and the thread. See section 7. |

---

## 1. How a report arrives today (end to end)

1. User taps Report/Block (profile sheet, job sheet, deck card, or inside a thread). App calls `POST /api/reports/` with `reported_user_id`, `reason`, optional `detail`, optional `conversation_id`. Analytics event: `User Reported` (`report_reason`, `from_conversation`).
2. Valid `reason` values (DB CHECK constraint and `VALID_REPORT_REASONS`): `harassment`, `spam`, `inappropriate`, `fake_profile`, `other`. `detail` max 1000 chars. Self-report rejected; unknown user 404.
3. In **one transaction** (`services/moderation.py::report_user`): insert `moderation.reports` row with `STATUS='OPEN'`, upsert `moderation.user_blocks`, withdraw likes between the pair, unmatch the pair, close conversations between the pair. Roll back on any failure (500 "Could not submit report").
4. After commit: caches invalidated; `send_report_alert` fires on a background thread (Resend via SMTP) to `MODERATION_ALERT_EMAIL` if set.
5. The reporter is instantly protected (mutual block). **The reported user is not restricted in any other way.** They remain fully active, visible to everyone else, and can keep messaging their other matches, until a human deactivates them. This is the important gap: "acted on" for the reporter is instant; "acted on" for the platform is entirely manual.
6. Reports are stored in `moderation.reports`: `report_id, reporter_id, reported_user_id, reason, detail, conversation_id, status (OPEN|RESOLVED), resolved_by, resolved_at, resolution_note, created_at`. Index on `(status, created_at DESC)` and on `reported_user_id`.

**Known deviations from the published Privacy Policy section 7 (fix or soften the copy):**
- Policy says "any pending referral between you is withdrawn." `report_user` does **not** touch `matching.referrals` (only likes, matches, conversations). Ask Nico to add the referral withdrawal, or soften the sentence.
- Policy says report records are kept "including after either account is deleted where necessary." The purge deletes them outright. See section 7.

---

## 2. Daily triage checklist (10 to 20 minutes, twice daily in launch week)

Do it at fixed times (suggest 9:00 and 17:00 local) plus whenever the alert email arrives. The 24h clock starts at `created_at`, so two passes a day keeps you inside it; anything P0/P1 is handled the minute you see it.

1. **Confirm the pipe works.** Once per day: is the alert inbox receiving? (If no alerts arrived in 3 days, still check the queue; a silent inbox may mean a broken email path, not a quiet platform.)
2. **Log in to the admin portal** (`<API host>/admin/login/`). Open `<API host>/admin/api/reports/?status=OPEN` in the same browser (GET works with the cookie). Note count and oldest `CREATED_AT`.
3. **Sort by severity, then age** using the tiers in section 3. Anything older than 12h gets first attention.
4. For each report: read `REASON`, `DETAIL`, `REPORTED_*_NAME`, `REPORTED_IS_ACTIVE`; pull the **reported user's other reports** (`GET ...?status=` empty returns all; filter for the same `REPORTED_USER_ID`). Repeat reported users jump a tier.
5. **Preserve evidence first** (section 6) for P0/P1 and any report you might action, then decide.
6. **Act** (section 4), write a `resolution_note` (what you saw, what you did, in one or two sentences; no speculation), resolve via the API.
7. **Notify** (section 8), only if a template applies.
8. **Log it** in the weekly metrics sheet (section 10): report id, tier, received, actioned time.
9. End of pass: `OPEN` count and oldest age should be under 24h. If not, that is a breach of the App Store commitment; say so in your daily note and fix the cause (staffing or tooling).

Also each pass: check Sentry for new issues in `POST /api/reports/` (tag `api.endpoint`), because a 500 there means users **cannot** report and you will not see reports that were never filed.

---

## 3. Severity tiers

The `reason` enum cannot distinguish a threat from mild rudeness: `inappropriate` and `other` both carry CSAM and threats. **Triage on `DETAIL`, not on `REASON`.** Treat any report whose detail mentions minors, self-harm, violence, or weapons as P0 regardless of reason.

| Tier | Category | Examples | Required action | Target time | Hard limit |
|---|---|---|---|---|---|
| **P0** | **CSAM / sexual content involving a minor** | Explicit or suggestive imagery of a minor in a photo; a user who states they are a minor and is being sexualised. Also: **account holder appears under 16** (Policy section 12: we delete). | Preserve evidence, **deactivate immediately**, follow section 7 (NCMEC report, counsel, do **not** delete the account or data). Under-16 self-declared non-sexual: deactivate, then delete via purge after the retention decision. | Deactivate within **1 hour** of seeing it; NCMEC report "as soon as reasonably possible" (counsel to confirm the standard). | Same day. Treat as a wake-you-up alert. |
| **P0** | **Credible threats** (violence, self-harm, stalking, doxxing) | "I know where you live," threats to a person or workplace, a user expressing intent to self-harm | Preserve, deactivate the threatener, keep the reporter's block. Self-harm: reply to the reporter with resources (section 8); do not investigate. Imminent danger: contact local emergency services / the platform's legal contact; counsel to confirm any law-enforcement disclosure. | **1 hour** | 4 hours |
| **P1** | **Harassment / abusive or sexual messages** | Repeated unwanted messages, slurs, unsolicited sexual content, hate speech | Read the thread (SQL). Clear-cut: deactivate. One-off, ambiguous: warn (section 8 template B) and resolve without deactivation; second confirmed offense: deactivate. | **4 hours** | 24 hours |
| **P1** | **Fake employer / scam sponsor** | Sponsor claims a company they do not work at; asks applicants for money, fees, gift cards, or to move to WhatsApp/Telegram; phishing links; collects SSN/bank details | Check `user_info.sponsor_profiles.work_email_verified` and the company/email-domain match. Any request for money or sensitive IDs: deactivate immediately (their job postings should drop out of feeds with the account; verify), and check **other applicants they matched** (`matching.matches`, `messaging.messages`) so you can warn them. | **4 hours** | 24 hours |
| **P1** | **Impersonation** | Using a real person's name/photo/company; posing as a recruiter or a named employee | Ask the reporter (or the impersonated person) for a way to verify; deactivate on reasonable evidence (photo/name match to a real, uninvolved person). Reversible, so lean toward acting. | **4 hours** | 24 hours |
| **P2** | **Spam** | Same message sent to many matches, promotional links, mass-liking, referral-selling | Check volume (`SELECT count(*) FROM messaging.messages WHERE sender_user_id = ...`). Clear spam: deactivate. Borderline: warning. | **24 hours** | 24 hours |
| **P2** | **`fake_profile` (not employer, not impersonation)** | Obviously fabricated résumé, joke profile, duplicate account | Review profile. Deactivate if plainly fake/duplicate; otherwise resolve with a note. | **24 hours** | 24 hours |
| **P3** | **`other` / `inappropriate` with no substance** | "I didn't like this person" | Resolve with note "reviewed, no violation." The reporter is already blocked from them. | 24 hours | 24 hours |

**Repeat-offender rule:** three distinct reporters against the same `REPORTED_USER_ID` in 7 days = treat as P1 regardless of individual severity.

**Abuse of the report button:** a reporter filing many unfounded reports about different people is itself a signal; note it, warn once, then (only then) consider deactivating.

---

## 4. Suspending / banning an account: tools that actually exist

### 4.1 What "deactivate" does (verified in code)

`POST /admin/api/reports/<id>/resolve/` with `deactivate_user: true`, or `POST /admin/api/users/<user_id>/active/` with `{"is_active": false}`, or the Deactivate button on `/admin/users/`. All call `services/admin.py::set_user_active`, which:
- sets `user_info.users.is_active = FALSE` (the only mutation) and writes `user_info.admin_audit_log` (`user_deactivate` / `report_resolve`);
- invalidates the `jwt_user` cache immediately, so the API stops accepting their token right away (`custom_jwt.py` requires `is_active = TRUE`);
- blocks email/password login (`find_user_by_credentials` requires `IS_ACTIVE = TRUE`);
- removes them from feeds/like lists (queries filter on `is_active`) and suppresses their pushes (`create_notification` skips inactive recipients);
- **refuses admin accounts** (403);
- is **fully reversible** and destroys nothing (likes, matches, conversations, messages stay), which is exactly what you want for evidence.

### 4.2 Step by step (normal path)

1. Log in at `<API host>/admin/login/`.
2. Read the report: `<API host>/admin/api/reports/?status=OPEN`.
3. Resolve + deactivate. There is no button, so use the browser console on the admin origin (the resolve endpoint is CSRF-protected via the `X-CSRFToken` header; the cookie is set by the login page):
   ```js
   const csrf = document.cookie.split('; ').find(c => c.startsWith('csrftoken='))?.split('=')[1];
   await fetch('/admin/api/reports/<REPORT_ID>/resolve/', {
     method: 'POST', credentials: 'same-origin',
     headers: {'Content-Type': 'application/json', 'X-CSRFToken': csrf},
     body: JSON.stringify({deactivate_user: true, resolution_note: 'P1 harassment, 3 abusive msgs, see notes 2026-..'})
   }).then(r => r.json())
   ```
   Cookie name `csrftoken` is Django's default; verify in devtools on first use. Expected: `{"report_id": "...", "status": "RESOLVED", "deactivated_user": true}`. Errors: 404 unknown report, 400 already resolved.
4. Confirm: `/admin/users/` shows the user inactive; `GET /admin/api/audit/` shows the entries.
5. To **only** deactivate without resolving (e.g. mid-investigation): `POST /admin/api/users/<user_id>/active/` `{"is_active": false}` the same way.

### 4.3 If the admin portal is down or you have no admin account

`users.is_admin` is set by SQL only (migration `008_admin_flag.sql`). If nobody on the team has it, ask Nico to run `UPDATE user_info.users SET is_admin = TRUE WHERE email = '...'`. **Confirm today that Yosef has a working admin login.** Fallback via SQL (needs DB credentials; Nico holds them, see "gaps"):
```sql
-- deactivate (reversible; same effect as the portal, minus audit log and cache invalidation)
UPDATE user_info.users SET is_active = FALSE WHERE user_id = '<id>';
-- resolve the report
UPDATE moderation.reports
   SET status='RESOLVED', resolved_by='<admin user id>', resolved_at=NOW(), resolution_note='...'
 WHERE report_id='<id>' AND status='OPEN';
```
Direct SQL **skips the cache invalidation**: `jwt_user` has a 5-minute TTL, so the user retains API access for up to 5 minutes, and feed caches lag. Prefer the portal. Any SQL run by hand should be pasted into the incident/moderation log.

### 4.4 What deactivation does NOT do (know these limits)

- **No ban.** A new email = a new account. Apple "Hide My Email" makes this trivial. No device, IP or phone ban exists. If a deactivated user re-registers, treat as a new P1 and deactivate again; note the pattern.
- **Refresh tokens are not revoked, and WebSocket auth has no `is_active` check that we could find.** `set_user_active` does not blacklist JWT refresh tokens; `/api/token/refresh/` is the stock simplejwt `TokenRefreshView` (an inactive user can still mint access tokens, though every REST call is then rejected by `custom_jwt.py`); and `ws_auth.py` contains no `is_active` reference, so a deactivated user with a live token may still be able to connect a chat socket and send messages to existing matches (the messaging service may check separately; we did not trace it). The SSO sign-in path was not traced either. **Test with a throwaway account before launch** (deactivate, then try refresh, SSO sign-in, and send over an already-open socket) and hand any hole to Nico.
- **Profile photo stays public.** Photos are on a public-read CDN (§V #2). Deactivation hides the profile in-app but the URL keeps working. For CSAM or non-consensual imagery, ask Nico to delete the Spaces object; **but see section 7 before deleting anything.**
- **Their other matches are not notified**, and their existing conversations stay open for those people (only the reporter's pair is closed by the report). A deactivated user cannot send, but the other party still sees an open thread.
- **No user-facing notification** that they were suspended; they simply get a login error. Send the email in section 8 by hand.

---

## 5. Blocks

`moderation.user_blocks (blocker_id, blocked_id)` is created by reporting (there is no standalone Block endpoint in `django_bc/urls.py`; in this API blocking equals reporting, so every block creates an OPEN report and a moderation task). Blocks are mutual and permanent from the app's side (policy section 7). To reverse a wrongly created block, SQL delete plus cache invalidation is needed (`blocked_ids:<id>`, 5-minute TTL): ask Nico. Do not remove blocks casually; the reporter's safety is the point.

---

## 6. Evidence preservation (do this before you deactivate)

Deactivation preserves data; **deletion destroys it**. Steps:

1. **Do not delete anything** (account, photos, messages, reports) while a P0/P1 case is open. Do not run `purge_users` on the person.
2. Create a case folder outside the repo (private, access-limited): `cases/<report_id>/`. Never commit it to git.
3. Capture, with timestamps (UTC) and who captured it:
   - The report row and all other reports on the same `reported_user_id` (JSON from `/admin/api/reports/?status=` plus `SELECT * FROM moderation.reports WHERE reported_user_id='...'`).
   - The reported user's `user_info.users` row **without `password_hash`** and profile rows (`user_profiles`, `sponsor_profiles`/`applicant_profiles`), `created_at`, `last_login`, SSO identity provider and `provider_email`.
   - The conversation: `SELECT * FROM messaging.messages WHERE conversation_id = '<id>' ORDER BY created_at;` (`report.CONVERSATION_ID` is null when the report came from a profile/deck/job sheet; then search `messaging.conversations` by both user ids), plus `messaging.conversations`, `matching.matches`, `matching.referrals` for the pair.
   - The photo URL and, if lawful to hold, a hash of the file; do **not** download, forward, email or screenshot suspected CSAM (see section 7).
   - Admin audit log entries: `GET /admin/api/audit/`.
4. Record a SHA-256 of each exported file in the case log.
5. **Reports purged on deletion.** If a reported user deletes their account (self-service flow), their reports and threads disappear, including your evidence. Mitigation until the backend changes: for any P0/P1, export first; for repeat offenders, keep the export as your record (counsel to confirm how long and under what basis, given the policy promises deletion but carves out legal/fraud-prevention retention).
6. Retention of case files: suggest 1 year for ordinary cases, and for anything reported to NCMEC or law enforcement, as long as counsel says (US law currently requires preservation of reported material for a set period, counsel to confirm the current number).

---

## 7. CSAM / child safety and mandatory reporting

**Facts to bring to counsel (do this before launch, not after the first incident):**
- A US electronic service provider that obtains **actual knowledge** of apparent CSAM on its service has a legal duty under **18 U.S.C. 2258A** to report it to the **NCMEC CyberTipline** ("as soon as reasonably possible"), and to preserve the reported content and related data for the period the statute specifies (extended by the REPORT Act of 2024; counsel to confirm the current period, the format and whether Bluejay Labs LLC is required to register with the CyberTipline ESP program). Failure to report carries statutory fines. **Counsel to confirm** all of this, including whether the duty attaches to us (we host user-uploaded photos on a public CDN, so yes, treat it as attaching).
- We have **no automated scanning** (no hash matching, no image classification). Detection is user reports only. Public-read photo URLs increase exposure. This is a gap to disclose to counsel.
- The app is for people 16+ (Policy section 12); minors 16-17 may legitimately be present, so imagery of a minor is possible without being CSAM. Do not adjudicate borderline cases alone; escalate.

**Procedure if a report or your own review indicates apparent CSAM:**
1. **Stop and do not spread it.** Do not download, forward, screenshot, copy into chat/email/Drive/Notion, or show it to other staff. Minimise the number of people who view it (ideally one).
2. Deactivate the account (section 4). Do **not** purge/delete the account, the photo object, or the messages.
3. Note: report id, user id, photo URL/object path, timestamps, who viewed it and when.
4. Contact **counsel immediately** (same hour). Counsel directs the NCMEC submission (cybertip.org / CyberTipline report), including what identifying data to include (account id, email, IP if available; **we do not currently store login IPs**, which is a gap that limits what you can report; see gaps).
5. Tell Nico (backend) to **preserve, not delete** the Spaces object and DB rows, and to **not** run cleanups on that user.
6. Do not notify the user before counsel says it is safe (tipping-off can hurt an investigation).
7. Log the decision and times. This log is the evidence that you acted fast.

**Also brief-worthy for counsel:** subpoenas/law-enforcement requests (who receives them at `support@`), the retention promises in Privacy Policy section 9 versus mandatory preservation, and whether the "report retained after deletion" language should be tightened.

---

## 8. User-notification templates

Send by hand (from `support@backchannel.app`, once MX + a real mailbox exist; sending needs a verified Resend domain, receiving needs MX; these are different DNS records). Look up emails by `SELECT email FROM user_info.users WHERE user_id = '...'`. Never include the reporter's identity in anything sent to the reported user (Policy section 7: "The person you report is not told who reported them").

**A. Reporter: report received and actioned**
> Subject: About your report on BackChannel
> Hi {first_name}, thank you for telling us. We reviewed your report and have taken action on the account you reported. You will not see each other in BackChannel. If anything else comes up, reply to this email. If you are ever in immediate danger, please contact local emergency services first. Thank you for helping keep BackChannel safe. The BackChannel team

**A2. Reporter: reviewed, no violation found**
> Subject: About your report on BackChannel
> Hi {first_name}, we reviewed your report. We did not find a violation of our Terms, but as always you will not see that person, and they will not see you. If there is more we should know, reply to this email and we will look again. The BackChannel team

**B. Reported user: warning (no suspension)**
> Subject: A reminder about BackChannel's community rules
> Hi {first_name}, we received a report about messages or content on your account that may not follow our Terms of Service (respectful, honest, professional conduct). We are not suspending your account at this time. Please review the Terms at https://backchannelapp.netlify.app/terms.html. Further violations can lead to suspension. If you think this was a mistake, reply to this email. The BackChannel team

**C. Reported user: account suspended**
> Subject: Your BackChannel account has been suspended
> Hi {first_name}, we suspended your BackChannel account because we found content or conduct that violates our Terms of Service ({one-line category, e.g. "abusive messages" or "misrepresenting your employer"}). You will not be able to sign in. If you believe this was a mistake, reply to this email within 30 days with any context you would like us to consider, and a person will review it. The BackChannel team

**D. Applicants who matched a scam sponsor**
> Subject: A safety notice about a BackChannel connection
> Hi {first_name}, we removed an account you were connected with because it was not who it claimed to be. As a precaution: never send money, gift cards, ID numbers or bank details to someone you meet online, and be careful with links or requests to move to another app. If you shared sensitive information, reply and tell us so we can help. The BackChannel team

**E. Self-harm disclosure (reporter or reported), supportive only**
> Hi {first_name}, we are sorry you are going through this. If you are in the United States, you can call or text 988 (Suicide & Crisis Lifeline) any time. If you are outside the US, findahelpline.com lists local options. If you are in immediate danger please call your local emergency number.

Templates for CSAM cases are **not** to be sent without counsel.

---

## 9. Appeals

- Channel: reply to the suspension email / `support@backchannel.app`. **No MX today** (§W #4), so a suspended user has no working way to reach you; fix MX before launch or appeals will silently bounce.
- SLA suggestion: acknowledge within 2 business days, decide within 7 days.
- Reviewer must be a different decision than the first if you are more than one person (the other founder reviews).
- Process: pull the case file (section 6), read the user's statement, decide. To reinstate: `POST /admin/api/users/<user_id>/active/` `{"is_active": true}` (audited, restores their feed visibility). The **block stays** (reporter's safety) and is not reversed by reinstatement.
- Never reinstate a P0 (CSAM/threat) without counsel/legal sign-off.
- Record outcome (upheld/reversed) in the case log and the weekly metrics.

---

## 10. Weekly metrics

Run every Monday. SQL (read-only, replace the date window):

```sql
-- received in window
SELECT count(*) FROM moderation.reports WHERE created_at >= date_trunc('week', now()) - interval '7 days'
                                          AND created_at <  date_trunc('week', now());
-- actioned (resolved) and median time-to-action, hours
SELECT count(*) FILTER (WHERE status='RESOLVED') AS actioned,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM resolved_at - created_at)/3600) AS median_hours,
       percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM resolved_at - created_at)/3600) AS p90_hours,
       count(*) FILTER (WHERE status='OPEN' AND created_at < now() - interval '24 hours') AS open_over_24h
FROM moderation.reports
WHERE created_at >= date_trunc('week', now()) - interval '7 days' AND created_at < date_trunc('week', now());
-- by reason
SELECT reason, count(*) FROM moderation.reports WHERE created_at >= now() - interval '7 days' GROUP BY 1;
```
Caveat: purged reports (deleted accounts) drop out of these counts silently; note the number of deactivated/deleted reported users separately. Cross-check with Mixpanel `User Reported` (client-side count, includes any that failed server-side).

| Week of | Reports received | By reason (h/s/i/f/o) | Actioned | Actioned <24h | Median time-to-action (h) | P90 (h) | Open >24h | Accounts deactivated | Warnings | Appeals (received / reversed) | NCMEC / LE reports |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-09-28 | | | | | | | | | | | |
| 2026-10-05 | | | | | | | | | | | |

**Target:** 100% of reports actioned within 24h (that is the promise to Apple); P0 under 1h, P1 under 4h. **Any "Open >24h" above 0 is an incident** to explain in the note.

---

## 11. Gaps to build, ranked by effort

**Ops-only / config (minutes to hours, no code):**
1. **Set `MODERATION_ALERT_EMAIL` in the DO prod env** to a monitored inbox (Nico; §W #4). Interim: a personal inbox, not `support@` (no MX). Then send a test report and confirm the email lands.
2. **Add MX for `backchannel.app`** (or a forwarding service) so support/appeals/law-enforcement mail is received; then set Resend `reply_to` (§W #5).
3. **Confirm Yosef has an `is_admin` account** and can log into `/admin/login/`; do a dry run: file a report from a test account, receive the alert, resolve it via the console snippet.
4. **Test deactivation end to end** with a throwaway account (login, refresh token, SSO, open WebSocket, feed hiding) to close the "unverified" items in section 4.4.
5. **Brief counsel** on section 7 and decide who files NCMEC reports.
6. **Get read-only DB access** for whoever does triage (or a saved-query workflow with Nico) so evidence exports are not blocked on one person.

**Small backend changes (hours):**
7. Fix the alert email: real API host in `queue_url`, and include reporter/reported **names, `DETAIL`, `CONVERSATION_ID`** so P0 can be triaged from the inbox. Add "OPEN reports older than N hours" digest.
8. Make `report_user` also **withdraw referrals** between the pair (matches Policy section 7) or soften the policy.
9. Startup `warning` when `MODERATION_ALERT_EMAIL` is unset in prod (already proposed in §W #4).
10. Add report reasons for `underage`, `threat_or_safety`, `scam` (needs a migration; the DB CHECK constraint limits reasons to 5 values today) so tiers can be triaged from the enum.
11. Blacklist refresh tokens and reject inactive users at refresh/SSO/WebSocket (if the test in item 4 shows they get through).

**Medium (a few days):**
12. **Do not purge reports/messages on account deletion when a report exists** (or archive to a restricted `moderation.evidence` table): fixes the evidence-loss problem and makes the Policy section 7 sentence true.
13. Reports tab in the admin portal (HTML page over the existing JSON: list, filters by reason/age, user card, thread view with the reported conversation, Resolve/Deactivate buttons, warning email trigger). Removes the console-snippet step.
14. Persist a login IP / device hint (privacy-policy impact; disclosure needed) so NCMEC and law-enforcement reports have something to include, and so repeat offenders can be linked.
15. User-facing "you were suspended" state and message on login (instead of a generic error), with an in-app appeal link.

**Larger (weeks):**
16. Automated safety: hash-matching for uploaded images (e.g. PhotoDNA / NCMEC hash-sharing via a vendor) and image moderation before photos become public; private-by-default photo CDN (§V #2).
17. Message-level reporting (report a specific message, with its text snapshotted into the report), rather than only user-level.
18. Ban primitives: normalised-email deny list, Apple relay-sub deny list, device-level deny; rate-limit new accounts per device.
19. Transparency/reporting: automatic weekly moderation metrics, and a shared inbox / ticketing tool (Help Scout, Front) for reports + appeals instead of email threads.
