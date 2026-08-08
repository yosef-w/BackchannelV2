import { CharCounter } from "@/components/ui/CharCounter";
import {
    BellRing,
    Briefcase,
    Check,
    ChevronLeft,
    MessageCircle,
} from "@/components/ui/icons";
import { getRelativeTime } from "@/utils/relativeTime";
import { BlurView } from "expo-blur";
import React from "react";
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import {
    DismissibleSheet,
    SheetScrollView,
} from "../ui/DismissibleSheet";
import {
    BarFooter,
    canvasSheet,
    HostCard,
    PillButton,
    QuietAction,
    RoleTicket,
    SectionCard,
} from "./JobSheetKit";
import { SponsorRequest } from "./matchesQueries";
import { modalStyles } from "./sharedModalStyles";
import { Colors, Type } from "@/constants/theme";

interface SrJobDetailPreview {
  organization_logo?: string | null;
  ORGANIZATION_LOGO?: string | null;
}

export interface SponsorRequestFlowState {
  step: number;
  relationship: string | null;
  canRefer: boolean | null;
  dayToDay: string;
  teamCulture: string;
  idealCandidate: string;
  insiderInsights: string;
  sponsoring: boolean;
  newJobId: string | null;
}

interface SponsorRequestModalProps {
  /** The incoming sponsor request being reviewed, or null when closed. */
  request: SponsorRequest | null;
  /** Prefetched silver-job detail (for the hero logo) — may lag the request
   * by a tick since it's fetched async when the request is selected. */
  jobDetailPreview: SrJobDetailPreview | null;
  flow: SponsorRequestFlowState;
  onClose: () => void;
  onOpenJobDetail: () => void;
  onSetStep: (step: number) => void;
  onSetRelationship: (value: string) => void;
  onSetCanRefer: (value: boolean) => void;
  onSetDayToDay: (value: string) => void;
  onSetTeamCulture: (value: string) => void;
  onSetIdealCandidate: (value: string) => void;
  onSetInsiderInsights: (value: string) => void;
  onSponsorAndConnect: (request: SponsorRequest) => void;
  onNavigateToMessages?: (jobId: string, userId?: string) => void;
}

/**
 * Sponsor-request multi-step flow (sponsor view) — a 4-step wizard:
 * 1) overview of the applicant's ask, 2) relationship + referral capability,
 * 3) insider insights, 4) success. Extracted from MatchesView; step/flow
 * state stays owned by the caller (still a mid-refactor MatchesView) and is
 * threaded through as props.
 */
export function SponsorRequestModal({
  request,
  jobDetailPreview,
  flow,
  onClose,
  onOpenJobDetail,
  onSetStep,
  onSetRelationship,
  onSetCanRefer,
  onSetDayToDay,
  onSetTeamCulture,
  onSetIdealCandidate,
  onSetInsiderInsights,
  onSponsorAndConnect,
  onNavigateToMessages,
}: SponsorRequestModalProps) {
  const {
    step,
    relationship,
    canRefer,
    dayToDay,
    teamCulture,
    idealCandidate,
    insiderInsights,
    sponsoring,
    newJobId,
  } = flow;

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
        {request && (
          <>
            {/* ── Step indicator (steps 2 & 3 only) — segmented bars,
                the same progress language as the check-in stack. The
                left affordance goes BACK a step (it's a ChevronLeft,
                not an X — dismissal is the backdrop/drag). ─────────── */}
            {(step === 2 || step === 3) && (
              <View style={styles.srStepRow}>
                <TouchableOpacity
                  onPress={() => onSetStep(step - 1)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <ChevronLeft size={20} color={Colors.muted} />
                </TouchableOpacity>
                <View style={styles.srSegments}>
                  <View style={[styles.srSegment, styles.srSegmentActive]} />
                  <View
                    style={[
                      styles.srSegment,
                      step === 3 && styles.srSegmentActive,
                    ]}
                  />
                </View>
                <Text style={styles.srStepLabel}>Step {step - 1} of 2</Text>
              </View>
            )}

            <SheetScrollView
              style={{ flexShrink: 1 }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {/* ── STEP 1: Overview ─────────────────────────────── */}
              {step === 1 && (
                <>
                  {/* Header tag */}
                  <View style={styles.interestedModalTag}>
                    <BellRing size={12} color="#000" />
                    <Text style={styles.interestedModalTagText}>
                      Asked for sponsorship
                      {request.createdAt
                        ? ` · ${getRelativeTime(request.createdAt)}`
                        : ""}
                    </Text>
                  </View>

                  {/* Applicant — the human asking is what this sheet is
                      about, so they get the host-card stage. */}
                  <HostCard
                    label="The Applicant"
                    name={request.applicantName}
                    role="Requesting your sponsorship for this role"
                    image={request.applicantPhoto || undefined}
                  />

                  {/* Job context — tappable role ticket into the full
                      role. Logo from the silver-detail prefetch where
                      possible; falls back to the company initial. */}
                  <RoleTicket
                    label="Wants sponsorship for"
                    title={request.jobTitle}
                    company={request.jobCompany}
                    logoUrl={
                      jobDetailPreview?.organization_logo ||
                      jobDetailPreview?.ORGANIZATION_LOGO
                    }
                    onPress={onOpenJobDetail}
                  />

                  {/* What happens callout */}
                  <SectionCard title="How This Works">
                    <Text style={styles.srCalloutText}>
                      By sponsoring this role, you&apos;re putting your
                      professional backing behind{" "}
                      {request.applicantName.split(" ")[0]}&apos;s application.
                      Once you do, {request.applicantName.split(" ")[0]} will
                      be able to connect with you directly — opening the door
                      to communicate and provide a referral.
                    </Text>
                  </SectionCard>
                </>
              )}

              {/* ── STEP 2: Relationship + Can Refer ─────────────── */}
              {step === 2 && (
                <>
                  <Text style={styles.srStepTitle}>Confirm Sponsorship</Text>
                  <Text style={styles.srStepSub}>
                    Help us understand your role and referral capability
                  </Text>

                  <View style={styles.srFormSection}>
                    <Text style={styles.srFieldLabel}>
                      Your relationship to this role
                    </Text>
                    {["Hiring Manager", "Team Member", "Other"].map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={styles.srRadioOption}
                        onPress={() => onSetRelationship(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.srRadioLeft}>
                          <View
                            style={[
                              styles.srRadioCircle,
                              relationship === item && styles.srRadioCircleActive,
                            ]}
                          />
                          <Text
                            style={[
                              styles.srRadioText,
                              relationship === item && styles.srRadioTextActive,
                            ]}
                          >
                            {item}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.srFormSection}>
                    <Text style={styles.srFieldLabel}>
                      Can you provide a referral?
                    </Text>
                    <View style={styles.srSideBySide}>
                      {[
                        { label: "Yes", value: true },
                        { label: "No", value: false },
                      ].map(({ label, value }) => (
                        <TouchableOpacity
                          key={label}
                          style={styles.srHalfOption}
                          onPress={() => onSetCanRefer(value)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.srRadioCircle,
                              canRefer === value && styles.srRadioCircleActive,
                            ]}
                          />
                          <Text
                            style={[
                              styles.srRadioText,
                              canRefer === value && styles.srRadioTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                </>
              )}

              {/* ── STEP 3: Insider Insights ──────────────────────── */}
              {step === 3 && (
                <>
                  <Text style={styles.srStepTitle}>
                    Add Insider Insights
                  </Text>
                  <Text style={styles.srStepSub}>
                    Share the inside story candidates won&apos;t find anywhere
                    else. All fields are optional.
                  </Text>

                  <SectionCard title="Why This Matters">
                    <Text style={styles.srCalloutText}>
                      Unlike traditional job boards, BackChannel gives
                      candidates real insider knowledge — which means better
                      applicants and fewer surprises on both sides.
                    </Text>
                  </SectionCard>

                  {[
                    {
                      label: "The Real Day-to-Day",
                      hint: "What does this role actually look like beyond the job description?",
                      placeholder:
                        "Be honest about daily work — meetings, focus time, pace, autonomy...",
                      value: dayToDay,
                      setter: onSetDayToDay,
                    },
                    {
                      label: "Team Culture & Dynamics",
                      hint: "Give candidates a real sense of who they'll be working with.",
                      placeholder:
                        "Team size, seniority mix, remote vs. in-office norms, collaboration style...",
                      value: teamCulture,
                      setter: onSetTeamCulture,
                    },
                    {
                      label: "Who Actually Thrives Here",
                      hint: "What matters more than what's on the resume?",
                      placeholder:
                        "Mindset, soft skills, working style, previous backgrounds that tend to succeed...",
                      value: idealCandidate,
                      setter: onSetIdealCandidate,
                    },
                    {
                      label: "Everything Else Worth Knowing",
                      hint: "Interview process, growth path, comp notes, anything candidates should know.",
                      placeholder:
                        "Interview format, timeline, promotion path, equity situation...",
                      value: insiderInsights,
                      setter: onSetInsiderInsights,
                    },
                  ].map(({ label, hint, placeholder, value, setter }) => (
                    <View key={label} style={styles.srFormSection}>
                      <Text style={styles.srFieldLabel}>{label}</Text>
                      <Text style={styles.srFieldHint}>{hint}</Text>
                      <TextInput
                        style={styles.srTextInput}
                        placeholder={placeholder}
                        placeholderTextColor={Colors.muted}
                        value={value}
                        onChangeText={setter}
                        multiline
                        numberOfLines={4}
                        maxLength={500}
                        autoCapitalize="sentences"
                        onSubmitEditing={() => Keyboard.dismiss()}
                      />
                      <CharCounter count={value.length} max={500} />
                    </View>
                  ))}

                </>
              )}

              {/* ── STEP 4: Success ───────────────────────────────── */}
              {step === 4 && (
                <Animated.View
                  entering={FadeIn}
                  style={styles.srSuccessContainer}
                >
                  <View style={styles.srSuccessIconCircle}>
                    <Check color="#FFF" size={36} strokeWidth={3} />
                  </View>
                  <Text style={styles.srSuccessTitle}>
                    Sponsorship Confirmed!
                  </Text>
                  <Text style={styles.srSuccessDesc}>
                    You&apos;re now sponsoring{" "}
                    <Text style={{ fontWeight: "800" }}>
                      {request.jobTitle}
                    </Text>
                    .{"\n\n"}
                    {request.applicantName.split(" ")[0]} will see you under
                    &ldquo;Wants to Connect With You&rdquo; and can message
                    you directly
                    once they connect back.
                  </Text>

                  {/* Message now — only available if we already have a
                      matched jobId back from the sponsorJob call */}
                  {newJobId && onNavigateToMessages && (
                    <View style={{ alignSelf: "stretch", marginBottom: 4 }}>
                      <PillButton
                        label="Message Now"
                        icon={
                          <MessageCircle
                            color="#FFF"
                            size={17}
                            strokeWidth={2.5}
                          />
                        }
                        onPress={() => {
                          const jid = newJobId;
                          onClose();
                          onNavigateToMessages(jid, request.applicantUserId);
                        }}
                      />
                    </View>
                  )}

                  <QuietAction label="Back to Matches" onPress={onClose} />
                </Animated.View>
              )}
            </SheetScrollView>

            {/* ── Pinned action bar — each step's action is always visible
                (the success step keeps its inline, centered CTAs). ─── */}
            {step === 1 && (
              <BarFooter
                button={{
                  label: "Sponsor & Connect",
                  icon: (
                    <Briefcase color="#FFF" size={17} strokeWidth={2.5} />
                  ),
                  onPress: () => onSetStep(2),
                }}
              >
                <QuietAction label="Not right now" onPress={onClose} />
              </BarFooter>
            )}
            {step === 2 && (
              <BarFooter
                button={{
                  label: "Continue",
                  disabled: !relationship || canRefer === null,
                  onPress: () => onSetStep(3),
                }}
              />
            )}
            {step === 3 && (
              <BarFooter
                button={{
                  label: "Confirm Sponsorship",
                  icon: <Check color="#FFF" size={17} strokeWidth={2.5} />,
                  loading: sponsoring,
                  spinnerOnLoading: true,
                  onPress: () => onSponsorAndConnect(request),
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
  interestedModalTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  interestedModalTagText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: "700",
  },
  srCalloutText: { fontSize: 14, color: Colors.body, lineHeight: 22 },
  // Segmented progress — same language as the check-in stack's bars.
  srSegments: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    marginHorizontal: 16,
  },
  srSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  srSegmentActive: { backgroundColor: "#000" },
  srFieldHint: {
    fontSize: 13,
    color: Colors.muted,
    marginBottom: 12,
    lineHeight: 18,
  },
  srFieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  srFormSection: { marginBottom: 24 },
  // Form surfaces sit white on the Gallery canvas.
  srHalfOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  srRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.faint,
  },
  srRadioCircleActive: { borderColor: "#000", borderWidth: 6 },
  srRadioLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  srRadioOption: {
    backgroundColor: "#FFF",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    marginBottom: 12,
  },
  srRadioText: { fontSize: 15, color: Colors.body, fontWeight: "600" },
  srRadioTextActive: { color: "#000", fontWeight: "600" },
  srSideBySide: { flexDirection: "row", gap: 12 },
  srStepLabel: { fontSize: 12, fontWeight: "700", color: Colors.muted },
  srStepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  srStepSub: {
    fontSize: 14,
    color: Colors.body,
    lineHeight: 20,
    marginBottom: 24,
  },
  srStepTitle: {
    ...Type.heading,
    color: Colors.ink,
    marginBottom: 6,
  },
  srSuccessContainer: {
    alignItems: "center",
    paddingVertical: 20,
    width: "100%",
  },
  srSuccessDesc: {
    fontSize: 14,
    color: Colors.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  srSuccessIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  srSuccessTitle: {
    ...Type.heading,
    marginBottom: 10,
    color: Colors.ink,
  },
  srTextInput: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    borderRadius: 12,
    padding: 16,
    paddingTop: 16,
    fontSize: 15,
    color: "#000",
    minHeight: 110,
    textAlignVertical: "top",
  },
});
