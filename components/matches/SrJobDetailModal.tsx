import {
    AlertTriangle,
    Briefcase,
    ChevronLeft,
    DollarSign,
    Info,
    MapPin,
    TrendingUp,
} from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
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
import { parseSkillsField } from "./matchesQueries";
import { modalStyles } from "./sharedModalStyles";

/** Raw /api/jobs/silver/<id>/ shape — column names as the backend returns
 * them (uppercase, Postgres adapter). Kept loose since this modal only
 * reads a handful of fields defensively. */
type SilverJobDetail = Record<string, any>;

interface SrJobDetailModalProps {
  visible: boolean;
  loading: boolean;
  error: string | null;
  /** The prefetched/fetched silver job, or null before it loads. */
  detail: SilverJobDetail | null;
  onBack: () => void;
}

/**
 * Full role detail for the job a sponsor-request references — reached by
 * tapping "Tap to review this role" on the sponsor-request overview step.
 * Extracted from MatchesView; shares the hero/comp-strip/detail-section
 * visual language via sharedModalStyles.ts.
 */
export function SrJobDetailModal({
  visible,
  loading,
  error,
  detail,
  onBack,
}: SrJobDetailModalProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={modalStyles.modalOverlay}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onBack}
      >
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet onDismiss={onBack} style={modalStyles.modalContent}>
        {/* Header row — back to request */}
        <TouchableOpacity
          style={styles.srJobDetailBackRow}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={18} color="#000" />
          <Text style={styles.srJobDetailBackText}>Back to Request</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.interestedLoadingContainer}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#F4F4F5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Briefcase color="#BBB" size={28} strokeWidth={1.8} />
            </View>
            <Text style={styles.interestedLoadingText}>
              Loading role details…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.interestedLoadingContainer}>
            <AlertTriangle size={32} color="#DC2626" />
            <Text style={styles.srJobDetailErrorTitle}>
              Could not load role details
            </Text>
            <Text style={styles.srJobDetailErrorSub}>{error}</Text>
          </View>
        ) : detail ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* Hero — company logo, title, company, location */}
            <View style={modalStyles.jobModalHero}>
              <CompanyLogo
                logoUrl={detail.organization_logo || detail.ORGANIZATION_LOGO}
                name={detail.ORGANIZATION}
                size={72}
                borderRadius={22}
                initialFontSize={32}
                style={{ marginBottom: 16 }}
              />
              <Text style={modalStyles.jobModalHeroTitle}>
                {detail.TITLE}
              </Text>
              <Text style={modalStyles.jobModalHeroCompany}>
                {detail.ORGANIZATION}
              </Text>
              {!!detail.FULL_LOCATION && (
                <View style={modalStyles.jobModalLocationRow}>
                  <MapPin size={13} color="#999" />
                  <Text style={modalStyles.jobModalLocationText}>
                    {detail.FULL_LOCATION}
                  </Text>
                  {detail.IS_REMOTE && (
                    <View style={modalStyles.jobRemoteBadge}>
                      <Text style={modalStyles.jobRemoteText}>Remote</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Compensation + experience strip */}
            {(detail.SALARY_ANNUAL_MIN || detail.EXPERIENCE_LEVEL) && (
              <View style={modalStyles.jobModalCompStrip}>
                {!!(detail.SALARY_ANNUAL_MIN && detail.SALARY_ANNUAL_MAX) && (
                  <View style={modalStyles.jobModalCompCell}>
                    <DollarSign size={14} color="#555" />
                    <View>
                      <Text style={modalStyles.jobModalCompLabel}>
                        SALARY
                      </Text>
                      <Text style={modalStyles.jobModalCompValue}>
                        {`$${Math.round(detail.SALARY_ANNUAL_MIN / 1000)}k – $${Math.round(detail.SALARY_ANNUAL_MAX / 1000)}k`}
                        {detail.SALARY_CURRENCY &&
                        detail.SALARY_CURRENCY !== "USD"
                          ? ` ${detail.SALARY_CURRENCY}`
                          : ""}
                      </Text>
                    </View>
                  </View>
                )}
                {!!detail.EXPERIENCE_LEVEL && (
                  <View
                    style={[
                      modalStyles.jobModalCompCell,
                      detail.SALARY_ANNUAL_MIN &&
                        modalStyles.jobModalCompCellBorder,
                    ]}
                  >
                    <Briefcase size={14} color="#555" />
                    <View>
                      <Text style={modalStyles.jobModalCompLabel}>
                        EXPERIENCE
                      </Text>
                      <Text style={modalStyles.jobModalCompValue}>
                        {detail.EXPERIENCE_LEVEL}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Role details — employment type + remote chip */}
            {!!(detail.EMPLOYMENT_TYPES || detail.IS_REMOTE) && (
              <View style={modalStyles.detailSection}>
                <View style={modalStyles.detailSectionHeader}>
                  <Info size={16} color="#000" />
                  <Text style={modalStyles.detailSectionTitle}>
                    Role Details
                  </Text>
                </View>
                <View style={modalStyles.skillsRow}>
                  {!!detail.EMPLOYMENT_TYPES && (
                    <View style={modalStyles.roleDetailChip}>
                      <Text style={modalStyles.roleDetailChipText}>
                        {detail.EMPLOYMENT_TYPES}
                      </Text>
                    </View>
                  )}
                  {detail.IS_REMOTE && (
                    <View style={modalStyles.roleDetailChip}>
                      <MapPin size={13} color="#000" />
                      <Text style={modalStyles.roleDetailChipText}>
                        Remote
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Required skills */}
            {parseSkillsField(detail.SKILLS).length > 0 && (
              <View style={modalStyles.detailSection}>
                <View style={modalStyles.detailSectionHeader}>
                  <TrendingUp size={16} color="#000" />
                  <Text style={modalStyles.detailSectionTitle}>
                    Required Skills
                  </Text>
                </View>
                <View style={modalStyles.skillsRow}>
                  {parseSkillsField(detail.SKILLS).map(
                    (skill: string, idx: number) => (
                      <View key={idx} style={modalStyles.skillBadge}>
                        <Text style={modalStyles.skillBadgeText}>
                          {skill}
                        </Text>
                      </View>
                    ),
                  )}
                </View>
              </View>
            )}

            {/* Description */}
            {!!detail.DESCRIPTION_TEXT && (
              <View style={modalStyles.jobSection}>
                <Text style={modalStyles.jobSectionTitle}>
                  About the Role
                </Text>
                <Text style={modalStyles.jobSectionText}>
                  {detail.DESCRIPTION_TEXT}
                </Text>
              </View>
            )}
          </ScrollView>
        ) : null}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  srJobDetailBackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 18,
  },
  srJobDetailBackText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  interestedLoadingContainer: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  interestedLoadingText: {
    fontSize: 14,
    color: "#AAA",
    fontWeight: "500",
  },
  srJobDetailErrorTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626",
    marginTop: 12,
    textAlign: "center",
  },
  srJobDetailErrorSub: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 19,
  },
});
