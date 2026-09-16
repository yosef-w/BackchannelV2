import { Dimensions, StyleSheet } from "react-native";
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
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  benefitText: { fontSize: 14, color: Colors.body, fontWeight: "500" },
  jobSectionText: { fontSize: 14, color: Colors.body, lineHeight: 22 },
});
