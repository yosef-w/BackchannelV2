import { CheckCircle, ChevronRight, X } from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    DismissibleSheet,
    SheetScrollView,
} from "../ui/DismissibleSheet";
import { jobsModalStyles } from "./jobsModalStyles";
import { Applicant } from "./jobTransforms";
import { Colors, Fonts } from "@/constants/theme";

interface TopApplicantsModalProps {
  applicants: Applicant[];
  isLoading: boolean;
  error: string | null;
  onSelectApplicant: (applicant: Applicant) => void;
  onClose: () => void;
}

/**
 * Top Applicants list for a sponsored job — each row opens the applicant
 * detail sheet. Extracted from JobsView; the applicants fetch and the
 * detail-sheet hand-off stay owned by the caller.
 */
export function TopApplicantsModal({
  applicants,
  isLoading,
  error,
  onSelectApplicant,
  onClose,
}: TopApplicantsModalProps) {
  return (
    <View style={jobsModalStyles.modalOverlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet
        scrollDismiss
        onDismiss={onClose}
        style={[
          jobsModalStyles.modalContent,
          // Absolute px — a % maxHeight resolves against the sheet's
          // content-sized gesture-root wrapper and mis-measures.
          { maxHeight: Dimensions.get("window").height * 0.6 },
        ]}
      >
        <View style={jobsModalStyles.modalHeader}>
          <Text style={jobsModalStyles.modalMainTitle}>Top Applicants</Text>
          <TouchableOpacity
            onPress={onClose}
            style={jobsModalStyles.closeButton}
          >
            <X color="#000" size={24} />
          </TouchableOpacity>
        </View>

        <SheetScrollView
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#000" />
              <Text
                style={{
                  marginTop: 12,
                  color: Colors.muted,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Loading applicants…
              </Text>
            </View>
          ) : error ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text
                style={{
                  textAlign: "center",
                  color: Colors.danger,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {error}
              </Text>
            </View>
          ) : applicants.length === 0 ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text style={{ textAlign: "center", color: Colors.muted, fontSize: 16 }}>
                No applicants yet.
              </Text>
            </View>
          ) : (
            applicants.map((applicant, i) => (
              // Entire row is the tap target — opens the applicant
              // profile detail modal. Larger hit area than just the
              // chevron, and matches MatchesView's "tap the card"
              // affordance for consistency.
              <TouchableOpacity
                key={applicant.id || i}
                style={styles.applicantRow}
                activeOpacity={0.7}
                onPress={() => onSelectApplicant(applicant)}
              >
                {applicant.image ? (
                  <Image
                    source={{ uri: applicant.image }}
                    style={styles.applicantAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.applicantAvatar,
                      {
                        borderWidth: 1,
                        borderColor: Colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.serif,
                        fontSize: 18,
                        color: Colors.muted,
                      }}
                    >
                      {(applicant.name || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.applicantName}>{applicant.name}</Text>
                  <Text style={styles.applicantRole}>
                    {applicant.company
                      ? `${applicant.role} · ${applicant.company}`
                      : applicant.role}
                  </Text>
                </View>
                {/* "Matched" status tag — a sibling of the info column
                    so the row's alignItems:"center" keeps it vertically
                    centered against the avatar, not pinned to the name. */}
                {applicant.status === "MATCHED" && (
                  <View style={styles.applicantMatchedTag}>
                    <CheckCircle size={11} color="#000" />
                    <Text style={styles.applicantMatchedTagText}>Matched</Text>
                  </View>
                )}
                {/* Chevron now a visual affordance only — the entire
                    row above handles the tap. */}
                <View style={styles.messageApplicantBtn}>
                  <ChevronRight color="#FFF" size={18} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </SheetScrollView>
      </DismissibleSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  applicantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  applicantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  applicantName: { fontSize: 16, fontWeight: "700", color: "#000" },
  applicantRole: { fontSize: 13, color: Colors.body, marginTop: 2 },
  applicantMatchedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  applicantMatchedTagText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
    color: "#000",
  },
  messageApplicantBtn: {
    backgroundColor: "#000",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
});
