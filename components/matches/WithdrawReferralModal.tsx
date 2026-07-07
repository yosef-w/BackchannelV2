import { BlurView } from "expo-blur";
import { AlertTriangle } from "@/components/ui/icons";
import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import type { Referral } from "./matchesQueries";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface WithdrawReferralModalProps {
  /** The referral pending withdrawal confirmation, or null when closed. */
  referral: Referral | null;
  /** Resolved display name for the applicant being withdrawn — the caller
   * looks this up against its matches list (falls back to "this applicant"
   * if nothing is found), so this component doesn't need that list itself. */
  applicantName: string;
  isProcessing: boolean;
  onCancel: () => void;
  onConfirm: (referral: Referral) => void;
}

/**
 * Confirmation sheet for withdrawing a submitted referral. Extracted from
 * MatchesView as a self-contained modal (visible/data/callbacks in, no
 * shared animation or lazy-fetch state) — the same pattern already used by
 * ApplicantCheckInModal, SponsorCheckInModal, and ProfileCompletionModal.
 */
export function WithdrawReferralModal({
  referral,
  applicantName,
  isProcessing,
  onCancel,
  onConfirm,
}: WithdrawReferralModalProps) {
  return (
    <View style={styles.modalOverlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onCancel}
      >
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet
        onDismiss={onCancel}
        style={[styles.modalContent, { maxHeight: SCREEN_HEIGHT * 0.6 }]}
      >
        {referral && (
          <View>
            <View style={styles.withdrawIconCircle}>
              <AlertTriangle size={28} color="#DC2626" strokeWidth={2.5} />
            </View>

            <Text style={styles.withdrawModalTitle}>Withdraw referral?</Text>
            <Text style={styles.withdrawModalSubtitle}>
              You're about to withdraw{" "}
              <Text style={styles.withdrawModalEmphasis}>
                {applicantName}
              </Text>
              {referral.jobTitle
                ? `'s referral for ${referral.jobTitle}.`
                : "'s referral."}
            </Text>

            <View style={styles.withdrawWarningCard}>
              <View style={styles.withdrawWarningRow}>
                <View style={styles.withdrawWarningDot} />
                <Text style={styles.withdrawWarningText}>
                  You'll have a few seconds to undo this.
                </Text>
              </View>
              <View style={styles.withdrawWarningRow}>
                <View style={styles.withdrawWarningDot} />
                <Text style={styles.withdrawWarningText}>
                  The applicant will be notified of the withdrawal.
                </Text>
              </View>
            </View>
            <View style={styles.withdrawModalActions}>
              <TouchableOpacity
                style={styles.withdrawCancelBtn}
                onPress={onCancel}
                disabled={isProcessing}
              >
                <Text style={styles.withdrawCancelBtnText}>Keep referral</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.withdrawConfirmBtn,
                  isProcessing && styles.withdrawBtnDisabled,
                ]}
                onPress={() => onConfirm(referral)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.withdrawConfirmBtnText}>
                    Yes, withdraw
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </DismissibleSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    paddingBottom: 40,
  },
  withdrawBtnDisabled: {
    opacity: 0.5,
  },
  withdrawIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 18,
  },
  withdrawModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  withdrawModalSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "500",
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  withdrawModalEmphasis: {
    fontWeight: "800",
    color: "#000",
  },
  withdrawWarningCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FEF2F2",
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  withdrawWarningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  withdrawWarningDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#DC2626",
    marginTop: 7,
  },
  withdrawWarningText: {
    flex: 1,
    fontSize: 13,
    color: "#DC2626",
    lineHeight: 19,
    fontWeight: "600",
  },
  withdrawModalActions: {
    flexDirection: "row",
    gap: 10,
  },
  withdrawCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  withdrawConfirmBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawConfirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
});
