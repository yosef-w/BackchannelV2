import { StyleSheet } from "react-native";

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
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  createModalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 32,
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
  modalMainTitle: { fontSize: 24, fontWeight: "800", color: "#000" },
  modalSubTitle: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 32,
  },
  closeButton: { padding: 4 },
  confirmBtn: {
    backgroundColor: "#000",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    width: "100%",
  },
  confirmBtnDisabled: { backgroundColor: "#E5E5E5" },
  confirmBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  insightsStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  insightsStepLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999",
    marginLeft: 4,
  },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E5E5E5" },
  stepDotActive: { backgroundColor: "#000", width: 24 },});
