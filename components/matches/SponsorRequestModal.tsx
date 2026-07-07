import { CharCounter } from "@/components/ui/CharCounter";
import {
    BellRing,
    Briefcase,
    Check,
    ChevronRight,
    MessageCircle,
    X,
} from "@/components/ui/icons";
import { getRelativeTime } from "@/utils/relativeTime";
import { BlurView } from "expo-blur";
import React from "react";
import {
    ActivityIndicator,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { CompanyLogo } from "../ui/CompanyLogo";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import { SponsorRequest } from "./matchesQueries";
import { modalStyles } from "./sharedModalStyles";

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

      <DismissibleSheet onDismiss={onClose} style={modalStyles.modalContent}>
        {request && (
          <>
            {/* ── Step indicator (steps 2 & 3 only) ───────────────── */}
            {step === 2 && (
              <View style={styles.srStepRow}>
                <TouchableOpacity
                  onPress={() => onSetStep(1)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={20} color="#999" />
                </TouchableOpacity>
                <View style={styles.srStepDots}>
                  <View style={[styles.srDot, styles.srDotActive]} />
                  <View style={styles.srDot} />
                </View>
                <Text style={styles.srStepLabel}>Step 1 of 2</Text>
              </View>
            )}
            {step === 3 && (
              <View style={styles.srStepRow}>
                <TouchableOpacity
                  onPress={() => onSetStep(2)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={20} color="#999" />
                </TouchableOpacity>
                <View style={styles.srStepDots}>
                  <View style={[styles.srDot, styles.srDotActive]} />
                  <View style={[styles.srDot, styles.srDotActive]} />
                </View>
                <Text style={styles.srStepLabel}>Step 2 of 2</Text>
              </View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
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

                  {/* Applicant hero */}
                  <View style={styles.sponsorRequestHero}>
                    {request.applicantPhoto ? (
                      <Image
                        source={{ uri: request.applicantPhoto }}
                        style={styles.sponsorRequestAvatar}
                      />
                    ) : (
                      <View style={styles.sponsorRequestInitial}>
                        <Text style={styles.sponsorRequestInitialText}>
                          {(request.applicantName || "?")[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.sponsorRequestName}>
                      {request.applicantName}
                    </Text>
                    <Text style={styles.srOverviewSub}>
                      is requesting your sponsorship for this role
                    </Text>
                  </View>

                  {/* Job context card — tappable to review the full role.
                      Hero logo from the silver-detail fetch where possible
                      (the same job the chevron opens); /api/jobs/sponsor-requests/
                      doesn't currently include a logo, so the CompanyLogo
                      component falls back to the company initial. */}
                  <TouchableOpacity
                    style={styles.sponsorRequestJobCard}
                    onPress={onOpenJobDetail}
                    activeOpacity={0.75}
                  >
                    <CompanyLogo
                      logoUrl={
                        jobDetailPreview?.organization_logo ||
                        jobDetailPreview?.ORGANIZATION_LOGO
                      }
                      name={request.jobCompany}
                      size={40}
                      borderRadius={20}
                      initialFontSize={17}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sponsorRequestJobLabel}>
                        WANTS SPONSORSHIP FOR
                      </Text>
                      <Text
                        style={styles.sponsorRequestJobTitle}
                        numberOfLines={2}
                      >
                        {request.jobTitle}
                      </Text>
                      {!!request.jobCompany && (
                        <Text style={styles.sponsorRequestJobCompany}>
                          {request.jobCompany}
                        </Text>
                      )}
                      <Text style={styles.srJobCardTapHint}>
                        Tap to review this role
                      </Text>
                    </View>
                    <ChevronRight color="#CCC" size={18} />
                  </TouchableOpacity>

                  {/* What happens callout */}
                  <View style={[styles.srCallout, { marginTop: 20 }]}>
                    <Text style={styles.srCalloutTitle}>How This Works</Text>
                    <Text style={styles.srCalloutText}>
                      By sponsoring this role, you're putting your
                      professional backing behind{" "}
                      {request.applicantName.split(" ")[0]}'s application.
                      Once you do, {request.applicantName.split(" ")[0]} will
                      be able to connect with you directly — opening the door
                      to communicate and provide a referral.
                    </Text>
                  </View>

                  {/* Primary CTA → step 2 */}
                  <TouchableOpacity
                    style={modalStyles.applyBtnLarge}
                    onPress={() => onSetStep(2)}
                  >
                    <Briefcase color="#FFF" size={20} strokeWidth={2.5} />
                    <Text style={modalStyles.applyBtnLargeText}>
                      Sponsor & Connect
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.srDismissBtn}
                    onPress={onClose}
                  >
                    <Text style={styles.srDismissBtnText}>Not right now</Text>
                  </TouchableOpacity>
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

                  <TouchableOpacity
                    style={[
                      modalStyles.applyBtnLarge,
                      (!relationship || canRefer === null) && {
                        opacity: 0.35,
                      },
                    ]}
                    disabled={!relationship || canRefer === null}
                    onPress={() => onSetStep(3)}
                  >
                    <Text style={modalStyles.applyBtnLargeText}>Continue</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── STEP 3: Insider Insights ──────────────────────── */}
              {step === 3 && (
                <>
                  <Text style={styles.srStepTitle}>
                    Add Insider Insights
                  </Text>
                  <Text style={styles.srStepSub}>
                    Share the inside story candidates won't find anywhere
                    else. All fields are optional.
                  </Text>

                  <View style={styles.srCallout}>
                    <Text style={styles.srCalloutTitle}>
                      💡 Why This Matters
                    </Text>
                    <Text style={styles.srCalloutText}>
                      Unlike traditional job boards, BackChannel gives
                      candidates real insider knowledge — which means better
                      applicants and fewer surprises on both sides.
                    </Text>
                  </View>

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
                        placeholderTextColor="#999"
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

                  <TouchableOpacity
                    style={[
                      modalStyles.applyBtnLarge,
                      sponsoring && { opacity: 0.6 },
                    ]}
                    disabled={sponsoring}
                    onPress={() => onSponsorAndConnect(request)}
                  >
                    {sponsoring ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Check color="#FFF" size={20} strokeWidth={2.5} />
                        <Text style={modalStyles.applyBtnLargeText}>
                          Confirm Sponsorship
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
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
                    You're now sponsoring{" "}
                    <Text style={{ fontWeight: "800" }}>
                      {request.jobTitle}
                    </Text>
                    .{"\n\n"}
                    {request.applicantName.split(" ")[0]} will see you under
                    "Wants to Connect With You" and can message you directly
                    once they connect back.
                  </Text>

                  {/* Message now — only available if we already have a
                      matched jobId back from the sponsorJob call */}
                  {newJobId && onNavigateToMessages && (
                    <TouchableOpacity
                      style={[modalStyles.applyBtnLarge, { marginBottom: 12 }]}
                      onPress={() => {
                        const jid = newJobId;
                        onClose();
                        onNavigateToMessages(jid, request.applicantUserId);
                      }}
                    >
                      <MessageCircle color="#FFF" size={20} strokeWidth={2.5} />
                      <Text style={modalStyles.applyBtnLargeText}>
                        Message Now
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.srDismissBtn} onPress={onClose}>
                    <Text style={styles.srDismissBtnText}>
                      Back to Matches
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </ScrollView>
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
    color: "#DC2626",
    fontWeight: "700",
  },
  sponsorRequestAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F2F2F2",
    marginBottom: 12,
  },
  sponsorRequestHero: {
    alignItems: "center",
    marginBottom: 18,
  },
  sponsorRequestInitial: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F2F2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  sponsorRequestInitialText: {
    fontSize: 36,
    fontWeight: "800",
    color: "#999",
  },
  sponsorRequestJobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F8F9FB",
    borderWidth: 1,
    borderColor: "#EEE",
    padding: 16,
    borderRadius: 16,
  },
  sponsorRequestJobCompany: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginTop: 2,
  },
  sponsorRequestJobLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sponsorRequestJobTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    lineHeight: 21,
  },
  sponsorRequestName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  srCallout: {
    backgroundColor: "#F0F0F0",
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#000",
  },
  srCalloutText: { fontSize: 14, color: "#555", lineHeight: 22 },
  srCalloutTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
    marginBottom: 8,
  },
  srDismissBtn: { alignItems: "center", marginTop: 14, paddingVertical: 8 },
  srDismissBtnText: { fontSize: 14, color: "#999", fontWeight: "600" },
  srDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E5E5",
  },
  srDotActive: { backgroundColor: "#000", width: 24, borderRadius: 4 },
  srFieldHint: {
    fontSize: 13,
    color: "#999",
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
  srHalfOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  srJobCardTapHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#AAA",
    marginTop: 6,
    letterSpacing: 0.2,
  },
  srOverviewSub: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  },
  srRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CCC",
  },
  srRadioCircleActive: { borderColor: "#000", borderWidth: 6 },
  srRadioLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  srRadioOption: {
    backgroundColor: "#F9F9F9",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
    marginBottom: 12,
  },
  srRadioText: { fontSize: 15, color: "#666", fontWeight: "600" },
  srRadioTextActive: { color: "#000", fontWeight: "600" },
  srSideBySide: { flexDirection: "row", gap: 12 },
  srStepDots: { flexDirection: "row", gap: 6 },
  srStepLabel: { fontSize: 12, fontWeight: "700", color: "#999" },
  srStepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  srStepSub: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 24,
  },
  srStepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    marginBottom: 6,
  },
  srSuccessContainer: {
    alignItems: "center",
    paddingVertical: 20,
    width: "100%",
  },
  srSuccessDesc: {
    fontSize: 14,
    color: "#666",
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
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
    color: "#000",
  },
  srTextInput: {
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 12,
    padding: 16,
    paddingTop: 16,
    fontSize: 15,
    color: "#000",
    minHeight: 110,
    textAlignVertical: "top",
  },
});
