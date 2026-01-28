import { BlurView } from "expo-blur";
import {
  AlertCircle,
  Bot,
  CheckCircle,
  Sparkles,
  X,
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
} from "react-native-reanimated";
import { WebView } from "react-native-webview";
import { generateAutofillAnswers } from "../lib/api";
import {
  generateFieldInjectionScript,
  generateFormScrapingScript,
} from "../lib/webview-scripts";
import { useUserProfileStore } from "../stores/useUserProfileStore";
import type {
  AutofillRequest,
  AutofillResponse,
  FormField,
  ScrapedFormData
} from "../types/autofill";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface JobApplicationWebViewProps {
  jobUrl: string;
  jobTitle: string;
  company: string;
  onClose: () => void;
}

export function JobApplicationWebView({
  jobUrl,
  jobTitle,
  company,
  onClose,
}: JobApplicationWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [showAutofillButton, setShowAutofillButton] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState<
    "idle" | "scraping" | "generating" | "filling" | "success" | "error"
  >("idle");
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [scrapedFields, setScrapedFields] = useState<FormField[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const profileData = useUserProfileStore((state) => state.data);
  const isProfileLoaded = useUserProfileStore((state) => state.isLoaded);

  // Get userId - fallback to email or generate temporary ID if not available
  const userId = profileData.personal.email || `temp_${Date.now()}`;

  // Simplified injected script - just notify that page is ready
  const injectedJavaScript = `
    (function() {
      // Intercept console.log and forward to React Native
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;
      
      console.log = function(...args) {
        originalLog.apply(console, args);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CONSOLE_LOG',
          level: 'log',
          message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        }));
      };
      
      console.error = function(...args) {
        originalError.apply(console, args);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CONSOLE_LOG',
          level: 'error',
          message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        }));
      };
      
      console.warn = function(...args) {
        originalWarn.apply(console, args);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CONSOLE_LOG',
          level: 'warn',
          message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        }));
      };
      
      // Notify React Native that page is ready
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PAGE_READY'
      }));
    })();
    
    true; // Required for iOS
  `;

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("[WebView Message]", data.type);

      // Handle different message types from WebView
      if (data.type === "PAGE_READY") {
        console.log("[WebView] Page ready, showing autofill button");
        setShowAutofillButton(true);
      } else if (data.type === "FORM_FIELDS_SCRAPED") {
        // Form scraping complete - process the fields
        console.log("[AI-AUTOFILL] Form fields scraped successfully");
        processScrapedFields(data.data);
      } else if (data.type === "AUTOFILL_COMPLETE") {
        // Field injection complete (from new AI system)
        console.log("[AI-AUTOFILL] Autofill injection complete:", data.data);
        setAutofillStatus("success");

        const successCount = data.data?.successCount || data.filledCount || 0;
        Alert.alert(
          "Success!",
          `Filled ${successCount} fields with AI-generated answers. Please review and submit.`,
          [{ text: "Got it", onPress: () => setAutofillStatus("idle") }],
        );
      } else if (data.type === "AUTOFILL_ERROR") {
        // Error from WebView scripts
        console.error("[AI-AUTOFILL] WebView error:", data.data);
        setAutofillStatus("error");
        setErrorMessage(data.data?.error || "Unknown error in WebView");

        setTimeout(() => {
          setAutofillStatus("idle");
        }, 3000);
      } else if (data.type === "CONSOLE_LOG") {
        // Forward WebView console logs to React Native console
        const prefix = `[WebView Console]`;
        if (data.level === "error") {
          console.error(prefix, data.message);
        } else if (data.level === "warn") {
          console.warn(prefix, data.message);
        } else {
          console.log(prefix, data.message);
        }
      }
    } catch (error) {
      console.error("Error parsing WebView message:", error);
      setAutofillStatus("error");
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
  };

  const handleCancelAutofill = () => {
    console.log("🚫 User cancelled autofill");
    setAutofillStatus("idle");
    setScrapedFields([]);
    setErrorMessage("");
  };

  const handleAutofill = async () => {
    console.log("\n" + "=".repeat(60));
    console.log("🤖 AUTOFILL BUTTON CLICKED - Starting AI-powered autofill");
    console.log("=".repeat(60));

    // Check what profile data is available (but don't block)
    console.log(
      "📊 Profile Status:",
      isProfileLoaded ? "Loaded" : "Partially loaded",
    );

    console.log("\n📋 User Profile Summary:");
    console.log("  Name:", profileData.personal.fullName || "(not set)");
    console.log("  Email:", profileData.personal.email || "(not set)");
    console.log("  Phone:", profileData.personal.phone || "(not set)");
    console.log(
      "  Title:",
      profileData.professional.title ||
        profileData.professional.seekingPosition ||
        "(not set)",
    );
    console.log(
      "  Experience:",
      profileData.professional.yearsExperience || "(not set)",
      "years",
    );
    console.log(
      "  Education:",
      profileData.education.degree || "(not set)",
      "in",
      profileData.education.major || "(not set)",
    );
    console.log("  Skills:", profileData.skills?.length || 0, "skills");

    // Warn user if critical fields are missing, but allow them to proceed
    const hasBasicInfo =
      profileData.personal.fullName || profileData.personal.email;
    if (!hasBasicInfo) {
      console.log("⚠️ Warning: Missing basic profile information");
      Alert.alert(
        "Limited Profile Data",
        "You haven't completed your profile yet. The autofill will work with whatever information is available, but results may be limited.",
        [
          { text: "Cancel", style: "cancel", onPress: () => {} },
          { text: "Continue Anyway", onPress: () => proceedWithAutofill() },
        ],
      );
      return;
    }

    // Proceed with autofill
    await proceedWithAutofill();
  };

  /**
   * Proceed with the autofill process
   */
  const proceedWithAutofill = async () => {
    console.log("\n🎯 Job Context:");
    console.log("  Position:", jobTitle);
    console.log("  Company:", company);
    console.log("  URL:", jobUrl);

    try {
      // Step 1: Scrape form fields from the page
      setAutofillStatus("scraping");
      console.log("\n🔍 STEP 1: Scraping form fields from webpage...");

      // Inject scraping script
      webViewRef.current?.injectJavaScript(generateFormScrapingScript());

      console.log("⏳ Waiting for form fields to be scraped...");
      // Note: The actual scraping result will come through handleWebViewMessage
      // We'll wait for the FORM_FIELDS_SCRAPED message
    } catch (error) {
      console.error("❌ [AI-AUTOFILL] Error during autofill:", error);
      setAutofillStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unknown error occurred",
      );

      Alert.alert(
        "Autofill Error",
        "Failed to autofill the application. Please try again or fill manually.",
        [{ text: "OK", onPress: () => setAutofillStatus("idle") }],
      );
    }
  };

  /**
   * Handle scraped form fields and send to AI backend
   */
  const processScrapedFields = async (scrapedData: ScrapedFormData) => {
    try {
      console.log("\n" + "-".repeat(60));
      console.log("📦 FORM FIELDS SCRAPED SUCCESSFULLY");
      console.log("-".repeat(60));
      console.log(
        "Found",
        scrapedData.fields.length,
        "form fields on the page",
      );
      console.log("Page title:", scrapedData.pageTitle);
      console.log("Form count:", scrapedData.formCount);

      setScrapedFields(scrapedData.fields);

      if (scrapedData.fields.length === 0) {
        console.log("❌ No form fields detected");
        throw new Error("No form fields detected on this page");
      }

      console.log("\n📝 Scraped Field Details:");
      scrapedData.fields.forEach((field, index) => {
        console.log(`\n  Field ${index + 1} (${field.id}):`);
        console.log(`    Type: ${field.fieldType}`);
        console.log(`    Label: "${field.label}"`);
        console.log(`    Required: ${field.required}`);
        if (field.options) {
          console.log(`    Options: [${field.options.join(", ")}]`);
        }
        if (field.placeholder) {
          console.log(`    Placeholder: "${field.placeholder}"`);
        }
      });

      // Step 2: Generate AI answers
      setAutofillStatus("generating");
      console.log("\n" + "=".repeat(60));
      console.log("🤖 STEP 2: Generating AI answers");
      console.log("=".repeat(60));

      // Prepare the request payload - send entire profile data for maximum flexibility
      const request: AutofillRequest = {
        userData: profileData,
        formFields: scrapedData.fields,
        jobContext: {
          jobTitle: jobTitle,
          company: company,
          jobUrl: jobUrl,
          jobDescription: undefined, // TODO: Can be scraped from job listing
          department: undefined,
          location: undefined,
          employmentType: undefined,
        },
        metadata: {
          appVersion: "1.0.0",
          timestamp: new Date().toISOString(),
          userId: userId || "unknown",
          sessionId: Math.random().toString(36).substring(7),
        },
      };

      console.log("\n📤 BACKEND REQUEST PAYLOAD:");
      console.log("=".repeat(60));
      console.log(JSON.stringify(request, null, 2));
      console.log("=".repeat(60));

      console.log("\n📊 Payload Summary:");
      console.log("  Total form fields:", request.formFields.length);
      console.log("  User skills:", request.userData.skills.length);
      console.log(
        "  Work experiences:",
        request.userData.professional.experiences.length,
      );
      console.log(
        "  Education entries:",
        request.userData.education.entries.length,
      );
      console.log("  Certifications:", request.userData.certifications.length);
      console.log("  Languages:", request.userData.languages.length);

      console.log("\n🚀 Sending request to backend API...");
      console.log("Endpoint: POST /api/v1/autofill/generate");

      // Call AI backend
      const response: AutofillResponse = await generateAutofillAnswers(request);

      console.log("\n" + "=".repeat(60));
      console.log("✅ BACKEND RESPONSE RECEIVED");
      console.log("=".repeat(60));
      console.log("Success:", response.success);
      console.log("Field answers received:", response.fieldAnswers.length);
      console.log("Unfilled fields:", response.unfilledFields?.length || 0);

      console.log("\n📝 AI-Generated Answers:");
      response.fieldAnswers.forEach((answer, index) => {
        const field = scrapedData.fields.find((f) => f.id === answer.fieldId);
        console.log(`\n  Answer ${index + 1}:`);
        console.log(`    Field: "${field?.label || answer.fieldId}"`);
        console.log(
          `    Value: "${typeof answer.value === "string" && answer.value.length > 100 ? answer.value.substring(0, 100) + "..." : answer.value}"`,
        );
        console.log(`    Confidence: ${(answer.confidence * 100).toFixed(0)}%`);
        if (answer.reasoning) {
          console.log(`    Reasoning: ${answer.reasoning}`);
        }
      });

      if (response.unfilledFields && response.unfilledFields.length > 0) {
        console.log("\n⚠️ Unfilled Fields:");
        response.unfilledFields.forEach((field, index) => {
          console.log(`  ${index + 1}. ${field.fieldId}: ${field.reason}`);
        });
      }

      if (response.suggestions) {
        console.log("\n💡 Additional Suggestions:");
        if (response.suggestions.coverLetterDraft) {
          console.log("  ✓ Cover letter draft generated");
        }
        if (response.suggestions.tailoredSummary) {
          console.log("  ✓ Tailored summary generated");
        }
        if (response.suggestions.skillsToHighlight) {
          console.log(
            "  ✓ Skills to highlight:",
            response.suggestions.skillsToHighlight.join(", "),
          );
        }
      }

      console.log(
        "\n⏱️  Processing time:",
        response.metadata.processingTime,
        "ms",
      );
      console.log("🤖 AI Model:", response.metadata.aiModel);

      if (!response.success) {
        console.log("❌ Backend returned unsuccessful response");
        throw new Error("AI backend returned unsuccessful response");
      }

      // Step 3: Inject answers back into the form
      setAutofillStatus("filling");
      console.log("\n" + "=".repeat(60));
      console.log("💉 STEP 3: Injecting answers into form");
      console.log("=".repeat(60));

      // Create a mapping of fieldId to htmlSelector for injection
      const answersWithSelectors = response.fieldAnswers.map((answer) => {
        const field = scrapedData.fields.find((f) => f.id === answer.fieldId);
        return {
          ...answer,
          htmlSelector: field?.htmlSelector,
          fieldType: field?.fieldType,
        };
      });

      console.log(
        "Preparing to inject",
        answersWithSelectors.length,
        "answers into form fields",
      );

      // Inject the field injection script
      webViewRef.current?.injectJavaScript(
        generateFieldInjectionScript(answersWithSelectors),
      );

      console.log("✅ Injection script executed - waiting for completion...");

      // Show success message with AI suggestions if available
      if (response.suggestions?.coverLetterDraft) {
        console.log("\n📄 AI also generated a cover letter draft");
        console.log(
          "Cover letter preview:",
          response.suggestions.coverLetterDraft.substring(0, 150) + "...",
        );
      }

      console.log("\n" + "=".repeat(60));
      console.log("✨ AUTOFILL PROCESS COMPLETE");
      console.log("=".repeat(60) + "\n");
    } catch (error) {
      console.log("\n" + "=".repeat(60));
      console.error("❌ ERROR PROCESSING SCRAPED FIELDS");
      console.log("=".repeat(60));
      console.error("Error:", error);
      if (error instanceof Error) {
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
      }
      console.log("=".repeat(60) + "\n");

      setAutofillStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unknown error occurred",
      );

      Alert.alert(
        "Autofill Error",
        error instanceof Error
          ? error.message
          : "Failed to generate autofill answers",
        [{ text: "OK", onPress: () => setAutofillStatus("idle") }],
      );
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <X color="#000" size={24} />
            </TouchableOpacity>
            <View style={styles.jobInfo}>
              <Text style={styles.jobTitle} numberOfLines={1}>
                {jobTitle}
              </Text>
              <Text style={styles.companyName} numberOfLines={1}>
                {company}
              </Text>
            </View>
          </View>

          <View style={styles.navigationButtons}>
            <TouchableOpacity
              onPress={() => webViewRef.current?.goBack()}
              disabled={!canGoBack}
              style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
            >
              <Text
                style={[
                  styles.navButtonText,
                  !canGoBack && styles.navButtonTextDisabled,
                ]}
              >
                ←
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => webViewRef.current?.goForward()}
              disabled={!canGoForward}
              style={[
                styles.navButton,
                !canGoForward && styles.navButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.navButtonText,
                  !canGoForward && styles.navButtonTextDisabled,
                ]}
              >
                →
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* WebView */}
        <WebView
          ref={webViewRef}
          source={{ uri: jobUrl }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onMessage={handleWebViewMessage}
          injectedJavaScript={injectedJavaScript}
          onNavigationStateChange={handleNavigationStateChange}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#000" />
              <Text style={styles.loadingText}>Loading application...</Text>
            </View>
          )}
        />

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        )}

        {/* Autofill Status Overlay */}
        {(autofillStatus === "scraping" ||
          autofillStatus === "generating" ||
          autofillStatus === "filling") && (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.statusOverlay}
          >
            <BlurView
              intensity={80}
              style={StyleSheet.absoluteFill}
              tint="light"
            />
            <Animated.View entering={ZoomIn} style={styles.statusCard}>
              <View style={styles.statusIcon}>
                {autofillStatus === "scraping" && (
                  <Bot color="#000" size={32} />
                )}
                {autofillStatus === "generating" && (
                  <Sparkles color="#000" size={32} />
                )}
                {autofillStatus === "filling" && (
                  <CheckCircle color="#000" size={32} />
                )}
              </View>
              <Text style={styles.statusTitle}>
                {autofillStatus === "scraping" && "Analyzing Form..."}
                {autofillStatus === "generating" && "Generating Answers..."}
                {autofillStatus === "filling" && "Filling Form..."}
              </Text>
              <Text style={styles.statusSubtitle}>
                {autofillStatus === "scraping" &&
                  "Reading form fields and questions"}
                {autofillStatus === "generating" &&
                  "AI is crafting personalized responses"}
                {autofillStatus === "filling" &&
                  "Injecting your information into the form"}
              </Text>
              <ActivityIndicator
                size="large"
                color="#000"
                style={{ marginTop: 20 }}
              />

              {/* Cancel Button */}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelAutofill}
                activeOpacity={0.7}
              >
                <X color="#666" size={18} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        )}

        {/* Error Status Overlay */}
        {autofillStatus === "error" && (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.statusOverlay}
          >
            <BlurView
              intensity={80}
              style={StyleSheet.absoluteFill}
              tint="light"
            />
            <Animated.View entering={ZoomIn} style={styles.statusCard}>
              <View style={[styles.statusIcon, { backgroundColor: "#FEE" }]}>
                <AlertCircle color="#F00" size={32} />
              </View>
              <Text style={styles.statusTitle}>Autofill Failed</Text>
              <Text style={styles.statusSubtitle}>
                {errorMessage || "Something went wrong. Please try again."}
              </Text>
              <TouchableOpacity
                style={[
                  styles.autofillButton,
                  { marginTop: 20, backgroundColor: "#000" },
                ]}
                onPress={() => setAutofillStatus("idle")}
              >
                <Text style={styles.autofillButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        )}

        {/* AI-Powered Autofill Button */}
        {showAutofillButton && autofillStatus === "idle" && (
          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={styles.autofillButtonContainer}
          >
            <TouchableOpacity
              style={styles.autofillButton}
              onPress={handleAutofill}
              activeOpacity={0.8}
            >
              <Sparkles color="#FFF" size={20} />
              <Text style={styles.autofillButtonText}>Autofill with AI</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#FFF",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  companyName: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  navigationButtons: {
    flexDirection: "row",
    gap: 8,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  navButtonTextDisabled: {
    color: "#999",
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  statusOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  statusCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    maxWidth: SCREEN_WIDTH - 64,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.2,
        shadowRadius: 25,
      },
      android: {
        elevation: 15,
      },
    }),
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
    marginBottom: 8,
  },
  statusSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  autofillButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  autofillButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 28,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  autofillButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    gap: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
});
