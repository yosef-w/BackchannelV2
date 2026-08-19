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
      StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { cardStyles } from "../home/cardStyles";
import { CompanyLogo } from "../ui/CompanyLogo";
import {
    DismissibleSheet,
    SheetScrollView,
} from "../ui/DismissibleSheet";
import { SkillChips } from "../matches/JobSheetKit";
import { extractDisplayDomain } from "./jobTransforms";
import { jobsModalStyles } from "./jobsModalStyles";
import { Colors, Fonts, Type } from "@/constants/theme";

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
        scrollDismiss
        onDismiss={onClose}
        style={[
          jobsModalStyles.modalContent,
          { maxHeight: SCREEN_HEIGHT * 0.88 },
        ]}
      >
        {job && (
          <SheetScrollView contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Hero: Company Logo (initial fallback) + Title + Company + Location */}
            {/* Dossier ID row — square tile beside the serif title. */}
            <View style={styles.jobModalHero}>
              <CompanyLogo
                logoUrl={job.image}
                name={job.company}
                size={64}
                borderRadius={16}
                initialFontSize={26}
              />
              <View style={styles.jobModalHeroText}>
                <Text style={styles.jobModalHeroTitle} numberOfLines={3}>
                  {job.title}
                </Text>
                <Text style={styles.jobModalHeroCompany} numberOfLines={2}>
                  {job.company}
                  {job.location ? ` · ${job.location}` : ""}
                  {job.isRemote ? " · Remote" : ""}
                </Text>
              </View>
            </View>

            {/* Compensation Strip */}
            <View style={styles.jobModalCompStrip}>
              <View style={styles.jobModalCompCell}>
                <DollarSign size={14} color={Colors.body} />
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
                  <Briefcase size={14} color={Colors.body} />
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
                <SkillChips skills={job.skills} />
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
                  <ExternalLink size={14} color={Colors.body} strokeWidth={2} />
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
                              backgroundColor: Colors.ink,
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
          </SheetScrollView>
        )}
      </DismissibleSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Desk rebrand: dossier ID row + flat hairline sections ─────────
  jobModalHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
    paddingRight: 8,
  },
  jobModalHeroText: { flex: 1, minWidth: 0 },
  jobModalHeroTitle: {
    fontFamily: Type.heading.fontFamily,
    fontSize: 22,
    lineHeight: 27,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  jobModalHeroCompany: {
    fontSize: 13.5,
    fontWeight: "500",
    color: Colors.body,
    lineHeight: 19,
    marginTop: 5,
  },
  // Flat hairline fact strip (was the recessed offWhite box).
  jobModalCompStrip: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
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
    borderLeftColor: Colors.border,
  },
  jobModalCompLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  // The serif stat-number voice.
  jobModalCompValue: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    color: Colors.ink,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  // Caps section labels — the ledger-key voice (12px accessibility floor).
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: Colors.muted,
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
    backgroundColor: Colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  roleDetailChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: Colors.body,
  },
  // Flat body text — the recessed card retires.
  jobDetailCard: {},
  jobDetailText: {
    fontSize: 14,
    color: Colors.body,
    lineHeight: 21,
    fontWeight: "500",
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  benefitText: { fontSize: 14, color: Colors.body, fontWeight: "500" },
  jobSection: { marginBottom: 24 },
  jobSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.muted,
    textTransform: "uppercase",
    marginBottom: 10,
    letterSpacing: 1.2,
  },
  jobSectionText: { fontSize: 14, color: Colors.body, lineHeight: 22 },
  // Flat section between hairlines (was a recessed card).
  sponsorInfoCard: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
    marginBottom: 24,
  },
  sponsorCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  sponsorCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  sponsorCardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  sponsorCardAvatar: { width: 40, height: 40, borderRadius: 12 },
  sponsorCardName: { fontSize: 14, fontWeight: "800", color: "#000" },
  sponsorCardRole: {
    fontSize: 12,
    color: Colors.body,
    fontWeight: "600",
    marginTop: 2,
  },
  canReferBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  unsponsorBtnContainer: {
    alignItems: "center",
    gap: 6,
  },
  unsponsorBtn: {
    backgroundColor: Colors.paper,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 16,
    borderRadius: 999,
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
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingVertical: 16,
    width: "100%",
  },
  unsponsorActiveBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700" as const,
  },
  applyBtnLarge: {
    backgroundColor: Colors.ink,
    paddingVertical: 16,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyBtnLargeText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
