import {
  Briefcase,
  CheckCircle,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  Globe,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "@/components/ui/icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp, SlideInDown } from "react-native-reanimated";
import {
    getPublicProfile,
    submitReferral,
    type PublicProfileEducation,
    type PublicProfileExperience,
    type PublicProfileResponse,
} from "@/lib/api";
import { trackReferralSubmitted } from "@/lib/analytics/mixpanel";
import { CompanyLogo } from "../ui/CompanyLogo";
import type { Conversation } from "../MessagesView";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ReferralFlowModalProps {
  visible: boolean;
  conversation: Conversation;
  onClose: () => void;
  /** Fired right after a successful submission, before advancing to the
   * success step — parent uses this to add the pair to `referredSet` so the
   * header "Referred" badge updates without a re-fetch. */
  onSubmitted: (applicantUserId: string, jobId: string) => void;
}

/**
 * Sponsor's referral-vetting flow (confidence checklist → candidate review →
 * submit → success). Extracted from MessagesView as a self-contained modal —
 * every piece of state here (the step, the four checkboxes, submit/error
 * state, and the lazily-fetched candidate profile) has zero readers outside
 * this modal, confirmed by a state-ownership audit before extraction.
 */
export function ReferralFlowModal({
  visible,
  conversation,
  onClose,
  onSubmitted,
}: ReferralFlowModalProps) {
  const [referralStep, setReferralStep] = useState(1);
  const [hasMessaged, setHasMessaged] = useState(false);
  const [feelsConfident, setFeelsConfident] = useState(false);
  const [knowsBackground, setKnowsBackground] = useState(false);
  const [comfortableAttaching, setComfortableAttaching] = useState(false);
  const [referralSubmitting, setReferralSubmitting] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralProfile, setReferralProfile] =
    useState<PublicProfileResponse | null>(null);
  const [referralProfileLoading, setReferralProfileLoading] = useState(false);

  // Reset all local state the moment the modal hides — mirrors the original
  // resetReferralFlow() that ran on every close button in MessagesView, so
  // the flow is always fresh by the time it's shown again (every open is
  // preceded by a close in the current UI, but resetting on hide is the
  // more robust invariant and needs no assumption about call order).
  useEffect(() => {
    if (visible) return;
    setReferralStep(1);
    setHasMessaged(false);
    setFeelsConfident(false);
    setKnowsBackground(false);
    setComfortableAttaching(false);
    setReferralError(null);
    setReferralSubmitting(false);
    setReferralProfile(null);
  }, [visible]);

  // Fetch the applicant's full public profile when the flow opens so the
  // Step 2 review card can show rich, real data.
  useEffect(() => {
    if (!visible) return;
    const applicantId = conversation.otherParticipant?.id;
    if (!applicantId) return;
    setReferralProfileLoading(true);
    getPublicProfile(String(applicantId))
      .then((profile) => setReferralProfile(profile))
      .catch((err) =>
        console.warn("[ReferralFlowModal] Failed to fetch referral profile:", err),
      )
      .finally(() => setReferralProfileLoading(false));
  }, [visible, conversation.otherParticipant?.id]);

  const canProceedFromStep1 =
    hasMessaged && feelsConfident && knowsBackground && comfortableAttaching;

  return (
    <Animated.View entering={SlideInDown} style={styles.referralFlowContainer}>
      <View style={styles.flowHeader}>
        <Text style={styles.flowTitle}>Referral Vetting</Text>
        <TouchableOpacity onPress={onClose}>
          <X color="#000" size={24} />
        </TouchableOpacity>
      </View>
      {referralStep === 1 && (
        <Animated.View entering={FadeInUp} style={styles.stepContent}>
          <Text style={styles.stepSubtitle}>Confidence Check</Text>
          <Text style={styles.stepDesc}>
            Before referring{" "}
            {conversation.otherParticipant?.name || conversation.name},
            please confirm your due diligence:
          </Text>
          <View style={styles.vettingList}>
            <TouchableOpacity
              style={styles.vettingItem}
              onPress={() => setHasMessaged(!hasMessaged)}
              activeOpacity={0.7}
            >
              <View style={styles.vettingCheck}>
                {hasMessaged ? (
                  <CheckCircle size={18} color="#000" />
                ) : (
                  <CheckCircle size={18} color="#E5E5E5" />
                )}
              </View>
              <Text style={styles.vettingText}>
                I have messaged and spoken to the applicant directly.
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.vettingItem}
              onPress={() => setFeelsConfident(!feelsConfident)}
              activeOpacity={0.7}
            >
              <View style={styles.vettingCheck}>
                {feelsConfident ? (
                  <CheckCircle size={18} color="#000" />
                ) : (
                  <CheckCircle size={18} color="#E5E5E5" />
                )}
              </View>
              <Text style={styles.vettingText}>
                I feel confident they would be successful in this role.
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.vettingItem}
              onPress={() => setKnowsBackground(!knowsBackground)}
              activeOpacity={0.7}
            >
              <View style={styles.vettingCheck}>
                {knowsBackground ? (
                  <CheckCircle size={18} color="#000" />
                ) : (
                  <CheckCircle size={18} color="#E5E5E5" />
                )}
              </View>
              <Text style={styles.vettingText}>
                I am aware of their background and experience level.
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.vettingItem}
              onPress={() => setComfortableAttaching(!comfortableAttaching)}
              activeOpacity={0.7}
            >
              <View style={styles.vettingCheck}>
                {comfortableAttaching ? (
                  <CheckCircle size={18} color="#000" />
                ) : (
                  <CheckCircle size={18} color="#E5E5E5" />
                )}
              </View>
              <Text style={styles.vettingText}>
                I feel comfortable attaching my name to this referral.
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              !canProceedFromStep1 && styles.primaryBtnDisabled,
            ]}
            onPress={() => canProceedFromStep1 && setReferralStep(2)}
            disabled={!canProceedFromStep1}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryBtnText}>Review Applicant Details</Text>
            <ChevronRight color="#FFF" size={18} />
          </TouchableOpacity>
        </Animated.View>
      )}
      {referralStep === 2 && (
        <Animated.View entering={FadeInUp} style={styles.stepContent}>
          <ScrollView
            style={styles.summaryScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {referralProfileLoading ? (
              <View style={styles.referralProfileLoading}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: "#F4F4F5",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 8,
                  }}
                >
                  <User color="#BBB" size={24} strokeWidth={2} />
                </View>
                <Text style={styles.referralProfileLoadingText}>
                  Loading candidate details…
                </Text>
              </View>
            ) : (
              (() => {
                const photo =
                  referralProfile?.PHOTO_URL || conversation.profileImageUrl;
                const name = referralProfile
                  ? `${referralProfile.FIRST_NAME || ""} ${
                      referralProfile.LAST_NAME || ""
                    }`.trim()
                  : conversation.otherParticipant?.name || conversation.name;
                const currentRole =
                  referralProfile?.applicant_profile?.CURRENT_ROLE ||
                  conversation.otherParticipant?.role ||
                  conversation.role ||
                  "";
                const location = [referralProfile?.CITY, referralProfile?.STATE]
                  .filter(Boolean)
                  .join(", ");
                const industry =
                  referralProfile?.applicant_profile?.INDUSTRY || "";
                const yearsExp =
                  referralProfile?.applicant_profile?.YEARS_EXPERIENCE;
                const jobTitle = conversation.jobContext?.jobTitle || "";
                const company = conversation.jobContext?.company || "";
                const bio = referralProfile?.BIO;
                // These arrive as real arrays on this endpoint's path —
                // the casts assert that (same runtime as before typing).
                const experiences = (referralProfile?.applicant_profile
                  ?.PROFESSIONAL_EXPERIENCES || []) as PublicProfileExperience[];
                const education = (referralProfile?.applicant_profile
                  ?.EDUCATION_ENTRIES || []) as PublicProfileEducation[];
                const rawSkills =
                  referralProfile?.applicant_profile?.SKILLS ||
                  conversation.skills ||
                  [];
                // SKILLS is a real array on this endpoint's path; tolerate
                // the string-encoded variant by falling back to [].
                const skills: string[] = Array.isArray(rawSkills)
                  ? rawSkills
                  : [];
                const portfolioUrl = referralProfile?.PORTFOLIO_URL;

                return (
                  <View style={{ gap: 12 }}>
                    {/* ATS hint banner — monochrome, modern */}
                    <View style={styles.atsBanner}>
                      <FileText size={14} color="#666" strokeWidth={2} />
                      <Text style={styles.atsBannerText}>
                        Enter these details into your ATS portal when
                        submitting the referral.
                      </Text>
                    </View>

                    {/* Hero: avatar + name + current role + quick chips */}
                    <View style={styles.candidateHero}>
                      {photo ? (
                        <Image
                          source={{ uri: photo }}
                          style={styles.candidateHeroAvatar}
                        />
                      ) : (
                        <View
                          style={[
                            styles.candidateHeroAvatar,
                            styles.candidateHeroAvatarFallback,
                          ]}
                        >
                          <User color="#999" size={32} />
                        </View>
                      )}
                      <Text style={styles.candidateHeroName} numberOfLines={1}>
                        {name}
                      </Text>
                      {!!currentRole && (
                        <Text style={styles.candidateHeroRole} numberOfLines={1}>
                          {currentRole}
                        </Text>
                      )}
                      {(!!location || !!industry || !!yearsExp) && (
                        <View style={styles.candidateChipsRow}>
                          {!!location && (
                            <View style={styles.candidateChip}>
                              <MapPin size={11} color="#666" />
                              <Text style={styles.candidateChipText}>
                                {location}
                              </Text>
                            </View>
                          )}
                          {!!industry && (
                            <View style={styles.candidateChip}>
                              <Briefcase size={11} color="#666" />
                              <Text style={styles.candidateChipText}>
                                {industry}
                              </Text>
                            </View>
                          )}
                          {!!yearsExp && (
                            <View style={styles.candidateChip}>
                              <Clock size={11} color="#666" />
                              <Text style={styles.candidateChipText}>
                                {yearsExp} yrs
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {/* APPLYING FOR — role-context card. Hero logo from PR
                        #62 pipeline when conversations eventually carry one
                        (currently undefined, so falls back to the company
                        initial). */}
                    {!!jobTitle && (
                      <View style={styles.refContext}>
                        <View style={styles.refContextRow}>
                          <CompanyLogo
                            logoUrl={conversation.jobContext?.logoUrl}
                            name={company || jobTitle}
                            size={40}
                            borderRadius={10}
                            initialFontSize={17}
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.refContextLabel}>
                              APPLYING FOR
                            </Text>
                            <Text style={styles.refContextTitle} numberOfLines={1}>
                              {jobTitle}
                            </Text>
                            {!!company && (
                              <Text
                                style={styles.refContextCompany}
                                numberOfLines={1}
                              >
                                {company}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Professional Summary */}
                    {!!bio && (
                      <View style={styles.refSection}>
                        <View style={styles.refSectionHeader}>
                          <FileText size={16} color="#000" />
                          <Text style={styles.refSectionTitle}>
                            Professional Summary
                          </Text>
                        </View>
                        <Text style={styles.refSectionBody}>{bio}</Text>
                      </View>
                    )}

                    {/* Experience — full list */}
                    {(experiences.length > 0 || !!yearsExp) && (
                      <View style={styles.refSection}>
                        <View style={styles.refSectionHeader}>
                          <Briefcase size={16} color="#000" />
                          <Text style={styles.refSectionTitle}>Experience</Text>
                        </View>
                        {!!yearsExp && (
                          <Text style={styles.refSectionMeta}>
                            {yearsExp} years in industry
                          </Text>
                        )}
                        {experiences.map((exp, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.refEntryRow,
                              idx > 0 && styles.refEntryRowDivider,
                            ]}
                          >
                            <Text style={styles.refEntryTitle}>
                              {exp.jobTitle || "Role"}
                            </Text>
                            <Text style={styles.refEntryMeta}>
                              {exp.company || ""}
                              {exp.current
                                ? " · Current"
                                : exp.endDate
                                  ? ` · ${exp.endDate}`
                                  : ""}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Education — full list */}
                    {education.length > 0 && (
                      <View style={styles.refSection}>
                        <View style={styles.refSectionHeader}>
                          <GraduationCap size={16} color="#000" />
                          <Text style={styles.refSectionTitle}>Education</Text>
                        </View>
                        {education.map((edu, idx) => {
                          const degreeLine = [edu.degree, edu.major]
                            .filter(Boolean)
                            .join(" in ");
                          const head =
                            degreeLine || edu.university || "Education";
                          const meta = degreeLine ? edu.university : "";
                          return (
                            <View
                              key={idx}
                              style={[
                                styles.refEntryRow,
                                idx > 0 && styles.refEntryRowDivider,
                              ]}
                            >
                              <Text style={styles.refEntryTitle}>{head}</Text>
                              {!!meta && (
                                <Text style={styles.refEntryMeta}>{meta}</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Key Skills */}
                    {skills.length > 0 && (
                      <View style={styles.refSection}>
                        <View style={styles.refSectionHeader}>
                          <Sparkles size={16} color="#000" />
                          <Text style={styles.refSectionTitle}>Key Skills</Text>
                        </View>
                        <View style={styles.skillsRow}>
                          {skills.map((skill: string, idx: number) => (
                            <View key={idx} style={styles.skillBadge}>
                              <Text style={styles.skillBadgeText}>{skill}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Portfolio */}
                    {!!portfolioUrl && (
                      <View style={styles.refSection}>
                        <View style={styles.refSectionHeader}>
                          <Globe size={16} color="#000" />
                          <Text style={styles.refSectionTitle}>Portfolio</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() =>
                            Linking.openURL(portfolioUrl).catch(() => {})
                          }
                          activeOpacity={0.7}
                          style={styles.refPortfolio}
                        >
                          <Text style={styles.refPortfolioText} numberOfLines={1}>
                            {portfolioUrl}
                          </Text>
                          <Globe size={14} color="#666" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })()
            )}
            {/* Final Confirmation — always shown, even while the candidate
                profile is still loading */}
            <View style={[styles.refSection, { marginTop: 12 }]}>
              <View style={styles.refSectionHeader}>
                <ShieldCheck size={16} color="#000" />
                <Text style={styles.refSectionTitle}>Final Confirmation</Text>
              </View>
              <View style={styles.refFinalRow}>
                <View style={styles.refFinalBullet} />
                <Text style={styles.refFinalText}>
                  This referral is binding within our system.
                </Text>
              </View>
              <View style={styles.refFinalRow}>
                <View style={styles.refFinalBullet} />
                <Text style={styles.refFinalText}>
                  Your reputation score may be affected by the outcome.
                </Text>
              </View>
            </View>
          </ScrollView>
          {/* Inline error — shown if submission fails */}
          {referralError && (
            <View style={styles.referralErrorBox}>
              <Text style={styles.referralErrorText}>{referralError}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.confirmBtn, referralSubmitting && { opacity: 0.65 }]}
            onPress={async () => {
              const applicantUserId = conversation.otherParticipant?.id;
              const jobId = conversation.jobContext?.jobId;

              if (!applicantUserId || !jobId) {
                setReferralError(
                  "Missing applicant or job information. Please try again.",
                );
                return;
              }

              setReferralSubmitting(true);
              setReferralError(null);
              try {
                await submitReferral({
                  applicant_user_id: applicantUserId,
                  job_id: jobId,
                  confidence_checks: {
                    has_messaged: hasMessaged,
                    feels_confident: feelsConfident,
                    knows_background: knowsBackground,
                    comfortable_attaching: comfortableAttaching,
                  },
                });
                trackReferralSubmitted({
                  conversationId: conversation.id,
                  jobId,
                  applicantUserId,
                });
                // Mark this pair as referred so the header button updates
                // immediately without a re-fetch.
                onSubmitted(applicantUserId, jobId);
                // Submission succeeded — move to success step
                setReferralStep(3);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes("400") || msg.toLowerCase().includes("already")) {
                  setReferralError(
                    "A referral already exists for this applicant and role.",
                  );
                } else if (
                  msg.includes("403") ||
                  msg.toLowerCase().includes("match")
                ) {
                  setReferralError(
                    "You must be matched with this applicant to refer them.",
                  );
                } else {
                  setReferralError(
                    "Failed to submit referral. Please try again.",
                  );
                }
              } finally {
                setReferralSubmitting(false);
              }
            }}
            disabled={referralSubmitting}
            activeOpacity={0.7}
          >
            {referralSubmitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <ClipboardCheck color="#FFF" size={20} />
                <Text style={styles.primaryBtnText}>Submit Formal Referral</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}
      {referralStep === 3 && (
        <Animated.View entering={FadeInDown} style={styles.successStep}>
          <View style={styles.successIcon}>
            <CheckCircle size={60} color="#000" />
          </View>
          <Text style={styles.successTitle}>Referral Submitted!</Text>
          <Text style={styles.successDesc}>
            You have successfully referred{" "}
            {referralProfile
              ? `${referralProfile.FIRST_NAME || ""} ${referralProfile.LAST_NAME || ""}`.trim()
              : conversation.otherParticipant?.name || conversation.name}{" "}
            for the {conversation.jobContext?.jobTitle || "this"} position.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryBtnText}>Back to Messages</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  referralFlowContainer: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 32,
    paddingBottom: 50,
    width: "100%",
    minHeight: 400,
  },
  flowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  flowTitle: { fontSize: 24, fontWeight: "800" },
  stepContent: { gap: 12 },
  stepSubtitle: { fontSize: 18, fontWeight: "700", color: "#000" },
  stepDesc: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 10 },
  vettingList: { gap: 16, marginBottom: 20 },
  vettingItem: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  vettingCheck: { marginTop: 2 },
  vettingText: { fontSize: 15, fontWeight: "600", color: "#444", flex: 1 },
  primaryBtn: {
    backgroundColor: "#000",
    paddingVertical: 18,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  primaryBtnDisabled: { backgroundColor: "#E5E5E5" },
  primaryBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  summaryScroll: { maxHeight: SCREEN_HEIGHT * 0.6, marginBottom: 10 },
  // ATS hint banner — monochrome, modern
  atsBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F4F4F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  atsBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    lineHeight: 17,
  },
  // Hero — centered avatar + name + role + quick-stats chips
  candidateHero: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  candidateHeroAvatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    marginBottom: 14,
    backgroundColor: "#EEE",
  },
  candidateHeroAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F4F5",
  },
  candidateHeroName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  candidateHeroRole: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
  },
  candidateChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  candidateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: "#F4F4F5",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  candidateChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#666",
  },
  // APPLYING FOR — role-context card (mirrors ProfileDetailSheet roleContext)
  refContext: {
    backgroundColor: "#F8F9FB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEE",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  refContextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  refContextLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#999",
    marginBottom: 6,
  },
  refContextTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
  },
  refContextCompany: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginTop: 2,
  },
  // Detail sections — mirror the MatchesView detailSection aesthetic
  refSection: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  refSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  refSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  refSectionBody: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
  },
  refSectionMeta: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    marginBottom: 8,
  },
  // Experience / Education entry rows (stack with subtle dividers)
  refEntryRow: {
    paddingVertical: 8,
  },
  refEntryRowDivider: {
    borderTopWidth: 1,
    borderTopColor: "#F4F4F5",
  },
  refEntryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  refEntryMeta: {
    fontSize: 13,
    color: "#666",
  },
  // Portfolio link tile
  refPortfolio: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  refPortfolioText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#000",
  },
  // Skills badges (shared within refSection)
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  skillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#F4F4F5",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  skillBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
  },
  // Final Confirmation rows
  refFinalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 5,
  },
  refFinalBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#000",
    marginTop: 8,
  },
  refFinalText: {
    flex: 1,
    fontSize: 13,
    color: "#444",
    fontWeight: "500",
    lineHeight: 19,
  },
  confirmBtn: {
    backgroundColor: "#000",
    paddingVertical: 18,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  successStep: { alignItems: "center", paddingVertical: 20, width: "100%" },
  successIcon: { marginBottom: 20 },
  successTitle: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
  successDesc: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  referralProfileLoading: {
    paddingVertical: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  referralProfileLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    fontWeight: "400" as const,
  },
  referralErrorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  referralErrorText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
    lineHeight: 18,
  },
});
