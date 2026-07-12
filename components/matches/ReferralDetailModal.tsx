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
    EnrichmentSkeleton,
    FooterButton,
    InsiderCard,
    InsiderNote,
    JobSheetHero,
    JourneySteps,
    ReadMoreText,
    SheetCloseButton,
    SheetFooter,
    StatRail,
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
 * Received-referral detail sheet (applicant view) — JobSheetKit layout.
 * The insider card leads (a referral IS the insider moment — their note
 * renders inside it), the journey strip shows where the referral sits, and
 * the role itself is background-enriched from GET /api/jobs/ so the sheet
 * can answer "which role is this again?" — the payload only carries
 * title/company.
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
              stats.push({
                label: "Experience",
                value: enriched.experienceLevel,
              });
            if (enriched?.workArrangement)
              stats.push({
                label: "Arrangement",
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
                  <JobSheetHero
                    logoUrl={r.jobLogoUrl || undefined}
                    logoName={r.jobCompany || undefined}
                    title={r.jobTitle || "Open Role"}
                    company={r.jobCompany || "Company"}
                    location={enriched?.location}
                    insetForClose
                  />
                  <View style={{ height: 12 }} />

                  {/* The referral IS the insider moment — their card leads,
                      with their note (when they wrote one) inside it. */}
                  <InsiderCard
                    name={sponsorName}
                    role={
                      isReferred
                        ? "Vouched for you personally"
                        : "Withdrew this referral"
                    }
                    image={r.sponsorPhotoUrl || undefined}
                    chip={
                      isReferred
                        ? { label: "Referred" }
                        : { label: "Withdrawn", muted: true }
                    }
                  >
                    {!!r.referralNote && <InsiderNote text={r.referralNote} />}
                  </InsiderCard>

                  {/* Journey — only while the referral is live; a withdrawn
                      one has no momentum to show. */}
                  {isReferred && (
                    <JourneySteps
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
                          label: "Hiring team",
                          sub: "Reviewing",
                          state: "active",
                        },
                      ]}
                    />
                  )}

                  {/* What this means */}
                  <View style={modalStyles.jobSection}>
                    <Text style={modalStyles.jobSectionTitle}>
                      What This Means
                    </Text>
                    <Text style={modalStyles.jobSectionText}>
                      {isReferred
                        ? `${sponsorFirst} has personally vouched for you and submitted you for this role at ${company}. A referral puts your application in front of their hiring team with a trusted employee's backing.`
                        : `${sponsorFirst} withdrew this referral, so it no longer counts as an active recommendation — but you're still connected and can reach out anytime.`}
                    </Text>
                  </View>

                  {/* The role itself — background-enriched. */}
                  <StatRail stats={stats} />
                  {showSkeleton && <EnrichmentSkeleton />}
                  {!!enriched?.description && (
                    <View style={modalStyles.jobSection}>
                      <Text style={modalStyles.jobSectionTitle}>
                        About the Role
                      </Text>
                      <ReadMoreText text={enriched.description} />
                    </View>
                  )}
                  {!!enriched?.skills?.length && (
                    <View style={modalStyles.jobSection}>
                      <Text style={modalStyles.jobSectionTitle}>Skills</Text>
                      <View style={modalStyles.skillsRow}>
                        {enriched.skills.map((skill, idx) => (
                          <View key={idx} style={modalStyles.skillBadge}>
                            <Text style={modalStyles.skillBadgeText}>
                              {skill}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </ScrollView>

                <SheetFooter>
                  {canMessage ? (
                    <FooterButton
                      label={`Message ${sponsorFirst}`}
                      icon={
                        <MessageCircle
                          color="#FFF"
                          size={20}
                          strokeWidth={2.5}
                        />
                      }
                      onPress={() => {
                        const jid = r.jobId;
                        onClose();
                        onNavigateToMessages?.(jid);
                      }}
                    />
                  ) : (
                    <FooterButton label="Got It" onPress={onClose} />
                  )}
                </SheetFooter>
              </>
            );
          })()}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Shrinks below its content height when the sheet hits its maxHeight cap,
  // leaving room for the pinned footer; scrolls the overflow.
  scroll: { flexShrink: 1 },
});
