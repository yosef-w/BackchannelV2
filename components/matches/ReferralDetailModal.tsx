import { MessageCircle } from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React, { useEffect, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import {
    BarFooter,
    canvasSheet,
    HostCard,
    PosterHero,
    ReadMoreText,
    SectionCard,
    SheetCloseButton,
    SkeletonCard,
    StatStrip,
    Timeline,
} from "./JobSheetKit";
import {
    fetchSponsoredJobEnrichment,
    JobOpportunity,
    Referral,
} from "./matchesQueries";
import { modalStyles } from "./sharedModalStyles";

interface ReferralDetailModalProps {
  /** The received referral being viewed, or null when closed. */
  referral: Referral | null;
  onClose: () => void;
  /** Wired only when the referral is active (REFERRED) — messages the sponsor. */
  onNavigateToMessages?: (jobId: string) => void;
}

/**
 * Received-referral detail sheet (applicant view) — Gallery layout. The
 * sponsor's host card (with their note quoted inside it) leads: a referral
 * IS the human moment. Below it, the vertical timeline shows where the
 * referral sits, and the role is background-enriched from GET /api/jobs/
 * (the payload only carries title/company).
 */
export function ReferralDetailModal({
  referral,
  onClose,
  onNavigateToMessages,
}: ReferralDetailModalProps) {
  const [enriched, setEnriched] = useState<Partial<JobOpportunity> | null>(
    null,
  );
  const [enriching, setEnriching] = useState(false);
  // Guards a slow fetch from landing on a different referral's sheet.
  const activeReferralId = useRef<string | null>(null);

  useEffect(() => {
    activeReferralId.current = referral?.referralId ?? null;
    setEnriched(null);
    if (!referral || (!referral.jobTitle && !referral.jobCompany)) {
      setEnriching(false);
      return;
    }
    const rid = referral.referralId;
    setEnriching(true);
    fetchSponsoredJobEnrichment({
      jobId: referral.jobId,
      title: referral.jobTitle || undefined,
      company: referral.jobCompany || undefined,
    })
      .then((result) => {
        if (activeReferralId.current === rid && result) setEnriched(result);
      })
      .catch(() => {
        // Best-effort — the sheet already shows the referral itself.
      })
      .finally(() => {
        if (activeReferralId.current === rid) setEnriching(false);
      });
  }, [referral]);

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
        onDismiss={onClose}
        style={[modalStyles.modalContent, canvasSheet]}
      >
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

            const stats: { label: string; value: string }[] = [];
            if (enriched?.salary)
              stats.push({
                label: "Salary",
                value:
                  enriched.salary +
                  (enriched.salaryCurrency && enriched.salaryCurrency !== "USD"
                    ? ` ${enriched.salaryCurrency}`
                    : ""),
              });
            if (enriched?.experienceLevel)
              stats.push({ label: "Level", value: enriched.experienceLevel });
            if (enriched?.workArrangement)
              stats.push({
                label: "Setting",
                value: enriched.workArrangement,
              });

            const showSkeleton =
              enriching && !enriched?.description && !enriched?.skills?.length;

            return (
              <>
                <SheetCloseButton onPress={onClose} />
                <ScrollView
                  style={styles.scroll}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  contentContainerStyle={{ paddingBottom: 16 }}
                >
                  <PosterHero
                    logoUrl={r.jobLogoUrl || undefined}
                    logoName={r.jobCompany || undefined}
                    title={r.jobTitle || "Open Role"}
                    company={r.jobCompany || "Company"}
                    location={enriched?.location}
                  />

                  {/* The referral IS the human moment — the sponsor's host
                      card leads, their note quoted inside it. */}
                  <HostCard
                    label="Referred By"
                    name={sponsorName}
                    role={
                      isReferred
                        ? "Vouched for you personally"
                        : "Withdrew this referral"
                    }
                    image={r.sponsorPhotoUrl || undefined}
                    pill={
                      isReferred ? { label: "Referral submitted" } : undefined
                    }
                    note={r.referralNote || undefined}
                  />

                  {/* Journey — only while the referral is live; a withdrawn
                      one has no momentum to show. */}
                  {isReferred && (
                    <Timeline
                      steps={[
                        { label: "Matched", state: "done" },
                        {
                          label: "Referred",
                          sub: r.createdAt
                            ? new Date(r.createdAt).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" },
                              )
                            : undefined,
                          state: "done",
                        },
                        {
                          label: "Hiring team review",
                          sub: "In progress",
                          state: "active",
                        },
                      ]}
                    />
                  )}

                  <SectionCard title="What This Means">
                    <Text style={modalStyles.jobSectionText}>
                      {isReferred
                        ? `${sponsorFirst} has personally vouched for you and submitted you for this role at ${company}. A referral puts your application in front of their hiring team with a trusted employee's backing.`
                        : `${sponsorFirst} withdrew this referral, so it no longer counts as an active recommendation — but you're still connected and can reach out anytime.`}
                    </Text>
                  </SectionCard>

                  {/* The role itself — background-enriched. */}
                  <StatStrip stats={stats} />
                  {showSkeleton && <SkeletonCard title="About the Role" />}
                  {!!enriched?.description && (
                    <SectionCard title="About the Role">
                      <ReadMoreText text={enriched.description} />
                    </SectionCard>
                  )}
                  {!!enriched?.skills?.length && (
                    <SectionCard title="Skills">
                      <View style={modalStyles.skillsRow}>
                        {enriched.skills.map((skill, idx) => (
                          <View key={idx} style={modalStyles.skillBadge}>
                            <Text style={modalStyles.skillBadgeText}>
                              {skill}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </SectionCard>
                  )}
                </ScrollView>

                {canMessage ? (
                  <BarFooter
                    context={{
                      title: `Referred by ${sponsorFirst}`,
                      done: true,
                    }}
                    button={{
                      label: "Message",
                      icon: (
                        <MessageCircle
                          color="#FFF"
                          size={17}
                          strokeWidth={2.5}
                        />
                      ),
                      onPress: () => {
                        const jid = r.jobId;
                        onClose();
                        onNavigateToMessages?.(jid);
                      },
                    }}
                  />
                ) : (
                  <BarFooter
                    button={{ label: "Got It", onPress: onClose }}
                  />
                )}
              </>
            );
          })()}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Shrinks below its content height when the sheet hits its maxHeight cap,
  // leaving room for the pinned action bar; scrolls the overflow.
  scroll: { flexShrink: 1 },
});
