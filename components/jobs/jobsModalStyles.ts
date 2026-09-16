import { StyleSheet } from "react-native";
import { Colors, Radii } from "@/constants/theme";

/**
 * Shared style vocabulary for the Jobs-screen modals — the sponsor-job
 * wizard, create-from-URL flow, job menu, job details, top-applicants list,
 * and sponsor gate all render the same bottom-sheet shell (overlay, rounded
 * content card, header + close button, black confirm button, step dots).
 * Centralized here so the shell stays visually consistent as each modal
 * gets extracted out of JobsView.tsx.
 */
export const jobsModalStyles = StyleSheet.create({
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
    maxHeight: "90%",
  },
  createModalContent: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    // Gripper hugs the sheet edge (PM: it floated too far down) —
    // 12 matches the sheets that already looked right.
    paddingTop: 12,
    paddingHorizontal: 32,
    paddingBottom: 40,
    width: "100%",
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalMainTitle: { fontSize: 24, fontWeight: "800", color: Colors.ink },
  modalSubTitle: {
    fontSize: 14,
    color: Colors.body,
    lineHeight: 20,
    marginBottom: 32,
  },
  closeButton: { padding: 4 },
  confirmBtn: {
    backgroundColor: Colors.ink,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    width: "100%",
  },
  confirmBtnDisabled: { backgroundColor: Colors.border },
  confirmBtnText: { color: Colors.paper, fontSize: 16, fontWeight: "700" },
  insightsStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  insightsStepLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.muted,
    marginLeft: 4,
  },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.ink, width: 24 },});
