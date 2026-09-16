import { Dimensions, Platform, StyleSheet } from "react-native";
import { Colors, Radii } from "@/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * Shared style vocabulary for the "role/job preview" modals on the Matches
 * screen — job detail, referral detail, waitlisted-job detail, and the
 * sponsor-request flow all render the same hero/comp-strip/detail-section/
 * sponsor-card visual language. Centralized here (rather than duplicated
 * per modal file) so that language stays visually consistent as each modal
 * gets extracted out of MatchesView.tsx.
 */
export const modalStyles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    // Gripper hugs the sheet edge (PM: it floated too far down) —
    // 12 matches the sheets that already looked right.
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 40,
    // Sheet sizes to its content; only grows to fill (and scroll) when the
    // content is taller than this cap — no empty whitespace for short modals.
    // Absolute px (not "88%") so it doesn't depend on a parent with a fixed
    // height — the GestureHandlerRootView wrapper inside DismissibleSheet is
    // content-sized, and a % maxHeight against it would collapse to nothing.
    maxHeight: SCREEN_HEIGHT * 0.88,
  },
  /**
   * Fixed-height variant for the enrichment-backed detail sheets (job,
   * referral, SR job). Those open with basics + a skeleton and grow when
   * the full posting lands — and a content-sized sheet repeatedly failed
   * to re-clamp/scroll after that growth ("the modal is stuck"). A fixed
   * height sidesteps the growth relayout entirely: the sheet presents
   * full-height from the first frame (standard detail-sheet behavior),
   * the skeleton breathes in the space, and the scroll area is stable.
   * Merge AFTER modalContent + canvasSheet.
   */
  modalContentTall: {
    height: SCREEN_HEIGHT * 0.88,
  },
  applyBtnLarge: {
    backgroundColor: Colors.ink,
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyBtnLargeText: { color: Colors.paper, fontSize: 16, fontWeight: "800" },
  detailSection: {
    backgroundColor: Colors.paper,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.surface,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: Colors.ink,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 15,
      },
      android: { elevation: 4 },
    }),
  },
  detailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  detailSectionTitle: {
    fontWeight: "800",
    fontSize: 13,
    textTransform: "uppercase",
    color: Colors.ink,
    letterSpacing: 0.8,
  },
  jobDetailText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 21,
  },
  jobModalCompCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  jobModalCompCellBorder: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  jobModalCompLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: Colors.faint,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  jobModalCompStrip: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 18,
    marginBottom: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  jobModalCompValue: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.ink,
  },
  jobModalHero: {
    alignItems: "center",
    marginBottom: 24,
  },
  jobModalHeroCompany: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
  jobModalHeroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  jobModalLikedDate: {
    fontSize: 12,
    color: Colors.faint,
    fontWeight: "600",
  },
  jobModalLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  jobModalLocationText: {
    fontSize: 13,
    color: Colors.muted,
    fontWeight: "500",
  },
  jobModalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  jobRemoteBadge: {
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  jobRemoteText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.ink,
  },
  jobSection: { marginBottom: 24 },
  jobSectionText: { fontSize: 14, color: "#555", lineHeight: 22 },
  jobSectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.ink,
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  jobSponsorInitialAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  jobSponsorInitialText: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.paper,
  },
  roleDetailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roleDetailChipText: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  sponsorCardAvatar: { width: 40, height: 40, borderRadius: 20 },
  sponsorCardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  sponsorCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  sponsorCardName: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  sponsorCardRole: {
    fontSize: 12,
    color: Colors.body,
    fontWeight: "600",
    marginTop: 2,
  },
  sponsorCardTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.ink,
    textTransform: "uppercase",
  },
  sponsorInfoCard: {
    backgroundColor: "#F8F9FB",
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  benefitText: { fontSize: 14, color: "#555", fontWeight: "500" },
  jobDetailCard: {
    backgroundColor: "#FAFAFA",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  jobMatchedSponsorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  jobMatchedSponsorText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.ink,
  },
  jobModalMatchedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  jobModalMatchedText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.ink,
  },
  jobModalPendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  jobModalPendingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.muted,
  },
});
