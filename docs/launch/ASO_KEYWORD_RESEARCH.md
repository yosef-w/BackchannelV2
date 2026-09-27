# ASO Keyword Research and Strategy

## Data limitation (read first)

This document was written without access to live App Store search-volume, popularity, or difficulty data. Nothing here states a search volume, a ranking, a difficulty score, or a competitor's download numbers, and any such number should be treated as invented. Every place where a number would be needed is marked **to verify in AppTweak / Sensor Tower / Apple Search Ads (Search Popularity in ASA Advanced) / App Store Connect Analytics**.

Method: hypotheses come from the product's real vocabulary and from how people describe the job. Validation must come from a tool, and from your own Search Ads and Analytics data once you have impressions.

## How the fields work (the constraints)

- Name (30), subtitle (30), and the keyword field (100) are indexed. The description is not indexed for iOS search.
- Apple combines terms across those three fields, so you can spend a word once.
- Singulars and plurals are generally treated together; **verify in a tool.**
- Don't include competitor names or trademarks. Don't waste characters on "app", "free", "best".
- Current picks are in `APP_STORE_LISTING.md`. Name: `BackChannel: Job Referrals`. Subtitle: `Get referred by insiders`.

## Seed terms

Product vocabulary: referral, refer, referred, employee referral, job referral, referral marketplace, vouch, sponsor, applicant, insider, backchannel, warm intro, introduction.

Job-search vocabulary: job, jobs, job search, hiring, get hired, apply, resume, interview, opportunities, internship, new grad, entry level, career change.

Networking vocabulary: networking, career networking, professional network, mentor, connections, recruiter, hiring manager.

## Intent clusters

For each cluster: the searcher's mind, candidate terms, current coverage, and a verdict to test. Volume and difficulty for every row: **to verify in AppTweak / Sensor Tower / Apple Search Ads.**

| Cluster | Searcher intent | Candidate terms | Covered by | Notes and risk |
|---|---|---|---|---|
| Job referral | "I want a referral to a company" | job referral, referral, referrals, refer | name (`job`, `referrals`), subtitle (`referred`) | Closest match to the product; likely lower volume than generic job search but higher intent. Verify. |
| Employee referral | Employees looking to refer, or applicants who know the term | employee referral, employee | keyword `employee` + name `referrals` | Sponsors are a supply target; this cluster may serve sponsors better than applicants. |
| Career networking | People wanting professional connections | career networking, networking, professional connections, mentor | keywords `career`, `networking` | Crowded with big networks. A long-tail play. Verify difficulty. |
| Get hired | Job seekers with high urgency | get hired, hiring, job search, job openings, apply | subtitle `get`, keyword `hiring`; name `job` | Very competitive, dominated by large job boards. Winning here early is unlikely; use it for incidental reach. |
| Referral marketplace | Category-defining term | referral marketplace, marketplace | none | Unlikely to be searched; treat as brand or positioning language, not keyword field content. Verify. |
| Role-specific and audience | New grad, intern, career changer | internship, new grad, graduate, student, resume | keywords `resume`; alternates in listing doc | Good test for campus push. |
| Brand | People who heard the name | backchannel, back channel | name | Check "back channel" as two words: some people will type that. **Verify whether the space variant is treated identically.** |

## Competitor set to check

Do the same audit for each; record findings in a shared sheet with the date.

For every listing check: title and subtitle wording, primary and secondary category, first three screenshots and their captions, whether an App Preview leads, the icon style, rating count and average, recency of the last update, "What's New" tone, in-app events, which keywords appear in the description (a hint of the intended terms), and which other apps Apple shows under "You Might Also Like".

| Competitor | What to look at specifically |
|---|---|
| LinkedIn | The category leader for job and networking. Title/subtitle terms it owns; you will not out-rank it on generic terms. Look at how it words "jobs" vs. "network"; identify which long-tail terms it leaves open. |
| Blind / Teamblind | Anonymous workplace community; check the category (Social Networking?), how it frames verified-employee trust (closest to your sponsor verification story), and its review complaints about moderation. |
| Handshake | Campus and early career. Study how it speaks to students and which school-related terms it uses; sets the bar for the campus angle. |
| Wellfound (formerly AngelList Talent) | Startup jobs. Note direct-apply framing, screenshots, and how it explains its two sides. |
| Otta / Welcome to the Jungle | Curated, swipe-adjacent job matching with a design-forward listing. Closest on visual and editorial tone; examine the screenshot style and caption length. **Verify the current app name and status.** |
| Refer.me | Direct referral competitor if it is live. **Verify it still exists and how it is listed**; study its promise, pricing framing (do not copy), and reviews about referral quality. |
| Lunchclub-style apps | Introduction-matching apps. Note how they describe "matches" and trust, and how they handle two-sided onboarding. **Verify which are still active.** |
| Others to add after searching | Search your own target terms ("job referral", "employee referral", "get referred") and add the top 5 to 10 apps that actually appear. Also check Indeed, Glassdoor, Jobright-style AI job apps for the generic terms. |

The point isn't to copy. Find (1) terms nobody in the top results uses, (2) claims that all competitors make and you can avoid, and (3) complaints in their reviews that your design answers, without promising what you don't do.

## Process for building the final keyword list

1. Put the seed terms and the competitor-derived terms into a spreadsheet.
2. For each: volume/popularity, difficulty, and current rank, all **to verify in AppTweak / Sensor Tower / Apple Search Ads.**
3. Score each term for relevance yourself (0 to 3): does the app truly do what someone searching this wants? Drop relevance-0 terms regardless of volume.
4. Choose terms with high relevance and tolerable difficulty. Prefer terms where you could plausibly land in the top 10, not terms you'd rank 200th for.
5. Fit into 30 + 30 + 100 characters without repeating words.
6. Ship, wait at least 2 to 4 weeks for indexing and data (Apple shows results with a lag), and measure before changing.
7. Run an Apple Search Ads Discovery campaign with a small budget to discover real search terms and relative Popularity. Treat ASA as a measurement tool, not just an acquisition one.

## Monthly ASO iteration checklist

Do this once a month, on the same day. Change one thing per cycle where possible, so you can attribute effects.

- [ ] Pull App Store Connect Analytics: impressions, product page views, conversion rate, downloads, and sources (search, browse, referral, web). Record in a sheet.
- [ ] Review Search Ads / tool rank for the 20 tracked keywords. Note gains and losses. (Numbers come from the tool, not from this document.)
- [ ] Check ratings and reviews; reply to every review that mentions a bug or safety concern. Check the rating prompt is behaving (`lib/ratingPrompt.ts`).
- [ ] Look at search terms in Search Ads for terms you didn't target. Add good ones to the keyword field; remove those with impressions but no conversions.
- [ ] Re-audit the top 3 to 5 competitors' listings for changes (title, screenshots, previews).
- [ ] Replace the weakest 1 to 3 keywords in the 100-char field; recount characters (must be <=100, no spaces after commas).
- [ ] Update the promotional text (no review needed) to reflect the current focus (a campus push, a new city, a new feature).
- [ ] Review the screenshots. Start or check a Product Page Optimization test (see `SCREENSHOT_PLAN.md`); note the winner and the confidence level.
- [ ] Update "What's New" with each release: specific, human, no filler.
- [ ] Localization: consider adding a listing in a second locale only once the English one has a baseline, and only where you can support users in that language. (Note: keywords in other English locales such as UK or Canada can add indexed terms for the same app; **verify in a tool.**)
- [ ] Check in-app events and custom product pages (Apple Search Ads and campaigns can point to different pages): create one page per audience (students, employees) when you have a campaign that needs it.
- [ ] Log every change and the date in a changelog, so later results can be tied to the cause.
- [ ] Confirm every claim in the listing is still true (24-hour moderation, verification, any feature named).

## Reminders specific to this app

- Premium is off. Don't add "free" or price terms; when it's re-enabled, re-do the listing and the age and privacy answers.
- The brand word "BackChannel" has no search meaning until people know it; the descriptive name carries early discovery, and the brand takes over later. Revisit the name field once branded searches show up in Analytics.
- Two-sided app: sponsors search different words (for example "employee referral", "refer someone", "hiring") than applicants (for example "get hired", "job search"). Consider a custom product page and Apple Search Ads ad group for each.
