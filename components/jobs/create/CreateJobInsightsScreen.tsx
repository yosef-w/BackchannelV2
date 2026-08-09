import { Check } from "@/components/ui/icons";
import {
    PromptsIntake,
    type PromptAnswer,
} from "@/components/ui/PromptsIntake";
import {
    JOB_PROMPT_CATEGORIES,
    JOB_PROMPT_EXAMPLES,
} from "@/constants/prompts";
import React, { useEffect } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    Easing,
    type SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import {
    backOut,
    type CinemaBeat,
    easeOut,
    useCinemaHaptics,
    win,
} from "@/components/cinema/engine";
import { CreateJobStepHeader } from "./CreateJobStepHeader";
import { Colors, Fonts } from "@/constants/theme";

interface CreateJobInsightsScreenProps {
  visible: boolean;
  jobTitle: string;
  answers: PromptAnswer[];
  onChangeAnswers: (next: PromptAnswer[]) => void;
  isPublishing: boolean;
  onPublish: () => void;
  onBack: () => void;
  onClose: () => void;
}

// A sponsor realistically writes 2-4 great insights; 6 leaves headroom
// without inviting a wall of text on the applicant's card.
const MAX_JOB_PROMPTS = 6;
const MAX_JOB_ANSWER_LENGTH = 500;

/**
 * Step 4 — insider insights as Hinge-style prompts: the same PromptsIntake
 * system applicants use at signup, fed with job-flavored prompts ("YOU'LL
 * STRUGGLE HERE IF…"). Picking and answering happen in PromptsIntake's own
 * full-screen library/editor, so the keyboard never fights this screen for
 * space. Fully skippable — insights can always be added later from My
 * Sponsored — because a skippable step gets finished more often than one
 * that feels mandatory.
 */
export function CreateJobInsightsScreen({
  visible,
  jobTitle,
  answers,
  onChangeAnswers,
  isPublishing,
  onPublish,
  onBack,
  onClose,
}: CreateJobInsightsScreenProps) {
  if (!visible) return null;

  const hasAnyInsight = answers.some((a) => a.answer.trim().length > 0);

  return (
    <View style={styles.screen}>
      <CreateJobStepHeader
        title="Add Insider Insights"
        step={4}
        totalSteps={4}
        onBack={onBack}
        onClose={onClose}
      />
      {/* Keyboard avoidance is handled once at the flow root
          (CreateJobFlowScreen) — no per-screen KAV. */}
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Plain section intro, deliberately NOT a card — the prompt
              cards below are the interactive objects on this screen, and
              a card introducing more cards diluted them (PM note). */}
          <View style={styles.payoffIntro}>
            <Text style={styles.payoffTitle}>The part only you can write</Text>
            <Text style={styles.payoffSubtitle}>
              Every other field on {jobTitle || "this listing"} could come
              from the job posting. Answer a prompt or two about what it&apos;s
              really like — that&apos;s what makes candidates apply.
            </Text>
          </View>

          <PromptsIntake
            value={answers}
            onChange={onChangeAnswers}
            categories={JOB_PROMPT_CATEGORIES}
            examples={JOB_PROMPT_EXAMPLES}
            min={0}
            max={MAX_JOB_PROMPTS}
            maxAnswerLength={MAX_JOB_ANSWER_LENGTH}
            emptySlotLabel="Add an insider insight"
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.publishBtn, isPublishing && styles.publishBtnDisabled]}
            onPress={onPublish}
            disabled={isPublishing}
            activeOpacity={0.85}
          >
            {isPublishing ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.publishBtnText}>Publish Job</Text>
            )}
          </TouchableOpacity>
          {!hasAnyInsight && !isPublishing && (
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={onPublish}
              activeOpacity={0.7}
            >
              <Text style={styles.skipBtnText}>
                Skip for now — I&apos;ll add these later
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ── "The Broadcast" — the publish-success moment ────────────────────────
// One 2.6s one-shot clock (0→1) drives everything through windowed
// worklet interpolations — the intro films' engine (curves, win, haptic
// beats) at confirmation scale. The check arrives with the films'
// overshoot, three pulse rings broadcast outward (your role is now out
// in front of candidates), the headline lands word by word in the brand
// serif, and each beat is felt: a success haptic on the pop, soft ticks
// as the later rings fire. The CTA is present throughout — a moment,
// not a gate.
const SUCCESS_MS = 2600;
const SUCCESS_BEATS: readonly CinemaBeat[] = [
  { at: 0.18, kind: "success" },
  { at: 0.28, kind: "tick" },
  { at: 0.37, kind: "tick" },
];
// Headline words: start / stagger / reveal-length as fractions of the
// 2.6s clock (≈750ms in, ≈105ms apart, ≈560ms per word — the films'
// caption rhythm rescaled to this clock).
const SUCCESS_WORDS: { word: string; accent?: boolean }[] = [
  { word: "Your" },
  { word: "role" },
  { word: "is" },
  { word: "live.", accent: true },
];
const SW_START = 0.288;
const SW_STAGGER = 0.0404;
const SW_LEN = 0.215;

function SuccessWord({
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
  const start = SW_START + index * SW_STAGGER;
  const style = useAnimatedStyle(() => {
    const p = easeOut(win(t.value, start, start + SW_LEN));
    return { opacity: p, transform: [{ translateY: (1 - p) * 12 }] };
  });
  return (
    <Animated.Text
      style={[
        styles.successHeadline,
        accent && styles.successHeadlineAccent,
        style,
      ]}
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
  return <Animated.View style={[styles.broadcastRing, style]} />;
}

export function CreateJobSuccessScreen({
  visible,
  jobTitle,
  onDone,
}: {
  visible: boolean;
  jobTitle: string;
  onDone: () => void;
}) {
  // Inner component mounts fresh each time the screen shows, so the
  // one-shot clock always starts from zero.
  if (!visible) return null;
  return <BroadcastSuccess jobTitle={jobTitle} onDone={onDone} />;
}

function BroadcastSuccess({
  jobTitle,
  onDone,
}: {
  jobTitle: string;
  onDone: () => void;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: SUCCESS_MS, easing: Easing.linear });
  }, [t]);
  useCinemaHaptics(t, SUCCESS_BEATS);

  const check = useAnimatedStyle(() => {
    const p = backOut(win(t.value, 0.046, 0.277));
    return {
      opacity: Math.min(1, p * 2),
      transform: [{ scale: p }],
    };
  });

  const subtitle = useAnimatedStyle(() => {
    const p = easeOut(win(t.value, 0.635, 0.865));
    return { opacity: p, transform: [{ translateY: (1 - p) * 8 }] };
  });

  return (
    <View style={styles.screen}>
      <View style={styles.successStage}>
        <View style={styles.broadcastCore}>
          <BroadcastRing t={t} at={0.177} />
          <BroadcastRing t={t} at={0.273} />
          <BroadcastRing t={t} at={0.369} />
          <Animated.View style={[styles.successIconCircle, check]}>
            <Check color="#FFF" size={36} strokeWidth={3} />
          </Animated.View>
        </View>
      </View>
      <View style={styles.successCaptionZone}>
        <View style={styles.successHeadlineRow}>
          {SUCCESS_WORDS.map((w, i) => (
            <SuccessWord
              key={w.word}
              t={t}
              index={i}
              word={w.word}
              accent={w.accent}
            />
          ))}
        </View>
        <Animated.Text style={[styles.successSubtitle, subtitle]}>
          Applicants can start swiping on {jobTitle || "it"} right now.
        </Animated.Text>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.publishBtn}
          onPress={onDone}
          activeOpacity={0.85}
        >
          <Text style={styles.publishBtnText}>View in My Sponsored</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF" },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48 },
  // Editorial section intro — serif head + light body, per the site's
  // section-intro language. No container: cards are reserved for the
  // interactive prompt objects below.
  payoffIntro: {
    marginBottom: 24,
    paddingRight: 8,
  },
  payoffTitle: {
    fontFamily: Fonts.serif,
    fontSize: 19,
    color: Colors.ink,
    marginBottom: 6,
  },
  payoffSubtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 14,
    color: Colors.body,
    lineHeight: 21,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  publishBtn: {
    flexDirection: "row",
    backgroundColor: "#000",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  publishBtnDisabled: { opacity: 0.6 },
  publishBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  skipBtn: { paddingVertical: 14, alignItems: "center" },
  skipBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.muted,
    textDecorationLine: "underline",
  },
  // ── The Broadcast ─────────────────────────────────────────────────────
  successStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Relative anchor so the rings expand from the check's exact center.
  broadcastCore: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  broadcastRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 55,
    borderWidth: 1.5,
    borderColor: Colors.muted,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  successCaptionZone: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 36,
    minHeight: 128,
  },
  successHeadlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  successHeadline: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    lineHeight: 33,
    color: Colors.ink,
  },
  successHeadlineAccent: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  successSubtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 15,
    color: Colors.body,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 10,
  },
});
