// Onboarding slides — the practical, role-tailored "how your day works"
// beat. Shown exactly once, post-signup, on a new user's first Home view
// (components/ui/HomeIntro.tsx wraps this in a full-screen Modal) and
// replayable later from the Home header "?". There's no pre-signup
// appearance of these slides anymore — the role's film (IntroCinema /
// SponsorCinema) sells the belief at macro scale, and a user goes
// straight from the film into sign-up; these slides are the "welcome,
// here's how your day actually works" beat that greets them once they
// have a real dashboard to look at.
//
// Rebuilt to the rebrand's editorial language and the films' fidelity
// bar: no abstract icon circles — each slide stages a small LIVE product
// vignette (fanned deck cards, the match + first message, the referral
// tracker), swiped as a real pager with parallax depth, breathing idle
// motion, and the serif/italic-accent typography of the marketing site.

import { ArrowRight } from "@/components/ui/icons";
import React, { useEffect, useRef, useState } from "react";
import { trackScreenViewed } from "@/lib/analytics/mixpanel";
import { Colors, Fonts, Type } from "@/constants/theme";
import {
  Dimensions,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { PressableScale } from "@/components/ui/PressableScale";

const { width: W } = Dimensions.get("window");

interface OnboardingProps {
  /** Finishing the deck (the last slide's CTA). */
  onComplete: () => void;
  /** The header Skip tap — tracked separately from onComplete. */
  onSkip: () => void;
  userType: "applicant" | "sponsor";
  /** Mixpanel screen_name. */
  screenName?: string;
}

type VignetteKind = "deck" | "match" | "track";

interface Slide {
  kind: VignetteKind;
  titlePlain: string;
  titleAccent: string;
  description: string;
}

// Titles split into [plain, accent] halves so the closing phrase renders
// in the site's italic-muted accent style (.hero-title em) — the payoff
// words carry the emphasis, per the marketing pages.
const applicantSlides: Slide[] = [
  {
    kind: "deck",
    titlePlain: "Every morning, ",
    titleAccent: "ten cards.",
    description:
      "A fresh deck of ten hand-picked jobs a day — each with real people inside who can refer you. Ten, not ten thousand.",
  },
  {
    kind: "match",
    titlePlain: "Interest goes ",
    titleAccent: "both ways.",
    description:
      "Tap Connect on a job you want. When a sponsor inside picks you back, it's a match — and a chat opens right here.",
  },
  {
    kind: "track",
    titlePlain: "From chat to ",
    titleAccent: "referred.",
    description:
      "Talk with your sponsor, share your story, and they refer you internally. Follow every step live from your dashboard.",
  },
];

const sponsorSlides: Slide[] = [
  {
    kind: "deck",
    titlePlain: "Your daily deck of ",
    titleAccent: "talent.",
    description:
      "Ten candidates a day who want in where you already are — real profiles you can actually judge, not a résumé pile.",
  },
  {
    kind: "match",
    titlePlain: "Vouch for who you ",
    titleAccent: "believe in.",
    description:
      "Match with candidates worth your name, and chat to vet them properly before anything moves.",
  },
  {
    kind: "track",
    titlePlain: "Refer. Then watch it ",
    titleAccent: "count.",
    description:
      "Submit the referral in a tap, and track every career you've helped move — right from your dashboard.",
  },
];

export function Onboarding({
  onComplete,
  onSkip,
  userType,
  screenName = "onboarding_intro",
}: OnboardingProps) {
  useEffect(() => {
    trackScreenViewed(screenName);
  }, [screenName]);

  const slides = userType === "applicant" ? applicantSlides : sponsorSlides;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  // Guards against momentum-end overwriting an in-flight button scroll.
  const targetIndex = useRef(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  // Idle life for the vignettes — the same slow breath as the films.
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [breath]);

  const goTo = (next: number) => {
    targetIndex.current = next;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * W, y: 0, animated: true });
  };

  const nextSlide = () => {
    if (index < slides.length - 1) goTo(index + 1);
    else onComplete();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Top Navigation — no back arrow: there's nothing before this
            (it's the first thing a new user sees on their dashboard), and
            the pager itself is still swipeable in both directions. */}
        <View style={styles.topNav}>
          <TouchableOpacity
            onPress={onSkip}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Pager */}
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const landed = Math.round(e.nativeEvent.contentOffset.x / W);
            targetIndex.current = landed;
            setIndex(landed);
          }}
          style={styles.pager}
        >
          {slides.map((slide, i) => (
            <SlidePage
              key={slide.kind}
              slide={slide}
              index={i}
              scrollX={scrollX}
              breath={breath}
              userType={userType}
            />
          ))}
        </Animated.ScrollView>

        {/* Footer Navigation */}
        <View style={styles.footer}>
          <View style={styles.dotsContainer}>
            {slides.map((_, i) => (
              <PagerDot key={i} index={i} scrollX={scrollX} />
            ))}
          </View>

          <PressableScale
            pressedScale={0.97}
            onPress={nextSlide}
            style={styles.nextButton}
            accessibilityRole="button"
          >
            <Text style={styles.nextButtonText}>
              {index === slides.length - 1 ? "Get Started" : "Continue"}
            </Text>
            <ArrowRight color="#FFF" size={20} />
          </PressableScale>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Pager pieces ────────────────────────────────────────────────────────

function SlidePage({
  slide,
  index,
  scrollX,
  breath,
  userType,
}: {
  slide: Slide;
  index: number;
  scrollX: SharedValue<number>;
  breath: SharedValue<number>;
  userType: "applicant" | "sponsor";
}) {
  const range = [(index - 1) * W, index * W, (index + 1) * W];

  // Depth: the vignette drifts slower than the page (classic parallax),
  // the text crossfades through the transition.
  const vignetteStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(scrollX.value, range, [W * 0.18, 0, -W * 0.18]) },
    ],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0]),
    transform: [
      { translateX: interpolate(scrollX.value, range, [W * 0.06, 0, -W * 0.06]) },
    ],
  }));

  return (
    <View style={styles.page}>
      <Animated.View style={[styles.vignetteArea, vignetteStyle]}>
        {slide.kind === "deck" && (
          <DeckVignette breath={breath} userType={userType} />
        )}
        {slide.kind === "match" && (
          <MatchVignette breath={breath} userType={userType} />
        )}
        {slide.kind === "track" && (
          <TrackVignette breath={breath} userType={userType} />
        )}
      </Animated.View>

      <Animated.View style={[styles.textSection, textStyle]}>
        <Text style={styles.title}>
          {slide.titlePlain}
          <Text style={styles.titleAccent}>{slide.titleAccent}</Text>
        </Text>
        <Text style={styles.description}>{slide.description}</Text>
      </Animated.View>
    </View>
  );
}

function PagerDot({
  index,
  scrollX,
}: {
  index: number;
  scrollX: SharedValue<number>;
}) {
  const range = [(index - 1) * W, index * W, (index + 1) * W];
  const style = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, range, [8, 24, 8], "clamp"),
    backgroundColor: interpolateColor(scrollX.value, range, [
      Colors.border,
      Colors.ink,
      Colors.border,
    ]),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

// ── Vignettes ───────────────────────────────────────────────────────────
// Small staged product moments at the films' fidelity bar — real content,
// paper cards, hairline borders, a slow breathing float.

function Breathing({
  breath,
  children,
  amount = 3,
}: {
  breath: SharedValue<number>;
  children: React.ReactNode;
  amount?: number;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (breath.value * 2 - 1) * amount }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Slide 1 — the daily deck: three fanned cards under the deck chip. */
function DeckVignette({
  breath,
  userType,
}: {
  breath: SharedValue<number>;
  userType: "applicant" | "sponsor";
}) {
  const applicant = userType === "applicant";
  return (
    <Breathing breath={breath}>
      <View style={styles.deckChip}>
        <Text style={styles.deckChipText}>TODAY’S DECK · 10</Text>
      </View>
      <View style={styles.deckFan}>
        <View style={[styles.deckCard, styles.deckCardLeft]}>
          <VignetteCardHeader
            round={!applicant}
            monogram={applicant ? "A" : "S"}
            title={applicant ? "Backend Engineer" : "Sana Iqbal"}
            sub={applicant ? "Atlas Health · NYC" : "Data Scientist · Northport"}
          />
        </View>
        <View style={[styles.deckCard, styles.deckCardRight]}>
          <VignetteCardHeader
            round={!applicant}
            monogram={applicant ? "N" : "D"}
            title={applicant ? "Data Scientist" : "Devon Park"}
            sub={applicant ? "Northport · Remote" : "Backend Eng · Atlas"}
          />
        </View>
        <View style={[styles.deckCard, styles.deckCardTop]}>
          <VignetteCardHeader
            round={!applicant}
            monogram={applicant ? "M" : "M"}
            title={applicant ? "Senior Product Designer" : "Maya Chen"}
            sub={
              applicant
                ? "Meridian Labs · Remote"
                : "Product Designer · Meridian"
            }
          />
          <View style={styles.vignettePillRow}>
            <View style={styles.vignettePill}>
              <Text style={styles.vignettePillText}>
                {applicant ? "$130–160k" : "Figma"}
              </Text>
            </View>
            <View style={styles.vignettePill}>
              <Text style={styles.vignettePillText}>
                {applicant ? "3 sponsors inside" : "6 yrs"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Breathing>
  );
}

/** Slide 2 — the match: met avatars + the first real message. */
function MatchVignette({
  breath,
  userType,
}: {
  breath: SharedValue<number>;
  userType: "applicant" | "sponsor";
}) {
  const applicant = userType === "applicant";
  return (
    <Breathing breath={breath}>
      <View style={styles.matchAvatars}>
        <View style={[styles.vAvatar, applicant ? null : styles.vAvatarDark]}>
          <Text style={styles.vAvatarInitial}>Y</Text>
        </View>
        <View
          style={[
            styles.vAvatar,
            styles.vAvatarOverlap,
            applicant ? styles.vAvatarDark : null,
          ]}
        >
          <Text style={styles.vAvatarInitial}>{applicant ? "S" : "M"}</Text>
        </View>
        <View style={styles.vMatchBadge}>
          <Text style={styles.vMatchBadgeText}>✓</Text>
        </View>
      </View>
      <View style={styles.messageCard}>
        <Text style={styles.messageSender}>
          {applicant ? "Sarah · Sponsor at Meridian" : "Maya · Product Designer"}
        </Text>
        <Text style={styles.messageBody}>
          {applicant
            ? "Happy to refer you — tell me about yourself."
            : "Thanks for connecting! Here’s my portfolio."}
        </Text>
      </View>
    </Breathing>
  );
}

/** Slide 3 — the payoff, tracked: referral status / referral impact. */
function TrackVignette({
  breath,
  userType,
}: {
  breath: SharedValue<number>;
  userType: "applicant" | "sponsor";
}) {
  if (userType === "applicant") {
    return (
      <Breathing breath={breath}>
        <View style={styles.trackCard}>
          <Text style={styles.trackEyebrow}>YOUR REFERRAL</Text>
          <VignetteCardHeader
            round={false}
            monogram="M"
            title="Senior Product Designer"
            sub="Meridian Labs · Remote"
          />
          <View style={styles.stepperRow}>
            <View style={[styles.stepDot, styles.stepDotDone]} />
            <View style={[styles.stepLine, styles.stepLineDone]} />
            <View style={[styles.stepDot, styles.stepDotDone]} />
            <View style={styles.stepLine} />
            <View style={styles.referredPill}>
              <Text style={styles.referredPillText}>Referred ✓</Text>
            </View>
          </View>
          <View style={styles.stepLabels}>
            <Text style={styles.stepLabel}>Matched</Text>
            <Text style={styles.stepLabel}>Chatting</Text>
            <Text style={[styles.stepLabel, styles.stepLabelDone]}>
              Referred
            </Text>
          </View>
        </View>
      </Breathing>
    );
  }
  return (
    <Breathing breath={breath}>
      <View style={styles.trackCard}>
        <Text style={styles.trackEyebrow}>YOUR IMPACT</Text>
        <View style={styles.impactRow}>
          <Text style={styles.impactCount}>3</Text>
          <Text style={styles.impactCaption}>
            referrals made{"\n"}this month
          </Text>
        </View>
        <View style={styles.impactPersonRow}>
          <Text style={styles.impactPersonName}>Devon Park</Text>
          <View style={styles.referredPill}>
            <Text style={styles.referredPillText}>Referred ✓</Text>
          </View>
        </View>
        <View style={[styles.impactPersonRow, styles.impactPersonRowLast]}>
          <Text style={styles.impactPersonName}>Sana Iqbal</Text>
          <View style={styles.interviewPill}>
            <Text style={styles.interviewPillText}>Interviewing</Text>
          </View>
        </View>
      </View>
    </Breathing>
  );
}

function VignetteCardHeader({
  monogram,
  title,
  sub,
  round,
}: {
  monogram: string;
  title: string;
  sub: string;
  round: boolean;
}) {
  return (
    <View style={styles.vHeader}>
      <View style={[styles.vLogo, round && styles.vLogoRound]}>
        <Text style={styles.vMonogram}>{monogram}</Text>
      </View>
      <View style={styles.vHeaderText}>
        <Text style={styles.vTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.vSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
  safeArea: {
    flex: 1,
  },
  topNav: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  skipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: Colors.muted,
    padding: 8,
  },
  pager: {
    flex: 1,
  },
  page: {
    width: W,
    paddingHorizontal: 32,
    justifyContent: "center",
  },
  vignetteArea: {
    height: 280,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  textSection: {
    width: "100%",
  },
  title: {
    ...Type.title,
    color: Colors.ink,
    marginBottom: 14,
  },
  // The site's .hero-title em rule — italic muted accent phrase.
  titleAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  // Matches the site's .hero-body treatment.
  description: {
    fontFamily: Fonts.sansLight,
    fontSize: 17,
    color: Colors.body,
    lineHeight: 26,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    gap: 28,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  nextButton: {
    backgroundColor: Colors.ink,
    height: 60,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  nextButtonText: {
    fontFamily: Fonts.sansSemiBold,
    color: "#FFF",
    fontSize: 17,
    letterSpacing: -0.2,
  },
  // ── Shared vignette atoms ─────────────────────────────────────────────
  vHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  vLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  vLogoRound: {
    borderRadius: 18,
  },
  vMonogram: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    color: Colors.body,
  },
  vHeaderText: { flex: 1, gap: 2 },
  vTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13.5,
    color: Colors.ink,
  },
  vSub: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.muted,
  },
  vignettePillRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  vignettePill: {
    borderRadius: 999,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  vignettePillText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10.5,
    color: Colors.body,
  },
  // ── Deck vignette ─────────────────────────────────────────────────────
  deckChip: {
    alignSelf: "center",
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  deckChipText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: Colors.muted,
  },
  deckFan: {
    width: 280,
    height: 170,
    alignItems: "center",
    justifyContent: "center",
  },
  deckCard: {
    position: "absolute",
    width: 216,
    backgroundColor: Colors.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  deckCardLeft: {
    transform: [
      { translateX: -34 },
      { translateY: -12 },
      { rotate: "-7deg" },
      { scale: 0.96 },
    ],
    opacity: 0.85,
  },
  deckCardRight: {
    transform: [
      { translateX: 34 },
      { translateY: -6 },
      { rotate: "6deg" },
      { scale: 0.96 },
    ],
    opacity: 0.85,
  },
  deckCardTop: {
    transform: [{ translateY: 18 }, { rotate: "-1deg" }],
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 5,
  },
  // ── Match vignette ────────────────────────────────────────────────────
  matchAvatars: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    marginBottom: 22,
  },
  vAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.paper,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  vAvatarOverlap: {
    marginLeft: -16,
  },
  vAvatarDark: {
    backgroundColor: Colors.border,
  },
  vAvatarInitial: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.body,
  },
  vMatchBadge: {
    position: "absolute",
    bottom: -8,
    alignSelf: "center",
    left: "50%",
    marginLeft: -13,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.paper,
  },
  vMatchBadgeText: { color: Colors.paper, fontSize: 12, fontWeight: "800" },
  messageCard: {
    width: 250,
    backgroundColor: Colors.paper,
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  messageSender: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 10.5,
    color: Colors.muted,
  },
  messageBody: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.ink,
  },
  // ── Track vignette ────────────────────────────────────────────────────
  trackCard: {
    width: 264,
    backgroundColor: Colors.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
  },
  trackEyebrow: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: Colors.faint,
    marginBottom: 12,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  stepDotDone: {
    backgroundColor: Colors.ink,
  },
  stepLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: Colors.border,
    marginHorizontal: 5,
  },
  stepLineDone: {
    backgroundColor: Colors.ink,
  },
  referredPill: {
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  referredPillText: {
    color: Colors.paper,
    fontSize: 10.5,
    fontWeight: "700",
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  stepLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 9,
    color: Colors.faint,
  },
  stepLabelDone: {
    color: Colors.ink,
  },
  // Sponsor impact card.
  impactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  // Serif for counts — the site's .stat-num rule.
  impactCount: {
    fontFamily: Fonts.serif,
    fontSize: 44,
    color: Colors.ink,
    lineHeight: 48,
  },
  impactCaption: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.muted,
  },
  impactPersonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
  impactPersonRowLast: {
    paddingBottom: 0,
  },
  impactPersonName: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12.5,
    color: Colors.ink,
  },
  interviewPill: {
    backgroundColor: Colors.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  interviewPillText: {
    color: Colors.body,
    fontSize: 10.5,
    fontWeight: "600",
  },
});
