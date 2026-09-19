# CI/CD Pipeline — Branches, OTA Updates, and Releases

**Last updated:** 2026-09-19
**Code side:** done — branches, workflows, EAS channels, and the safer runtime-version policy are all in place. What's left is three account-level steps in GitHub (below), each a few minutes.

---

## The shape of it

```
develop  ──push──▶  CI (typecheck/lint/test)  ──▶  OTA update  ──▶  "preview" channel
                                                                     (internal/TestFlight testers)

main     ──push──▶  CI (typecheck/lint/test)  ──▶  OTA update  ──▶  "production" channel
                                                    (behind a required-approval gate,        (real users)
                                                     once you turn that on — see Part 2)

v1.2.3 tag ──push──▶  CI  ──▶  new iOS build  ──▶  auto-submit  ──▶  TestFlight
                                                                     (you promote to the
                                                                      App Store manually)
```

Two different things can happen when code lands on `develop` or `main`, and they're deliberately separate:

- **Every push** publishes an **OTA (over-the-air) update** — JavaScript and asset changes only, reaches phones in seconds, no App Store review. This is the fast path, and it's automatic.
- **Only a version tag** (`v1.2.3`) triggers a **new native build** — needed when native code changed (a new library, a permission, an icon). Slower, costs a build, and for production ends with Apple's review. This is deliberately *not* automatic on every merge — someone has to decide "this is a release."

## Why this is safe even if someone forgets to tag a native change

`app.json`'s `runtimeVersion.policy` is now `"fingerprint"` instead of `"appVersion"`. Expo computes a hash of your native code (dependencies, config plugins, native project files) and stamps every build and every OTA update with it. An update only ever reaches a phone whose installed binary has the *exact same* native fingerprint.

Concretely: if someone adds a native library and forgets that this needs a new build, and an OTA update still gets pushed to `main`, **nothing breaks** — that update's fingerprint won't match any installed binary's fingerprint, so it's silently never delivered, instead of crashing every phone that received it. This is the single biggest safety net in this whole setup, and it's why it was worth doing before turning any of this on.

## What each branch is for

| Branch | CI runs | OTA channel | Who sees it |
|---|---|---|---|
| Pull requests | typecheck, lint, test | — | nobody (gate to merge) |
| `develop` | typecheck, lint, test | `preview` | internal/TestFlight testers |
| `main` | typecheck, lint, test | `production` | real users |

There is no separate `preview` *branch* — `develop` publishes to the `preview` *channel*. Branches are for code; channels are for which update a build listens for.

## How to cut a release

1. Merge whatever you want to ship into `main` (it'll auto-publish as an OTA update immediately if it's JS-only).
2. When you're ready for a real App Store release — including any native change — tag it:
   ```
   git tag v1.2.3
   git push origin v1.2.3
   ```
3. GitHub Actions builds the iOS binary on EAS's infrastructure and auto-submits it to TestFlight. Watch progress at [expo.dev](https://expo.dev).
4. Test the TestFlight build. When it's good, promote **that exact build** to the App Store in App Store Connect — don't cut a new build for the store release. What testers verified in TestFlight should be byte-for-byte what ships.
5. Releasing to the public in App Store Connect stays a manual click, on purpose — Apple review timing isn't in your control, and a phased rollout (1% → 10% → 100%) lets you halt a bad release before it reaches everyone.

---

## Part 1 — Required: let CI actually publish updates (~5 min)

The workflows exist but can't authenticate to EAS yet.

1. Go to [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens).
2. Prefer creating a **robot user** for this (Account Settings → Members → Robots → "+ Create robot"), then generate an access token for that robot and give it access to this project. A robot token means CI access doesn't depend on any one person's Expo account, and can be scoped/revoked independently. A personal access token works too if you want to move faster now and switch to a robot later.
3. In GitHub: repo → **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `EXPO_TOKEN` (exact name — the workflows and the `expo/expo-github-action` action both read this specific name)
   - Value: the token from step 2
4. Done. The next push to `develop` or `main` will actually publish.

## Part 2 — Recommended: require a human approval before production OTA updates (~3 min)

Right now `ota-production.yml` references a GitHub Environment called `production`, but that environment has no protection rules yet — so it runs unattended. To make every production OTA update pause for a manual approval first:

1. Repo → **Settings → Environments → New environment** → name it exactly `production`.
2. Under **Deployment protection rules**, check **Required reviewers** and add yourself (and anyone else who should sign off).
3. Save.

After this, a push to `main` will queue the OTA update and wait — you'll get a notification to approve it in the Actions tab before it actually reaches real users. This is the closest thing this pipeline has to a manual "release" button for JS-only changes, and it's the one gate I'd recommend keeping even once you fully trust the pipeline.

## Part 3 — Recommended: protect `main` (~2 min)

So nobody (including future-you, by accident) can push straight to `main` without CI passing:

1. Repo → **Settings → Branches → Add branch protection rule**.
2. Branch name pattern: `main`.
3. Check **Require a pull request before merging** and **Require status checks to pass before merging** — select the `CI / checks` job.
4. Save.

From then on, the flow is: branch off `develop`, open a PR into `develop` (or `main` for a hotfix), CI has to go green, then merge.

---

## Things that are still manual on purpose

- **App Store release** — always a human click in App Store Connect (see step 5 above).
- **Native/version-bump builds** — always a deliberate tag push, never automatic.
- **RevenueCat production keys** — still sandbox `test_` keys as of this writing; swap for live keys before the first real App Store submission (unrelated to this pipeline, but easy to forget once releases start feeling automatic).
