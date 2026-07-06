import { BlurView } from "expo-blur";
import { ChevronRight, Info, Mail } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { authApi } from "@/lib/auth-api";
import { trackTesterModeEnabled } from "@/lib/analytics/mixpanel";
import { useUserProfileStore } from "../../stores/useUserProfileStore";
import { DismissibleSheet } from "../ui/DismissibleSheet";

interface WorkEmailVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  /** Parent flips the shared isTester flag and closes the modal; this
   * component only triggers the analytics event. */
  onTesterBypass: () => void;
}

/**
 * Soft gate blocking sponsor swiping until their work email is verified.
 * Extracted from HomeView as a self-contained modal: isEditingWorkEmail/
 * editedWorkEmail/emailVerifyError/emailVerifyLoading have zero readers
 * outside this UI (confirmed by a state-ownership audit before extraction).
 * pendingWorkEmail, profileData, fetchFromBackend, and updatePersonalStore
 * all come straight from useUserProfileStore, so this component reads them
 * directly rather than needing them threaded in as props.
 */
export function WorkEmailVerificationModal({
  visible,
  onClose,
  onTesterBypass,
}: WorkEmailVerificationModalProps) {
  const profileData = useUserProfileStore((state) => state.data);
  const pendingWorkEmail = useUserProfileStore(
    (state) => state.pendingWorkEmail,
  );
  const setPendingWorkEmail = useUserProfileStore(
    (state) => state.setPendingWorkEmail,
  );
  const fetchFromBackend = useUserProfileStore(
    (state) => state.fetchFromBackend,
  );
  const updatePersonalStore = useUserProfileStore(
    (state) => state.updatePersonal,
  );

  const [isEditingWorkEmail, setIsEditingWorkEmail] = useState(false);
  const [editedWorkEmail, setEditedWorkEmail] = useState("");
  const [emailVerifyError, setEmailVerifyError] = useState("");
  const [emailVerifyLoading, setEmailVerifyLoading] = useState(false);

  // Clear any stale error message whenever the gate re-opens — mirrors the
  // original handleSwipe() call site, which cleared this right before
  // setting the modal visible (the Modal's `visible` prop toggles without
  // unmounting this component, so state would otherwise persist).
  useEffect(() => {
    if (visible) setEmailVerifyError("");
  }, [visible]);

  const resetAndClose = () => {
    setIsEditingWorkEmail(false);
    setEditedWorkEmail("");
    setEmailVerifyError("");
    onClose();
  };

  const displayedEmail = pendingWorkEmail ?? profileData?.personal?.workEmail ?? "";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.emailVerifOverlay}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={resetAndClose}
      >
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet
        onDismiss={resetAndClose}
        fullSheetGesture
        style={styles.emailVerifModal}
      >
        <View style={styles.emailVerifIconCircle}>
          <Mail color="#FFF" size={32} strokeWidth={1.5} />
        </View>

        <Text style={styles.emailVerifTitle}>Verify Your Work Email</Text>

        {isEditingWorkEmail ? (
          <View style={styles.emailVerifEditBlock}>
            <Text style={styles.emailVerifEditLabel}>
              Update your work email
            </Text>
            <TextInput
              value={editedWorkEmail}
              onChangeText={setEditedWorkEmail}
              placeholder="name@company.com"
              placeholderTextColor="#BBB"
              style={styles.emailVerifEditInput}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <View style={styles.emailVerifEditActions}>
              <TouchableOpacity
                onPress={() => {
                  setIsEditingWorkEmail(false);
                  setEditedWorkEmail("");
                  setEmailVerifyError("");
                }}
                style={styles.emailVerifEditCancel}
                activeOpacity={0.7}
                disabled={emailVerifyLoading}
              >
                <Text style={styles.emailVerifEditCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  const trimmed = editedWorkEmail.trim();
                  if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
                    setEmailVerifyError(
                      "That doesn't look like a valid email.",
                    );
                    return;
                  }
                  setEmailVerifyLoading(true);
                  setEmailVerifyError("");
                  try {
                    // Two coordinated backend calls + a local mirror:
                    //   1. PATCH sponsor profile so the backend
                    //      persists work_email immediately and
                    //      auto-flips work_email_verified=FALSE
                    //      (services/profiles.py:162). Without this
                    //      the column doesn't update until the user
                    //      clicks the verification link.
                    //   2. Send the verification email — backend
                    //      embeds the email in a JWT; on link click
                    //      it re-saves and flips verified=TRUE.
                    // Run them in parallel since they're independent.
                    await Promise.all([
                      authApi.updateWorkEmail(trimmed),
                      authApi.sendWorkEmailVerification(trimmed),
                    ]);
                    await setPendingWorkEmail(trimmed);
                    // Mirror to data.personal.workEmail so ProfileView
                    // reflects the new address immediately without
                    // waiting for a full profile refetch.
                    await updatePersonalStore({ workEmail: trimmed });
                    setIsEditingWorkEmail(false);
                    setEditedWorkEmail("");
                    setEmailVerifyError(
                      `Sent! Check ${trimmed} — including your spam folder.`,
                    );
                  } catch (err) {
                    const msg =
                      err instanceof Error ? err.message : "Couldn't send.";
                    setEmailVerifyError(
                      msg.toLowerCase().includes("rate")
                        ? "Too many sends — please wait a bit and try again."
                        : "Couldn't send to that address. Please try again.",
                    );
                  } finally {
                    setEmailVerifyLoading(false);
                  }
                }}
                style={styles.emailVerifEditSave}
                activeOpacity={0.8}
                disabled={emailVerifyLoading}
              >
                {emailVerifyLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.emailVerifEditSaveText}>
                    Save & resend
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.emailVerifSubtitle}>
              To start discovering candidates, verify the link we sent to{" "}
              <Text style={styles.emailVerifAddress}>
                {displayedEmail || "your work address"}
              </Text>
            </Text>
            <TouchableOpacity
              onPress={() => {
                setEditedWorkEmail(displayedEmail);
                setIsEditingWorkEmail(true);
                setEmailVerifyError("");
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.emailVerifEditLink}>
                Wrong email? Update it
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.emailVerifSpamHint}>
          <Info color="#999" size={13} strokeWidth={2} />
          <Text style={styles.emailVerifSpamHintText}>
            Don't see it? Check your spam or junk folder — it can take a
            minute to arrive.
          </Text>
        </View>

        <View style={styles.emailVerifInfoBox}>
          <Text style={styles.emailVerifInfoText}>
            This keeps the network trusted — every candidate knows they're
            talking to a real, verified professional.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.emailVerifPrimaryBtn}
          onPress={() => Linking.openURL("message:")}
          activeOpacity={0.8}
        >
          <Text style={styles.emailVerifPrimaryBtnText}>Open Email App</Text>
          <ChevronRight color="#FFF" size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.emailVerifSecondaryBtn}
          onPress={async () => {
            setEmailVerifyLoading(true);
            setEmailVerifyError("");
            try {
              await fetchFromBackend();
              const isNowVerified =
                useUserProfileStore.getState().workEmailVerified;
              if (isNowVerified) {
                onClose();
              } else {
                setEmailVerifyError(
                  "Still pending — please click the link in your inbox.",
                );
              }
            } catch {
              setEmailVerifyError("Could not check status. Please try again.");
            } finally {
              setEmailVerifyLoading(false);
            }
          }}
          disabled={emailVerifyLoading}
          activeOpacity={0.8}
        >
          {emailVerifyLoading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.emailVerifSecondaryBtnText}>
              I've Verified My Email
            </Text>
          )}
        </TouchableOpacity>

        {emailVerifyError ? (
          <Text style={styles.emailVerifErrorText}>{emailVerifyError}</Text>
        ) : null}

        {/* Resend (PR #42) — re-trigger the verification email if the user
          never received it. Prefers the in-modal pendingWorkEmail (the
          corrected address from the "Update it" flow) over whatever's on
          file. Backend rate-limits to 5/hour per user. */}
        <TouchableOpacity
          style={styles.emailVerifTesterBtn}
          onPress={async () => {
            const workEmail = pendingWorkEmail ?? profileData?.personal?.workEmail;
            if (!workEmail) {
              setEmailVerifyError(
                "We don't have a work email on file. Tap 'Update it' to add one.",
              );
              return;
            }
            setEmailVerifyError("");
            try {
              await authApi.sendWorkEmailVerification(workEmail);
              setEmailVerifyError("Sent! Check your inbox and spam folder.");
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Couldn't resend.";
              setEmailVerifyError(
                msg.toLowerCase().includes("rate")
                  ? "Too many resends — please wait a bit and try again."
                  : "Couldn't resend. Please try again.",
              );
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.emailVerifTesterBtnText}>Resend email</Text>
        </TouchableOpacity>

        {/* Dev-only bypass for internal testing — never shown in a
            production build. This gate exists to keep unverified
            sponsors off the real applicant deck; a public bypass button
            defeated that entirely. __DEV__ is stripped from release
            bundles. */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.emailVerifTesterBtn}
            onPress={() => {
              trackTesterModeEnabled({ source: "email_verification_modal" });
              onTesterBypass();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.emailVerifTesterBtnText}>
              I am a tester (dev only)
            </Text>
          </TouchableOpacity>
        )}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  emailVerifOverlay: { flex: 1, justifyContent: "flex-end" },
  emailVerifModal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 44,
  },
  emailVerifIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  emailVerifTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    marginBottom: 12,
  },
  emailVerifSubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emailVerifAddress: {
    fontWeight: "700",
    color: "#000",
  },
  emailVerifSpamHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    marginTop: 14,
    marginBottom: 18,
  },
  emailVerifSpamHintText: {
    flex: 1,
    fontSize: 12.5,
    color: "#999",
    fontWeight: "500",
    lineHeight: 17,
  },
  emailVerifInfoBox: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  emailVerifInfoText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    textAlign: "center",
  },
  emailVerifPrimaryBtn: {
    backgroundColor: "#000",
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  emailVerifPrimaryBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
  },
  emailVerifSecondaryBtn: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  emailVerifSecondaryBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  emailVerifErrorText: {
    fontSize: 13,
    color: "#DC2626",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  emailVerifTesterBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  emailVerifTesterBtnText: {
    color: "#999",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Inline "Wrong email? Update it" affordance + edit form for fixing typos
  // in the modal without leaving the verification flow. Muted gray to match
  // the modal's neutral palette (no bright accent — the existing primary CTA
  // already owns the visual emphasis).
  emailVerifEditLink: {
    color: "#666",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 6,
    textDecorationLine: "underline",
  },
  emailVerifEditBlock: {
    width: "100%",
    marginVertical: 8,
  },
  emailVerifEditLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  emailVerifEditInput: {
    width: "100%",
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  emailVerifEditActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  emailVerifEditCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  emailVerifEditCancelText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },
  emailVerifEditSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  emailVerifEditSaveText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
