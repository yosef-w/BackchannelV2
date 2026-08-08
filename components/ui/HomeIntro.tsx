// HomeIntro — a full-screen, editorial first-run intro (Linear / Stripe /
// Robinhood territory). Big confident type on near-black, a few swipeable
// statements with parallax depth, a giant faint index numeral per slide, and
// a single primary CTA. No scrim, no spotlight, no tutorial chrome.
//
// Role-aware copy; one-time per role (the caller persists the flag).

import { ArrowRight } from "@/components/ui/icons";
import { Fonts } from "@/constants/theme";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

const { width: W, height: H } = Dimensions.get("window");
const AnimatedScroll = Animated.createAnimatedComponent(ScrollView);
const C = Extrapolation.CLAMP;

// AsyncStorage key for the one-time "show the intro" flag. Set when a user
// completes signup; consumed (and cleared) on their first Home view, so the
// intro only ever shows to newly-signed-up users.
export const HOME_INTRO_PENDING_KEY = "@bc/homeIntroPending";

interface SlideData {
  num: string;
  eyebrow: string;
  headline: string;
  /** Second line of the headline, rendered in the site's italic muted
   * accent style (.hero-title em) — the payoff phrase. */
  headlineAccent: string;
  body: string;
}

interface HomeIntroProps {
  visible: boolean;
  userType: "applicant" | "sponsor";
  onDone: (action: "complete" | "skip") => void;
}

const SLIDES: Record<"applicant" | "sponsor", SlideData[]> = {
  applicant: [
    {
      num: "01",
      eyebrow: "WELCOME",
      headline: "Get",
      headlineAccent: "referred.",
      body: "BackChannel connects you with people inside companies who can refer you to open roles.",
    },
    {
      num: "02",
      eyebrow: "YOUR DECK",
      headline: "10 jobs",
      headlineAccent: "a day.",
      body: "A fresh set of 10 jobs each day — with the insiders who can refer you in.",
    },
    {
      num: "03",
      eyebrow: "HOW IT WORKS",
      headline: "Connect",
      headlineAccent: "or pass.",
      body: "Tap Connect on the ones you want, Pass on the rest. If they connect back, you match and can message.",
    },
  ],
  sponsor: [
    {
      num: "01",
      eyebrow: "WELCOME",
      headline: "Refer",
      headlineAccent: "talent.",
      body: "BackChannel connects you with people who want a referral into your company.",
    },
    {
      num: "02",
      eyebrow: "YOUR DECK",
      headline: "10 applicants",
      headlineAccent: "a day.",
      body: "A fresh set of 10 applicants each day, qualified for roles you're sponsoring.",
    },
    {
      num: "03",
      eyebrow: "HOW IT WORKS",
      headline: "Connect",
      headlineAccent: "or pass.",
      body: "Tap Connect on applicants you'd vouch for, Pass on the rest. If they connect back, you match and can message.",
    },
  ],
};

function Slide({
  slide,
  i,
  scrollX,
}: {
  slide: SlideData;
  i: number;
  scrollX: SharedValue<number>;
}) {
  const range = [(i - 1) * W, i * W, (i + 1) * W];

  const numStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [(i - 0.8) * W, i * W, (i + 0.8) * W],
      [0, 1, 0],
      C,
    ),
    transform: [
      { translateX: interpolate(scrollX.value, range, [W * 0.5, 0, -W * 0.5], C) },
    ],
  }));
  const headStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [(i - 0.55) * W, i * W, (i + 0.55) * W],
      [0, 1, 0],
      C,
    ),
    transform: [
      { translateX: interpolate(scrollX.value, range, [W * 0.16, 0, -W * 0.16], C) },
    ],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [(i - 0.5) * W, i * W, (i + 0.5) * W],
      [0, 1, 0],
      C,
    ),
    transform: [
      { translateX: interpolate(scrollX.value, range, [W * 0.32, 0, -W * 0.32], C) },
    ],
  }));

  return (
    <View style={styles.slide}>
      <Animated.Text style={[styles.bigNum, numStyle]}>{slide.num}</Animated.Text>
      <View style={styles.slideContent}>
        <Animated.View style={headStyle}>
          <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
          <Text style={styles.headline}>
            {slide.headline}
            {"\n"}
            <Text style={styles.headlineAccent}>{slide.headlineAccent}</Text>
          </Text>
        </Animated.View>
        <Animated.Text style={[styles.body, bodyStyle]}>
          {slide.body}
        </Animated.Text>
      </View>
    </View>
  );
}

export function HomeIntro({ visible, userType, onDone }: HomeIntroProps) {
  const slides = useMemo(() => SLIDES[userType], [userType]);
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (visible) {
      setIndex(0);
      scrollX.value = 0;
      // Reset to the first slide when (re)opened.
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ x: 0, animated: false }),
      );
    }
  }, [visible, scrollX]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const isLast = index === slides.length - 1;
  const handleNext = () => {
    if (isLast) onDone("complete");
    else scrollRef.current?.scrollTo({ x: (index + 1) * W, animated: true });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        <AnimatedScroll
          ref={scrollRef as React.RefObject<any>}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / W))
          }
        >
          {slides.map((s, i) => (
            <Slide key={i} slide={s} i={i} scrollX={scrollX} />
          ))}
        </AnimatedScroll>

        {/* Top: segmented progress + Skip */}
        <View style={styles.topBar}>
          <View style={styles.progress}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[styles.progSeg, i <= index && styles.progSegOn]}
              />
            ))}
          </View>
          <TouchableOpacity
            onPress={() => onDone("skip")}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom: dots + CTA */}
        <View style={styles.bottomBar}>
          <View style={styles.dots}>
            {slides.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
            ))}
          </View>
          <TouchableOpacity
            style={[styles.cta, isLast && styles.ctaLast]}
            activeOpacity={0.85}
            onPress={handleNext}
          >
            <Text style={styles.ctaText}>{isLast ? "Start" : "Next"}</Text>
            {!isLast && (
              <ArrowRight color="#000" size={18} strokeWidth={2.6} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const TOP = H > 800 ? 64 : 48;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0B" },

  slide: { width: W, height: H, overflow: "hidden", justifyContent: "flex-end" },
  bigNum: {
    position: "absolute",
    top: TOP - 30,
    right: -18,
    fontSize: 300,
    fontWeight: "900",
    color: "rgba(255,255,255,0.04)",
    letterSpacing: -8,
  },
  slideContent: {
    paddingHorizontal: 34,
    paddingBottom: H * 0.2,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 18,
  },
  // Font only — this is a dark first-run overlay, a distinct UI moment
  // from the rest of the (light) app; its background/color scheme is a
  // separate decision from the font migration, left untouched here.
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 44,
    color: "#FFF",
    letterSpacing: -1.4,
    lineHeight: 48,
  },
  // The site's .hero-title em rule, adapted for the dark surface — the
  // payoff line in italic muted gray against the white lead line.
  headlineAccent: {
    fontFamily: Fonts.serifItalic,
    color: "#999999",
  },
  body: {
    fontSize: 16.5,
    fontWeight: "500",
    color: "rgba(255,255,255,0.66)",
    lineHeight: 25,
    marginTop: 22,
    maxWidth: 340,
  },

  topBar: {
    position: "absolute",
    top: TOP,
    left: 34,
    right: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progress: { flexDirection: "row", gap: 6, flex: 1, marginRight: 20 },
  progSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  progSegOn: { backgroundColor: "#FFF" },
  skipText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.55)",
  },

  bottomBar: {
    position: "absolute",
    bottom: H > 800 ? 54 : 36,
    left: 34,
    right: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: { flexDirection: "row", gap: 7 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  dotOn: { width: 22, backgroundColor: "#FFF" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF",
    paddingVertical: 15,
    paddingHorizontal: 26,
    borderRadius: 30,
  },
  ctaLast: { paddingHorizontal: 40 },
  ctaText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.2,
  },
});
