import { CheckCircle, ChevronRight, X } from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { jobsModalStyles } from "./jobsModalStyles";
import { Applicant } from "./jobTransforms";

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

      <Animated.View
        entering={SlideInDown}
        exiting={SlideOutDown}
        style={[jobsModalStyles.modalContent, { maxHeight: "60%" }]}
      >
        <View style={styles.modalHandle} />
        <View style={jobsModalStyles.modalHeader}>
          <Text style={jobsModalStyles.modalMainTitle}>Top Applicants</Text>
          <TouchableOpacity
            onPress={onClose}
            style={jobsModalStyles.closeButton}
          >
            <X color="#000" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#000" />
              <Text
                style={{
                  marginTop: 12,
                  color: "#999",
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
                  color: "#DC2626",
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {error}
              </Text>
            </View>
          ) : applicants.length === 0 ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text style={{ textAlign: "center", color: "#999", fontSize: 16 }}>
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
                        backgroundColor: "#000",
                        alignItems: "center",
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "800",
                        color: "#FFF",
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
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#EEE",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  applicantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  applicantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EEE",
  },
  applicantName: { fontSize: 16, fontWeight: "700", color: "#000" },
  applicantRole: { fontSize: 13, color: "#666", marginTop: 2 },
  applicantMatchedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F4F4F5",
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
