import {
    Briefcase,
    Check,
    CheckCircle,
    DollarSign,
    ExternalLink,
    Info,
    MapPin,
    Trash2,
    TrendingUp,
    Users,
    Zap,
} from "@/components/ui/icons";
import type { Job } from "@/types/jobs";
import { formatSalary } from "@/types/jobs";
import { BlurView } from "expo-blur";
import React from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { cardStyles } from "../home/cardStyles";
import { CompanyLogo } from "../ui/CompanyLogo";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import { extractDisplayDomain } from "./jobTransforms";
import { jobsModalStyles } from "./jobsModalStyles";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface JobDetailsModalProps {
  /** The browse/sponsored job whose detail is being viewed, or null when closed. */
  job: Job | null;
  /** JOB_POSTINGS id currently being unsponsored (drives the spinner). */
  isUnsponsoringId: string | null;
  /** Resolve the JOB_POSTINGS id for a sponsored browse job — sponsoredJobs
   * mapping lives in the caller's store. */
  resolveJobPostingsId: (job: Job) => string;
  onRemoveSponsorship: (jobPostingsId: string, job: Job) => void;
  onSponsor: (job: Job) => void;
  onClose: () => void;
}

/**
 * Full job-detail sheet (hero, comp strip, role details, skills,
 * requirements, highlights, description, sponsors, action button).
 * Extracted from JobsView; the unsponsor mutation and the sponsor-flow
 * hand-off stay owned by the caller and arrive as callbacks.
 */
export function JobDetailsModal({
  job,
  isUnsponsoringId,
  resolveJobPostingsId,
  onRemoveSponsorship,
  onSponsor,
  onClose,
}: JobDetailsModalProps) {
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
        onDismiss={onClose}
        style={[
          jobsModalStyles.modalContent,
          { maxHeight: SCREEN_HEIGHT * 0.88 },
        ]}
      >
        {job && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* Hero: Company Logo (initial fallback) + Title + Company + Location */}
            <View style={styles.jobModalHero}>
              <CompanyLogo
                logoUrl={job.image}
                name={job.company}
                size={72}
                borderRadius={22}
                initialFontSize={32}
                style={{ marginBottom: 16 }}
              />
              <Text style={styles.jobModalHeroTitle}>{job.title}</Text>
              <Text style={styles.jobModalHeroCompany}>{job.company}</Text>
              {!!job.location && (
                <View style={styles.jobModalLocationRow}>
                  <MapPin size={13} color="#999" />
                  <Text style={styles.jobModalLocationText}>
                    {job.location}
                  </Text>
                  {job.isRemote && (
                    <View style={styles.jobRemoteBadge}>
                      <Text style={styles.jobRemoteText}>Remote</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Compensation Strip */}
            <View style={styles.jobModalCompStrip}>
              <View style={styles.jobModalCompCell}>
                <DollarSign size={14} color="#555" />
                <View style={{ flex: 1, flexShrink: 1 }}>
                  <Text style={styles.jobModalCompLabel}>SALARY</Text>
                  <Text style={styles.jobModalCompValue}>
                    {job.salaryMin && job.salaryMax
                      ? formatSalary(
                          job.salaryMin,
                          job.salaryMax,
                          job.salaryCurrency,
                        )
                      : job.salary || "Not specified"}
                  </Text>
                </View>
              </View>
              {!!job.experienceLevel && (
                <View
                  style={[
                    styles.jobModalCompCell,
                    styles.jobModalCompCellBorder,
                  ]}
                >
                  <Briefcase size={14} color="#555" />
                  <View style={{ flex: 1, flexShrink: 1 }}>
                    <Text style={styles.jobModalCompLabel}>EXPERIENCE</Text>
                    <Text style={styles.jobModalCompValue}>
                      {job.experienceLevel}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Role Details — work arrangement + employment type chips */}
            {(!!job.workArrangement || !!job.type) && (
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <Info size={16} color="#000" />
                  <Text style={styles.detailSectionTitle}>Role Details</Text>
                </View>
                <View style={styles.skillsRow}>
                  {!!job.workArrangement && (
                    <View style={styles.roleDetailChip}>
                      <MapPin size={13} color="#000" />
                      <Text style={styles.roleDetailChipText}>
                        {job.workArrangement}
                      </Text>
                    </View>
                  )}
                  {!!job.type && (
                    <View style={styles.roleDetailChip}>
                      <Briefcase size={13} color="#000" />
                      <Text style={styles.roleDetailChipText}>{job.type}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Core Responsibilities */}
            {!!job.coreResponsibilities && (
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <Briefcase size={16} color="#000" />
                  <Text style={styles.detailSectionTitle}>
                    Core Responsibilities
                  </Text>
                </View>
                <View style={styles.jobDetailCard}>
                  <Text style={styles.jobDetailText}>
                    {job.coreResponsibilities}
                  </Text>
                </View>
              </View>
            )}

            {/* Required Skills */}
            {(job.skills || []).length > 0 && (
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <TrendingUp size={16} color="#000" />
                  <Text style={styles.detailSectionTitle}>
                    Required Skills
                  </Text>
                </View>
                <View style={styles.skillsRow}>
                  {job.skills.map((skill, i) => (
                    <View key={i} style={styles.skillBadge}>
                      <Text style={styles.skillBadgeText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Requirements text fallback when no structured skills */}
            {(job.skills || []).length === 0 && !!job.requirements && (
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <TrendingUp size={16} color="#000" />
                  <Text style={styles.detailSectionTitle}>Requirements</Text>
                </View>
                <View style={styles.jobDetailCard}>
                  <Text style={styles.jobDetailText}>{job.requirements}</Text>
                </View>
              </View>
            )}

            {/* Benefits / Highlights */}
            {(job.benefits || []).length > 0 && (
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <Text style={styles.detailSectionTitle}>Highlights</Text>
                </View>
                {job.benefits.map((benefit, i) => (
                  <View key={i} style={styles.benefitRow}>
                    <Check size={14} color="#000" />
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Source — trust signal + verification link, shown to the
                sponsor for their own listing regardless of how it was
                created. Same header+title pattern every other section on
                this modal uses. See BACKEND_CHANGES_NEEDED.md §O/§P. */}
            {job.url && extractDisplayDomain(job.url) && (
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <Text style={styles.detailSectionTitle}>Source</Text>
                </View>
                <TouchableOpacity
                  style={cardStyles.originalPostingRow}
                  onPress={() => Linking.openURL(job.url).catch(() => {})}
                  activeOpacity={0.7}
                >
                  <ExternalLink size={14} color="#666" strokeWidth={2} />
                  <Text style={cardStyles.originalPostingText}>
                    {extractDisplayDomain(job.url)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* About the Role — full description last (longest free-form text) */}
            {!!job.description && (
              <View style={styles.jobSection}>
                <Text style={styles.jobSectionTitle}>About the Role</Text>
                <Text style={styles.jobSectionText}>{job.description}</Text>
              </View>
            )}

            {/* Job Sponsors */}
            {(job.currentSponsors || []).length > 0 && (
              <View style={styles.sponsorInfoCard}>
                <View style={styles.sponsorCardHeader}>
                  <Users size={16} color="#000" />
                  <Text style={styles.sponsorCardTitle}>Job Sponsors</Text>
                </View>
                <View style={{ gap: 12 }}>
                  {job.currentSponsors.map((sponsor, i) => (
                    <View key={i} style={styles.sponsorCardContent}>
                      {sponsor.image ? (
                        <Image
                          source={{ uri: sponsor.image }}
                          style={styles.sponsorCardAvatar}
                        />
                      ) : (
                        <View
                          style={[
                            styles.sponsorCardAvatar,
                            {
                              backgroundColor: "#000",
                              alignItems: "center",
                              justifyContent: "center",
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "800",
                              color: "#FFF",
                            }}
                          >
                            {(sponsor.name || "?")[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sponsorCardName}>
                          {sponsor.name}
                        </Text>
                        {!!sponsor.role && (
                          <Text style={styles.sponsorCardRole}>
                            {sponsor.role}
                          </Text>
                        )}
                      </View>
                      {sponsor.canRefer && (
                        <View style={styles.canReferBadge}>
                          <CheckCircle size={12} color="#000" />
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Action Button */}
            {job.isSponsored ? (
              (() => {
                const jobPostingsId = resolveJobPostingsId(job);
                const isBusy = isUnsponsoringId === jobPostingsId;
                return (
                  <View style={styles.unsponsorBtnContainer}>
                    <View style={styles.unsponsorBtn}>
                      <Check color="#000" size={18} strokeWidth={3} />
                      <Text style={styles.unsponsorBtnText}>
                        Already Sponsoring
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.unsponsorActiveBtn,
                        (!jobPostingsId || isBusy) && { opacity: 0.4 },
                      ]}
                      activeOpacity={0.7}
                      disabled={!jobPostingsId || isBusy}
                      onPress={() => {
                        if (!jobPostingsId || isBusy) return;
                        onRemoveSponsorship(jobPostingsId, job);
                      }}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Trash2 size={15} color="#FFF" />
                          <Text style={styles.unsponsorActiveBtnText}>
                            Remove Sponsorship
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })()
            ) : (
              <TouchableOpacity
                style={styles.applyBtnLarge}
                onPress={() => onSponsor(job)}
              >
                <Zap color="#FFF" size={20} fill="#FFF" />
                <Text style={styles.applyBtnLargeText}>Sponsor</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </DismissibleSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  jobModalHero: {
    alignItems: "center",
    marginBottom: 24,
  },
  jobModalHeroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  jobModalHeroCompany: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
  jobModalLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  jobModalLocationText: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  jobRemoteBadge: {
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  jobRemoteText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
  },
  jobModalCompStrip: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 18,
    marginBottom: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  jobModalCompCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  jobModalCompCellBorder: {
    borderLeftWidth: 1,
    borderLeftColor: "#EEEEEE",
  },
  jobModalCompLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#BBB",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  jobModalCompValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#000",
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#000",
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleDetailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleDetailChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
  jobDetailCard: {
    backgroundColor: "#F8F9FB",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  jobDetailText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 21,
    fontWeight: "500",
  },
  skillBadge: {
    backgroundColor: "#F8F9FB",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  skillBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    letterSpacing: 0.2,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  benefitText: { fontSize: 14, color: "#555", fontWeight: "500" },
  jobSection: { marginBottom: 24 },
  jobSectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#000",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  jobSectionText: { fontSize: 14, color: "#555", lineHeight: 22 },
  sponsorInfoCard: {
    backgroundColor: "#F8F9FB",
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  sponsorCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  sponsorCardTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#000",
    textTransform: "uppercase",
  },
  sponsorCardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  sponsorCardAvatar: { width: 40, height: 40, borderRadius: 20 },
  sponsorCardName: { fontSize: 14, fontWeight: "800", color: "#000" },
  sponsorCardRole: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    marginTop: 2,
  },
  canReferBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  unsponsorBtnContainer: {
    alignItems: "center",
    gap: 6,
  },
  unsponsorBtn: {
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  unsponsorBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "800" as const,
  },
  unsponsorActiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#000",
    borderRadius: 18,
    paddingVertical: 16,
    width: "100%",
  },
  unsponsorActiveBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700" as const,
  },
  applyBtnLarge: {
    backgroundColor: "#000",
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyBtnLargeText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
