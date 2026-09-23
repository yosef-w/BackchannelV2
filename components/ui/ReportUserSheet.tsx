// ReportUserSheet — the shared "why are you reporting this person" picker,
// extracted from ThreadMenuSheet's second step so every surface that shows
// a person (profile sheets, the deck card, a job posting's sponsor) can
// offer the same Report action instead of it only existing inside an
// already-open message thread. Visually identical to ThreadMenuSheet's
// report step on purpose — one motion/visual language for "report someone"
// everywhere it appears, not a bespoke look per screen.
//
// Presentational only: this component owns the reason/detail form state
// and nothing else. The caller owns the actual reportUser() call (each
// surface's post-report cleanup differs — closing a sheet, advancing the
// deck, removing a job from a list — so that stays with whoever knows
// their own surface, matching ThreadMenuSheet's onReport-callback shape).

import { BlurView } from "expo-blur";
import { Check } from "@/components/ui/icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { DismissibleSheet } from "./DismissibleSheet";
import type { ReportReason } from "@/lib/api";
import { Colors, Fonts, Radii, Type } from "@/constants/theme";

const REASONS: [ReportReason, string][] = [
  ["harassment", "Harassment or bullying"],
  ["spam", "Spam or scam"],
  ["inappropriate", "Inappropriate content"],
  ["fake_profile", "Fake profile"],
  ["other", "Something else"],
];

interface ReportUserSheetProps {
  visible: boolean;
  /** First name (or a short label like "this job") — used in the title. */
  reportedName: string;
  /**
   * Shown under the title. Defaults to the message-thread copy's spirit
   * but without assuming a match/conversation exists — most surfaces this
   * is used from (a deck card, a matched profile, a job posting) don't
   * have one.
   */
  subtitle?: string;
  isSubmitting: boolean;
  onSubmit: (reason: ReportReason, detail: string) => void;
  onClose: () => void;
}

export function ReportUserSheet({
  visible,
  reportedName,
  subtitle,
  isSubmitting,
  onSubmit,
  onClose,
}: ReportUserSheetProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");

  // Reset on close so a stale reason isn't pre-selected next time this
  // opens for a different person — mirrors ThreadMenuSheet's own reset.
  useEffect(() => {
    if (visible) return;
    setReason(null);
    setDetail("");
  }, [visible]);

  const handleDismiss = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    // Self-contained Modal (not just a sibling overlay View) so this drops
    // safely into any caller regardless of whether THAT caller's own root
    // happens to be Modal-wrapped already — some are (ProfileDetailSheet),
    // some aren't (JobDetailModal's own root is a plain View, presented by
    // whatever screen embeds it). One Modal here is correct either way.
    <Modal visible={visible} transparent animationType="none">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleDismiss}
        >
          <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
        </TouchableOpacity>

        <DismissibleSheet scrollDismiss onDismiss={handleDismiss} style={styles.sheet}>
        <Text style={styles.title}>Report {reportedName}</Text>
        <Text style={styles.subtitle}>
          {subtitle ?? "You won't be shown to each other again. What happened?"}
        </Text>

        <View style={styles.reasonList}>
          {REASONS.map(([value, label]) => {
            const isSelected = reason === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.reasonRow, isSelected && styles.reasonRowSelected]}
                onPress={() => setReason(value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.reasonText, isSelected && styles.reasonTextSelected]}
                >
                  {label}
                </Text>
                {isSelected && (
                  <Check size={16} color={Colors.paper} strokeWidth={3} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={styles.detailInput}
          placeholder="Add details (optional)"
          placeholderTextColor={Colors.faint}
          value={detail}
          onChangeText={setDetail}
          multiline
          maxLength={500}
        />

        <TouchableOpacity
          style={[styles.submitBtn, (isSubmitting || !reason) && { opacity: 0.5 }]}
          onPress={() => reason && onSubmit(reason, detail)}
          disabled={isSubmitting || !reason}
          activeOpacity={0.7}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={Colors.paper} />
          ) : (
            <Text style={styles.submitBtnText}>Submit Report</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleDismiss}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        </DismissibleSheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 52,
  },
  title: {
    ...Type.heading,
    fontSize: 20,
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  reasonList: { gap: 8, marginBottom: 16 },
  reasonRow: {
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
  reasonRowSelected: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  reasonText: { fontSize: 15, fontWeight: "600", color: Colors.ink },
  reasonTextSelected: { color: Colors.paper },
  detailInput: {
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
  submitBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  submitBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15.5,
    letterSpacing: -0.2,
    color: Colors.paper,
  },
  cancelBtn: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "700", color: Colors.ink },
});
