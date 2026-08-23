// ResumeReadingFilm — "The Reading": the full-screen film that plays while
// an applicant's résumé is uploaded, parsed, and AI-classified during
// onboarding. Replaces the blur-and-spinner overlay with a staged title
// sequence in the app's editorial voice.
//
// Structure (one scene on stage at a time, never two):
//   1 · the scan — miniature résumé under a slow reading beam
//   2 · fact one, 3 · fact two — full-read DID YOU KNOW beats making the
//       case for the backchannel in full-bleed serif type
//   4 · the drift — verbatim lines from the user's own parsed résumé
//       (skipped when no presentable lines exist yet)
//   5 · fact three
//   6 · the build — the REAL classified values typeset into the deck
//       card's ledger keys, fired by the API resolving, never the clock
//   7 · confirmation — BroadcastMoment, then onComplete
//
// Signal-driven, single run-through: the rotation plays once; if the AI is
// still working after fact three, a quiet "still reading" hold breathes
// until `resolved` flips (the caller's 75s foreground timeout unmounts the
// film if the API outlasts even that). When `resolved` arrives mid-scene,
// the current beat finishes its read before cutting to the build — no
// scene is ever yanked mid-sentence. A resolve during the scan still plays
// fact one first, so every wait gets at least one full beat of theater.

import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Colors, Fonts } from "@/constants/theme";
import { BroadcastMoment } from "./BroadcastMoment";
import type { ReadingRow } from "./resumeReadingContent";
import { pickResumeLines } from "./resumeReadingContent";

// ─── Timing ───────────────────────────────────────────────────────────────
// One run-through: scan + three facts + drift ≈ 46s of unique material —
// sized to the classify step's typical 20–60s. Facts hold long enough for
// a comfortable full read (user-tuned: longer beats over repeats).

const SCAN_MS = 5000;
const FACT_MS = 9000;
const DRIFT_MS = 7000;
const BUILD_MS = 5600;
const CONFIRM_MS = 3400;

type SceneId =
  | "scan"
  | "fact0"
  | "fact1"
  | "drift"
  | "fact2"
  | "hold"
  | "build"
  | "confirm";

const SCENE_MS: Record<SceneId, number> = {
  scan: SCAN_MS,
  fact0: FACT_MS,
  fact1: FACT_MS,
  drift: DRIFT_MS,
  fact2: FACT_MS,
  hold: 0, // waits on `resolved`, not the clock
  build: BUILD_MS,
  confirm: CONFIRM_MS,
};

// ─── Fact copy ────────────────────────────────────────────────────────────
// The case for the backchannel, one claim per beat. Accented spans render
// serif-italic muted, matching the film voice everywhere else in the app.

interface FactSegment {
  text: string;
  accent?: boolean;
}

interface Fact {
  big: string;
  bigSuffix: string;
  segments: FactSegment[];
  kicker: string;
}

const FACTS: Fact[] = [
  {
    big: "4",
    bigSuffix: "×",
    segments: [
      { text: "Referred candidates are " },
      { text: "four times", accent: true },
      { text: " more likely to be hired." },
    ],
    kicker: "THAT'S WHY SPONSORS EXIST HERE",
  },
  {
    big: "80",
    bigSuffix: "%",
    segments: [
      { text: "Up to " },
      { text: "80% of roles", accent: true },
      { text: " are filled before they're ever posted." },
    ],
    kicker: "BACKCHANNEL PUTS YOU ON THE INSIDE",
  },
  {
    big: "40",
    bigSuffix: "%",
    segments: [
      { text: "Referrals are just " },
      { text: "7% of applicants", accent: true },
      { text: " — and about " },
      { text: "40% of hires.", accent: true },
    ],
    kicker: "BACKCHANNEL TURNS THE ODDS YOUR WAY",
  },
];

// ─── Film progress hairline ───────────────────────────────────────────────
// Four segments — scan / rotation / build / done — the stories-style
// "this is finite and you are here" cue from the intro films.

function ProgressSegment({ progress }: { progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fill]} />
    </View>
  );
}

// ─── Scenes ───────────────────────────────────────────────────────────────

/** The miniature résumé under its reading beam — scan and hold scenes. */
function ScanStage({ caption, breathing }: { caption: React.ReactNode; breathing?: boolean }) {
  const beam = useSharedValue(0);
  const breath = useSharedValue(1);

  useEffect(() => {
    beam.value = withRepeat(
      withTiming(1, { duration: 2300, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    if (breathing) {
      breath.value = withRepeat(
        withSequence(
          withTiming(0.45, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
    }
  }, [beam, breath, breathing]);

  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -20 + beam.value * 152 }],
  }));
  const breathStyle = useAnimatedStyle(() => ({ opacity: breath.value }));

  return (
    <>
      <View style={styles.doc}>
        <View style={[styles.docLine, styles.docHeading]} />
        <View style={styles.docLine} />
        <View style={[styles.docLine, styles.docW80]} />
        <View style={styles.docLine} />
        <View style={[styles.docLine, styles.docW60]} />
        <View style={[styles.docLine, styles.docW80]} />
        <View style={styles.docLine} />
        <View style={[styles.docLine, styles.docW60]} />
        <Animated.View style={[styles.beam, beamStyle]} />
      </View>
      <Animated.View
        entering={FadeInDown.delay(650).duration(650)}
        style={breathing ? breathStyle : undefined}
      >
        <Text style={styles.sceneCaption}>{caption}</Text>
      </Animated.View>
    </>
  );
}

function FactScene({ fact }: { fact: Fact }) {
  return (
    <>
      <Animated.View entering={FadeInDown.delay(300).duration(650)}>
        <Text style={styles.eyebrow}>DID YOU KNOW</Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(550).duration(650)}>
        <Text style={styles.factBig}>
          {fact.big}
          <Text style={styles.factBigSuffix}>{fact.bigSuffix}</Text>
        </Text>
      </Animated.View>
      <Animated.View
        entering={FadeInDown.delay(800).duration(650)}
        style={styles.factRule}
      />
      <Animated.View entering={FadeInDown.delay(950).duration(650)}>
        <Text style={styles.factDesc}>
          {fact.segments.map((seg, i) => (
            <Text key={i} style={seg.accent ? styles.factDescAccent : undefined}>
              {seg.text}
            </Text>
          ))}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(1500).duration(650)}>
        <Text style={styles.kicker}>{fact.kicker}</Text>
      </Animated.View>
    </>
  );
}

function DriftScene({ lines }: { lines: string[] }) {
  return (
    <>
      <Animated.View entering={FadeInDown.delay(300).duration(650)}>
        <Text style={styles.eyebrow}>FROM YOUR RÉSUMÉ</Text>
      </Animated.View>
      {lines.map((line, i) => (
        <Animated.View
          key={line}
          entering={FadeInDown.delay(800 + i * 800).duration(650)}
        >
          <Text style={[styles.driftLine, i > 0 && styles.driftLineDim]}>
            “{line}”
          </Text>
        </Animated.View>
      ))}
      <Animated.View entering={FadeInDown.delay(800 + lines.length * 800).duration(650)}>
        <Text style={styles.kicker}>STILL READING — THIS IS YOU</Text>
      </Animated.View>
    </>
  );
}

const BUILD_ROW_BASE_MS = 700;
const BUILD_ROW_STEP_MS = 1200;

function BuildScene({ rows }: { rows: ReadingRow[] }) {
  return (
    <>
      <Animated.View entering={FadeInDown.duration(650)}>
        <Text style={styles.sceneCaption}>
          Building your <Text style={styles.sceneCaptionAccent}>profile.</Text>
        </Text>
      </Animated.View>
      <View style={styles.ledger}>
        {rows.map((row, i) => (
          <Animated.View
            key={row.label}
            entering={FadeInDown.delay(BUILD_ROW_BASE_MS + i * BUILD_ROW_STEP_MS).duration(650)}
            style={styles.ledgerRow}
          >
            <Text style={styles.ledgerKey} numberOfLines={1}>
              {row.label}
            </Text>
            <Text style={styles.ledgerValue} numberOfLines={1}>
              {row.value}
            </Text>
          </Animated.View>
        ))}
      </View>
    </>
  );
}

// ─── The film ─────────────────────────────────────────────────────────────

interface ResumeReadingFilmProps {
  /** Raw extracted résumé text — arrives when the parse step lands. */
  resumeText: string | null;
  /** True once classify + profile refetch are done (real values exist). */
  resolved: boolean;
  /** Real ledger rows for the build scene (buildReadingRows output). */
  rows: ReadingRow[];
  /** Fired when the confirmation beat finishes — the caller advances. */
  onComplete: () => void;
}

export function ResumeReadingFilm({
  resumeText,
  resolved,
  rows,
  onComplete,
}: ResumeReadingFilmProps) {
  const [scene, setScene] = useState<SceneId>("scan");
  const sceneRef = useRef<SceneId>("scan");
  sceneRef.current = scene;
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Drift lines computed once the parse text arrives; the rotation checks
  // this at the moment it reaches the drift slot.
  const driftLinesRef = useRef<string[]>([]);
  const [driftLines, setDriftLines] = useState<string[]>([]);
  useEffect(() => {
    if (resumeText && driftLinesRef.current.length === 0) {
      const lines = pickResumeLines(resumeText);
      driftLinesRef.current = lines;
      setDriftLines(lines);
    }
  }, [resumeText]);

  const advance = useCallback(() => {
    const cur = sceneRef.current;
    if (cur === "confirm") return;
    if (cur === "build") {
      setScene("confirm");
      return;
    }
    // The API landed: cut to the build after the beat that just finished —
    // except out of the scan, where fact one still plays (minimum theater).
    if (resolvedRef.current && cur !== "scan") {
      setScene("build");
      return;
    }
    const next: SceneId | null =
      cur === "scan"
        ? "fact0"
        : cur === "fact0"
          ? "fact1"
          : cur === "fact1"
            ? driftLinesRef.current.length > 0
              ? "drift"
              : "fact2"
            : cur === "drift"
              ? "fact2"
              : null; // fact2 → rotation exhausted
    if (next) {
      setScene(next);
    } else {
      setScene(resolvedRef.current ? "build" : "hold");
    }
  }, []);

  // Scene clock — each scene books its own exit; hold waits on `resolved`.
  useEffect(() => {
    if (scene === "hold") return;
    if (scene === "confirm") {
      const t = setTimeout(() => onCompleteRef.current(), CONFIRM_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(advance, SCENE_MS[scene]);
    return () => clearTimeout(t);
  }, [scene, advance]);

  // A resolve arriving during the hold cuts to the build immediately.
  useEffect(() => {
    if (resolved && scene === "hold") setScene("build");
  }, [resolved, scene]);

  // Haptic beats: a light tick as each scene lands, medium ticks as the
  // build rows typeset. The confirmation's success buzz comes from
  // BroadcastMoment itself.
  useEffect(() => {
    if (scene === "scan" || scene === "confirm") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (scene === "build") {
      const timers = rows.map((_, i) =>
        setTimeout(
          () =>
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            ),
          BUILD_ROW_BASE_MS + i * BUILD_ROW_STEP_MS,
        ),
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [scene, rows]);

  // Progress hairline — scan / rotation / build / done.
  const seg0 = useSharedValue(0);
  const seg1 = useSharedValue(0);
  const seg2 = useSharedValue(0);
  const seg3 = useSharedValue(0);
  useEffect(() => {
    switch (scene) {
      case "scan":
        seg0.value = withTiming(1, { duration: SCAN_MS, easing: Easing.linear });
        break;
      case "fact0":
        seg1.value = withTiming(0.3, { duration: FACT_MS, easing: Easing.linear });
        break;
      case "fact1":
        seg1.value = withTiming(0.55, { duration: FACT_MS, easing: Easing.linear });
        break;
      case "drift":
        seg1.value = withTiming(0.75, { duration: DRIFT_MS, easing: Easing.linear });
        break;
      case "fact2":
        seg1.value = withTiming(0.95, { duration: FACT_MS, easing: Easing.linear });
        break;
      case "hold":
        // A slow honest crawl — never reaches full while we're still waiting.
        seg1.value = withTiming(0.99, { duration: 30000, easing: Easing.linear });
        break;
      case "build":
        seg1.value = withTiming(1, { duration: 300 });
        seg2.value = withTiming(1, { duration: BUILD_MS, easing: Easing.linear });
        break;
      case "confirm":
        seg2.value = withTiming(1, { duration: 300 });
        seg3.value = withTiming(1, { duration: 2600, easing: Easing.linear });
        break;
    }
  }, [scene, seg0, seg1, seg2, seg3]);

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(300)}
      style={[StyleSheet.absoluteFill, styles.root]}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.progressRow}>
          <ProgressSegment progress={seg0} />
          <ProgressSegment progress={seg1} />
          <ProgressSegment progress={seg2} />
          <ProgressSegment progress={seg3} />
        </View>

        {scene === "confirm" ? (
          <Animated.View entering={FadeIn.duration(350)} style={styles.confirmStage}>
            <BroadcastMoment
              words={[
                { word: "Your" },
                { word: "profile" },
                { word: "is" },
                { word: "ready.", accent: true },
              ]}
              subtitle="Here's what we found — fine-tune anything later."
              durationMs={2600}
            />
          </Animated.View>
        ) : (
          <Animated.View
            key={scene}
            entering={FadeInDown.delay(280).duration(500)}
            exiting={FadeOutUp.duration(380)}
            style={styles.stage}
          >
            {scene === "scan" && (
              <ScanStage caption="Reading your résumé." />
            )}
            {scene === "fact0" && <FactScene fact={FACTS[0]} />}
            {scene === "fact1" && <FactScene fact={FACTS[1]} />}
            {scene === "drift" && <DriftScene lines={driftLines} />}
            {scene === "fact2" && <FactScene fact={FACTS[2]} />}
            {scene === "hold" && (
              <ScanStage
                breathing
                caption={
                  <>
                    Still reading — <Text style={styles.sceneCaptionAccent}>almost there.</Text>
                  </>
                }
              />
            )}
            {scene === "build" && <BuildScene rows={rows} />}
          </Animated.View>
        )}
      </SafeAreaView>
    </Animated.View>
  );
}

// ─── Styles — paper-and-ink, DM Serif / DM Sans, artifact-matched ────────

const styles = StyleSheet.create({
  root: {
    backgroundColor: Colors.paper,
    zIndex: 40,
  },
  safeArea: {
    flex: 1,
  },
  progressRow: {
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 28,
    marginTop: 14,
  },
  progressTrack: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1,
    backgroundColor: Colors.muted,
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },
  confirmStage: {
    flex: 1,
  },
  // The miniature résumé.
  doc: {
    width: 124,
    height: 160,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    elevation: 4,
  },
  docLine: {
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.offWhite,
    marginTop: 10,
    marginHorizontal: 14,
  },
  docHeading: {
    height: 9,
    backgroundColor: "#E9E6DE",
    width: "52%",
    marginTop: 14,
  },
  docW80: { width: "68%" },
  docW60: { width: "50%" },
  beam: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 26,
    backgroundColor: "rgba(10,10,10,0.055)",
  },
  sceneCaption: {
    fontFamily: Fonts.serif,
    fontSize: 23,
    lineHeight: 30,
    color: Colors.ink,
    textAlign: "center",
    marginTop: 30,
  },
  sceneCaptionAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  eyebrow: {
    fontFamily: Fonts.sansBold,
    fontSize: 10.5,
    letterSpacing: 2.4,
    color: Colors.muted,
    textAlign: "center",
  },
  factBig: {
    fontFamily: Fonts.serif,
    fontSize: 76,
    lineHeight: 84,
    color: Colors.ink,
    textAlign: "center",
    marginTop: 22,
  },
  factBigSuffix: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  factRule: {
    width: 34,
    height: 1,
    backgroundColor: Colors.muted,
    opacity: 0.5,
    marginTop: 22,
    marginBottom: 20,
    alignSelf: "center",
  },
  factDesc: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    lineHeight: 29,
    color: Colors.ink,
    textAlign: "center",
  },
  factDescAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  kicker: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: Colors.muted,
    textAlign: "center",
    marginTop: 16,
  },
  driftLine: {
    fontFamily: Fonts.serifItalic,
    fontSize: 17.5,
    lineHeight: 27,
    color: Colors.ink,
    textAlign: "center",
    marginTop: 14,
  },
  driftLineDim: {
    color: Colors.body,
  },
  ledger: {
    width: "100%",
    marginTop: 22,
  },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ledgerKey: {
    width: 104,
    fontFamily: Fonts.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: Colors.muted,
  },
  ledgerValue: {
    flex: 1,
    fontFamily: Fonts.serif,
    fontSize: 16,
    color: Colors.ink,
  },
});
