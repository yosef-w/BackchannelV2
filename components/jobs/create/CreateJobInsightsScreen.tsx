import { Check, MessageSquareQuote, Sparkles } from "@/components/ui/icons";
import { SponsorInsightCards } from "@/components/jobs/SponsorInsightCards";
import React from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { CreateJobStepHeader } from "./CreateJobStepHeader";

interface InsightsValues {
  dayToDay: string;
  teamCulture: string;
  idealCandidate: string;
  insiderInsights: string;
}

interface CreateJobInsightsScreenProps {
  visible: boolean;
  jobTitle: string;
  values: InsightsValues;
  onChange: (key: keyof InsightsValues, text: string) => void;
  isPublishing: boolean;
  onPublish: () => void;
  onBack: () => void;
  onClose: () => void;
}

/**
 * Step 4 — insider insights, reframed as the payoff rather than a chore.
 * Every other field on this listing could have come from the scraper; this
 * is the one thing only the sponsor can write, and it's what makes a
 * BackChannel listing worth more than the original posting. Skippable —
 * insights can always be added later from My Sponsored — because a
 * skippable step gets finished more often than one that feels mandatory.
 */
export function CreateJobInsightsScreen({
  visible,
  jobTitle,
  values,
  onChange,
  isPublishing,
  onPublish,
  onBack,
  onClose,
}: CreateJobInsightsScreenProps) {
  if (!visible) return null;

  const hasAnyInsight = Object.values(values).some((v) => v.trim().length > 0);

  return (
    <View style={styles.screen}>
      <CreateJobStepHeader
        title="Add Insider Insights"
        step={4}
        totalSteps={4}
        onBack={onBack}
        onClose={onClose}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
                from the job posting. This is what candidates can&apos;t find
                anywhere else — and it&apos;s what makes them apply.
              </Text>
            </View>
          </View>

          <SponsorInsightCards values={values} onChange={onChange} />
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
              <>
                <Sparkles color="#FFF" size={18} />
                <Text style={styles.publishBtnText}>Publish Job</Text>
              </>
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
      </KeyboardAvoidingView>
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
    backgroundColor: "#F8F9FB",
    borderWidth: 1,
    borderColor: "#EEE",
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
    color: "#666",
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
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
    color: "#999",
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
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
});
