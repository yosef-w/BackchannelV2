// HomeIntroOverlay — a one-time, role-aware primer shown the first time a user
// lands on the Home deck. It teaches the core loop by SHOWING it: a looping
// mini demo where a tap lands on Connect → "It's a Match!" pops → a tap lands
// on Pass → the card clears, then it repeats. Below the demo, three short lines
// spell out the rules (Connect/Pass, 10-a-day, refresh).
//
// Design language matches the rest of the app: monochrome, rounded white card
// on a dark blur, black primary button, and the same "IT'S A MATCH" pill used
// by the real match modal — so the demo reads as the real thing, not generic
// onboarding art.
//
// It is intentionally short, skippable, and shown once (the caller persists the
// flag). A "?" affordance in the header lets users replay it.

import { BlurView } from "expo-blur";
import { Check, RefreshCcw, Sparkles, Layers, X } from "lucide-react-native";
import React, { useEffect } from "react";
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInUp,
  ZoomIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 40, 400);
// One full beat of the demo loop (connect → match → pass → reset).
const LOOP_MS = 4200;

interface HomeIntroOverlayProps {
  visible: boolean;
  userType: "applicant" | "sponsor";
  /** Fired when the user taps Start or Skip (caller persists the seen flag). */
  onDone: (action: "start" | "skip") => void;
}

const COPY = {
  applicant: {
    kicker: "WELCOME TO BACKCHANNEL",
    title: "Get referred, not ignored.",
    subtitle: "These are insiders who can refer you into roles.",
    connectRule: "Tap Connect on people you want — Pass on the rest.",
    demoName: "A real insider",
    demoRole: "Hiring at a top company",
  },
  sponsor: {
    kicker: "WELCOME TO BACKCHANNEL",
    title: "Refer talent you believe in.",
    subtitle: "These are people who want in at your company.",
    connectRule: "Tap Connect on applicants you'd vouch for — Pass on the rest.",
    demoName: "A strong applicant",
    demoRole: "Wants a referral",
  },
} as const;

export function HomeIntroOverlay({
  visible,
  userType,
  onDone,
}: HomeIntroOverlayProps) {
  const copy = COPY[userType];

  // Single 0→1 driver looped for the whole demo; every element reads its own
  // slice of the timeline via interpolate, so the choreography stays in sync.
  const t = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [visible, t]);

  // ── Timeline (t ∈ [0,1]) ───────────────────────────────────────────────
  // 0.10–0.30  tap Connect (ripple) + button press
  // 0.30–0.72  "It's a Match!" pops, holds, fades
  // 0.74–0.94  tap Pass + button press + card dims (clears)
  const connectTapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      t.value,
      [0.1, 0.15, 0.26, 0.3],
      [0, 0.9, 0.9, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          t.value,
          [0.1, 0.18, 0.3],
          [0.5, 1.15, 0.5],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const connectBtnStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          t.value,
          [0.14, 0.2, 0.28],
          [1, 0.86, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const matchStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      t.value,
      [0.3, 0.4, 0.62, 0.72],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          t.value,
          [0.3, 0.44, 0.72],
          [0.7, 1, 0.92],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const passTapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      t.value,
      [0.74, 0.79, 0.9, 0.94],
      [0, 0.9, 0.9, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          t.value,
          [0.74, 0.82, 0.94],
          [0.5, 1.15, 0.5],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const passBtnStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          t.value,
          [0.78, 0.84, 0.92],
          [1, 0.86, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Card content dims as the Pass "clears" it, implying it slides away.
  const demoCardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      t.value,
      [0.8, 0.87, 0.97, 1],
      [1, 0.55, 0.55, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        <Animated.View
          entering={ZoomIn.springify().damping(16).stiffness(160)}
          style={styles.card}
        >
          {/* Skip */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => onDone("skip")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          {/* Kicker + headline */}
          <Animated.View entering={FadeInUp.delay(120).duration(380)}>
            <View style={styles.kickerPill}>
              <Sparkles size={11} color="#000" strokeWidth={2.5} />
              <Text style={styles.kickerText}>{copy.kicker}</Text>
            </View>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
          </Animated.View>

          {/* ── Animated demo card ─────────────────────────────────────── */}
          <Animated.View
            entering={FadeIn.delay(260).duration(450)}
            style={styles.demoStage}
          >
            <Animated.View style={[styles.demoCard, demoCardStyle]}>
              <View style={styles.demoHeaderRow}>
                <View style={styles.demoAvatar}>
                  <Text style={styles.demoAvatarText}>
                    {copy.demoName[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.demoName} numberOfLines={1}>
                    {copy.demoName}
                  </Text>
                  <Text style={styles.demoRole} numberOfLines={1}>
                    {copy.demoRole}
                  </Text>
                </View>
              </View>
              <View style={[styles.demoLine, { width: "92%" }]} />
              <View style={[styles.demoLine, { width: "78%" }]} />
              <View style={[styles.demoLine, { width: "60%" }]} />
            </Animated.View>

            {/* "IT'S A MATCH" pop — mirrors the real match modal pill */}
            <Animated.View style={[styles.matchPop, matchStyle]}>
              <Sparkles size={13} color="#FFF" strokeWidth={2.5} />
              <Text style={styles.matchPopText}>IT'S A MATCH</Text>
            </Animated.View>

            {/* Demo Pass / Connect buttons (mirror the real floating buttons) */}
            <View style={styles.demoBtnRow}>
              <View style={styles.demoBtnWrap}>
                <Animated.View style={[styles.demoPassBtn, passBtnStyle]}>
                  <X color="#000" size={20} strokeWidth={3} />
                </Animated.View>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.tapRipple, passTapStyle]}
                />
              </View>

              <View style={styles.demoBtnWrap}>
                <Animated.View style={[styles.demoConnectBtn, connectBtnStyle]}>
                  <Check color="#FFF" size={22} strokeWidth={3} />
                </Animated.View>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.tapRipple, connectTapStyle]}
                />
              </View>
            </View>
          </Animated.View>

          {/* ── Rules ──────────────────────────────────────────────────── */}
          <View style={styles.rules}>
            <Animated.View
              entering={FadeInUp.delay(420).duration(360)}
              style={styles.ruleRow}
            >
              <View style={styles.ruleIcon}>
                <Check size={14} color="#000" strokeWidth={2.8} />
              </View>
              <Text style={styles.ruleText}>{copy.connectRule}</Text>
            </Animated.View>

            <Animated.View
              entering={FadeInUp.delay(520).duration(360)}
              style={styles.ruleRow}
            >
              <View style={styles.ruleIcon}>
                <Layers size={14} color="#000" strokeWidth={2.4} />
              </View>
              <Text style={styles.ruleText}>
                You get <Text style={styles.ruleStrong}>10 fresh profiles</Text>{" "}
                a day.
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeInUp.delay(620).duration(360)}
              style={styles.ruleRow}
            >
              <View style={styles.ruleIcon}>
                <RefreshCcw size={14} color="#000" strokeWidth={2.4} />
              </View>
              <Text style={styles.ruleText}>
                Caught up? Refresh the deck or come back tomorrow.
              </Text>
            </Animated.View>
          </View>

          {/* Primary CTA */}
          <Animated.View entering={FadeInUp.delay(720).duration(380)}>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => onDone("start")}
              activeOpacity={0.85}
            >
              <Text style={styles.startBtnText}>Start</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#FFF",
    borderRadius: 32,
    padding: 26,
    paddingTop: 24,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  skipBtn: { position: "absolute", top: 18, right: 18, zIndex: 5 },
  skipText: { fontSize: 13, fontWeight: "700", color: "#AAA" },

  kickerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "#F4F4F5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  kickerText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 23,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
    lineHeight: 20,
  },

  // Demo stage
  demoStage: {
    marginTop: 20,
    marginBottom: 8,
    alignItems: "center",
  },
  demoCard: {
    width: "100%",
    backgroundColor: "#F8F9FB",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEE",
    padding: 16,
  },
  demoHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  demoAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  demoAvatarText: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  demoName: { fontSize: 15, fontWeight: "800", color: "#000" },
  demoRole: { fontSize: 12, fontWeight: "500", color: "#999", marginTop: 1 },
  demoLine: {
    height: 9,
    borderRadius: 5,
    backgroundColor: "#E8E8EC",
    marginTop: 9,
  },

  matchPop: {
    position: "absolute",
    top: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#000",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  matchPopText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },

  demoBtnRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
    marginTop: 16,
  },
  demoBtnWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  demoPassBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  demoConnectBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  tapRipple: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.16)",
  },

  // Rules
  rules: { marginTop: 18, gap: 12 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ruleIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  ruleText: {
    flex: 1,
    fontSize: 13.5,
    color: "#333",
    fontWeight: "500",
    lineHeight: 19,
  },
  ruleStrong: { fontWeight: "800", color: "#000" },

  startBtn: {
    backgroundColor: "#000",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  startBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});
