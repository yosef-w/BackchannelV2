import {
    Briefcase,
    Check,
    CheckCircle,
    Clock,
    DollarSign,
    ExternalLink,
    Info,
    MapPin,
    MessageCircle,
    TrendingUp,
    Users,
} from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
    Image,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { cardStyles } from "../home/cardStyles";
import { CompanyLogo } from "../ui/CompanyLogo";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import { extractDisplayDomain } from "../jobs/jobTransforms";
import { JobOpportunity } from "./matchesQueries";
import { modalStyles } from "./sharedModalStyles";

interface JobDetailModalProps {
  /** The liked job whose detail is being viewed, or null when closed. */
  job: JobOpportunity | null;
  onClose: () => void;
  /** Wired only when the job is MATCHED — messages the sponsor. */
  onNavigateToMessages?: (jobId: string) => void;
  /**
   * Replaces the default Message/Pending CTA. Used when this modal is
   * layered over another flow whose action should carry through — e.g. an
   * interested sponsor's job context, where the right action is "Connect",
   * not a disabled "Pending Match".
   */
  cta?: {
    label: string;
    icon?: React.ReactNode;
    onPress: () => void;
    loading?: boolean;
  };
}

/**
 * Liked-job detail sheet (applicant view) — full role breakdown plus a CTA
 * that's either "Message {sponsor}" (once matched) or a disabled "Pending
 * Match" state. Extracted from MatchesView; visual language (hero, comp
 * strip, detail sections, sponsor card) is shared with the other
 * role-preview modals via sharedModalStyles.ts.
 */
export function JobDetailModal({
  job,
  onClose,
  onNavigateToMessages,
  cta,
}: JobDetailModalProps) {
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
        {job && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* Status + Liked Date Row */}
            <View style={modalStyles.jobModalTopRow}>
              {job.status === "MATCHED" ? (
                <View style={modalStyles.jobModalMatchedBadge}>
                  <CheckCircle size={12} color="#000" />
                  <Text style={modalStyles.jobModalMatchedText}>
                    Matched!
                  </Text>
                </View>
              ) : (
                <View style={modalStyles.jobModalPendingBadge}>
                  <View style={modalStyles.pulsingDot} />
                  <Text style={modalStyles.jobModalPendingText}>
                    Pending match
                  </Text>
                </View>
              )}
              {!!job.likedAt && (
                <Text style={modalStyles.jobModalLikedDate}>
                  Liked{" "}
                  {new Date(job.likedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              )}
            </View>

            {/* Hero: Company Logo (initial fallback) + Title + Company + Location */}
            <View style={modalStyles.jobModalHero}>
              <CompanyLogo
                logoUrl={job.companyLogoUrl}
                name={job.company}
                size={72}
                borderRadius={22}
                initialFontSize={32}
                style={{ marginBottom: 16 }}
              />
              <Text style={modalStyles.jobModalHeroTitle}>{job.title}</Text>
              <Text style={modalStyles.jobModalHeroCompany}>
                {job.company}
              </Text>
              {!!job.location && (
                <View style={modalStyles.jobModalLocationRow}>
                  <MapPin size={13} color="#999" />
                  <Text style={modalStyles.jobModalLocationText}>
                    {job.location}
                  </Text>
                  {job.remoteOption && (
                    <View style={modalStyles.jobRemoteBadge}>
                      <Text style={modalStyles.jobRemoteText}>Remote</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Compensation Strip */}
            <View style={modalStyles.jobModalCompStrip}>
              <View style={modalStyles.jobModalCompCell}>
                <DollarSign size={14} color="#555" />
                <View>
                  <Text style={modalStyles.jobModalCompLabel}>SALARY</Text>
                  <Text style={modalStyles.jobModalCompValue}>
                    {job.salary}
                    {job.salaryCurrency &&
                      job.salaryCurrency !== "USD" &&
                      ` ${job.salaryCurrency}`}
                  </Text>
                </View>
              </View>
              {!!job.experienceLevel && (
                <View
                  style={[
                    modalStyles.jobModalCompCell,
                    modalStyles.jobModalCompCellBorder,
                  ]}
                >
                  <Briefcase size={14} color="#555" />
                  <View>
                    <Text style={modalStyles.jobModalCompLabel}>
                      EXPERIENCE
                    </Text>
                    <Text style={modalStyles.jobModalCompValue}>
                      {job.experienceLevel}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Role Details — work arrangement chip. Experience already
                lives in the comp strip above so we don't duplicate it. */}
            {!!job.workArrangement && (
              <View style={modalStyles.detailSection}>
                <View style={modalStyles.detailSectionHeader}>
                  <Info size={16} color="#000" />
                  <Text style={modalStyles.detailSectionTitle}>
                    Role Details
                  </Text>
                </View>
                <View style={modalStyles.skillsRow}>
                  <View style={modalStyles.roleDetailChip}>
                    <MapPin size={13} color="#000" />
                    <Text style={modalStyles.roleDetailChipText}>
                      {job.workArrangement}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Core Responsibilities */}
            {!!job.coreResponsibilities && (
              <View style={modalStyles.detailSection}>
                <View style={modalStyles.detailSectionHeader}>
                  <Briefcase size={16} color="#000" />
                  <Text style={modalStyles.detailSectionTitle}>
                    Core Responsibilities
                  </Text>
                </View>
                <View style={modalStyles.jobDetailCard}>
                  <Text style={modalStyles.jobDetailText}>
                    {job.coreResponsibilities}
                  </Text>
                </View>
              </View>
            )}

            {/* Required Skills */}
            {job.skills.length > 0 && (
              <View style={modalStyles.detailSection}>
                <View style={modalStyles.detailSectionHeader}>
                  <TrendingUp size={16} color="#000" />
                  <Text style={modalStyles.detailSectionTitle}>
                    Required Skills
                  </Text>
                </View>
                <View style={modalStyles.skillsRow}>
                  {job.skills.map((skill, idx) => (
                    <View key={idx} style={modalStyles.skillBadge}>
                      <Text style={modalStyles.skillBadgeText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Highlights / Benefits */}
            {job.benefits.length > 0 && (
              <View style={modalStyles.detailSection}>
                <View style={modalStyles.detailSectionHeader}>
                  <Text style={modalStyles.detailSectionTitle}>
                    Highlights
                  </Text>
                </View>
                {job.benefits.map((benefit, idx) => (
                  <View key={idx} style={modalStyles.benefitRow}>
                    <Check size={14} color="#000" />
                    <Text style={modalStyles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Source — trust signal + verification link, regardless of
                how the job was created. Same bordered detailSection card
                every other section on this modal uses, so it reads as a
                peer section rather than orphaned floating text. See
                BACKEND_CHANGES_NEEDED.md §O/§P. */}
            {job.url && extractDisplayDomain(job.url) && (
              <View style={modalStyles.detailSection}>
                <View style={modalStyles.detailSectionHeader}>
                  <Text style={modalStyles.detailSectionTitle}>Source</Text>
                </View>
                <TouchableOpacity
                  style={cardStyles.originalPostingRow}
                  onPress={() => Linking.openURL(job.url!).catch(() => {})}
                  activeOpacity={0.7}
                >
                  <ExternalLink size={14} color="#666" strokeWidth={2} />
                  <Text style={cardStyles.originalPostingText}>
                    {extractDisplayDomain(job.url)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* About the Role — full description, last because it's the
                longest free-form text. */}
            {!!job.description && (
              <View style={modalStyles.jobSection}>
                <Text style={modalStyles.jobSectionTitle}>
                  About the Role
                </Text>
                <Text style={modalStyles.jobSectionText}>
                  {job.description}
                </Text>
              </View>
            )}

            {/* Sponsor Card */}
            <View style={modalStyles.sponsorInfoCard}>
              <View style={modalStyles.sponsorCardHeader}>
                <Users size={16} color="#000" />
                <Text style={[modalStyles.sponsorCardTitle, { flex: 1 }]}>
                  Introduced By
                </Text>
                {job.status === "MATCHED" && (
                  <View style={modalStyles.jobMatchedSponsorBadge}>
                    <CheckCircle size={10} color="#000" />
                    <Text style={modalStyles.jobMatchedSponsorText}>
                      Matched Sponsor
                    </Text>
                  </View>
                )}
              </View>
              <View style={modalStyles.sponsorCardContent}>
                {job.sponsorInfo.image ? (
                  <Image
                    source={{ uri: job.sponsorInfo.image }}
                    style={modalStyles.sponsorCardAvatar}
                  />
                ) : (
                  <View style={modalStyles.jobSponsorInitialAvatar}>
                    <Text style={modalStyles.jobSponsorInitialText}>
                      {(job.sponsorInfo.name || "S")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={modalStyles.sponsorCardName}>
                    {job.sponsorInfo.name}
                  </Text>
                  {!!job.sponsorInfo.role &&
                    job.sponsorInfo.role !== "Sponsor" && (
                      <Text style={modalStyles.sponsorCardRole}>
                        {job.sponsorInfo.role}
                      </Text>
                    )}
                </View>
              </View>
            </View>

            {/* Primary CTA. Messaging is gated on a mutual match —
                applicants can only DM the sponsor after status flips to
                "MATCHED". Before that, the CTA shows "Awaiting Sponsor"
                so the user knows why the action is unavailable. An explicit
                `cta` prop overrides all of this (e.g. "Connect" when this
                modal is layered over an interested sponsor's profile). */}
            {cta ? (
              <TouchableOpacity
                style={[
                  modalStyles.applyBtnLarge,
                  cta.loading && { opacity: 0.6 },
                ]}
                onPress={cta.onPress}
                disabled={cta.loading}
                activeOpacity={0.8}
              >
                {cta.icon}
                <Text style={modalStyles.applyBtnLargeText}>{cta.label}</Text>
              </TouchableOpacity>
            ) : job.status === "MATCHED" && onNavigateToMessages && !!job.jobId ? (
              <TouchableOpacity
                style={modalStyles.applyBtnLarge}
                onPress={() => {
                  const jid = job.jobId as string;
                  onClose();
                  onNavigateToMessages(jid);
                }}
              >
                <MessageCircle color="#FFF" size={20} strokeWidth={2.5} />
                <Text style={modalStyles.applyBtnLargeText}>
                  Message{" "}
                  {job.sponsorInfo.name !== "Pending"
                    ? job.sponsorInfo.name.split(" ")[0]
                    : "Sponsor"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[modalStyles.applyBtnLarge, { opacity: 0.6 }]}
                onPress={onClose}
                activeOpacity={0.6}
              >
                <Clock color="#FFF" size={20} strokeWidth={2.5} />
                <Text style={modalStyles.applyBtnLargeText}>
                  Pending Match
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}
