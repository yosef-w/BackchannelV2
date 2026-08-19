import { Platform, StyleSheet } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

/**
 * Style cluster for ThreadScreen — 2026-08 Correspondence rebrand: the
 * chat sits on paper with hairline rules; your bubbles are ink, theirs
 * are the surface tint; the person's name goes serif (names are
 * headline-tier); day headers become caps eyebrows; the gray-recess
 * buttons become flat letterpress (paper + hairline).
 */
export const threadScreenStyles = StyleSheet.create({
  startersHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  startersHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 1,
  },
  startersList: {
    width: "100%",
    gap: 8,
  },
  starterChip: {
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  starterChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.ink,
    textAlign: "left",
  },

  closedNotice: {
    backgroundColor: Colors.offWhite,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: "center",
  },
  closedNoticeText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 19,
  },
  referralNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  referralNudgeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  referralNudgeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.ink,
  },
  referralNudgeSubtitle: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 1,
  },
  chatContainer: { flex: 1, backgroundColor: Colors.paper },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerIdentity: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 8,
  },
  // Square ID tile, matching the dossier language everywhere else.
  headerImage: { width: 40, height: 40, borderRadius: 12 },
  headerInfo: { marginLeft: 12, flex: 1, minWidth: 0 },
  // A person's name is headline-tier — serif.
  headerName: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    color: Colors.ink,
    letterSpacing: -0.2,
  },
  headerRole: { fontSize: 12, color: Colors.body, marginTop: 1 },
  // Flat letterpress buttons — paper + hairline, no gray recess.
  headerReferBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  headerReferText: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  headerReferTextDone: { color: Colors.ink },
  messagesScroll: { flex: 1, paddingHorizontal: 20 },
  // Spacing between messages lives on each messageWrapper (via an inline
  // marginTop) rather than a container gap, so clustered messages from the
  // same sender can sit tight while cluster boundaries keep the full gap.
  messagesContent: { paddingTop: 20, paddingBottom: 28 },
  messageWrapper: { maxWidth: "85%" },
  msgLeft: { alignSelf: "flex-start" },
  msgRight: { alignSelf: "flex-end" },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleMe: { backgroundColor: Colors.ink },
  bubbleThem: {
    backgroundColor: Colors.surface,
  },
  // Within a cluster, the corners facing the adjacent bubble tighten so the
  // run reads as one grouped exchange.
  bubbleClusterTopMe: { borderTopRightRadius: 6 },
  bubbleClusterTopThem: { borderTopLeftRadius: 6 },
  bubbleClusterBottomMe: { borderBottomRightRadius: 6 },
  bubbleClusterBottomThem: { borderBottomLeftRadius: 6 },
  txtMe: { color: Colors.paper, fontSize: 15, lineHeight: 21 },
  txtThem: { color: Colors.ink, fontSize: 15, lineHeight: 21 },
  msgTime: {
    fontSize: 10,
    color: Colors.faint,
    marginTop: 6,
    fontWeight: "700",
    alignSelf: "flex-end",
  },
  dayHeader: {
    alignItems: "center",
    paddingVertical: 16,
  },
  // Caps eyebrow — the section-label voice.
  dayHeaderText: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: Colors.muted,
    textTransform: "uppercase",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 12 : 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.paper,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 44,
    maxHeight: 110,
    marginRight: 10,
    color: Colors.ink,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerMoreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
