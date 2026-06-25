# Input Guards & Safe-Display Audit

**Date:** 2026-06-23
**Scope:** validation/cleaning of user-entered data + safe display of unbounded text, app-wide.

The concern: users can enter anything (a "phone number" with letters, a 5,000-char
bio, a malformed link), and we (a) save it unchecked and (b) render it raw, which
can corrupt data and break layouts. This audit adds a reusable protective layer and
applies it to the highest-risk surfaces, then lists what remains.

---

## ✅ Shipped in this pass

### Reusable infrastructure
- **`lib/validation.ts`** — central validators + cleaners:
  - `validateProfileField(field, raw)` → `{ ok, cleaned, error }` (one switch keyed to ProfileView's fields).
  - `isValidPhone` (7–15 digits, no letters), `isValidEmail`, `isValidUrl` + `normalizeUrl` (adds `https://`), `isValidYear` (4-digit, sane range), `isValidGpa` (0–5).
  - `cleanText` (trim + collapse whitespace + cap) and `cleanMultiline` (preserve line breaks, cap blank lines, cap length).
  - `FIELD_LIMITS` — per-field character caps (name 60, bio 1000, url 300, …).
- **`components/ui/ExpandableText.tsx`** — truncates to N lines with a measured "Read more / Show less" toggle (no toggle when text fits). Use for any unbounded free-text display.

### Applied
- **ProfileView save path** (`handleSaveField`) now runs every field through `validateProfileField`: rejects bad phone / link / year / GPA with a toast, and trims/collapses/caps everything else before persisting. (Was: saved raw `tempValue` with zero checks.)
- **Bio display** uses `ExpandableText` (collapsed to 5 lines) in: `ProfileView`, `ApplicantPublicProfileView`, `SponsorPublicProfileView`.
- **Bio editor** has `maxLength={1000}` + a live character counter.
- **Create-job-from-URL** (`JobsView.handlePreviewJob`) validates the link with `isValidUrl` before loading the webview (was: prepended `https://` to literally anything).

### Second pass (2026-06-24)
- **Signup email validation** (`AuthScreen`): registration now rejects a malformed email (`isValidEmail`) instead of only checking non-empty; the **forgot-password** input is validated the same way.
- **Work-email step** (`SponsorQuestionnaire.handleNext`): a typed work email must be valid before advancing (blank still allowed → verify later via the in-app gate). Applicant questionnaire has no email step (email comes from signup).
- **Achievements**: editor capped at `maxLength={1000}` + counter; the read-only display in `ApplicantPublicProfileView` now uses `ExpandableText` (5-line collapse).
- **Card overflow**: added `numberOfLines={1}` to the JobsView job-card **company name** and the MessagesView chat-header **name** (both could stretch on a long unbroken string). HomeView deck names already cap at 2–3 lines; MatchesView card names already `numberOfLines={1}`.
- **Message input** (`MessagesView`) capped at `maxLength={2000}`.
- Also: applicant onboarding welcome toast now mentions the spam folder (parity with the sponsor flow).

---

## 🔲 Remaining recommendations (prioritized)

### Low value / optional
1. **`maxLength` on the remaining ProfileView inline editors** (firstName, lastName, role, company, degree, major, university, etc.). The save-time `validateProfileField` gate already caps these, so this is a typing-nicety, not a data risk.
2. **Insight answers** are already capped at `maxLength={200}` at entry (questionnaires) — low-risk; no change needed unless that cap is removed.
3. **Job descriptions** (ATS-sourced) are long but shown in dedicated scrollable detail views; if any are ever rendered inline in a card, wrap with `ExpandableText`.
4. **Manual salary input** — N/A today (jobs are created via URL scraping, not manual salary entry). Revisit if a manual create-job form with salary fields is added (enforce numeric + min ≤ max).

### ⚠️ Server-side (backend team)
Client validation is UX, **not** security — the backend must independently validate/sanitize the same fields (phone, email, URL, lengths) on write, since the API can be called directly. Worth a dedicated backend ticket mirroring `lib/validation.ts`.

---

## How to extend
- New editable profile field → add a case to `validateProfileField`.
- New long free-text display → wrap the `<Text>` in `<ExpandableText numberOfLines={n}>`.
- New form input → import the relevant `isValid*` and gate the submit handler with a toast on failure.
