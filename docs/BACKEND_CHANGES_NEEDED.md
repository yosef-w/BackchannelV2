# Backend Changes Needed

**Last updated:** 2026-05-05
**Verified against backend HEAD:** `eef69b8` (post-PR #40, 2026-05-05)
**Frontend repo:** `BackchannelV2`
**Backend repo:** `Backchannel-backend/BackChannel-backend`

> All previously-tracked ship-blockers (Redis caching, sponsored-job insights, `create-from-url`, and profile-pack enrichment) have shipped end-to-end and been integrated on the frontend. Two items remain — both originally marked optional. **Neither blocks beta.** §1 is a product-integrity issue that should land before any wider/public launch; §2 is pure polish.

---

## 📋 Summary

| #   | Item                                          | Priority      | Status         | Type     |
| --- | --------------------------------------------- | ------------- | -------------- | -------- |
| §1  | Real work-email verification for sponsors     | 🟡 Pre-launch | Cosmetic only  | New flow |
| §2  | Notifications enhancements (5 sub-items)      | 🟢 Polish     | Mostly working | Polish   |

**🟡 = should land before public launch** (product-integrity issue; closed beta is fine without it) **·** **🟢 = pure polish, app works without it**

---

## §1 — Real Work-Email Verification for Sponsors

**Affects:** [`components/SponsorQuestionnaire.tsx`](../components/SponsorQuestionnaire.tsx) — step 8 "Verify your employment"

### What's showing now

The last step of sponsor sign-up asks for a work email (e.g. `name@company.com`). When the sponsor presses "Verify & Complete", the app shows a fake "Awaiting verification…" spinner then submits registration regardless — no email is sent, no link is clicked, nothing is verified. The "Resend" button is also fake.

`sponsor_profiles.work_email` is collected and stored, but there is no verification of any kind. The frontend's `workEmailVerified` flag defaults to `true` if the backend doesn't return `work_email_verified` on the profile response, so **every sponsor passes the email-verification gate in `HomeView`** regardless of what they entered.

### Why this is more than cosmetic

A sponsor can claim to work at any company with any email address. For closed beta with controlled tester accounts this is acceptable. For any wider/public launch it's a real product-integrity issue — the entire premise of "BackChannel = real insider context from a real employee" rests on this signal.

### Why we can't reuse PR #38's account email-verification flow

We considered piggybacking on the existing `/api/auth/verify-email/` endpoint shipped in PR #38. It doesn't work — three blocking differences:

1. **Different target column.** PR #38's service hardcodes `UPDATE users SET email_verified = TRUE`. This flow needs to write to `sponsor_profiles.work_email_verified` (new column, not yet in schema).
2. **Different recipient.** PR #38 sends the link to `users.email` (the user's login email). Work-email verification *must* send the link to the work email itself — that's the integrity check. Otherwise `jane@gmail.com` would receive a link confirming she works at Stripe, which defeats the purpose.
3. **Different trigger time + status polling.** PR #38 fires automatically at register. Work-email verification needs an explicit send call when the sponsor types their work email at step 8, plus a status endpoint for auto-advance.

**Reuse opportunity:** ~80% of PR #38's code can be copied verbatim. Only the target column, the recipient address, and the token `purpose` claim need to change.

### Endpoints needed

#### 1. `POST /api/auth/verify-work-email/send/`

- **Auth:** Required (sponsor session)
- **Body:** `{ "work_email": "name@company.com" }`
- **Behavior:** Generates a JWT verification token with claims `{ user_id, work_email, purpose: "work_email_verification" }`, sends a verification email to `work_email` (NOT to `users.email`), stores the pending verification.
- **Optional defense-in-depth:** validate that `work_email`'s domain matches the sponsor's claimed `company` field (e.g. reject `name@gmail.com` if `company == "Stripe"`). Domain-to-company mapping can be punted to a future iteration.
- **Rate limit:** 5 / hour per user (mirror PR #38's `resend-verification` throttle).
- **Response (200):** `{ "message": "Verification email sent to name@company.com" }`

#### 2. `POST /api/auth/verify-work-email/confirm/`

- **Auth:** None — the token in the body carries identity (same pattern as `/api/auth/verify-email/`)
- **Body:** `{ "token": "<JWT>" }`
- **Behavior:** Validates token, checks `purpose === "work_email_verification"`, marks `sponsor_profiles.work_email_verified = TRUE`, stores the verified `work_email` value.
- **Idempotency:** verifying twice returns success both times.
- **Response (200):** `{ "verified": true }`
- **Response (400):** `{ "error": "Invalid or expired verification token" }`

#### 3. `GET /api/auth/verify-work-email/status/` *(optional but unblocks auto-advance UX)*

- **Auth:** Required
- **Behavior:** Returns the current sponsor's verification state. Polled by the frontend during the "Awaiting verification…" step so the UI can auto-advance the instant the link is clicked, rather than requiring the user to come back to the app and tap "I verified".
- **Response (200):** `{ "verified": true | false }`

### Schema change required

```sql
ALTER TABLE user_info.sponsor_profiles
  ADD COLUMN work_email_verified BOOLEAN NOT NULL DEFAULT FALSE;
```

The existing `GET /api/profile/` response should also start returning `work_email_verified` on the `sponsor_profile` sub-object so the frontend's `useUserProfileStore.fetchFromBackend()` reads the real value instead of defaulting to `true`.

### Email template

Mirror PR #38's [`verify_email.html`](../../Backchannel-backend/BackChannel-backend/bc_microservices/templates/email/verify_email.html) — same visual style, but body text references "verifying your employment at *<company>*" instead of "verifying your account email". Link should point at `{FRONTEND_URL}/verify-email?token=<JWT>` — the existing deep-link route on the frontend already handles arbitrary verification tokens; the backend's `verify` service just needs to branch on the `purpose` claim and call the right column-update path.

### Frontend impact (when shipped)

Once these endpoints exist, `SponsorQuestionnaire.tsx`:

1. Replaces the fake `setTimeout` spinner with a real call to `POST /api/auth/verify-work-email/send/` when the sponsor presses "Verify & Complete".
2. Polls `GET /api/auth/verify-work-email/status/` every 3 seconds while the "Awaiting verification…" modal is open.
3. Auto-advances to `handleFinalSubmit()` the moment `verified: true` is returned.
4. Wires the "Resend" button to a second call to the send endpoint (with the existing 5/hr backend throttle preventing abuse).

The `workEmailVerified` flag in [`stores/useUserProfileStore.ts:225`](../stores/useUserProfileStore.ts#L225) reverts to its real-data semantics — the gate in `HomeView` then actually blocks unverified sponsors from swiping.

### Done when

- A sponsor entering a work email at step 8 receives a real verification email at that address (NOT at their login email).
- Clicking the link flips `sponsor_profiles.work_email_verified` to `TRUE` and the questionnaire auto-advances.
- `GET /api/profile/` returns the new `work_email_verified` field on the sponsor sub-object.
- The `HomeView` email-verification gate (`workEmailVerified === true`) actually blocks unverified sponsors.

---

## §2 — Notifications Enhancements

**Affects:** [`components/NotificationsView.tsx`](../components/NotificationsView.tsx)

### Context

The notifications list is fully interactive on the frontend — tap-to-navigate, swipe-to-mark-read, pull-to-refresh, date grouping, ticking relative times. The items below unlock functionality the frontend cannot implement alone.

### Current state

- Swipe → mark-read (because no delete endpoint exists).
- Read notifications accumulate forever (no bulk-clear).
- Cards show the generic server-provided `TITLE` / `BODY` only — no related-user names, photos, or job titles.
- Fresh rows appear only on pull-to-refresh or re-navigation. The unread-count badge polls every 60s but the list itself is stale for the duration of the session.

### What to build

#### 1. `DELETE /api/notifications/<id>/` — true per-row dismiss

- **Behavior:** Marks a single notification as dismissed for the owning user (hard delete or soft-delete via `DISMISSED_AT`).
- **Response (200):** `{ "message": "Notification deleted" }`
- **Why:** Swipe currently maps to mark-as-read because there is no delete endpoint. Users expect swipe-away to mean gone.

#### 2. `DELETE /api/notifications/?only=read` — bulk clear read

- **Behavior:** Deletes/dismisses all read notifications for the authenticated user.
- **Response (200):** `{ "deleted_count": N }`
- **Why:** Read notifications accumulate forever today. A "Clear read" header action needs this.

#### 3. Denormalized metadata on notification rows

Add four nullable fields to the existing `GET /api/notifications/` response shape:

- `RELATED_USER_NAME` (string)
- `RELATED_USER_PHOTO_URL` (string)
- `RELATED_JOB_TITLE` (string)
- `RELATED_JOB_COMPANY` (string)

**Why:** The frontend has `RELATED_USER_ID` / `RELATED_JOB_ID` but no display data. Without these, richer notification cards (e.g. *"John Smith liked **Senior Engineer** at Acme"*) require N+1 follow-up fetches per notification — bad for perf and UX.

#### 4. Realtime channel — or cheap polling alternative

Either:

- WebSocket `/ws/notifications/` that pushes newly-created rows to connected clients, **or**
- `GET /api/notifications/?since=<iso_timestamp>` to return only rows created after a client-held cursor.

**Why:** A focused user sitting on the notifications screen never sees new rows arrive. The unread-count poll updates the badge but not the list itself.

#### 5. Server-side grouping of repeat events

Aggregate near-identical events into a single row with a count (e.g., 5 `job_like` notifications on the same job within 10 minutes → one row with `body: "5 new applicants interested"`).

**Why:** High-activity users (especially sponsors) can otherwise receive a cascade of identical rows that bury other events.

### Frontend impact (when each ships)

1. Swap swipe-to-mark-read → swipe-to-delete; add a "Clear read" button in the header.
2. Render richer cards with actual names / photos / job titles instead of generic `BODY` strings.
3. Live list updates without manual pull-to-refresh.
4. Collapse grouped rows behind a count badge.

### Done when

- Swipe-to-delete actually removes the row from the user's notification list.
- A "Clear read" action removes all read notifications in one call.
- Notification cards display sender names, photos, and job context inline.
- New notifications appear on the screen without the user having to pull-to-refresh.

---
