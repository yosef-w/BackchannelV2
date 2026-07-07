import {
    Check,
    ChevronLeft,
    ChevronRight,
    Globe,
    Sparkles,
    X,
} from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { WebView } from "react-native-webview";
import { jobsModalStyles } from "./jobsModalStyles";
import { SponsorInsightCards } from "./SponsorInsightCards";

export type CreateFlowStep = "url" | "webview" | "insights";

export interface CreateFlowInsights {
  dayToDay: string;
  teamCulture: string;
  idealCandidate: string;
  insiderInsights: string;
}

interface CreateJobFlowProps {
  visible: boolean;
  step: CreateFlowStep;
  onSetStep: (step: CreateFlowStep) => void;
  onClose: () => void;
  // URL step
  jobUrlInput: string;
  onSetJobUrlInput: (url: string) => void;
  onPreviewJob: () => void;
  // WebView step — the ref and the scraping message handler stay owned by
  // JobsView (handleConfirmJob injects the scraping script into this same
  // ref), so both are threaded through rather than duplicated here.
  webviewRef: React.RefObject<WebView | null>;
  previewUrl: string;
  webviewLoading: boolean;
  onSetWebviewLoading: (loading: boolean) => void;
  webviewCanGoBack: boolean;
  webviewCanGoForward: boolean;
  onSetWebviewCanGoBack: (v: boolean) => void;
  onSetWebviewCanGoForward: (v: boolean) => void;
  onWebViewMessage: (event: { nativeEvent: { data: string } }) => void;
  isScraping: boolean;
  onConfirmJob: () => void;
  // Insights step
  insights: CreateFlowInsights;
  onSetDayToDay: (v: string) => void;
  onSetTeamCulture: (v: string) => void;
  onSetIdealCandidate: (v: string) => void;
  onSetInsiderInsights: (v: string) => void;
  isCreatingJob: boolean;
  onCreateJob: () => void;
}

/**
 * Create-a-job-from-URL flow — three chained modals: 1) URL entry, 2) a
 * full-screen WebView preview of the posting (with the scrape-confirm bar),
 * 3) BackChannel insights (SponsorInsightCards) before creation. Extracted
 * from JobsView as one unit since all three share the create-flow state
 * machine (showCreateModal + createFlowStep).
 */
export function CreateJobFlow({
  visible,
  step,
  onSetStep,
  onClose,
  jobUrlInput,
  onSetJobUrlInput,
  onPreviewJob,
  webviewRef,
  previewUrl,
  webviewLoading,
  onSetWebviewLoading,
  webviewCanGoBack,
  webviewCanGoForward,
  onSetWebviewCanGoBack,
  onSetWebviewCanGoForward,
  onWebViewMessage,
  isScraping,
  onConfirmJob,
  insights,
  onSetDayToDay,
  onSetTeamCulture,
  onSetIdealCandidate,
  onSetInsiderInsights,
  isCreatingJob,
  onCreateJob,
}: CreateJobFlowProps) {
  return (
    <>
      {/* Step 1: URL Entry Modal */}
      <Modal
        visible={visible && step === "url"}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          style={jobsModalStyles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          >
            <BlurView
              intensity={60}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>
          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={jobsModalStyles.createModalContent}
          >
            {/* Header */}
            <View style={jobsModalStyles.modalHeader}>
              <Text style={jobsModalStyles.modalMainTitle}>Add a Job</Text>
              <TouchableOpacity
                onPress={onClose}
                style={jobsModalStyles.closeButton}
              >
                <X color="#000" size={24} />
              </TouchableOpacity>
            </View>

            <Text style={jobsModalStyles.modalSubTitle}>
              Paste the URL of the job posting you want to add to BackChannel.
            </Text>

            {/* URL Input */}
            <View style={styles.urlInputContainer}>
              <Globe color="#999" size={18} />
              <TextInput
                style={styles.urlTextInput}
                placeholder="https://jobs.company.com/role"
                placeholderTextColor="#999"
                value={jobUrlInput}
                onChangeText={onSetJobUrlInput}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={jobUrlInput.trim() ? onPreviewJob : undefined}
                returnKeyType="go"
              />
              {jobUrlInput.trim().length > 0 && (
                <TouchableOpacity
                  onPress={() => onSetJobUrlInput("")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X color="#999" size={16} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.urlHintText}>
              Works with Greenhouse, Lever, Workday, and most job boards.
            </Text>

            {/* Preview Button */}
            <TouchableOpacity
              style={[
                jobsModalStyles.confirmBtn,
                {
                  marginTop: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                },
                !jobUrlInput.trim() && jobsModalStyles.confirmBtnDisabled,
              ]}
              disabled={!jobUrlInput.trim()}
              onPress={onPreviewJob}
              activeOpacity={0.85}
            >
              <Globe color={!jobUrlInput.trim() ? "#999" : "#FFF"} size={18} />
              <Text
                style={[
                  jobsModalStyles.confirmBtnText,
                  !jobUrlInput.trim() && { color: "#999" },
                ]}
              >
                Preview Job
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Step 2: Full-Screen WebView Job Preview */}
      <Modal
        visible={visible && step === "webview"}
        animationType="slide"
        onRequestClose={() => onSetStep("url")}
      >
        <SafeAreaView style={styles.webviewModalContainer}>
          {/* Header */}
          <View style={styles.createWebViewHeader}>
            <TouchableOpacity
              onPress={() => onSetStep("url")}
              style={styles.createWebViewNavBtn}
              activeOpacity={0.7}
            >
              <X color="#000" size={22} />
            </TouchableOpacity>

            <View style={styles.createWebViewUrlWrap}>
              <Globe color="#999" size={13} />
              <Text style={styles.createWebViewUrl} numberOfLines={1}>
                {previewUrl}
              </Text>
            </View>

            <View style={styles.createWebViewNavGroup}>
              <TouchableOpacity
                onPress={() => webviewRef.current?.goBack()}
                disabled={!webviewCanGoBack}
                style={styles.createWebViewNavBtn}
                activeOpacity={0.7}
              >
                <ChevronLeft
                  color={webviewCanGoBack ? "#000" : "#CCC"}
                  size={22}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => webviewRef.current?.goForward()}
                disabled={!webviewCanGoForward}
                style={styles.createWebViewNavBtn}
                activeOpacity={0.7}
              >
                <ChevronRight
                  color={webviewCanGoForward ? "#000" : "#CCC"}
                  size={22}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* WebView */}
          <WebView
            ref={webviewRef}
            source={{ uri: previewUrl }}
            style={{ flex: 1 }}
            onLoadStart={() => onSetWebviewLoading(true)}
            onLoadEnd={() => onSetWebviewLoading(false)}
            onNavigationStateChange={(nav) => {
              onSetWebviewCanGoBack(nav.canGoBack);
              onSetWebviewCanGoForward(nav.canGoForward);
            }}
            onMessage={onWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            allowsBackForwardNavigationGestures={Platform.OS === "ios"}
          />

          {/* Loading overlay */}
          {webviewLoading && (
            <View style={styles.webviewLoadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#000" />
            </View>
          )}

          {/* Confirm bar */}
          <View style={styles.confirmJobBar}>
            <View style={styles.confirmJobBarInner}>
              <View style={styles.confirmJobStepPill}>
                <Sparkles color="#FFF" size={11} />
                <Text style={styles.confirmJobStepText}>Step 1 of 2</Text>
              </View>
              <Text style={styles.confirmJobBarLabel}>
                Is this the right job?
              </Text>
              <TouchableOpacity
                style={[styles.confirmJobBtn, isScraping && { opacity: 0.6 }]}
                onPress={onConfirmJob}
                disabled={isScraping}
                activeOpacity={0.85}
              >
                {isScraping ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Check color="#FFF" size={17} strokeWidth={2.5} />
                    <Text style={styles.confirmJobBtnText}>Confirm Job</Text>
                    <ChevronRight color="#FFF" size={17} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Step 3: BackChannel Insights Modal */}
      <Modal
        visible={visible && step === "insights"}
        transparent
        animationType="fade"
        onRequestClose={() => onSetStep("webview")}
      >
        <KeyboardAvoidingView
          style={jobsModalStyles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          >
            <BlurView
              intensity={60}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableOpacity>
          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={jobsModalStyles.createModalContent}
          >
            {/* Header */}
            <View style={[jobsModalStyles.modalHeader, { gap: 8 }]}>
              <TouchableOpacity
                onPress={() => onSetStep("webview")}
                style={[jobsModalStyles.closeButton, { marginRight: 4 }]}
              >
                <ChevronLeft color="#000" size={24} />
              </TouchableOpacity>
              <Text style={[jobsModalStyles.modalMainTitle, { flex: 1 }]}>
                BackChannel Insights
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={jobsModalStyles.closeButton}
              >
                <X color="#000" size={22} />
              </TouchableOpacity>
            </View>

            {/* Step indicator */}
            <View style={jobsModalStyles.insightsStepRow}>
              <View
                style={[
                  jobsModalStyles.stepDot,
                  jobsModalStyles.stepDotActive,
                  { width: 8 },
                ]}
              />
              <View
                style={[
                  jobsModalStyles.stepDot,
                  jobsModalStyles.stepDotActive,
                ]}
              />
              <Text style={jobsModalStyles.insightsStepLabel}>
                Step 2 of 2
              </Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={styles.createScrollView}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <Text style={jobsModalStyles.modalSubTitle}>
                Share the inside story candidates can't find anywhere else.
                Every question is optional.
              </Text>

              <SponsorInsightCards
                values={insights}
                onChange={(key, text) => {
                  if (key === "dayToDay") onSetDayToDay(text);
                  else if (key === "teamCulture") onSetTeamCulture(text);
                  else if (key === "idealCandidate") onSetIdealCandidate(text);
                  else onSetInsiderInsights(text);
                }}
              />
            </ScrollView>

            {/* Create Job Button */}
            <TouchableOpacity
              style={[styles.createJobBtn, isCreatingJob && { opacity: 0.6 }]}
              onPress={onCreateJob}
              disabled={isCreatingJob}
              activeOpacity={0.85}
            >
              {isCreatingJob ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Sparkles color="#FFF" size={18} />
                  <Text style={jobsModalStyles.confirmBtnText}>
                    Create Job
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  urlInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderWidth: 1.5,
    borderColor: "#EEE",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 2,
    gap: 10,
  },
  urlTextInput: {
    flex: 1,
    fontSize: 15,
    color: "#000",
    paddingVertical: 14,
    fontWeight: "500",
  },
  urlHintText: {
    fontSize: 13,
    color: "#999",
    marginTop: 10,
    fontWeight: "500",
    lineHeight: 18,
  },
  webviewModalContainer: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  createWebViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#FFF",
    gap: 8,
  },
  createWebViewNavBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
  },
  createWebViewUrlWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  createWebViewUrl: {
    flex: 1,
    fontSize: 12,
    color: "#555",
    fontWeight: "500",
  },
  createWebViewNavGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  webviewLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmJobBar: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#FFF",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 8,
  },
  confirmJobBarInner: {
    alignItems: "center",
    gap: 10,
  },
  confirmJobStepPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#000",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  confirmJobStepText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  confirmJobBarLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  confirmJobBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#000",
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 18,
    width: "100%",
  },
  confirmJobBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  createScrollView: { maxHeight: 420 },
  createJobBtn: {
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    borderRadius: 18,
    marginTop: 4,
  },
});
