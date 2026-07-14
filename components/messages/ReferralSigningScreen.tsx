// ReferralSigningScreen — "The Signing": the referral flow as a full-screen
// ceremony, not a form in a drawer. Four acts: the candidate (editorial,
// photo-forward), the vouch (one statement per screen, stamped with a tap),
// the signature (the app's single dark screen — hold-to-sign, Apple-Pay
// energy), and the receipt (gratitude + the copyable ATS packet). First
// timers get three intro frames (AsyncStorage-flagged, replayable via ⓘ).
//
// The engine is unchanged from the old sheet: same submitReferral payload,
// same four confidence checks, same analytics and onSubmitted contract.

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
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  runOnJS,
  SlideInRight,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
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
  PacketCard,
  PillButton,
  QuietAction,
  SectionCard,
  SkeletonCard,
  type PacketField,
} from "../matches/JobSheetKit";
import { CompanyLogo } from "../ui/CompanyLogo";
import type { Conversation } from "../MessagesView";

const { width: SCREEN_W } = Dimensions.get("window");
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Shown once (AsyncStorage-flagged), replayable via the header's ⓘ. */
const INTRO_SEEN_KEY = "@bc/referralIntroSeen";

const INTRO_FRAMES = [
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
      `You'll review ${first}'s full profile, stand behind a few statements, and sign. That's the whole thing.`,
  },
  {
    icon: ClipboardCheck,
    title: "We prep the paperwork",
    body: (first: string) =>
      `You'll get a ready-to-copy packet of ${first}'s details for your company's referral portal — saved in Matches → Referrals whenever you need it.`,
  },
] as const;

/** The four attestations, staged one per screen. Keys map 1:1 onto the
 * confidence_checks payload — semantics identical to the old checklist. */
const STATEMENTS = [
  {
    key: "has_messaged" as const,
    icon: MessageCircle,
    text: (first: string) =>
      `I've messaged and spoken with ${first} directly.`,
  },
  {
    key: "feels_confident" as const,
    icon: Star,
    text: (first: string) => `I'm confident ${first} would succeed in this role.`,
  },
  {
    key: "knows_background" as const,
    icon: Briefcase,
    text: (first: string) => `I know ${first}'s background and experience.`,
  },
  {
    key: "comfortable_attaching" as const,
    icon: ShieldCheck,
    text: () => `I'm comfortable putting my name on this referral.`,
  },
];

/** How long the sign button must be held, and the ring geometry. */
const HOLD_MS = 1200;
const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;
/** Aborted holds before the plain fallback button appears — delight must
 * never gate function. */
const FALLBACK_AFTER_ABORTS = 3;

type Act = "intro" | "candidate" | "vouch" | "sign" | "receipt";

interface ReferralSigningScreenProps {
  visible: boolean;
  conversation: Conversation;
  onClose: () => void;
  /** Fired right after a successful submission — parent adds the pair to
   * `referredSet` so the header "Referred" badge updates without a
   * re-fetch. */
  onSubmitted: (applicantUserId: string, jobId: string) => void;
}

// ── Hold-to-sign ──────────────────────────────────────────────────────────

function HoldToSign({
  onComplete,
  onAbort,
}: {
  onComplete: () => void;
  /** Fired when a hold is released before completing. */
  onAbort: () => void;
}) {
  const progress = useSharedValue(0);
  const completedRef = useRef(false);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    onComplete();
  };
  const tick = () => {
    Haptics.selectionAsync().catch(() => {});
  };

  // Haptic ramp — a tick each quarter of the way in.
  useAnimatedReaction(
    () => progress.value,
    (curr, prev) => {
      if (prev === null) return;
      for (const t of [0.25, 0.5, 0.75]) {
        if (prev < t && curr >= t) runOnJS(tick)();
      }
    },
  );

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - progress.value),
  }));
  const pressScale = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * 0.06 }],
  }));

  return (
    <View style={holdStyles.wrap}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
          progress.value = withTiming(
            1,
            { duration: HOLD_MS, easing: Easing.linear },
            (finished) => {
              if (finished) runOnJS(finish)();
            },
          );
        }}
        onPressOut={() => {
          if (completedRef.current) return;
          if (progress.value < 1) {
            cancelAnimation(progress);
            progress.value = withTiming(0, { duration: 160 });
            onAbort();
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="Hold to sign and submit the referral"
      >
        <Animated.View style={[holdStyles.button, pressScale]}>
          <Svg
            width={RING_R * 2 + 12}
            height={RING_R * 2 + 12}
            style={StyleSheet.absoluteFill}
          >
            <Circle
              cx={RING_R + 6}
              cy={RING_R + 6}
              r={RING_R}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={4}
              fill="none"
            />
            <AnimatedCircle
              cx={RING_R + 6}
              cy={RING_R + 6}
              r={RING_R}
              stroke="#FFF"
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${RING_C} ${RING_C}`}
              animatedProps={ringProps}
              // Start the sweep from 12 o'clock.
              transform={`rotate(-90 ${RING_R + 6} ${RING_R + 6})`}
            />
          </Svg>
          <View style={holdStyles.inner}>
            <Check size={30} color="#000" strokeWidth={3} />
          </View>
        </Animated.View>
      </TouchableOpacity>
      <Text style={holdStyles.label}>Hold to sign</Text>
    </View>
  );
}

const holdStyles = StyleSheet.create({
  wrap: { alignItems: "center" },
  button: {
    width: RING_R * 2 + 12,
    height: RING_R * 2 + 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    width: RING_R * 2 - 18,
    height: RING_R * 2 - 18,
    borderRadius: RING_R - 9,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.3,
  },
});

// ── The screen ────────────────────────────────────────────────────────────

export function ReferralSigningScreen({
  visible,
  conversation,
  onClose,
  onSubmitted,
}: ReferralSigningScreenProps) {
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const sponsorFirstName = useUserProfileStore(
    (s) => s.data.personal.firstName,
  );

  const [act, setAct] = useState<Act>("candidate");
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [introFrame, setIntroFrame] = useState(0);
  const introPagerRef = useRef<ScrollView>(null);
  const [statementIndex, setStatementIndex] = useState(0);
  const [stamped, setStamped] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [signAborts, setSignAborts] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(INTRO_SEEN_KEY)
      .then((v) => setIntroSeen(v === "1"))
      .catch(() => setIntroSeen(true));
  }, []);

  // Fresh state each open; first-timers start on the intro frames.
  useEffect(() => {
    if (visible) {
      if (introSeen === false) {
        setAct("intro");
        setIntroFrame(0);
        introPagerRef.current?.scrollTo({ x: 0, animated: false });
      }
      return;
    }
    setAct("candidate");
    setStatementIndex(0);
    setStamped(false);
    setChecks({});
    setSignAborts(0);
    setSubmitting(false);
    setSubmitError(null);
    setProfile(null);
  }, [visible, introSeen]);

  // Full public profile for the candidate act + the packet.
  useEffect(() => {
    if (!visible) return;
    const applicantId = conversation.otherParticipant?.id;
    if (!applicantId) return;
    setProfileLoading(true);
    getPublicProfile(String(applicantId))
      .then(setProfile)
      .catch((err) =>
        console.warn("[ReferralSigning] Failed to fetch profile:", err),
      )
      .finally(() => setProfileLoading(false));
  }, [visible, conversation.otherParticipant?.id]);

  const markIntroSeen = () => {
    setIntroSeen(true);
    AsyncStorage.setItem(INTRO_SEEN_KEY, "1").catch(() => {});
    setAct("candidate");
  };

  // ── Candidate fields (profile fetch wins, conversation seeds) ──
  const photo = profile?.PHOTO_URL || conversation.profileImageUrl;
  const name = profile
    ? `${profile.FIRST_NAME || ""} ${profile.LAST_NAME || ""}`.trim()
    : conversation.otherParticipant?.name || conversation.name;
  const firstName = (name || "them").split(" ")[0];
  const currentRole =
    profile?.applicant_profile?.CURRENT_ROLE ||
    conversation.otherParticipant?.role ||
    conversation.role ||
    "";
  const location = [profile?.CITY, profile?.STATE].filter(Boolean).join(", ");
  const industry = profile?.applicant_profile?.INDUSTRY || "";
  const yearsExp = profile?.applicant_profile?.YEARS_EXPERIENCE;
  const jobTitle = conversation.jobContext?.jobTitle || "";
  const company = conversation.jobContext?.company || "";
  const bio = profile?.BIO;
  const experiences = (profile?.applicant_profile?.PROFESSIONAL_EXPERIENCES ||
    []) as PublicProfileExperience[];
  const education = (profile?.applicant_profile?.EDUCATION_ENTRIES ||
    []) as PublicProfileEducation[];
  const rawSkills =
    profile?.applicant_profile?.SKILLS || conversation.skills || [];
  const skills: string[] = Array.isArray(rawSkills) ? rawSkills : [];
  const portfolioUrl = profile?.PORTFOLIO_URL;

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

  // Thin progress: how far through the ceremony (intro excluded).
  const progressFraction =
    act === "candidate"
      ? 0.15
      : act === "vouch"
        ? 0.25 + statementIndex * 0.15
        : act === "sign"
          ? 0.92
          : act === "receipt"
            ? 1
            : 0;

  const handleSubmit = async () => {
    const applicantUserId = conversation.otherParticipant?.id;
    const jobId = conversation.jobContext?.jobId;
    if (!applicantUserId || !jobId) {
      setSubmitError("Missing applicant or job information. Please try again.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitReferral({
        applicant_user_id: applicantUserId,
        job_id: jobId,
        confidence_checks: {
          has_messaged: !!checks.has_messaged,
          feels_confident: !!checks.feels_confident,
          knows_background: !!checks.knows_background,
          comfortable_attaching: !!checks.comfortable_attaching,
        },
      });
      trackReferralSubmitted({
        conversationId: conversation.id,
        jobId,
        applicantUserId,
      });
      onSubmitted(applicantUserId, jobId);
      setAct("receipt");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("400") || msg.toLowerCase().includes("already")) {
        setSubmitError("A referral already exists for this applicant and role.");
      } else if (msg.includes("403") || msg.toLowerCase().includes("match")) {
        setSubmitError("You must be matched with this applicant to refer them.");
      } else {
        setSubmitError("Failed to submit referral. Please try again.");
      }
      // Whatever went wrong, don't make them re-earn the gesture.
      setSignAborts(FALLBACK_AFTER_ABORTS);
    } finally {
      setSubmitting(false);
    }
  };

  // Stamp the current statement: haptic, check animation, auto-advance.
  const stampStatement = () => {
    if (stamped) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setStamped(true);
    setChecks((prev) => ({ ...prev, [STATEMENTS[statementIndex].key]: true }));
    setTimeout(() => {
      setStamped(false);
      if (statementIndex < STATEMENTS.length - 1) {
        setStatementIndex(statementIndex + 1);
      } else {
        setAct("sign");
      }
    }, 520);
  };

  const dark = act === "sign";
  const statement = STATEMENTS[statementIndex];
  const StatementIcon = statement.icon;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, dark && styles.rootDark]}>
        <SafeAreaView style={styles.safe}>
          {/* ── Header: escape/back + thin progress + ⓘ ── */}
          {act !== "receipt" && (
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  if (act === "vouch") {
                    if (statementIndex > 0)
                      setStatementIndex(statementIndex - 1);
                    else setAct("candidate");
                  } else if (act === "sign") {
                    setAct("vouch");
                  } else {
                    onClose();
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={
                  act === "vouch" || act === "sign" ? "Back" : "Close"
                }
              >
                {act === "vouch" || act === "sign" ? (
                  <ChevronLeft size={22} color={dark ? "#FFF" : "#000"} />
                ) : (
                  <X size={20} color={dark ? "#FFF" : "#000"} />
                )}
              </TouchableOpacity>
              <View
                style={[styles.progressTrack, dark && styles.progressTrackDark]}
              >
                <View
                  style={[
                    styles.progressFill,
                    dark && styles.progressFillDark,
                    { width: `${progressFraction * 100}%` },
                  ]}
                />
              </View>
              {act !== "intro" && !dark ? (
                <TouchableOpacity
                  onPress={() => {
                    setIntroFrame(0);
                    introPagerRef.current?.scrollTo({ x: 0, animated: false });
                    setAct("intro");
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="About referrals"
                >
                  <Info size={18} color="#9CA3AF" strokeWidth={2.2} />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 18 }} />
              )}
            </View>
          )}

          {/* ── INTRO: first-time frames ── */}
          {act === "intro" && (
            <Animated.View entering={FadeIn} style={styles.body}>
              <ScrollView
                ref={introPagerRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) =>
                  setIntroFrame(
                    Math.round(e.nativeEvent.contentOffset.x / SCREEN_W),
                  )
                }
                style={{ flexGrow: 0, flex: 1 }}
              >
                {INTRO_FRAMES.map((f) => {
                  const FrameIcon = f.icon;
                  return (
                    <View key={f.title} style={styles.introFrame}>
                      <View style={styles.introIconTile}>
                        <FrameIcon size={34} color="#000" strokeWidth={2} />
                      </View>
                      <Text style={styles.introTitle}>{f.title}</Text>
                      <Text style={styles.introBody}>
                        {f.body(firstName)}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
              <View style={styles.introDots}>
                {INTRO_FRAMES.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.introDot,
                      i === introFrame && styles.introDotOn,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.footer}>
                <PillButton
                  label={
                    introFrame < INTRO_FRAMES.length - 1 ? "Next" : "Let's Go"
                  }
                  onPress={() => {
                    if (introFrame < INTRO_FRAMES.length - 1) {
                      const next = introFrame + 1;
                      setIntroFrame(next);
                      introPagerRef.current?.scrollTo({
                        x: next * SCREEN_W,
                        animated: true,
                      });
                    } else {
                      markIntroSeen();
                    }
                  }}
                />
                {introFrame < INTRO_FRAMES.length - 1 && (
                  <QuietAction label="Skip intro" onPress={markIntroSeen} />
                )}
              </View>
            </Animated.View>
          )}

          {/* ── ACT 1: The candidate ── */}
          {act === "candidate" && (
            <Animated.View entering={FadeIn} style={styles.body}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.candidateScroll}
              >
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.candidatePhoto} />
                ) : (
                  <View
                    style={[styles.candidatePhoto, styles.candidatePhotoFallback]}
                  >
                    <Text style={styles.candidatePhotoInitial}>
                      {(name || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.candidateLead}>You know</Text>
                <Text style={styles.candidateName}>{name}.</Text>
                <Text style={styles.candidateMeta}>
                  {[
                    currentRole,
                    location,
                    yearsExp ? `${yearsExp} yrs` : "",
                    industry,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>

                {!!jobTitle && (
                  <View style={styles.roleRow}>
                    <CompanyLogo
                      logoUrl={conversation.jobContext?.logoUrl}
                      name={company || jobTitle}
                      size={36}
                      borderRadius={11}
                      initialFontSize={15}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.roleLabel}>REFERRING FOR</Text>
                      <Text style={styles.roleTitle} numberOfLines={1}>
                        {jobTitle}
                        {company ? ` · ${company}` : ""}
                      </Text>
                    </View>
                  </View>
                )}

                {profileLoading && !profile && (
                  <>
                    <SkeletonCard title="Summary" />
                    <SkeletonCard title="Experience" />
                  </>
                )}
                {!!bio && (
                  <SectionCard title="Summary">
                    <Text style={styles.sectionBody}>{bio}</Text>
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
                          style={[
                            styles.entryRow,
                            idx > 0 && styles.entryDivider,
                          ]}
                        >
                          <Text style={styles.entryTitle}>{head}</Text>
                          {!!meta && (
                            <Text style={styles.entryMeta}>{meta}</Text>
                          )}
                        </View>
                      );
                    })}
                  </SectionCard>
                )}
                {skills.length > 0 && (
                  <SectionCard title="Key Skills">
                    <View style={styles.skillsRow}>
                      {skills.map((skill, idx) => (
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
                      onPress={() =>
                        Linking.openURL(portfolioUrl).catch(() => {})
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.portfolioLink} numberOfLines={1}>
                        {portfolioUrl}
                      </Text>
                    </TouchableOpacity>
                  </SectionCard>
                )}
              </ScrollView>
              <View style={styles.footer}>
                <PillButton
                  label="This is who I'm referring"
                  onPress={() => {
                    setStatementIndex(0);
                    setAct("vouch");
                  }}
                />
              </View>
            </Animated.View>
          )}

          {/* ── ACT 2: The vouch — one statement per screen ── */}
          {act === "vouch" && (
            <Animated.View
              key={`statement-${statementIndex}`}
              entering={SlideInRight.duration(240)}
              style={styles.body}
            >
              <View style={styles.statementWrap}>
                <View style={styles.statementIconTile}>
                  <StatementIcon size={24} color="#000" strokeWidth={2.2} />
                </View>
                <Text style={styles.statementQuote}>
                  &ldquo;{statement.text(firstName)}&rdquo;
                </Text>
                {stamped && (
                  <Animated.View
                    entering={ZoomIn.duration(260)}
                    style={styles.stamp}
                  >
                    <Check size={34} color="#FFF" strokeWidth={3.5} />
                  </Animated.View>
                )}
              </View>
              <View style={styles.footer}>
                <PillButton
                  label="I stand behind this"
                  icon={<Check size={17} color="#FFF" strokeWidth={2.8} />}
                  onPress={stampStatement}
                />
                <QuietAction
                  label="Not yet"
                  onPress={() => {
                    if (statementIndex > 0)
                      setStatementIndex(statementIndex - 1);
                    else setAct("candidate");
                  }}
                />
              </View>
            </Animated.View>
          )}

          {/* ── ACT 3: The signature — the app's one dark screen ── */}
          {act === "sign" && (
            <Animated.View entering={FadeIn.duration(350)} style={styles.body}>
              <View style={styles.signWrap}>
                <Text style={styles.signLead}>
                  You&apos;re putting your name on this.
                </Text>
                <View style={styles.signCard}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.signAvatar} />
                  ) : (
                    <View style={[styles.signAvatar, styles.signAvatarFallback]}>
                      <Text style={styles.signAvatarInitial}>
                        {(name || "?")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.signName}>{name}</Text>
                  {!!(jobTitle || company) && (
                    <Text style={styles.signRole}>
                      {[jobTitle, company].filter(Boolean).join(" at ")}
                    </Text>
                  )}
                </View>

                {submitError && (
                  <Text style={styles.signError}>{submitError}</Text>
                )}

                {submitting ? (
                  <View style={styles.signSubmitting}>
                    <ActivityIndicator color="#FFF" size="large" />
                    <Text style={styles.signSubmittingText}>Signing…</Text>
                  </View>
                ) : (
                  <>
                    <HoldToSign
                      onComplete={handleSubmit}
                      onAbort={() => setSignAborts((n) => n + 1)}
                    />
                    {signAborts >= FALLBACK_AFTER_ABORTS && (
                      <Animated.View
                        entering={FadeInDown}
                        style={{ marginTop: 22, alignSelf: "stretch" }}
                      >
                        <PillButton
                          label="Sign & Submit"
                          variant="outline"
                          onPress={handleSubmit}
                        />
                      </Animated.View>
                    )}
                  </>
                )}
              </View>
            </Animated.View>
          )}

          {/* ── ACT 4: The receipt ── */}
          {act === "receipt" && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.body}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.receiptScroll}
              >
                <Animated.View
                  entering={ZoomIn.delay(120).duration(320)}
                  style={styles.receiptCheck}
                >
                  <Check color="#FFF" size={32} strokeWidth={3} />
                </Animated.View>
                <Text style={styles.receiptTitle}>
                  Thank you{sponsorFirstName ? `, ${sponsorFirstName}` : ""}.
                </Text>
                <Text style={styles.receiptSub}>
                  Referrals like this are how people get real chances — you
                  just gave {firstName} one.
                </Text>
                <Text style={styles.receiptNext}>
                  Next step: enter the packet below into your company&apos;s
                  referral portal.
                </Text>
                <PacketCard
                  fields={packetFields}
                  onCopied={(what) => showToast(`${what} copied.`, "success")}
                />
                <Text style={styles.savedHint}>
                  🔖 Saved — find this packet anytime in Matches → Referrals.
                </Text>
              </ScrollView>
              <View style={styles.footer}>
                <PillButton label="Done" onPress={onClose} />
                <QuietAction
                  label="View in Referrals"
                  onPress={() => {
                    onClose();
                    router.navigate("/(tabs)/matches");
                  }}
                />
              </View>
            </Animated.View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F6F7F9" },
  rootDark: { backgroundColor: "#000" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  progressTrackDark: { backgroundColor: "rgba(255,255,255,0.18)" },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#000",
  },
  progressFillDark: { backgroundColor: "#FFF" },
  body: { flex: 1 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  // ── Intro ──
  introFrame: {
    width: SCREEN_W,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  introIconTile: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: "#F0F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  introTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 12,
  },
  introBody: {
    fontSize: 15,
    color: "#4B5563",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 23,
  },
  introDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginBottom: 8,
  },
  introDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  introDotOn: { backgroundColor: "#000", width: 18 },
  // ── Candidate ──
  candidateScroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  candidatePhoto: {
    width: 124,
    height: 124,
    borderRadius: 40,
    marginBottom: 20,
  },
  candidatePhotoFallback: {
    backgroundColor: "#F0F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  candidatePhotoInitial: { fontSize: 44, fontWeight: "800", color: "#3B4353" },
  candidateLead: {
    fontSize: 32,
    fontWeight: "800",
    color: "#9CA3AF",
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  candidateName: {
    fontSize: 34,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.9,
    lineHeight: 40,
    marginBottom: 8,
  },
  candidateMeta: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 18,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    padding: 14,
    marginBottom: 12,
  },
  roleLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#9CA3AF",
    letterSpacing: 1,
    marginBottom: 3,
  },
  roleTitle: { fontSize: 15, fontWeight: "800", color: "#000" },
  sectionBody: { fontSize: 14, color: "#4B5563", lineHeight: 21 },
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
  // ── Vouch ──
  statementWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  statementIconTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#F0F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
  },
  statementQuote: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.6,
    lineHeight: 37,
    textAlign: "center",
  },
  stamp: {
    position: "absolute",
    bottom: 60,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Sign ──
  signWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  signLead: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: -0.6,
    textAlign: "center",
    lineHeight: 33,
    marginBottom: 26,
  },
  signCard: {
    alignSelf: "stretch",
    backgroundColor: "#FFF",
    borderRadius: 22,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 34,
  },
  signAvatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 10 },
  signAvatarFallback: {
    backgroundColor: "#F0F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  signAvatarInitial: { fontSize: 24, fontWeight: "800", color: "#3B4353" },
  signName: { fontSize: 18, fontWeight: "800", color: "#000" },
  signRole: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 3,
    textAlign: "center",
  },
  signError: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FCA5A5",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  signSubmitting: { alignItems: "center", gap: 12 },
  signSubmittingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
  },
  // ── Receipt ──
  receiptScroll: {
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: "stretch",
  },
  receiptCheck: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  receiptTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 8,
  },
  receiptSub: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  receiptNext: {
    fontSize: 13,
    color: "#000",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
  },
  savedHint: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
});
