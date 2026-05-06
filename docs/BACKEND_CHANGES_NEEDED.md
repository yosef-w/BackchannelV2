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

### Root cause: two emails in two separate columns

We have two distinct email fields with two distinct meanings:

```
users table                       sponsor_profiles table
─────────────────                 ────────────────────────
user_id        → 1234             user_id            → 1234
email          → jane@gmail.com   work_email         → jane@stripe.com
email_verified → TRUE/FALSE       work_email_verified → (column does not exist yet)
```

- `users.email` is Jane's **login credential**. Verified by PR #38.
- `sponsor_profiles.work_email` is her **employment claim**. Currently unverified by anything.

These can be the same address or different addresses. They mean different things. PR #38's existing `users.email_verified` flag answers *"does Jane control her login mailbox?"* — it cannot also answer *"does Jane work at the company she claims?"* The two questions are independent, so we need two separate flags.

This rules out re-flipping the existing `users.email_verified` from a work-email click — that would conflate two unrelated facts and create a false integrity signal.

### Strategy: extend PR #38, don't duplicate it

The cleanest path is to *extend* the existing verification machinery rather than build a parallel one. The total work is:

- **1 new column** (`sponsor_profiles.work_email_verified`)
- **1 new endpoint** (`POST /api/auth/verify-work-email/send/`)
- **1 small modification** to the existing `POST /api/auth/verify-email/` endpoint — branch on the JWT's `purpose` claim
- **1 new email template** (or a small variant of the existing one)

Frontend reuses everything else: the [existing `/verify-email` deep-link route](../app/verify-email.tsx), the `authApi.verifyEmail()` helper, and the success/error UI. No new frontend route or API helper needed.

### What to build

#### 1. New column

```sql
ALTER TABLE user_info.sponsor_profiles
  ADD COLUMN work_email_verified BOOLEAN NOT NULL DEFAULT FALSE;
```

Also expose `work_email_verified` on the existing `GET /api/profile/` response under the sponsor sub-object, so the frontend's `useUserProfileStore.fetchFromBackend()` can read the real value instead of defaulting to `true`.

#### 2. New endpoint — `POST /api/auth/verify-work-email/send/`

- **Auth:** Required (sponsor session)
- **Body:** `{ "work_email": "name@company.com" }`
- **Behavior:** Generates a JWT verification token with claims `{ user_id, work_email, purpose: "work_email_verification" }`, sends a verification email to the `work_email` address (NOT to `users.email`).
  - **Important:** the `work_email` value goes *into the token* so the verify endpoint can write the exact verified address to `sponsor_profiles.work_email`. This handles the case where the user changes the form between send and click — only the address that was actually emailed gets persisted as verified.
- **Optional defense-in-depth:** validate that `work_email`'s domain matches the sponsor's claimed `company` field (e.g. reject `name@gmail.com` if `company == "Stripe"`). Can be punted to a future iteration.
- **Rate limit:** 5 / hour per user (mirror PR #38's `resend-verification` throttle).
- **Response (200):** `{ "message": "Verification email sent to name@company.com" }`

#### 3. Extension to existing `POST /api/auth/verify-email/`

Today this endpoint unconditionally calls `users_q.set_email_verified(user_id)`. It needs to branch on the token's `purpose` claim:

```python
# Pseudocode for the verify-email service
def verify_email(token_str):
    decoded = decode_token(token_str)  # existing
    user_id = decoded.get('user_id')
    purpose = decoded.get('purpose')

    if purpose == 'email_verification':
        # EXISTING BEHAVIOR — do not change
        users_q.set_email_verified(user_id)
        return success("Email verified successfully.")

    elif purpose == 'work_email_verification':
        # NEW BRANCH
        work_email = decoded.get('work_email')
        if not work_email:
            return bad_request("Invalid token")
        sponsor_profiles_q.set_work_email_verified(user_id, work_email)
        return success("Work email verified successfully.")

    else:
        return bad_request("Invalid or expired verification token")
```

The new query helper:

```python
def set_work_email_verified(user_id, work_email):
    q = """
    UPDATE user_info.sponsor_profiles
    SET work_email = %s, work_email_verified = TRUE
    WHERE USER_ID = %s
    """
    execute_query(q, (work_email, user_id))
    invalidate(f"sponsor_profile:{user_id}", f"pub_profile:{user_id}", f"sponsor_info:{user_id}")
```

Both purposes should remain idempotent (verifying twice = success both times).

#### 4. Email template

Either:
- Add a new template `verify_work_email.html`, OR
- Add a `kind: "work_email"` flag to [`verify_email.html`](../../Backchannel-backend/BackChannel-backend/bc_microservices/templates/email/verify_email.html) and branch the body copy.

Body should reference *"verifying your employment at <company>"* instead of *"verifying your account email"*. Link still points at `{FRONTEND_URL}/verify-email?token=<JWT>` — same deep-link target, the verify endpoint will route based on `purpose`.

### Frontend impact (when shipped)

Once the backend is live, [`SponsorQuestionnaire.tsx`](../components/SponsorQuestionnaire.tsx) step 8:

1. Replaces the fake `setTimeout` spinner with a real call to `POST /api/auth/verify-work-email/send/` when the sponsor presses "Verify & Complete".
2. Shows the "Awaiting verification…" UI and polls `GET /api/profile/` every 3 seconds (no separate `/status/` endpoint needed — the profile endpoint already returns the sponsor sub-object, and `work_email_verified` will live on it).
3. Auto-advances to `handleFinalSubmit()` the moment the polled response shows `work_email_verified === true`.
4. Wires the "Resend" button to a second call to the send endpoint (the 5/hr backend throttle prevents abuse).

The [existing `app/verify-email.tsx` deep-link landing screen](../app/verify-email.tsx) handles the user clicking the link — no changes needed there. The screen already calls `authApi.verifyEmail(token)` with whatever JWT was in the URL; the backend's branched verify service routes the write to the correct column based on `purpose`.

The `workEmailVerified` flag in [`stores/useUserProfileStore.ts:225`](../stores/useUserProfileStore.ts#L225) reverts to its real-data semantics — the gate in `HomeView` then actually blocks unverified sponsors from swiping.

### Done when

- A sponsor entering a work email at step 8 receives a real verification email at that address (NOT at their login email).
- Clicking the link routes through the existing `/verify-email` endpoint, the service branches on `purpose === "work_email_verification"`, and flips `sponsor_profiles.work_email_verified` to `TRUE`.
- `GET /api/profile/` returns the new `work_email_verified` field on the sponsor sub-object.
- `users.email_verified` (PR #38's flag) is unaffected — verifying a work email does not flip the account-email flag, and vice versa.
- The questionnaire auto-advances on link click, and the `HomeView` email-verification gate actually blocks unverified sponsors.

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
