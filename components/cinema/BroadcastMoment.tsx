// BroadcastMoment — the app's full-size success confirmation, extracted
// from the create-job publish screen ("The Broadcast") so every milestone
// moment speaks the same language: a one-shot clock drives the icon's
// backOut arrival, three pulse rings broadcasting outward, a serif
// headline landing word by word (italic-muted accent on the payoff word),
// and a subtitle fading up — with the beats felt through the cinema
// engine's haptics (success on the pop, soft ticks as rings fire).
//
// Scale guide: this is for MILESTONES (published a job, finished signup,
// verified an email) — rare, once-per-journey moments. For in-modal or
// in-flow confirmations use ConfirmPop; for ambient feedback use a toast.
//
// The component renders the stage + caption only; screen chrome (footer
// CTA, background, navigation timing) stays with the caller.

import { Check } from "@/components/ui/icons";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Colors, Fonts } from "@/constants/theme";
import {
  backOut,
  type CinemaBeat,
  easeOut,
  useCinemaHaptics,
  win,
} from "./engine";

export interface BroadcastWord {
  word: string;
  accent?: boolean;
}

interface BroadcastMomentProps {
  /** Headline, word by word — mark the payoff word(s) with accent. */
  words: BroadcastWord[];
  subtitle?: string;
  /** Total clock length. Default 2600ms (the publish screen's timing). */
  durationMs?: number;
  /** Replace the default check glyph (must render white-on-ink). */
  icon?: React.ReactNode;
  /** Set false for passive/re-entrant contexts where a buzz would misfire. */
  haptics?: boolean;
}

// All choreography is fractional, so a shorter durationMs compresses the
// whole moment proportionally (used by flows that navigate on a timer).
const BEATS: readonly CinemaBeat[] = [
  { at: 0.18, kind: "success" },
  { at: 0.28, kind: "tick" },
  { at: 0.37, kind: "tick" },
];
const NO_BEATS: readonly CinemaBeat[] = [];
const WORD_START = 0.288;
const WORD_STAGGER = 0.0404;
const WORD_LEN = 0.215;

function BroadcastWordText({
  t,
  index,
  word,
  accent,
}: {
  t: SharedValue<number>;
  index: number;
  word: string;
  accent?: boolean;
}) {
  const start = WORD_START + index * WORD_STAGGER;
  const style = useAnimatedStyle(() => {
    const p = easeOut(win(t.value, start, start + WORD_LEN));
    return { opacity: p, transform: [{ translateY: (1 - p) * 12 }] };
  });
  return (
    <Animated.Text
      style={[styles.headline, accent && styles.headlineAccent, style]}
    >
      {word}{" "}
    </Animated.Text>
  );
}

function BroadcastRing({ t, at }: { t: SharedValue<number>; at: number }) {
  const style = useAnimatedStyle(() => {
    const p = easeOut(win(t.value, at, at + 0.385));
    return {
      opacity: (1 - p) * 0.45 * win(t.value, at, at + 0.02),
      transform: [{ scale: 0.6 + p * 1.75 }],
    };
  });
  return <Animated.View style={[styles.ring, style]} />;
}

export function BroadcastMoment({
  words,
  subtitle,
  durationMs = 2600,
  icon,
  haptics = true,
}: BroadcastMomentProps) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: durationMs, easing: Easing.linear });
  }, [t, durationMs]);
  useCinemaHaptics(t, haptics ? BEATS : NO_BEATS);

  const iconStyle = useAnimatedStyle(() => {
    const p = backOut(win(t.value, 0.046, 0.277));
    return { opacity: Math.min(1, p * 2), transform: [{ scale: p }] };
  });

  const subtitleStyle = useAnimatedStyle(() => {
    const p = easeOut(win(t.value, 0.635, 0.865));
    return { opacity: p, transform: [{ translateY: (1 - p) * 8 }] };
  });

  return (
    <>
      <View style={styles.stage}>
        <View style={styles.core}>
          <BroadcastRing t={t} at={0.177} />
          <BroadcastRing t={t} at={0.273} />
          <BroadcastRing t={t} at={0.369} />
          <Animated.View style={[styles.iconCircle, iconStyle]}>
            {icon ?? <Check color="#FFF" size={36} strokeWidth={3} />}
          </Animated.View>
        </View>
      </View>
      <View style={styles.captionZone}>
        <View style={styles.headlineRow}>
          {words.map((w, i) => (
            <BroadcastWordText
              key={`${w.word}-${i}`}
              t={t}
              index={i}
              word={w.word}
              accent={w.accent}
            />
          ))}
        </View>
        {subtitle ? (
          <Animated.Text style={[styles.subtitle, subtitleStyle]}>
            {subtitle}
          </Animated.Text>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Relative anchor so the rings expand from the icon's exact center.
  core: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 55,
    borderWidth: 1.5,
    borderColor: Colors.muted,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  captionZone: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 36,
    minHeight: 128,
  },
  headlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    lineHeight: 33,
    color: Colors.ink,
  },
  headlineAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  subtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 15,
    color: Colors.body,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 10,
  },
});
