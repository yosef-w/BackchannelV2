// AddSideScreen — a sponsor adds a job search to their account
// (docs/DUAL_SIDES.md). Only sponsors can: they already work somewhere and
// may be quietly looking; applicants have no second side to add.
//
// Three steps on one screen:
//   why    — what it is, and the privacy promise;
//   setup  — only the fields the new side cannot exist without. Name, photo
//           and email carry over, and the rest (résumé, skills, prompts) is
//           what the Account tab's existing "finish your profile" rows are
//           for. Sign-up is ten steps; this is one.
//   résumé — optional: a PDF that fills in experience and skills. Read
//            after the side exists (lib/newSideResume), so skipping costs
//            nothing and a slow parse never holds up the switch.
//
// Adding a side is free — the job-search side has the same free limits and
// the same Premium offer as every applicant.

import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, FileText, Upload, X } from "@/components/ui/icons";
import { KeyboardAwareScrollView } from "@/components/ui/keyboard";
import { PressableScale } from "@/components/ui/PressableScale";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { DUAL_SIDES_PREVIEW } from "@/constants/config";
import { Colors, Fonts, Type } from "@/constants/theme";
import {
  trackAddSideFailed,
  trackAddSideViewed,
  trackSideAdded,
} from "@/lib/analytics/mixpanel";
import { authApi, type AddRoleRequest } from "@/lib/auth-api";
import { hitSlopTo44 } from "@/lib/responsive";
import { parseRoles, roleToUserType, type Role } from "@/lib/sides";
import {
  NEW_SIDE_RESUME_MAX_BYTES,
  readResumeForNewSide,
  type PickedResume,
} from "@/lib/newSideResume";
import { switchSide } from "@/lib/switchSide";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";

const WORK_PREFERENCES = ["Remote", "Hybrid", "On-site"] as const;

interface AddSideScreenProps {
  /** The side being added — always the job search (lib/sides addableRole). */
  side: "Applicant";
}

interface Point {
  title: string;
  body: string;
}

function copyFor(employer: string) {
  const at = employer || "your company";
  return {
    eyebrow: "ADD A JOB SEARCH",
    lead: "Find your next role ",
    accent: "quietly.",
    intro: `You keep sponsoring at ${at}. This adds a separate side of your account for your own search.`,
    points: [
      {
        title: "Hidden from your employer",
        body: `Sponsors at ${at} never see your job-search profile, and you never see roles there.`,
      },
      {
        title: "Two profiles, kept apart",
        body: "Applicants who see you as a sponsor can't tell you're looking.",
      },
      {
        title: "About a minute",
        body: "Tell us what you want, and add a résumé if you like. Your name and photo carry over.",
      },
    ] as Point[],
    start: "Start my job search",
    setupTitle: "What are you looking for?",
    submit: "Add job search",
    done: "Your job search is ready.",
  };
}

export function AddSideScreen({ side }: AddSideScreenProps) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const profile = useUserProfileStore((s) => s.data);
  const employer = (profile?.professional?.company || "").trim();
  const copy = copyFor(employer);

  const [step, setStep] = useState<"why" | "setup" | "resume">("why");
  const [resume, setResume] = useState<PickedResume | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [currentRole, setCurrentRole] = useState(
    (profile?.professional?.title || "").trim(),
  );
  const [wantedRole, setWantedRole] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);

  useEffect(() => {
    trackAddSideViewed(roleToUserType(side));
  }, [side]);

  const canSubmit = wantedRole.trim().length > 1;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const goBack = () => {
    if (submitting) return;
    if (step === "resume") setStep("setup");
    else if (step === "setup") setStep("why");
    else close();
  };

  const finish = async (roles: Role[], preview: boolean) => {
    await useAuthStore.getState().setRoles(roles);
    trackSideAdded(roleToUserType(side), preview);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Land on the new side's feed: leave this screen, then switch — the
    // shell's cover plays over the tabs, not over a form.
    if (router.canGoBack()) router.back();
    router.navigate("/(tabs)/home");
    const switched = await switchSide(side, queryClient, "added");
    // The résumé needs the new side to exist AND be active — every request
    // must carry its X-Active-Role. In a preview the server has no job-
    // search side to write to, so it isn't sent.
    if (resume && switched && !preview) {
      readResumeForNewSide(resume).catch(() => {});
      return;
    }
    // The side is added either way. If the switch itself was refused
    // (connection dropped just now) the switcher is there for later.
    showToast(
      preview
        ? `${copy.done} Preview only, saved on this device${resume ? "; the résumé isn't read in a preview" : ""}.`
        : switched
          ? copy.done
          : `${copy.done} Switch to it from the top of any tab.`,
      "success",
    );
  };

  const pickResume = async () => {
    setResumeError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      if (file.size && file.size > NEW_SIDE_RESUME_MAX_BYTES) {
        setResumeError("That file is over 10 MB. Choose a smaller PDF.");
        return;
      }
      setResume({ uri: file.uri, name: file.name, mimeType: file.mimeType, size: file.size });
    } catch {
      setResumeError("We couldn't open that file. Try another PDF.");
    }
  };

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const firstName = (profile?.personal?.firstName || "").trim();
    const lastName = (profile?.personal?.lastName || "").trim();
    const names = {
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
    };
    const payload: AddRoleRequest = {
      role: "Applicant",
      ...names,
      ...(currentRole.trim() ? { current_role: currentRole.trim() } : {}),
      positions: [wantedRole.trim()],
      work_preferences: preferences,
      skills: [],
      insights: [],
    };
    try {
      const res = await authApi.addRole(payload);
      const roles = parseRoles(res.roles);
      const held = useAuthStore.getState().roles;
      await finish(roles.length > 1 ? roles : parseRoles([...held, side]), false);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown";
      // The request may have succeeded with the response lost (timeout,
      // flaky signal) — a retry would then be told the side already
      // exists. Ask the server what the account holds before deciding
      // this failed.
      await useUserProfileStore
        .getState()
        .fetchFromBackend()
        .catch(() => {});
      if (useAuthStore.getState().roles.includes(side)) {
        await finish(useAuthStore.getState().roles, false);
        return;
      }
      if (DUAL_SIDES_PREVIEW) {
        // The endpoint isn't built yet — keep the side on this device so
        // the rest of the flow can be reviewed (see DUAL_SIDES_PREVIEW).
        console.warn("[AddSide] addRole failed; continuing in preview:", reason);
        await finish(parseRoles([...useAuthStore.getState().roles, side]), true);
        return;
      }
      trackAddSideFailed(roleToUserType(side), reason);
      setSubmitting(false);
      showToast(
        "We couldn't add that just now. Nothing was changed. Please try again.",
        "error",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenContainer variant="form" style={styles.column}>
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            hitSlop={hitSlopTo44(36, 36)}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={22} color={Colors.ink} strokeWidth={2} />
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>{copy.eyebrow}</Text>

          {step === "why" ? (
            <>
              <Text style={styles.title} accessibilityRole="header">
                {copy.lead}
                <Text style={styles.titleEm}>{copy.accent}</Text>
              </Text>
              <Text style={styles.intro}>{copy.intro}</Text>
              <View style={styles.points}>
                {copy.points.map((p) => (
                  <View key={p.title} style={styles.point}>
                    <Text style={styles.pointTitle}>{p.title}</Text>
                    <Text style={styles.pointBody}>{p.body}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : step === "resume" ? (
            <>
              <Text style={styles.title} accessibilityRole="header">
                Add your <Text style={styles.titleEm}>résumé.</Text>
              </Text>
              <Text style={styles.intro}>
                Optional. We&apos;ll read it and fill in your experience,
                education and skills, so sponsors see the full picture and
                each role shows how well you fit.
              </Text>

              {resume ? (
                <View style={styles.fileRow}>
                  <View style={styles.fileIcon}>
                    <FileText size={20} color={Colors.ink} strokeWidth={1.8} />
                  </View>
                  <View style={styles.fileText}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {resume.name}
                    </Text>
                    <Text style={styles.fileMeta}>
                      {resume.size ? `${Math.max(1, Math.round(resume.size / 1024))} KB · ` : ""}
                      Read after your job search is added
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setResume(null)}
                    style={({ pressed }) => [styles.fileRemove, pressed && styles.pressed]}
                    hitSlop={hitSlopTo44(32, 32)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${resume.name}`}
                  >
                    <X size={18} color={Colors.muted} strokeWidth={2} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={pickResume}
                  style={({ pressed }) => [styles.drop, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Choose a PDF résumé"
                >
                  <Upload size={22} color={Colors.ink} strokeWidth={1.8} />
                  <Text style={styles.dropTitle}>Choose a PDF</Text>
                  <Text style={styles.dropMeta}>Up to 10 MB</Text>
                </Pressable>
              )}
              {resumeError ? <Text style={styles.fileError}>{resumeError}</Text> : null}
              <Text style={styles.hint}>
                Skip it and add one any time from the Account tab.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title} accessibilityRole="header">
                {copy.setupTitle}
              </Text>

                <View style={styles.fields}>
                  <View>
                    <Text style={styles.label}>ROLE YOU WANT</Text>
                    <TextInput
                      style={styles.input}
                      value={wantedRole}
                      onChangeText={setWantedRole}
                      placeholder="e.g. Design Director"
                      placeholderTextColor={Colors.faint}
                      autoCapitalize="words"
                      autoFocus
                      returnKeyType="next"
                      maxLength={80}
                      accessibilityLabel="Role you want"
                    />
                  </View>
                  <View>
                    <Text style={styles.label}>WHAT YOU DO NOW</Text>
                    <TextInput
                      style={styles.input}
                      value={currentRole}
                      onChangeText={setCurrentRole}
                      placeholder="e.g. Design Manager"
                      placeholderTextColor={Colors.faint}
                      autoCapitalize="words"
                      maxLength={80}
                      accessibilityLabel="What you do now"
                    />
                  </View>
                  <View>
                    <Text style={styles.label}>HOW YOU WANT TO WORK</Text>
                    <View style={styles.chips}>
                      {WORK_PREFERENCES.map((pref) => {
                        const on = preferences.includes(pref);
                        return (
                          <Pressable
                            key={pref}
                            onPress={() =>
                              setPreferences((prev) =>
                                on ? prev.filter((p) => p !== pref) : [...prev, pref],
                              )
                            }
                            style={[styles.chip, on && styles.chipOn]}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: on }}
                            accessibilityLabel={pref}
                          >
                            <Text style={[styles.chipText, on && styles.chipTextOn]}>
                              {pref}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
            </>
          )}
        </KeyboardAwareScrollView>

        <View style={styles.footer}>
          {step === "why" ? (
            <>
              <PressableScale
                style={styles.primary}
                onPress={() => setStep("setup")}
                accessibilityRole="button"
                accessibilityLabel={copy.start}
              >
                <Text style={styles.primaryText}>{copy.start.toUpperCase()}</Text>
              </PressableScale>
              <Pressable
                onPress={close}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Not now"
              >
                <Text style={styles.secondaryText}>NOT NOW</Text>
              </Pressable>
            </>
          ) : step === "setup" ? (
            <PressableScale
              style={[styles.primary, !canSubmit && styles.primaryDisabled]}
              onPress={() => setStep("resume")}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              accessibilityState={{ disabled: !canSubmit }}
            >
              <Text style={styles.primaryText}>CONTINUE</Text>
            </PressableScale>
          ) : (
            <>
              <PressableScale
                style={[styles.primary, submitting && styles.primaryDisabled]}
                onPress={submit}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={copy.submit}
                accessibilityState={{ disabled: submitting, busy: submitting }}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.paper} />
                ) : (
                  <Text style={styles.primaryText}>{copy.submit.toUpperCase()}</Text>
                )}
              </PressableScale>
            </>
          )}
        </View>
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paper },
  column: { flex: 1 },
  pressed: { opacity: 0.6 },
  header: { height: 48, paddingHorizontal: 16, justifyContent: "center" },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  eyebrow: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.8,
    color: Colors.muted,
  },
  title: {
    ...Type.title,
    fontSize: 34,
    lineHeight: 38,
    color: Colors.ink,
    marginTop: 14,
  },
  titleEm: { fontFamily: Fonts.serifItalic, color: Colors.muted },
  intro: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.body,
    marginTop: 14,
  },
  points: { marginTop: 24, borderTopWidth: 1, borderTopColor: Colors.ink },
  point: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pointTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.ink,
  },
  pointBody: {
    fontFamily: Fonts.sans,
    fontSize: 13.5,
    lineHeight: 19,
    color: Colors.muted,
    marginTop: 4,
  },

  fields: { marginTop: 28, gap: 22 },
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    color: Colors.muted,
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    backgroundColor: Colors.offWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: Colors.ink,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  chipText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.ink },
  chipTextOn: { color: Colors.paper },

  drop: {
    marginTop: 24,
    minHeight: 132,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.offWhite,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 20,
  },
  dropTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: Colors.ink },
  dropMeta: { fontFamily: Fonts.sans, fontSize: 12.5, color: Colors.muted },
  fileRow: {
    marginTop: 24,
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  fileText: { flex: 1, minWidth: 0 },
  fileName: { fontFamily: Fonts.sansSemiBold, fontSize: 14.5, color: Colors.ink },
  fileMeta: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.muted, marginTop: 2 },
  fileRemove: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  fileError: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.danger,
    marginTop: 10,
  },
  hint: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.muted,
    marginTop: 14,
  },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12, gap: 4 },
  primary: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 2,
    color: Colors.paper,
  },
  secondary: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  secondaryText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: Colors.muted,
  },
});
