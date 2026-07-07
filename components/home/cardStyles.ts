import { StyleSheet } from "react-native";

/**
 * Shared style cluster for the Hinge-style profile/job cards rendered by
 * ApplicantProfileCard (sponsor view) and JobCardContent (applicant view)
 * in HomeView. Extracted verbatim — both components render the same
 * visual language (hero, sections, insight cards, timelines, chips) for
 * different data shapes, so the styles were already shared before the
 * split and stay shared now.
 */
export const cardStyles = StyleSheet.create({
  // ── Hero (applicant identity / job identity) ──────────────────────
  hingeHero: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 24,
  },
  hingeHeroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F0F0F0",
  },
  hingeHeroAvatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  hingeHeroAvatarInitial: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFF",
  },
  hingeHeroName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.6,
    marginTop: 16,
    textAlign: "center",
  },
  hingeHeroSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  },
  hingeHeroPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 14,
  },

  // ── "Liked your role" top-of-card pill ────────────────────────────
  likedYourRoleRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
  },

  // ── Section primitives ────────────────────────────────────────────
  hingeDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 4,
  },
  hingeSection: { paddingVertical: 18 },
  hingeSectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#999",
    marginBottom: 10,
  },
  hingeBodyText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
    lineHeight: 23,
  },

  // ── At-a-glance stats strip (sponsor view) ────────────────────────

  // ── Insight Q&A cards — quote-style with vertical accent ──────────
  // White card with a soft drop shadow + thin hairline border for
  // depth (instead of the prior gray-on-gray look that disappeared
  // into the page). A 3px black stripe runs the full height of the
  // left edge as a brand accent — the only color is monochrome, but
  // the stripe gives the card a strong sense of authorship ("here are
  // the applicant's actual words"). A large opening quote mark next
  // to the answer plays the same role typographically.
  hingeInsightCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  hingeInsightAccent: {
    width: 3,
    backgroundColor: "#000",
  },
  hingeInsightBody: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  hingeInsightQuestion: {
    fontSize: 11,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 1.0,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  hingeInsightAnswerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  hingeInsightQuoteMark: {
    fontSize: 36,
    lineHeight: 30,
    fontWeight: "800",
    color: "#000",
    marginRight: 8,
    marginTop: -2,
  },
  hingeInsightAnswer: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#1A1A1A",
    lineHeight: 24,
  },

  // ── Job-brief cards (role-spec insights from the sponsor) ─────────
  // Same depth treatment as the sponsor's quote cards (white bg, soft
  // shadow, hairline border), but a totally different visual rhythm:
  // a dark "header strip" at the top carries the label, then body
  // text below. Reads as a formal documented brief rather than a
  // personal quote — distinct enough at a glance that the user knows
  // this is "what the sponsor wrote ABOUT the role" vs. "what the
  // sponsor said in their own words".
  jobInsightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  jobInsightHeader: {
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  jobInsightHeaderLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  jobInsightBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  jobInsightBodyText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1A1A1A",
    lineHeight: 23,
  },

  // ── Chip wrapping (skills, credentials, role details) ─────────────
  hingeChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hingeSkillChip: {
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  hingeSkillChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A1A",
  },

  // ── Timeline (experience, education) ──────────────────────────────
  hingeTimelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  hingeTimelineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#000",
    marginTop: 7,
  },
  hingeTimelineBody: { flex: 1, minWidth: 0 },
  hingeTimelineTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
  },
  hingeTimelineSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginTop: 2,
  },
  hingeTimelineMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    marginTop: 3,
    letterSpacing: 0.1,
  },
  hingeTimelineDescription: {
    fontSize: 14,
    fontWeight: "500",
    color: "#444",
    lineHeight: 21,
    marginTop: 8,
  },

  // ── Credential blocks (certifications, languages) ─────────────────
  hingeCredentialList: { gap: 12 },
  hingeCredentialBlock: {
    backgroundColor: "#F8F9FB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  hingeCredentialName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#000",
  },
  hingeCredentialMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#777",
    marginTop: 3,
  },

  // ── Status banner (waitlisted / applied / sponsor-requested) ──────
  statusBannerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 4,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBannerText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.4,
  },

  // ── "No sponsor yet" inline block (applicant view) ────────────────
  noSponsorInlineBlock: {
    alignItems: "center",
    backgroundColor: "#F8F9FB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    paddingVertical: 28,
    paddingHorizontal: 20,
  },

  // ── Sponsor zone card (sponsored jobs — distinct section) ─────────
  sponsorZoneOuter: { paddingVertical: 18 },
  sponsorZoneCard: {
    backgroundColor: "#F8F9FB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  sponsorZoneBody: { padding: 16 },
  sponsorZoneDivider: {
    height: 1,
    backgroundColor: "#E8E8E8",
    marginVertical: 16,
  },
  // "SPONSOR INSIGHTS" sub-label — light gray, personal voice
  sponsorZoneQALabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  // "JOB INSIGHTS" sub-label — darker to signal role data vs personal
  sponsorZoneJobLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#444",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // ── Meet your sponsor inline block ────────────────────────────────
  sponsorMeetInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  sponsorMeetAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0F0F0",
  },
  sponsorMeetAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  sponsorMeetAvatarInitial: {
    fontSize: 21,
    fontWeight: "800",
    color: "#FFF",
  },
  sponsorMeetName: {
    fontSize: 19,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.3,
  },
  sponsorMeetRole: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
    marginTop: 2,
  },

  // ── Centered-profile card front face (redesign) ──
  // Circular avatar + centered identity + centered fact pills, with a
  // left-aligned ABOUT block below. Shared by the sponsor view (applicant
  // profile cards) and the applicant view (job cards).
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  // PR #56 — "Liked your role" badge at the top of a sponsor's profile-pack
  // card. Black accent pill so it visually anchors the high-conviction
  // signal above the neutral hero block.
  likedYourRolePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 5,
    backgroundColor: "#000",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  likedYourRolePillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.8,
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    letterSpacing: -0.1,
  },
  // Accent pill — used for the AI-match score. Black so it stands apart
  // from the neutral fact pills.
  heroPillAccent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#000",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroPillAccentText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: -0.1,
  },
  // Sponsorship status pill (job cards only).
  heroStatusSponsored: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#000",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 10,
  },
  heroStatusSponsoredText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.2,
  },
  heroStatusMuted: {
    backgroundColor: "#F2F2F2",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 10,
  },
  heroStatusMutedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 0.2,
  },

  // ── Referral Check-in Banner ───────────────────────────────────────────────
  canReferTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8FBEF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  canReferTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#00CB54",
    letterSpacing: 0.2,
  },
  benefitsList: { gap: 10, marginTop: 8 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  benefitText: { fontSize: 14, color: "#555", flex: 1 },

  // JOB CARD SPECIFIC STYLES

  // Non-Sponsored Back Design
  // Small centered kicker label at the top of the back faces.
  // Non-sponsored back — centered "no sponsor yet" status block.
  // About-the-company blurb beneath the no-sponsor status block.
  noSponsorIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  noSponsorHeadline: {
    fontSize: 17,
    fontWeight: "800",
    color: "#000",
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  noSponsorSubtext: {
    fontSize: 14,
    fontWeight: "500",
    color: "#777",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },

  // Relevance badge & requirements summary
  roleDetailChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  roleDetailChipText: {
    fontSize: 13,
    color: "#000",
    fontWeight: "500" as const,
  },

  // "View original posting" row — shows the sponsor's pasted domain
  // (subdomain and all) as a legibility/trust signal, tappable to open the
  // real posting. See BACKEND_CHANGES_NEEDED.md §O.
  originalPostingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: 4,
  },
  originalPostingText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500" as const,
  },
});
