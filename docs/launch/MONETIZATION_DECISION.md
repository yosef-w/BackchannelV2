# When to turn Premium on

`PREMIUM_ENABLED` is `false`. Everything is built and tested (own checkout, plan picker,
held likes, restore, daily cap, free first sponsor request). This is a **business
decision, not an engineering one**. Here is how I'd frame it.

## What Premium sells today (be honest about this)

| Side | Free | Premium |
|---|---|---|
| Applicant | 2 interests/day, 1 free sponsor request | 5 interests/day, marketplace actions |
| Sponsor | Uncapped (never asked to pay) | n/a |

What it does **not** sell yet: more cards per day (still 10 for everyone). A bigger deck
needs the backend work in `docs/BACKEND_CHANGES_NEEDED.md` §Y.

So Premium today is "send 3 more expressions of interest a day, and act in the
marketplace." That is a thin promise. It is fine for a soft launch. It is not enough to
carry a subscription at scale.

## The core tension

A marketplace's scarce resource is **liquidity** (enough sponsors that an applicant's
interest lands on someone who responds). Charging the *demand* side (applicants) before
the *supply* side (sponsors) is dense enough means people pay to send interest into a
void. They churn, and they leave 1-star reviews that say "paid and nothing happened."

## Three options

### A. Launch free, turn Premium on after liquidity (recommended)
- Ship v1.0 with `PREMIUM_ENABLED = false`. Nothing to explain to App Review.
- Watch the liquidity metrics in `docs/ops/ACTIVATION_FUNNEL.md`. Flip Premium when
  **all** of these hold for a few consecutive weeks (these are starting hypotheses, not
  benchmarks; set your own from real data):
  - a healthy share of applicant interests reach a *verified* sponsor,
  - median time-to-first-match is short enough that a paying user sees value in days,
  - deck-exhaustion rate shows people actually hit the free cap (otherwise there is
    nothing to sell).
- Flipping needs an app release today (`PREMIUM_ENABLED` is a compile-time constant).
  The remote-config `flags` channel (§AB) can make this a server switch later. That is a
  reason to land §AB early.
- **Risk:** you learn nothing about willingness to pay until later.

### B. Launch with Premium on
- Learns willingness-to-pay immediately and starts revenue.
- **Risks:** the App Review surface grows (3.1.x subscription disclosure, restore,
  sandbox testing all become reviewable), the deck may be thin at launch, and the
  premium promise is currently modest. Also requires the RevenueCat products,
  offerings and the App Store Connect subscription group to be fully configured and
  *submitted with the build*.

### C. Free launch, but seed monetization learning
- Keep Premium off, but add a **"Notify me about Premium"** interest capture (or show the
  plan sheet with a waitlist) to measure demand without charging.
- Cheapest way to get a willingness-to-pay signal with no App Review or refund risk.

## What must be true before flipping it on (checklist)
- [ ] RevenueCat: entitlement `Backchannel Pro`, an offering with the intended packages,
      API key in the production EAS env (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`).
- [ ] App Store Connect: subscription group + products approved, with localized
      display names/descriptions, price tiers, and screenshot for review.
- [ ] Manually verify in a **sandbox build**: purchase, restore after reinstall,
      cancel via Manage Subscription, the renewal disclosure text, and that every paywall
      has a working close control (Apple tests these).
- [ ] Backend entitlement verification (§V / §Y prerequisite). Without it, a modified
      client can fake Premium. Acceptable for a soft launch, not for scale.
- [ ] Privacy manifest / policy mention purchases (the manifest already declares
      PurchaseHistory; confirm the policy text matches).
- [ ] A support answer for "I paid and lost access" (Restore, then email support).

## Pricing (things to decide, not recommendations from data I don't have)
I have no market data here, so I am deliberately not naming a price. Decide:
monthly vs. weekly (job seekers are short-term users, so a **1-month or "until I'm hired"**
plan often fits better than an annual one), whether a lifetime plan makes sense, and
whether to offer a student/new-grad discount (a large share of your applicants).
Test prices with RevenueCat Experiments once real traffic exists.

## Recommendation
**Option A, with C layered on.** Land §AB (remote flags) so the switch is server-side,
launch free, instrument liquidity, and revisit in 4 to 6 weeks with real numbers.
