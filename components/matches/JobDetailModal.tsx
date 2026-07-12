import { Check, ExternalLink, MessageCircle } from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import { extractDisplayDomain } from "../jobs/jobTransforms";
import {
    EnrichmentSkeleton,
    FooterButton,
    InsiderCard,
    JobSheetHero,
    JourneySteps,
    ReadMoreText,
    SheetCloseButton,
    SheetFooter,
    StatRail,
    WaitingBar,
} from "./JobSheetKit";
import { JobOpportunity } from "./matchesQueries";
import { modalStyles } from "./sharedModalStyles";

interface JobDetailModalProps {
  /** The liked job whose detail is being viewed, or null when closed. */
  job: JobOpportunity | null;
  onClose: () => void;
  /** Wired only when the job is MATCHED — messages the sponsor. */
  onNavigateToMessages?: (jobId: string) => void;
  /**
   * Replaces the default Message/Waiting CTA. Used when this modal is
   * layered over another flow whose action should carry through — e.g. an
   * interested sponsor's job context, where the right action is "Connect",
   * not a waiting state.
   */
  cta?: {
    label: string;
    icon?: React.ReactNode;
    onPress: () => void;
    loading?: boolean;
  };
  /**
   * True while the caller is still fetching the full posting in the
   * background (thread strip / interested sponsor open with basics only).
   * Renders a skeleton where the details will land instead of letting
   * them pop in mid-read.
   */
  enriching?: boolean;
}

/**
 * Liked-job detail sheet — "insider first" layout on the JobSheetKit
 * vocabulary. The story reads top to bottom: the role (compact hero + stat
 * rail), the human way in (inverted insider card), the journey so far
 * (liked → matched → chat), then the long-form details. The primary action
 * is pinned below the scroll so it never has to be scrolled to.
 */
export function JobDetailModal({
  job,
  onClose,
  onNavigateToMessages,
  cta,
  enriching,
}: JobDetailModalProps) {
  const matched = job?.status === "MATCHED";
  const sponsorFirstName =
    job && job.sponsorInfo.name && job.sponsorInfo.name !== "Pending"
      ? job.sponsorInfo.name.split(" ")[0]
      : "the sponsor";

  const stats: { label: string; value: string }[] = [];
  if (job) {
    if (job.salary) {
      stats.push({
        label: "Salary",
        value:
          job.salary +
          (job.salaryCurrency && job.salaryCurrency !== "USD"
            ? ` ${job.salaryCurrency}`
            : ""),
      });
    }
    if (job.experienceLevel)
      stats.push({ label: "Experience", value: job.experienceLevel });
    if (job.workArrangement)
      stats.push({ label: "Arrangement", value: job.workArrangement });
    if (job.type) stats.push({ label: "Type", value: job.type });
  }

  const sourceDomain = job?.url ? extractDisplayDomain(job.url) : null;
  // Skeleton only while the details area would otherwise be empty; the
  // moment any real detail lands, the real sections take over.
  const showSkeleton =
    !!enriching &&
    !!job &&
    !job.description &&
    !job.coreResponsibilities &&
    job.skills.length === 0 &&
    job.benefits.length === 0;

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
          <>
            <SheetCloseButton onPress={onClose} />
            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <JobSheetHero
                logoUrl={job.companyLogoUrl}
                logoName={job.company}
                title={job.title}
                company={job.company}
                location={job.location}
                remote={job.remoteOption}
                insetForClose
              />

              {/* Source — trust signal, above the fold: verify the posting
                  before investing in the read. See BACKEND doc §O/§P. */}
              {sourceDomain && (
                <TouchableOpacity
                  style={styles.sourceRow}
                  onPress={() => Linking.openURL(job.url!).catch(() => {})}
                  activeOpacity={0.7}
                  accessibilityLabel={`View original posting on ${sourceDomain}`}
                >
                  <ExternalLink size={12} color="#666" strokeWidth={2} />
                  <Text style={styles.sourceText}>
                    Original posting · {sourceDomain}
                  </Text>
                </TouchableOpacity>
              )}

              <StatRail stats={stats} />

              {/* The Insider — the differentiator, so it sits right under
                  the role facts and is the sheet's one inverted block. */}
              <InsiderCard
                name={job.sponsorInfo.name}
                role={
                  job.sponsorInfo.role !== "Sponsor"
                    ? job.sponsorInfo.role
                    : undefined
                }
                image={job.sponsorInfo.image}
                chip={matched && !cta ? { label: "Matched" } : undefined}
              />

              {/* Journey — liked → matched → chat, the momentum story.
                  Only for liked jobs (layered contexts have no likedAt and
                  carry their own action through the cta prop). */}
              {!!job.likedAt && !cta && (
                <JourneySteps
                  steps={[
                    {
                      label: "Liked",
                      sub: new Date(job.likedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      }),
                      state: "done",
                    },
                    {
                      label: "Matched",
                      sub: matched ? undefined : "Waiting",
                      state: matched ? "done" : "active",
                    },
                    {
                      label: "Chat",
                      sub: matched ? "Unlocked" : "Locked",
                      state: matched ? "done" : "todo",
                    },
                  ]}
                />
              )}

              {/* Enrichment skeleton — holds the details area's place while
                  the full posting loads, instead of content popping in
                  mid-read. */}
              {showSkeleton && <EnrichmentSkeleton />}

              {/* About the Role — collapsed to a preview; the full text is
                  one tap away instead of a wall on open. */}
              {!!job.description && (
                <View style={modalStyles.jobSection}>
                  <Text style={modalStyles.jobSectionTitle}>
                    About the Role
                  </Text>
                  <ReadMoreText text={job.description} />
                </View>
              )}

              {/* What You'll Do */}
              {!!job.coreResponsibilities && (
                <View style={modalStyles.jobSection}>
                  <Text style={modalStyles.jobSectionTitle}>
                    What You&apos;ll Do
                  </Text>
                  <Text style={modalStyles.jobSectionText}>
                    {job.coreResponsibilities}
                  </Text>
                </View>
              )}

              {/* Skills */}
              {job.skills.length > 0 && (
                <View style={modalStyles.jobSection}>
                  <Text style={modalStyles.jobSectionTitle}>Skills</Text>
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
                <View style={modalStyles.jobSection}>
                  <Text style={modalStyles.jobSectionTitle}>Highlights</Text>
                  {job.benefits.map((benefit, idx) => (
                    <View key={idx} style={modalStyles.benefitRow}>
                      <Check size={14} color="#000" />
                      <Text style={modalStyles.benefitText}>{benefit}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Pinned footer — the action (or the honest waiting state)
                is always visible; nothing to scroll for. */}
            <SheetFooter>
              {cta ? (
                <FooterButton
                  label={cta.label}
                  icon={cta.icon}
                  onPress={cta.onPress}
                  loading={cta.loading}
                />
              ) : matched && onNavigateToMessages && !!job.jobId ? (
                <FooterButton
                  label={`Message ${sponsorFirstName}`}
                  icon={
                    <MessageCircle color="#FFF" size={20} strokeWidth={2.5} />
                  }
                  onPress={() => {
                    const jid = job.jobId as string;
                    onClose();
                    onNavigateToMessages(jid);
                  }}
                />
              ) : (
                <WaitingBar text={`Waiting on ${sponsorFirstName} to accept`} />
              )}
            </SheetFooter>
          </>
        )}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Shrinks below its content height when the sheet hits its maxHeight cap,
  // leaving room for the pinned footer; scrolls the overflow.
  scroll: { flexShrink: 1 },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 16,
    paddingVertical: 4,
  },
  sourceText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
