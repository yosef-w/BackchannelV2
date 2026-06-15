# Sentry Setup — Crash Reporting

**Last updated:** 2026-06-11
**Code side:** already done (branch `fix/launch-blockers`) — `@sentry/react-native` is installed, the config plugin is in `app.json`, and `lib/sentry.ts` initializes it from `EXPO_PUBLIC_SENTRY_DSN`. The app no-ops gracefully while the DSN is empty, so nothing breaks before these steps are done.

What's left is account setup — roughly 10 minutes for the required part.

---

## Part 1 — Required: get crashes flowing (~10 min)

### 1. Create the Sentry account + project

1. Go to [sentry.io](https://sentry.io) → sign up (the free tier is plenty for a beta: 5k errors/month).
2. When prompted to create a project, pick platform **React Native**.
3. Name it `backchannel` (org name can be anything — e.g. `backchannel-app`).

### 2. Copy the DSN

After the project is created, Sentry shows a code snippet containing the DSN — a URL like:

```
https://a1b2c3d4e5f6...@o123456.ingest.us.sentry.io/4506789012345678
```

You can always find it later under **Project Settings → Client Keys (DSN)**.

The DSN is safe to ship in the app bundle (it can only *send* events, not read them) — same risk class as the Mixpanel token.

### 3. Put the DSN in the env files

Each env file already has an empty `EXPO_PUBLIC_SENTRY_DSN=` line at the bottom. Fill it in:

- `.env.production` — required (this is what TestFlight builds use)
- `.env.development` / `.env.test` — optional; note `lib/sentry.ts` disables reporting in dev builds anyway (`enabled: !__DEV__`), so dev crashes stay in Metro and never pollute the dashboard.

### 4. Add it to the EAS production build env

Production builds on EAS read env vars from `eas.json` → `build.production.env`. Add:

```json
"EXPO_PUBLIC_SENTRY_DSN": "https://...your-dsn..."
```

(Or, cleaner: store it with `eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value <dsn>` and keep it out of git — same migration the other keys in `eas.json` deserve.)

### 5. Verify it works

1. Make a build that isn't a dev build (`eas build --profile preview` or `production`), since dev builds don't report.
2. Temporarily add a crash trigger somewhere reachable, e.g. a button that calls:
   ```ts
   throw new Error("Sentry smoke test");
   ```
3. Tap it, reopen the app (events flush on next launch for hard crashes), and check the Sentry dashboard — the event should appear within a minute.
4. Remove the trigger.

**Done — crashes are now captured**, including native crashes and JS errors. Stack traces for JS errors will be minified (unreadable function names) until Part 2.

---

## Part 2 — Recommended: readable stack traces (source maps)

Without this, a crash report says something like `at a (index.bundle:1:482910)`. With it, you get `at handleSwipe (HomeView.tsx:1893)`. Crashes are captured either way — this only affects readability.

### 1. Create an auth token

Sentry → **Settings → Auth Tokens** (organization settings) → Create token with scopes `project:releases` + `org:read`. This token is a **secret** — unlike the DSN, never commit it.

### 2. Store it as an EAS secret

```bash
eas env:create --environment production --name SENTRY_AUTH_TOKEN --value <token> --type sensitive
```

Also set the org/project so the upload knows where to go (these two are not secret):

```bash
eas env:create --environment production --name SENTRY_ORG --value <your-org-slug>
eas env:create --environment production --name SENTRY_PROJECT --value backchannel
```

(Slugs are in the Sentry URL: `sentry.io/organizations/<org-slug>/projects/<project-slug>/`.)

### 3. That's it

The `@sentry/react-native` config plugin already in `app.json` adds the upload step to EAS builds automatically; it activates when those env vars are present and silently skips when they're not. The next production build uploads its source maps and all subsequent crash reports are symbolicated.

---

## Day-to-day during the beta

- **Dashboard → Issues** is the main view: each distinct crash is grouped, with device model, OS version, app version, and the breadcrumb trail (taps/navigation leading up to it).
- **Set up alerts** (Settings → Alerts): "email me on any new issue" is the right setting for a beta — first-week volume will be low and every crash matters.
- When a tester says "it crashed," ask for the rough time and check Issues — you'll usually find it without needing anything else from them.
- Manual capture is available anywhere via the re-export in `lib/sentry.ts`:
  ```ts
  import { Sentry } from "@/lib/sentry";
  Sentry.captureException(err);   // in catch blocks worth reporting
  ```

## Costs / limits

Free tier: 5k errors + 10k performance events/month, 1 user. Fine through beta. If the team grows or volume spikes post-launch, the Team plan (~$26/mo) is the next step — no code changes needed.
