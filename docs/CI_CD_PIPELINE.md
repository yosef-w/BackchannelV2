# CI/CD Pipeline — Branches, OTA Updates, and Releases

**Last updated:** 2026-09-19
**Status:** live and verified. `EXPO_TOKEN` is set, branch protection and the production approval gate are on, and the `develop → preview` path has run successfully multiple times in production. One account-level step remains (`SENTRY_AUTH_TOKEN`, Part 1 below) and one important transition caveat applies to everyone reading this (read that first).

---

## Read this before your first tag: OTA is inert until the next real build

Every currently-installed build of this app (all TestFlight builds through at least #30) was built under the old `appVersion` runtime policy and identifies itself as runtime `1.0.0`. Every OTA update this pipeline now publishes carries a `fingerprint`-based runtime version instead — a hash of the native code. **These don't match**, so by design, no OTA update reaches any phone that has the app installed today. This isn't a bug; it's the fingerprint safety net doing its job (see below) — but it means the OTA half of this pipeline has nothing to actually deliver to until:

1. A new native build ships (a `v*` tag, or a Build Preview run) with the fingerprint policy baked in, and
2. Someone actually installs that build.

From that point on, OTA updates work exactly as described below. Treat the **first tag build** as the real "OTA goes live" moment, not the day these workflows were merged.

Related: as of this writing, there has never been a `preview`-profile build (only `production`-profile TestFlight builds exist), so the `preview` channel currently has zero subscribers. Run **Build Preview** (Actions tab → Run workflow) to create one and hand it to testers before expecting `develop`'s auto-published updates to reach anybody.

---

## The shape of it

```
develop  ──push──▶  CI (typecheck/lint/test)  ──▶  OTA update + source maps  ──▶  "preview" channel
                                                                                    (internal testers)

main     ──push──▶  CI (typecheck/lint/test)  ──▶  OTA update + source maps  ──▶  "production" channel
                                                     (waits for your approval                (real users)
                                                      in the Actions tab)

v1.2.3 tag ──push──▶  CI + tag/version checks  ──▶  new iOS build  ──▶  auto-submit  ──▶  TestFlight
                                                                                          (you promote to the
                                                                                           App Store manually)

Actions tab, on demand ──▶  CI  ──▶  new "preview"-profile build  ──▶  internal distribution link
```

Two different things can happen when code lands on `develop` or `main`, and they're deliberately separate:

- **Every push** publishes an **OTA (over-the-air) update** — JavaScript and asset changes only, reaches phones in seconds, no App Store review. This is the fast path, and it's automatic.
- **Only a version tag** (`v1.2.3`) triggers a **new native build** — needed when native code changed (a new library, a permission, an icon). Slower, costs a build, and for production ends with Apple's review. This is deliberately *not* automatic on every merge — someone has to decide "this is a release."

## Why this is safe even if someone forgets to tag a native change

`app.json`'s `runtimeVersion.policy` is `"fingerprint"`. Expo computes a hash of your native code (dependencies, config plugins, native project files) and stamps every build and every OTA update with it. An update only ever reaches a phone whose installed binary has the *exact same* native fingerprint.

Concretely: if someone adds a native library and forgets that this needs a new build, and an OTA update still gets pushed to `main`, **nothing breaks** — that update's fingerprint won't match any installed binary's fingerprint, so it's silently never delivered, instead of crashing every phone that received it. This is the single biggest safety net in this whole setup.

## What each branch is for

| Branch | CI runs | OTA channel | Who sees it |
|---|---|---|---|
| Pull requests | typecheck, lint, test | — | nobody (gate to merge) |
| `develop` | typecheck, lint, test | `preview` | internal testers (once a preview build exists — see above) |
| `main` | typecheck, lint, test | `production` | real users (behind an approval gate) |

There is no separate `preview` *branch* — `develop` publishes to the `preview` *channel*. Branches are for code; channels are for which update a build listens for.

**Merging `develop → main` must use a merge commit, never squash or rebase** — this is enforced at the repo level now (squash/rebase merge are disabled entirely), specifically because a squashed promotion would leave `main` with a commit `develop` doesn't have, and the two branches would start silently diverging. Squash is still fine for a short-lived feature branch merging into `develop`; the setting is repo-wide because GitHub has no per-target-branch merge-method control, so "always merge commit" was the only way to make the unsafe option actually unavailable rather than just documented against.

## How to cut a release

1. Bump `"version"` in `app.json` to match the release you're about to tag (the release workflow checks this and will refuse to build if they don't match).
2. Merge whatever you want to ship into `main` (it'll auto-publish as an OTA update immediately if it's JS-only, pending your approval in the Actions tab).
3. When you're ready for a real App Store release — including any native change — tag the commit **that is on `main`**:
   ```
   git tag v1.2.3
   git push origin v1.2.3
   ```
   Only repo admins can create/delete/move `v*` tags (enforced by a ruleset) — this isn't about trust, it's about making sure a release can't be accidentally cut from the wrong branch by anyone still learning the flow.
4. The workflow verifies the tag is actually on `main` and that its version matches `app.json` before doing anything else, then builds the iOS binary on EAS's infrastructure and auto-submits it to TestFlight. The GitHub Actions run waits for the whole thing (build + submit) and will show failed, not just "started," if either step fails — watch it in the Actions tab or at [expo.dev](https://expo.dev).
5. Test the TestFlight build. When it's good, promote **that exact build** to the App Store in App Store Connect — don't cut a new build for the store release. What testers verified in TestFlight should be byte-for-byte what ships.
6. Releasing to the public in App Store Connect stays a manual click, on purpose — Apple review timing isn't in your control, and a phased rollout (1% → 10% → 100%) lets you halt a bad release before it reaches everyone.

## Building a preview (internal test) build

Nothing publishes a `preview`-profile build automatically — that's intentional (a build is expensive; you decide when testers need a new one). To cut one: **Actions tab → Build Preview → Run workflow**, pick the branch, run it. It builds and waits, so a failure shows up in the Actions tab rather than only at expo.dev.

## Hotfixing production

A broken `main` needs two things done, not one:

1. **Branch off `main`** (not `develop`), fix it, PR it into `main` directly — branch protection allows a PR from any branch into `main`, it doesn't require the source to be `develop`.
2. **Immediately back-merge `main` into `develop`** after the hotfix lands. If you skip this, the fix only exists on `main`, and the next normal `develop → main` promotion can silently overwrite it — nobody will notice until the bug reappears.
   ```
   git checkout develop
   git merge main
   git push origin develop
   ```

## Rolling back a bad OTA update

If a published update turns out to be broken, you have two options, both faster than a new build:

- **Republish the previous good update** to the same channel:
  ```
  eas update:list --branch production        # find the last-known-good group ID
  eas update:republish --group <group-id>
  ```
- **Roll every device back to the build's originally-embedded JS** (nuclear option — undoes every OTA update ever published to that channel, not just the last one):
  ```
  eas update:roll-back-to-embedded --branch production
  ```

There is no rollback for a bad **native** build already in the App Store beyond the standard App Store Connect flow (pull the release / expedited review for a new one) — OTA can't fix native code.

---

## Part 1 — Required: Sentry source maps for OTA updates (~5 min)

Native builds already upload their own source maps automatically. OTA updates are a separate JS bundle and need their own upload, or a crash from an OTA-updated app shows up in Sentry minified and unreadable.

1. Go to Sentry → your organization's **Settings → Auth Tokens** (or **Developer Settings → Auth Tokens**, depending on Sentry's current layout).
2. Create a new token with at least the `project:releases` scope (needed to upload source maps).
3. In GitHub: repo → **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `SENTRY_AUTH_TOKEN` (exact name)
   - Value: the token from step 2
4. Done — the next push to `develop` or `main` will upload matching source maps automatically. Org/project are already read from `app.json`'s Sentry plugin config; only the token was missing.

## Already done (kept here for reference)

- **`EXPO_TOKEN`** — a robot-user Expo access token, stored as a repo secret. Without it the workflows can't authenticate to EAS at all.
- **Production approval gate** — the `production` GitHub Environment exists with a required reviewer. A push to `main` queues the OTA update and waits for approval in the Actions tab before it reaches real users.
- **Branch protection on `main`** — requires the `checks` status check to pass and a PR to merge; enforced for admins too, so there's no "just this once" direct push.
- **Tag protection** — only repo admins can create, delete, or move `v*` tags.
- **Merge-commit-only** — squash and rebase merge are disabled repo-wide (see "What each branch is for" above for why).

---

## Things that are still manual on purpose

- **App Store release** — always a human click in App Store Connect.
- **Native/version-bump builds** — always a deliberate tag push, never automatic.
- **Back-merging a hotfix from `main` into `develop`** — nothing automates this; see "Hotfixing production" above.
- **RevenueCat production keys** — still sandbox `test_` keys as of this writing; swap for live keys before the first real App Store submission (unrelated to this pipeline, but easy to forget once releases start feeling automatic).

## Known limitations, not yet addressed

- **Two app launches to see an OTA update.** `app.json`'s `checkAutomatically: "ON_LOAD"` downloads a new update in the background on launch, but applies it on the *next* launch, not the current session. Don't expect a tester to see a fix by force-quitting and reopening once — it takes two opens.
- **Android has no release path yet** — `release-build.yml` and `build-preview.yml` are iOS-only, matching how this app has shipped so far. Add a parallel `--platform android` job if/when Android distribution starts.
- **Solo-developer defaults on approvals.** `required_approving_review_count` is 0 (a PR just needs to exist and pass CI, not get a second person's sign-off) and the production environment's reviewer can approve their own deployment. Both are correct for one person; raise the review count and turn on `prevent_self_review` the moment a second engineer joins.
- **The `EXPO_TOKEN` robot has account-wide access**, not scoped to just this project — fine on a personal account with one project, worth revisiting if more Expo projects are added under this account later.
