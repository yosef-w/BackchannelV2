import { Award, Info, MessageCircle } from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { CompanyLogo } from "../ui/CompanyLogo";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import { Referral } from "./matchesQueries";
import { modalStyles } from "./sharedModalStyles";

interface ReferralDetailModalProps {
  /** The received referral being viewed, or null when closed. */
  referral: Referral | null;
  onClose: () => void;
  /** Wired only when the referral is active (REFERRED) — messages the sponsor. */
  onNavigateToMessages?: (jobId: string) => void;
}

/**
 * Received-referral detail sheet (applicant view) — who referred them, what
 * it means, and a CTA to message the sponsor (or just dismiss, if the
 * referral was withdrawn). Extracted from MatchesView; shares the hero/
 * detail-section/sponsor-card visual language via sharedModalStyles.ts.
 */
export function ReferralDetailModal({
  referral,
  onClose,
  onNavigateToMessages,
}: ReferralDetailModalProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={modalStyles.modalOverlay}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet onDismiss={onClose} style={modalStyles.modalContent}>
        {referral &&
          (() => {
            const r = referral;
            const isReferred = r.status === "REFERRED";
            const sponsorName =
              [r.sponsorFirstName, r.sponsorLastName]
                .filter(Boolean)
                .join(" ") || "Your sponsor";
            const sponsorFirst = r.sponsorFirstName?.trim() || "Sponsor";
            const company = r.jobCompany || "the company";
            const canMessage =
              isReferred && !!onNavigateToMessages && !!r.jobId;
            return (
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* Status + date */}
                <View style={modalStyles.jobModalTopRow}>
                  <View style={styles.refPill}>
                    <View
                      style={[
                        styles.refPillDot,
                        isReferred
                          ? styles.refPillDotReferred
                          : styles.refPillDotWithdrawn,
                      ]}
                    />
                    <Text
                      style={[
                        styles.refPillText,
                        isReferred
                          ? styles.refPillTextReferred
                          : styles.refPillTextWithdrawn,
                      ]}
                    >
                      {isReferred ? "Referred" : "Withdrawn"}
                    </Text>
                  </View>
                  {!!r.createdAt && (
                    <Text style={modalStyles.jobModalLikedDate}>
                      Referred{" "}
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  )}
                </View>

                {/* Hero — company logo + role */}
                <View style={modalStyles.jobModalHero}>
                  <CompanyLogo
                    logoUrl={r.jobLogoUrl}
                    name={r.jobCompany}
                    size={72}
                    borderRadius={22}
                    initialFontSize={32}
                    style={{ marginBottom: 16 }}
                  />
                  <Text style={modalStyles.jobModalHeroTitle}>
                    {r.jobTitle || "Open Role"}
                  </Text>
                  <Text style={modalStyles.jobModalHeroCompany}>
                    {r.jobCompany || "Company"}
                  </Text>
                </View>

                {/* Referred By — the sponsor */}
                <View style={modalStyles.sponsorInfoCard}>
                  <View style={modalStyles.sponsorCardHeader}>
                    <Award size={16} color="#000" />
                    <Text style={modalStyles.sponsorCardTitle}>
                      Referred By
                    </Text>
                  </View>
                  <View style={modalStyles.sponsorCardContent}>
                    {r.sponsorPhotoUrl ? (
                      <Image
                        source={{ uri: r.sponsorPhotoUrl }}
                        style={modalStyles.sponsorCardAvatar}
                      />
                    ) : (
                      <View style={modalStyles.jobSponsorInitialAvatar}>
                        <Text style={modalStyles.jobSponsorInitialText}>
                          {sponsorName[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={modalStyles.sponsorCardName}>
                        {sponsorName}
                      </Text>
                      <Text style={modalStyles.sponsorCardRole}>
                        {isReferred
                          ? "Referred you for this role"
                          : "Withdrew this referral"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* What this means */}
                <View style={modalStyles.detailSection}>
                  <View style={modalStyles.detailSectionHeader}>
                    <Info size={16} color="#000" />
                    <Text style={modalStyles.detailSectionTitle}>
                      What This Means
                    </Text>
                  </View>
                  <Text style={modalStyles.jobDetailText}>
                    {isReferred
                      ? `${sponsorFirst} has personally vouched for you and submitted you for this role at ${company}. A referral puts your application in front of their hiring team with a trusted employee's backing.`
                      : `${sponsorFirst} withdrew this referral, so it no longer counts as an active recommendation — but you're still connected and can reach out anytime.`}
                  </Text>
                </View>

                {/* CTA */}
                {canMessage ? (
                  <TouchableOpacity
                    style={modalStyles.applyBtnLarge}
                    onPress={() => {
                      const jid = r.jobId;
                      onClose();
                      onNavigateToMessages?.(jid);
                    }}
                  >
                    <MessageCircle color="#FFF" size={20} strokeWidth={2.5} />
                    <Text style={modalStyles.applyBtnLargeText}>
                      Message {sponsorFirst}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={modalStyles.applyBtnLarge}
                    onPress={onClose}
                    activeOpacity={0.85}
                  >
                    <Text style={modalStyles.applyBtnLargeText}>Got It</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            );
          })()}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  refPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  refPillDot: { width: 6, height: 6, borderRadius: 3 },
  refPillDotReferred: { backgroundColor: "#000" },
  refPillDotWithdrawn: { backgroundColor: "#BBB" },
  refPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  refPillTextReferred: { color: "#000" },
  refPillTextWithdrawn: { color: "#999" },
});
