import { BlurView } from "expo-blur";
import { Check, Flag } from "@/components/ui/icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import type { ReportReason } from "@/lib/api";
import { Colors, Fonts, Type } from "@/constants/theme";

interface ThreadMenuSheetProps {
  visible: boolean;
  participantName: string;
  isUnmatching: boolean;
  isReporting: boolean;
  onUnmatch: () => void;
  onReport: (reason: ReportReason, detail: string) => void;
  onClose: () => void;
}

/**
 * Thread overflow menu — Report/Unmatch/Cancel, with the report reason
 * picker as a second step in the same sheet. Extracted from MessagesView as
 * a self-contained modal: `threadMenuStep`/`reportReason`/`reportDetail`
 * have zero readers outside this sheet (confirmed by a state-ownership
 * audit before extraction). `handleUnmatch`/`handleSubmitReport` stay in
 * the parent (they mutate the conversations list + navigate away), so
 * they're passed in as `onUnmatch`/`onReport` instead.
 */
export function ThreadMenuSheet({
  visible,
  participantName,
  isUnmatching,
  isReporting,
  onUnmatch,
  onReport,
  onClose,
}: ThreadMenuSheetProps) {
  const [threadMenuStep, setThreadMenuStep] = useState<"actions" | "report">(
    "actions",
  );
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDetail, setReportDetail] = useState("");

  // Reset back to the default step whenever the sheet hides, so it doesn't
  // reopen mid-report next time — mirrors the original closeThreadMenu().
  useEffect(() => {
    if (visible) return;
    setThreadMenuStep("actions");
    setReportReason(null);
    setReportDetail("");
  }, [visible]);

  // Dismissal (backdrop tap / sheet swipe-down / Cancel) is a no-op while a
  // mutation is in flight — same guard the original inline handlers had.
  const handleDismiss = () => {
    if (isUnmatching || isReporting) return;
    onClose();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.modalOverlay}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleDismiss}
      >
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet
        scrollDismiss
        onDismiss={handleDismiss}
        style={styles.unmatchSheet}
      >
        {threadMenuStep === "actions" ? (
          <>
            <Text style={styles.unmatchSheetTitle}>{participantName}</Text>
            <Text style={styles.unmatchSheetSubtitle}>
              Unmatching or reporting permanently ends your match and closes
              this conversation. It moves to Past Connections as read-only
              and can&apos;t be undone.
            </Text>

            <TouchableOpacity
              style={styles.reportActionBtn}
              onPress={() => setThreadMenuStep("report")}
              activeOpacity={0.7}
            >
              <Flag size={18} color="#000" strokeWidth={2} />
              <Text style={styles.reportActionText}>
                Report {participantName.split(" ")[0]}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.unmatchActionBtn, isUnmatching && { opacity: 0.6 }]}
              onPress={onUnmatch}
              disabled={isUnmatching}
              activeOpacity={0.7}
            >
              {isUnmatching ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.unmatchActionText}>Unmatch</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.unmatchCancelBtn}
              onPress={handleDismiss}
              disabled={isUnmatching}
              activeOpacity={0.7}
            >
              <Text style={styles.unmatchCancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.unmatchSheetTitle}>
              Report {participantName}
            </Text>
            <Text style={styles.unmatchSheetSubtitle}>
              Reporting also ends this match and closes the conversation.
              What happened?
            </Text>

            <View style={styles.reportReasonList}>
              {(
                [
                  ["harassment", "Harassment or bullying"],
                  ["spam", "Spam or scam"],
                  ["inappropriate", "Inappropriate content"],
                  ["fake_profile", "Fake profile"],
                  ["other", "Something else"],
                ] as [ReportReason, string][]
              ).map(([value, label]) => {
                const isSelected = reportReason === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.reportReasonRow,
                      isSelected && styles.reportReasonRowSelected,
                    ]}
                    onPress={() => setReportReason(value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.reportReasonText,
                        isSelected && styles.reportReasonTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                    {isSelected && (
                      <Check size={16} color="#FFF" strokeWidth={3} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={styles.reportDetailInput}
              placeholder="Add details (optional)"
              placeholderTextColor={Colors.faint}
              value={reportDetail}
              onChangeText={setReportDetail}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              style={[
                styles.unmatchActionBtn,
                (isReporting || !reportReason) && { opacity: 0.5 },
              ]}
              onPress={() => reportReason && onReport(reportReason, reportDetail)}
              disabled={isReporting || !reportReason}
              activeOpacity={0.7}
            >
              {isReporting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.unmatchActionText}>Submit Report</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.unmatchCancelBtn}
              onPress={() => setThreadMenuStep("actions")}
              disabled={isReporting}
              activeOpacity={0.7}
            >
              <Text style={styles.unmatchCancelText}>Back</Text>
            </TouchableOpacity>
          </>
        )}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  unmatchSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    // Gripper hugs the sheet edge (PM: it floated too far down) —
    // 12 matches the sheets that already looked right.
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 52,
  },
  unmatchSheetTitle: {
    ...Type.heading,
    fontSize: 20,
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  unmatchSheetSubtitle: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  // Unmatch CTA — solid black to match the rest of the app's primary action
  // pattern (Match button, Send button, etc.). The destructive context is
  // communicated by the modal subtitle ("This cannot be undone."), not by
  // the button color — keeps the brand palette consistent across surfaces.
  // Pill CTAs — the rebrand's primary-action shape.
  unmatchActionBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  unmatchActionText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15.5,
    letterSpacing: -0.2,
    color: Colors.paper,
  },
  unmatchCancelBtn: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  unmatchCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.ink,
  },
  // Report — outlined (not filled) to sit visually below Unmatch's solid
  // black CTA without resorting to red; severity is communicated by copy
  // and icon, matching the app's monochrome-only convention for
  // destructive actions (see the comment on unmatchActionBtn above).
  reportActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    marginBottom: 12,
  },
  reportActionText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.ink,
  },
  reportReasonList: {
    gap: 8,
    marginBottom: 16,
  },
  reportReasonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reportReasonRowSelected: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  reportReasonText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.ink,
  },
  reportReasonTextSelected: {
    color: Colors.paper,
  },
  reportDetailInput: {
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.ink,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 20,
  },
});
