# CLAUDE.md

Read this before touching git, GitHub Actions, or anything EAS-related in this repo.

## Full reference

**`docs/CI_CD_PIPELINE.md`** has the complete picture: the branch diagram, why each piece exists, the hotfix runbook, and the OTA rollback commands. Read it before making pipeline changes — the summary below is just enough to not break something by accident.

## The 30-second version

- `develop` → auto-publishes an OTA (JS-only) update to the `preview` channel on every push.
- `main` → auto-publishes an OTA update to the `production` channel on every push, but it **waits for a human approval** in the Actions tab first (GitHub Environment `production`, required reviewer). It does not go out unattended.
- A `v*.*.*` tag → triggers a **real native iOS build and a real TestFlight submission** (also gated behind the same approval). This costs an EAS build credit and produces something real testers can see. Don't push a tag casually or "just to test something."

## Things that will surprise you if you don't know them

- **Squash and rebase merge are disabled repo-wide, on purpose.** Only merge commits are allowed. This is not a preference — it prevents `develop` and `main` from silently diverging (a squashed `develop → main` promotion leaves `main` with a commit `develop` doesn't have). Don't re-enable squash merge without re-reading why in `docs/CI_CD_PIPELINE.md`.
- **Only repo admins can create/delete/move `v*` tags** (enforced by a ruleset, confirmed working — it blocks by default and only an admin's bypass lets it through). If a tag push fails with "creations being restricted," that's this rule, not a bug.
- **`app.json`'s `runtimeVersion.policy` is `"fingerprint"`, not `"appVersion"`.** This means an OTA update only reaches a phone whose installed binary has the exact same native-code fingerprint. This is the safety net that makes auto-publishing OTA updates on every push safe — a native change that should've been a new build simply never gets delivered instead of crashing anything. Don't change this back to `"appVersion"` without understanding you're removing that net.
- **A build only receives OTA updates once it's actually running fingerprint-based versioning.** Builds made before 2026-09-19 (through at least build #30) used the old `appVersion` policy and can never receive any OTA update published after that date — this isn't a bug, the versions just don't match by design. Only builds from #31 onward are on the new system.
- **The release workflow (`release-build.yml`) verifies two things before building anything**: that the tag is actually an ancestor of `main`, and that the tag's version number matches `app.json`'s `"version"`. If either check fails, bump `app.json`'s version and/or retag the right commit — don't try to bypass the check.
- **A hotfix to `main` must be back-merged into `develop` immediately after**, or the next normal promotion can silently overwrite it. See the runbook in `docs/CI_CD_PIPELINE.md`.

## Required secrets (already set as of 2026-09-19)

`EXPO_TOKEN` (Expo robot user), `SENTRY_AUTH_TOKEN` (separate from the one EAS itself uses for native builds — this one is for uploading OTA source maps from GitHub Actions). Both live in GitHub repo secrets, not anywhere in this codebase.
