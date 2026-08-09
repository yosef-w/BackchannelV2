// The cinema engine — shared machinery for the pre-signup product films
// (IntroCinema for applicants, SponsorCinema for sponsors). Both films are
// deliberate mirrors of each other — same arc, same motion vocabulary,
// same premium finish — so everything that defines that feel lives here
// once: the curves, the master clock, the word-by-word caption engine,
// the act progress hairline, and the haptic beat system.
//
// Clock architecture: ONE master 0→1 shared value drives every element
// through windowed interpolations in UI-thread worklets. The first play
// runs the full reel (problem act included); every loop after that replays
// only the solution acts — resolving the story once and then letting the
// product speak, instead of re-breaking the world every 23 seconds.

import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

// Premium curves: explosive start, long luxurious deceleration for
// entrances; committed acceleration for exits. Evaluated directly in
// worklets — bezierFn's returned closure is itself a worklet (defined
// with a worklet directive inside Reanimated), so it's safe to call from
// useAnimatedStyle. Any plain JS wrapper around these is NOT (a
// non-worklet arrow here previously aborted the whole app with the
// worklet callGuard the moment the film mounted).
export const easeOut = Easing.bezierFn(0.16, 1, 0.3, 1);
export const easeIn = Easing.bezierFn(0.55, 0, 0.8, 0.2);
export const easeInOut = Easing.bezierFn(0.65, 0, 0.35, 1);
export const backOut = Easing.bezierFn(0.34, 1.56, 0.64, 1);

/** Windowed sub-progress: 0 before `a`, 1 after `b`, linear between. */
export const win = (t: number, a: number, b: number): number => {
  'worklet';
  if (t <= a) return 0;
  if (t >= b) return 1;
  return (t - a) / (b - a);
};

// ── Master clock ────────────────────────────────────────────────────────

export interface CinemaClock {
  master: SharedValue<number>;
  /** Slow sine breath (0→1→0, 4.8s round trip) for idle life on actors. */
  breath: SharedValue<number>;
  /** Marching dash offset for the backchannel line (-240 over 16s). */
  march: SharedValue<number>;
  /** Tap-to-advance: hard-cut to the next act boundary. */
  advance: () => void;
}

/**
 * @param totalMs   full-reel duration
 * @param loopStart master value the reel rewinds to after the first full
 *                  play — the story's problem act runs once, then the
 *                  solution acts loop. Must be a point where the stage
 *                  renders empty so the rewind is invisible.
 * @param boundaries act-start times (ascending) used by tap-to-advance.
 */
export function useCinemaClock(
  totalMs: number,
  loopStart: number,
  boundaries: readonly number[],
): CinemaClock {
  const master = useSharedValue(0);
  const breath = useSharedValue(0);
  const march = useSharedValue(0);

  const run = useCallback(
    (from: number) => {
      cancelAnimation(master);
      master.value = from;
      master.value = withSequence(
        withTiming(1, {
          duration: totalMs * (1 - from),
          easing: Easing.linear,
        }),
        withRepeat(
          withSequence(
            withTiming(loopStart, { duration: 0 }),
            withTiming(1, {
              duration: totalMs * (1 - loopStart),
              easing: Easing.linear,
            }),
          ),
          -1,
        ),
      );
    },
    [master, totalMs, loopStart],
  );

  useEffect(() => {
    run(0);
    march.value = withRepeat(
      withTiming(-240, { duration: 16000, easing: Easing.linear }),
      -1,
    );
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(master);
      cancelAnimation(march);
      cancelAnimation(breath);
    };
  }, [run, master, march, breath]);

  const advance = useCallback(() => {
    // Reading .value from JS is a one-off snapshot — fine outside worklets.
    const t = master.value;
    const next = boundaries.find((b) => b > t + 0.002);
    if (next !== undefined && next < 0.999) run(next);
  }, [boundaries, run, master]);

  return { master, breath, march, advance };
}

// ── Haptic beats ────────────────────────────────────────────────────────
// The film is felt, not just watched: each beat fires once as the clock
// crosses its timestamp. Loop rewinds (value decreasing) and tap-advance
// jumps (large deltas) deliberately fire nothing — haptics only accompany
// motion the viewer actually watched happen.

export type CinemaBeatKind = 'tick' | 'impact' | 'heavy' | 'success';

export interface CinemaBeat {
  at: number;
  kind: CinemaBeatKind;
}

function fireBeat(kind: CinemaBeatKind): void {
  switch (kind) {
    case 'tick':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      break;
    case 'impact':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      break;
    case 'heavy':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      break;
    case 'success':
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      break;
  }
}

export function useCinemaHaptics(
  master: SharedValue<number>,
  beats: readonly CinemaBeat[],
): void {
  useAnimatedReaction(
    () => master.value,
    (curr, prev) => {
      if (prev === null || curr <= prev) return; // first frame / loop rewind
      if (curr - prev > 0.02) return; // tap-advance jump — stay silent
      for (const beat of beats) {
        if (prev < beat.at && curr >= beat.at) runOnJS(fireBeat)(beat.kind);
      }
    },
  );
}

// ── Act progress ────────────────────────────────────────────────────────
// A stories-style hairline: one segment per act, filling in real time —
// tells the viewer this is a short, finite reel (and where they are in it).

export function ActProgress({
  master,
  acts,
}: {
  master: SharedValue<number>;
  acts: readonly (readonly [number, number])[];
}) {
  return (
    <View style={styles.progressRow} pointerEvents="none">
      {acts.map(([a, b], i) => (
        <ProgressSegment key={i} master={master} a={a} b={b} />
      ))}
    </View>
  );
}

function ProgressSegment({
  master,
  a,
  b,
}: {
  master: SharedValue<number>;
  a: number;
  b: number;
}) {
  const fill = useAnimatedStyle(() => ({
    width: `${win(master.value, a, b) * 100}%`,
  }));
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fill]} />
    </View>
  );
}

// ── Caption engine ──────────────────────────────────────────────────────
// Words reveal one after another (~100ms apart, each on the premium
// decel curve), and the whole line exits by continuing its upward travel
// while fading — motion has one direction, so nothing feels like it
// bounces back where it came from.

const WORD_STAGGER = 0.0045; // ≈105ms between word starts
const WORD_LEN = 0.024; // ≈565ms per word reveal

export interface CaptionSegment {
  text: string;
  accent?: boolean;
}

export function CinemaCaption({
  master,
  enter,
  out,
  segments,
  textStyle,
  accentStyle,
}: {
  master: SharedValue<number>;
  enter: number;
  out: [number, number];
  segments: CaptionSegment[];
  textStyle: TextStyle;
  accentStyle?: TextStyle;
}) {
  const words = useMemo(
    () =>
      segments.flatMap((seg) =>
        seg.text
          .split(' ')
          .filter(Boolean)
          .map((word) => ({ word, accent: seg.accent })),
      ),
    [segments],
  );

  const containerStyle = useAnimatedStyle(() => {
    const o = easeIn(win(master.value, out[0], out[1]));
    return { opacity: 1 - o, transform: [{ translateY: -o * 10 }] };
  });

  return (
    <Animated.View style={[styles.captionRow, containerStyle]}>
      {words.map((w, i) => (
        <CaptionWord
          key={`${w.word}-${i}`}
          master={master}
          start={enter + i * WORD_STAGGER}
          baseStyle={textStyle}
          accentStyle={w.accent ? accentStyle : undefined}
          word={w.word}
        />
      ))}
    </Animated.View>
  );
}

function CaptionWord({
  master,
  start,
  word,
  baseStyle,
  accentStyle,
}: {
  master: SharedValue<number>;
  start: number;
  word: string;
  baseStyle: TextStyle;
  accentStyle?: TextStyle;
}) {
  const style = useAnimatedStyle(() => {
    const p = easeOut(win(master.value, start, start + WORD_LEN));
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * 12 }],
    };
  });

  return (
    <Animated.Text style={[baseStyle, accentStyle, style]}>
      {word}{' '}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  progressRow: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 28,
    marginTop: 14,
  },
  progressTrack: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
    backgroundColor: Colors.muted,
  },
  captionRow: {
    position: 'absolute',
    left: 36,
    right: 36,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
});
