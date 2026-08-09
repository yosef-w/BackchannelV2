import {
    PromptsIntake,
    type PromptAnswer,
} from "@/components/ui/PromptsIntake";
import {
    JOB_PROMPT_CATEGORIES,
    JOB_PROMPT_EXAMPLES,
} from "@/constants/prompts";
import React from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { BroadcastMoment } from "@/components/cinema/BroadcastMoment";
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

// "The Broadcast" — the publish-success moment, running on the shared
// BroadcastMoment primitive (components/cinema/BroadcastMoment.tsx, which
// was extracted FROM this screen and now serves every milestone
// confirmation in the app). The CTA is present throughout — a moment,
// not a gate.
export function CreateJobSuccessScreen({
  visible,
  jobTitle,
  onDone,
}: {
  visible: boolean;
  jobTitle: string;
  onDone: () => void;
}) {
  // Mounts fresh each time the screen shows, so the one-shot clock
  // always starts from zero.
  if (!visible) return null;
  return (
    <View style={styles.screen}>
      <BroadcastMoment
        words={[
          { word: "Your" },
          { word: "role" },
          { word: "is" },
          { word: "live.", accent: true },
        ]}
        subtitle={`Applicants can start swiping on ${jobTitle || "it"} right now.`}
      />
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
});
