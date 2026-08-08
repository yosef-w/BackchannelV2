import { Check, MessageSquareQuote } from "@/components/ui/icons";
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
import { CreateJobStepHeader } from "./CreateJobStepHeader";
import { Colors, Type } from "@/constants/theme";

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
          <View style={styles.payoffBanner}>
            <View style={styles.payoffIconCircle}>
              <MessageSquareQuote color="#FFF" size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payoffTitle}>The part only you can write</Text>
              <Text style={styles.payoffSubtitle}>
                Every other field on {jobTitle || "this listing"} could come
                from the job posting. Answer a prompt or two about what it&apos;s
                really like — that&apos;s what makes candidates apply.
              </Text>
            </View>
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

export function CreateJobSuccessScreen({
  visible,
  jobTitle,
  onDone,
}: {
  visible: boolean;
  jobTitle: string;
  onDone: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.screen}>
      <View style={styles.successContent}>
        <View style={styles.successIconCircle}>
          <Check color="#FFF" size={36} strokeWidth={3} />
        </View>
        <Text style={styles.successTitle}>Listing Published</Text>
        <Text style={styles.successSubtitle}>
          {jobTitle || "Your job"} is live. Applicants can start swiping on it
          right now.
        </Text>
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
  payoffBanner: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
  },
  payoffIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  payoffTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
    marginBottom: 4,
  },
  payoffSubtitle: {
    fontSize: 13,
    color: Colors.body,
    lineHeight: 19,
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
  successContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    ...Type.heading,
    color: Colors.ink,
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 15,
    color: Colors.body,
    textAlign: "center",
    lineHeight: 22,
  },
});
