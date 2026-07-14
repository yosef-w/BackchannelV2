import {
  Briefcase,
  Check,
  ChevronLeft,
  ClipboardCheck,
  Handshake,
  Info,
  MessageCircle,
  ShieldCheck,
  Star,
  X,
} from "@/components/ui/icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  DismissibleSheet,
  SheetScrollView,
} from "../ui/DismissibleSheet";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import {
    getPublicProfile,
    submitReferral,
    type PublicProfileEducation,
    type PublicProfileExperience,
    type PublicProfileResponse,
} from "@/lib/api";
import { trackReferralSubmitted } from "@/lib/analytics/mixpanel";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import {
  BarFooter,
  canvasSheet,
  PacketCard,
  PersonHero,
  QuietAction,
  RoleTicket,
  SectionCard,
  SelectionCard,
  SkeletonCard,
  type PacketField,
} from "../matches/JobSheetKit";
import type { Conversation } from "../MessagesView";

/** Shown once (AsyncStorage-flagged), replayable via the header's ⓘ. */
const INTRO_SEEN_KEY = "@bc/referralIntroSeen";
// Panel width inside the sheet: window minus the canvas padding (20/side).
const INTRO_PANEL_W = Dimensions.get("window").width - 40;

const INTRO_PANELS = [
  {
    icon: Handshake,
    title: "You're the bridge",
    body: (first: string) =>
      `A referral here isn't a button click — it's your name opening a door for ${first}. Thank you for doing that.`,
  },
  {
    icon: Star,
    title: "Two minutes, honestly",
    body: (first: string) =>
      `You'll review ${first}'s full profile, confirm a few statements you can stand behind, and submit. That's the whole thing.`,
  },
  {
    icon: ClipboardCheck,
    title: "We prep the paperwork",
    body: (first: string) =>
      `You'll get a ready-to-copy packet of ${first}'s details for your company's referral portal — saved in Matches → Referrals whenever you need it.`,
  },
] as const;

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
 * Sponsor's referral flow, Robinhood-order-shaped: review the candidate
 * FIRST (read before you sign), then attest via whole-surface selection
 * cards (the old bare-text checkboxes didn't read as tappable), then a
 * receipt with the copyable referral packet — which also lives on
 * permanently as the sponsor-side referral detail in Matches → Referrals.
 */
export function ReferralFlowModal({
  visible,
  conversation,
  onClose,
  onSubmitted,
}: ReferralFlowModalProps) {
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const sponsorFirstName = useUserProfileStore(
    (s) => s.data.personal.firstName,
  );
  const [referralStep, setReferralStep] = useState(1);
  // Intro pager: null = flag not read yet; false = first-timer (show the
  // panels as step 0). Read at mount so it's settled long before opening.
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [introPanel, setIntroPanel] = useState(0);
  const introPagerRef = useRef<ScrollView>(null);
  useEffect(() => {
    AsyncStorage.getItem(INTRO_SEEN_KEY)
      .then((v) => setIntroSeen(v === "1"))
      .catch(() => setIntroSeen(true));
  }, []);

  const markIntroSeen = () => {
    setIntroSeen(true);
    AsyncStorage.setItem(INTRO_SEEN_KEY, "1").catch(() => {});
    setReferralStep(1);
  };
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
  // the flow is always fresh by the time it's shown again.
  useEffect(() => {
    if (visible) {
      // First-timers start on the why-this-matters panels (step 0).
      if (introSeen === false) {
        setReferralStep(0);
        setIntroPanel(0);
        introPagerRef.current?.scrollTo({ x: 0, animated: false });
      }
      return;
    }
    setReferralStep(1);
    setHasMessaged(false);
    setFeelsConfident(false);
    setKnowsBackground(false);
    setComfortableAttaching(false);
    setReferralError(null);
    setReferralSubmitting(false);
    setReferralProfile(null);
    // introSeen in deps: if the flag read resolves after the modal is
    // already open, this re-run still routes first-timers to the panels.
    // A false→true flip while open (finishing the intro) hits the early
    // return without touching the step.
  }, [visible, introSeen]);

  // Fetch the applicant's full public profile when the flow opens so the
  // candidate-review step shows rich, real data.
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

  // ── Derived candidate fields (profile fetch wins, conversation seeds) ──
  const photo = referralProfile?.PHOTO_URL || conversation.profileImageUrl;
  const name = referralProfile
    ? `${referralProfile.FIRST_NAME || ""} ${
        referralProfile.LAST_NAME || ""
      }`.trim()
    : conversation.otherParticipant?.name || conversation.name;
  const firstName = (name || "them").split(" ")[0];
  const currentRole =
    referralProfile?.applicant_profile?.CURRENT_ROLE ||
    conversation.otherParticipant?.role ||
    conversation.role ||
    "";
  const location = [referralProfile?.CITY, referralProfile?.STATE]
    .filter(Boolean)
    .join(", ");
  const industry = referralProfile?.applicant_profile?.INDUSTRY || "";
  const yearsExp = referralProfile?.applicant_profile?.YEARS_EXPERIENCE;
  const jobTitle = conversation.jobContext?.jobTitle || "";
  const company = conversation.jobContext?.company || "";
  const bio = referralProfile?.BIO;
  // These arrive as real arrays on this endpoint's path — the casts assert
  // that (same runtime as before typing).
  const experiences = (referralProfile?.applicant_profile
    ?.PROFESSIONAL_EXPERIENCES || []) as PublicProfileExperience[];
  const education = (referralProfile?.applicant_profile?.EDUCATION_ENTRIES ||
    []) as PublicProfileEducation[];
  const rawSkills =
    referralProfile?.applicant_profile?.SKILLS || conversation.skills || [];
  const skills: string[] = Array.isArray(rawSkills) ? rawSkills : [];
  const portfolioUrl = referralProfile?.PORTFOLIO_URL;

  // The packet — everything a sponsor types into their ATS portal. Rows
  // with empty values drop out automatically (PacketCard filters). An
  // Email row lights up if/when the backend adds APPLICANT_EMAIL (§Q).
  const packetFields: PacketField[] = [
    { label: "Name", value: name || "" },
    { label: "Role", value: currentRole },
    { label: "Location", value: location },
    { label: "Industry", value: industry },
    { label: "Experience", value: yearsExp ? `${yearsExp} years` : "" },
    { label: "Portfolio", value: portfolioUrl || "" },
    {
      label: "Referred for",
      value: [jobTitle, company].filter(Boolean).join(" at "),
    },
  ];

  const confirmedCount = [
    hasMessaged,
    feelsConfident,
    knowsBackground,
    comfortableAttaching,
  ].filter(Boolean).length;
  const allConfirmed = confirmedCount === 4;

  const handleSubmit = async () => {
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
      setReferralStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("400") || msg.toLowerCase().includes("already")) {
        setReferralError(
          "A referral already exists for this applicant and role.",
        );
      } else if (msg.includes("403") || msg.toLowerCase().includes("match")) {
        setReferralError(
          "You must be matched with this applicant to refer them.",
        );
      } else {
        setReferralError("Failed to submit referral. Please try again.");
      }
    } finally {
      setReferralSubmitting(false);
    }
  };

  return (
    <DismissibleSheet
      scrollDismiss
      onDismiss={onClose}
      style={[styles.referralFlowContainer, canvasSheet]}
    >
      {/* ── Header: back/close + segmented progress; ⓘ replays the
          why-this-matters panels ── */}
      {referralStep < 3 && (
        <View style={styles.flowHeader}>
          <TouchableOpacity
            onPress={() =>
              referralStep === 2 ? setReferralStep(1) : onClose()
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={referralStep === 2 ? "Back" : "Close"}
          >
            {referralStep === 2 ? (
              <ChevronLeft size={20} color="#999" />
            ) : (
              <X size={20} color="#999" />
            )}
          </TouchableOpacity>
          <View style={styles.segments}>
            {referralStep >= 1 && (
              <>
                <View style={[styles.segment, styles.segmentActive]} />
                <View
                  style={[
                    styles.segment,
                    referralStep === 2 && styles.segmentActive,
                  ]}
                />
              </>
            )}
          </View>
          <Text style={styles.flowTitle}>Refer {firstName}</Text>
          {referralStep >= 1 && (
            <TouchableOpacity
              onPress={() => {
                setIntroPanel(0);
                introPagerRef.current?.scrollTo({ x: 0, animated: false });
                setReferralStep(0);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="About referrals"
              style={{ marginLeft: 10 }}
            >
              <Info size={17} color="#9CA3AF" strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── STEP 0: Why this matters — one-time intro panels ── */}
      {referralStep === 0 && (
        <Animated.View entering={FadeInUp} style={styles.stepBody}>
          <ScrollView
            ref={introPagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setIntroPanel(
                Math.round(e.nativeEvent.contentOffset.x / INTRO_PANEL_W),
              )
            }
            style={{ flexGrow: 0 }}
          >
            {INTRO_PANELS.map((p) => {
              const PanelIcon = p.icon;
              return (
                <View key={p.title} style={styles.introPanel}>
                  <View style={styles.introCard}>
                    <View style={styles.introIconTile}>
                      <PanelIcon size={30} color="#000" strokeWidth={2} />
                    </View>
                    <Text style={styles.introTitle}>{p.title}</Text>
                    <Text style={styles.introBody}>{p.body(firstName)}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.introDots}>
            {INTRO_PANELS.map((_, i) => (
              <View
                key={i}
                style={[styles.introDot, i === introPanel && styles.introDotOn]}
              />
            ))}
          </View>
          <BarFooter
            button={{
              label:
                introPanel < INTRO_PANELS.length - 1 ? "Next" : "Let's Go",
              onPress: () => {
                if (introPanel < INTRO_PANELS.length - 1) {
                  const next = introPanel + 1;
                  setIntroPanel(next);
                  introPagerRef.current?.scrollTo({
                    x: next * INTRO_PANEL_W,
                    animated: true,
                  });
                } else {
                  markIntroSeen();
                }
              },
            }}
          >
            {introPanel < INTRO_PANELS.length - 1 && (
              <QuietAction label="Skip intro" onPress={markIntroSeen} />
            )}
          </BarFooter>
        </Animated.View>
      )}

      {/* ── STEP 1: The candidate — read before you sign ── */}
      {referralStep === 1 && (
        <Animated.View entering={FadeInUp} style={styles.stepBody}>
          <SheetScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            <PersonHero
              name={name || "This applicant"}
              image={photo || undefined}
              meta={currentRole || undefined}
              location={location || undefined}
              infoPill={
                [industry, yearsExp ? `${yearsExp} yrs experience` : ""]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            />

            {!!jobTitle && (
              <RoleTicket
                label="Referring for"
                title={jobTitle}
                company={company || undefined}
                logoUrl={conversation.jobContext?.logoUrl}
              />
            )}

            {referralProfileLoading && !referralProfile && (
              <>
                <SkeletonCard title="Summary" />
                <SkeletonCard title="Experience" />
              </>
            )}

            {!!bio && (
              <SectionCard title="Summary">
                <Text style={styles.bodyText}>{bio}</Text>
              </SectionCard>
            )}

            {(experiences.length > 0 || !!yearsExp) && (
              <SectionCard title="Experience">
                {!!yearsExp && (
                  <Text style={styles.entryMeta}>
                    {yearsExp} years in industry
                  </Text>
                )}
                {experiences.map((exp, idx) => (
                  <View
                    key={idx}
                    style={[styles.entryRow, idx > 0 && styles.entryDivider]}
                  >
                    <Text style={styles.entryTitle}>
                      {exp.jobTitle || "Role"}
                    </Text>
                    <Text style={styles.entryMeta}>
                      {exp.company || ""}
                      {exp.current
                        ? " · Current"
                        : exp.endDate
                          ? ` · ${exp.endDate}`
                          : ""}
                    </Text>
                  </View>
                ))}
              </SectionCard>
            )}

            {education.length > 0 && (
              <SectionCard title="Education">
                {education.map((edu, idx) => {
                  const degreeLine = [edu.degree, edu.major]
                    .filter(Boolean)
                    .join(" in ");
                  const head = degreeLine || edu.university || "Education";
                  const meta = degreeLine ? edu.university : "";
                  return (
                    <View
                      key={idx}
                      style={[styles.entryRow, idx > 0 && styles.entryDivider]}
                    >
                      <Text style={styles.entryTitle}>{head}</Text>
                      {!!meta && <Text style={styles.entryMeta}>{meta}</Text>}
                    </View>
                  );
                })}
              </SectionCard>
            )}

            {skills.length > 0 && (
              <SectionCard title="Key Skills">
                <View style={styles.skillsRow}>
                  {skills.map((skill: string, idx: number) => (
                    <View key={idx} style={styles.skillBadge}>
                      <Text style={styles.skillBadgeText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </SectionCard>
            )}

            {!!portfolioUrl && (
              <SectionCard title="Portfolio">
                <TouchableOpacity
                  onPress={() => Linking.openURL(portfolioUrl).catch(() => {})}
                  activeOpacity={0.7}
                >
                  <Text style={styles.portfolioLink} numberOfLines={1}>
                    {portfolioUrl}
                  </Text>
                </TouchableOpacity>
              </SectionCard>
            )}
          </SheetScrollView>

          <BarFooter
            button={{
              label: "Looks Right — Continue",
              onPress: () => setReferralStep(2),
            }}
          />
        </Animated.View>
      )}

      {/* ── STEP 2: The vouch — whole-surface attestation cards ── */}
      {referralStep === 2 && (
        <Animated.View entering={FadeInUp} style={styles.stepBody}>
          <SheetScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            <Text style={styles.stepLead}>
              Your name goes on this referral — that&apos;s what makes it
              worth more than a cold application. Tap each statement you can
              stand behind.
            </Text>

            <SelectionCard
              icon={<MessageCircle size={18} color="#000" strokeWidth={2.2} />}
              title="We've talked"
              description={`I've messaged and spoken with ${firstName} directly.`}
              selected={hasMessaged}
              onToggle={() => setHasMessaged((v) => !v)}
            />
            <SelectionCard
              icon={<Star size={18} color="#000" strokeWidth={2.2} />}
              title="I'm confident"
              description="They'd be successful in this role."
              selected={feelsConfident}
              onToggle={() => setFeelsConfident((v) => !v)}
            />
            <SelectionCard
              icon={<Briefcase size={18} color="#000" strokeWidth={2.2} />}
              title="I know their background"
              description="I'm aware of their experience and skill level."
              selected={knowsBackground}
              onToggle={() => setKnowsBackground((v) => !v)}
            />
            <SelectionCard
              icon={<ShieldCheck size={18} color="#000" strokeWidth={2.2} />}
              title="My name's on it"
              description="I'm comfortable attaching my name to this referral."
              selected={comfortableAttaching}
              onToggle={() => setComfortableAttaching((v) => !v)}
            />

            <Text style={styles.bindingNote}>
              Referrals are binding within BackChannel, and the outcome can
              affect your reputation score.
            </Text>

            {referralError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{referralError}</Text>
              </View>
            )}
          </SheetScrollView>

          <BarFooter
            context={{
              title: allConfirmed
                ? "All confirmed"
                : `${confirmedCount} of 4 confirmed`,
              done: allConfirmed,
              waiting: !allConfirmed,
            }}
            button={{
              label: "Submit Referral",
              disabled: !allConfirmed,
              loading: referralSubmitting,
              spinnerOnLoading: true,
              onPress: handleSubmit,
            }}
          />
        </Animated.View>
      )}

      {/* ── STEP 3: The receipt — success + the copyable packet ── */}
      {referralStep === 3 && (
        <Animated.View entering={FadeInDown} style={styles.stepBody}>
          <SheetScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            <View style={styles.successHeader}>
              <View style={styles.successIconCircle}>
                <Check color="#FFF" size={30} strokeWidth={3} />
              </View>
              <Text style={styles.successTitle}>
                Thank you{sponsorFirstName ? `, ${sponsorFirstName}` : ""}.
              </Text>
              <Text style={styles.successSub}>
                Referrals like this are how people get real chances — you
                just gave {firstName} one.
              </Text>
              <Text style={styles.successNext}>
                Next step: enter the packet below into your company&apos;s
                referral portal.
              </Text>
            </View>

            <PacketCard
              fields={packetFields}
              onCopied={(what) => showToast(`${what} copied.`, "success")}
            />

            <Text style={styles.savedHint}>
              🔖 Saved — find this packet anytime in Matches → Referrals.
            </Text>
          </SheetScrollView>

          <BarFooter button={{ label: "Done", onPress: onClose }}>
            <QuietAction
              label="View in Referrals"
              onPress={() => {
                onClose();
                router.navigate("/(tabs)/matches");
              }}
            />
          </BarFooter>
        </Animated.View>
      )}
    </DismissibleSheet>
  );
}

const styles = StyleSheet.create({
  referralFlowContainer: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    width: "100%",
    minHeight: 420,
    // Absolute px — a % maxHeight resolves against DismissibleSheet's
    // content-sized gesture-root wrapper, mis-measures, and floats the
    // sheet off the bottom of the screen (same trap as ProfileActionSheet).
    maxHeight: Dimensions.get("window").height * 0.88,
  },
  flowHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  segments: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    marginHorizontal: 14,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
  },
  segmentActive: { backgroundColor: "#000" },
  flowTitle: { fontSize: 13, fontWeight: "800", color: "#000" },
  stepBody: { flexShrink: 1 },
  scroll: { flexShrink: 1 },
  stepLead: {
    fontSize: 14,
    color: "#4B5563",
    fontWeight: "500",
    lineHeight: 20,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  bodyText: { fontSize: 14, color: "#4B5563", lineHeight: 21 },
  entryRow: { paddingVertical: 8 },
  entryDivider: {
    borderTopWidth: 1,
    borderTopColor: "rgba(15,23,42,0.06)",
  },
  entryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  entryMeta: { fontSize: 13, color: "#6B7280" },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  skillBadge: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: "#F0F2F7",
    borderRadius: 999,
  },
  skillBadgeText: { fontSize: 11, fontWeight: "700", color: "#000" },
  portfolioLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    textDecorationLine: "underline",
  },
  bindingNote: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
    lineHeight: 17,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
    lineHeight: 18,
  },
  successHeader: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 18,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  successSub: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 16,
  },
  successNext: {
    fontSize: 13,
    color: "#000",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  introPanel: {
    width: INTRO_PANEL_W,
    paddingBottom: 4,
  },
  introCard: {
    backgroundColor: "#FFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    alignItems: "center",
    paddingVertical: 34,
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  introIconTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F0F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 10,
  },
  introBody: {
    fontSize: 14,
    color: "#4B5563",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 21,
  },
  introDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginBottom: 10,
  },
  introDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  introDotOn: {
    backgroundColor: "#000",
    width: 18,
  },
  savedHint: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 8,
  },
});
