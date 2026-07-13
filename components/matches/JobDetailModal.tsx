import { Check, MessageCircle } from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    DismissibleSheet,
    SheetScrollView,
} from "../ui/DismissibleSheet";
import {
    BarFooter,
    canvasSheet,
    HostCard,
    PosterHero,
    ReadMoreText,
    SectionCard,
    SkeletonCard,
    StatStrip,
    Timeline,
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
  /**
   * First name for the footer's "Matched with X · Message" — defaults to
   * the insider's. Pass it when the viewer IS the insider (a sponsor
   * looking at their own posting), where the person they'd message is the
   * matched applicant, not themselves.
   */
  messageName?: string;
}

/**
 * Liked-job detail sheet — Gallery layout: poster hero, App-Store stat
 * strip, the insider as an Airbnb-style host card, a vertical timeline,
 * and detail sections as floating cards on the soft canvas. The action
 * bar is pinned under the scroll with the current state spelled out.
 */
export function JobDetailModal({
  job,
  onClose,
  onNavigateToMessages,
  cta,
  enriching,
  messageName,
}: JobDetailModalProps) {
  const matched = job?.status === "MATCHED";
  const counterpartFirstName =
    messageName ||
    (job && job.sponsorInfo.name && job.sponsorInfo.name !== "Pending"
      ? job.sponsorInfo.name.split(" ")[0]
      : "the sponsor");

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
      stats.push({ label: "Level", value: job.experienceLevel });
    if (job.workArrangement)
      stats.push({ label: "Setting", value: job.workArrangement });
    else if (job.type) stats.push({ label: "Type", value: job.type });
  }

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

      <DismissibleSheet
        scrollDismiss
        onDismiss={onClose}
        style={[modalStyles.modalContent, canvasSheet]}
      >
        {job && (
          <>
            <SheetScrollView
              style={styles.scroll}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <PosterHero
                logoUrl={job.companyLogoUrl}
                logoName={job.company}
                title={job.title}
                company={job.company}
                location={job.location}
                remote={job.remoteOption}
                sourceUrl={job.url}
                onClose={onClose}
              />

              <StatStrip stats={stats} />

              {/* The insider — the human way in gets the host-card stage. */}
              <HostCard
                label="Your Insider"
                name={job.sponsorInfo.name}
                role={
                  job.sponsorInfo.role !== "Sponsor"
                    ? job.sponsorInfo.role
                    : undefined
                }
                image={job.sponsorInfo.image}
                // No pill when messageName is set: the viewer is (or may
                // be) the insider themself, and "Matched with you" on your
                // own card reads wrong — the footer carries the state.
                pill={
                  matched && !cta && !messageName
                    ? { label: "Matched with you" }
                    : undefined
                }
              />

              {/* Journey — liked → matched → chat. Only for liked jobs
                  (layered contexts carry their own action via cta). */}
              {!!job.likedAt && !cta && (
                <Timeline
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
                      sub: matched ? undefined : "Waiting on the sponsor",
                      state: matched ? "done" : "active",
                    },
                    {
                      label: "Start the chat",
                      sub: matched ? "Unlocked" : "Unlocks on match",
                      state: matched ? "active" : "todo",
                    },
                  ]}
                />
              )}

              {/* Enrichment skeleton — holds the details area's place while
                  the full posting loads. */}
              {showSkeleton && <SkeletonCard title="About the Role" />}

              {!!job.description && (
                <SectionCard title="About the Role">
                  <ReadMoreText text={job.description} />
                </SectionCard>
              )}

              {!!job.coreResponsibilities && (
                <SectionCard title="What You'll Do">
                  <Text style={modalStyles.jobSectionText}>
                    {job.coreResponsibilities}
                  </Text>
                </SectionCard>
              )}

              {job.skills.length > 0 && (
                <SectionCard title="Skills">
                  <View style={modalStyles.skillsRow}>
                    {job.skills.map((skill, idx) => (
                      <View key={idx} style={modalStyles.skillBadge}>
                        <Text style={modalStyles.skillBadgeText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </SectionCard>
              )}

              {job.benefits.length > 0 && (
                <SectionCard title="Highlights">
                  {job.benefits.map((benefit, idx) => (
                    <View key={idx} style={modalStyles.benefitRow}>
                      <Check size={14} color="#000" />
                      <Text style={modalStyles.benefitText}>{benefit}</Text>
                    </View>
                  ))}
                </SectionCard>
              )}
            </SheetScrollView>

            {/* Action bar — the state and the action, always visible. */}
            {cta ? (
              <BarFooter
                button={{
                  label: cta.label,
                  icon: cta.icon,
                  onPress: cta.onPress,
                  loading: cta.loading,
                }}
              />
            ) : matched && onNavigateToMessages && !!job.jobId ? (
              <BarFooter
                context={{
                  title: `Matched with ${counterpartFirstName}`,
                  done: true,
                }}
                button={{
                  label: "Message",
                  icon: (
                    <MessageCircle color="#FFF" size={17} strokeWidth={2.5} />
                  ),
                  onPress: () => {
                    const jid = job.jobId as string;
                    onClose();
                    onNavigateToMessages(jid);
                  },
                }}
              />
            ) : (
              <BarFooter
                context={{
                  title: `Waiting on ${counterpartFirstName}`,
                  sub: "Chat unlocks when they accept",
                  waiting: true,
                }}
              />
            )}
          </>
        )}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Shrinks below its content height when the sheet hits its maxHeight cap,
  // leaving room for the pinned action bar; scrolls the overflow.
  scroll: { flexShrink: 1 },
});
