import { Globe, Link2, X } from "@/components/ui/icons";
import { isValidUrl } from "@/lib/validation";
import { requireOptionalNativeModule } from "expo-modules-core";
import React, { useEffect, useState } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { CreateJobStepHeader } from "./CreateJobStepHeader";
import { useKeyboardVisible } from "./useKeyboardVisible";
import { Colors } from "@/constants/theme";

interface CreateJobUrlScreenProps {
  visible: boolean;
  url: string;
  onSetUrl: (url: string) => void;
  onContinue: () => void;
  onClose: () => void;
}

/**
 * Step 1 — paste a job posting link. Detects a URL already sitting on the
 * clipboard (the overwhelmingly common case: a sponsor just copied the
 * posting) and offers it as a one-tap chip instead of a manual paste.
 */
export function CreateJobUrlScreen({
  visible,
  url,
  onSetUrl,
  onContinue,
  onClose,
}: CreateJobUrlScreenProps) {
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const keyboardVisible = useKeyboardVisible();

  useEffect(() => {
    if (!visible) {
      setClipboardUrl(null);
      return;
    }
    let cancelled = false;
    // The ExpoClipboard native module is resolved optionally: dev clients
    // built before the expo-clipboard dependency don't include it, and the
    // clipboard suggestion is a nice-to-have — degrade to manual paste.
    // getUrlAsync is iOS-only, hence the extra typeof guard.
    const NativeClipboard = requireOptionalNativeModule<{
      getUrlAsync?: () => Promise<string | null>;
    }>("ExpoClipboard");
    if (!NativeClipboard || typeof NativeClipboard.getUrlAsync !== "function") {
      return;
    }
    NativeClipboard.getUrlAsync()
      .then((clipped) => {
        if (!cancelled && clipped && isValidUrl(clipped)) {
          setClipboardUrl(clipped);
        }
      })
      .catch(() => {
        // Clipboard access can fail (permissions, platform quirks) — the
        // manual paste path still works, so this is silent.
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible) return null;

  const canContinue = isValidUrl(url.trim());

  return (
    <View style={styles.screen}>
      <CreateJobStepHeader title="Add a Job" onClose={onClose} />
      {/* Keyboard avoidance is handled once at the flow root
          (CreateJobFlowScreen) — no per-screen KAV. */}
      <View style={styles.flex}>
        <View style={styles.content}>
          <Text style={styles.heading}>Paste the job link</Text>
          <Text style={styles.subheading}>
            We&apos;ll read the posting and build the listing for you — you can
            fine-tune everything before it goes live.
          </Text>

          {clipboardUrl && clipboardUrl !== url && (
            <TouchableOpacity
              style={styles.clipboardChip}
              onPress={() => {
                onSetUrl(clipboardUrl);
                setClipboardUrl(null);
              }}
              activeOpacity={0.8}
            >
              <Link2 size={15} color="#000" />
              <Text style={styles.clipboardChipText} numberOfLines={1}>
                Use copied link: {clipboardUrl.replace(/^https?:\/\//, "")}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.inputContainer}>
            <Globe color={Colors.muted} size={18} />
            <TextInput
              style={styles.textInput}
              placeholder="https://jobs.company.com/role"
              placeholderTextColor={Colors.muted}
              value={url}
              onChangeText={onSetUrl}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              onSubmitEditing={canContinue ? onContinue : undefined}
              returnKeyType="go"
            />
            {url.trim().length > 0 && (
              <TouchableOpacity
                onPress={() => onSetUrl("")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X color={Colors.muted} size={16} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.hint}>
            Works with Greenhouse, Lever, Workday, and most job boards.
          </Text>
        </View>

        <View style={[styles.footer, keyboardVisible && styles.footerKeyboard]}>
          <TouchableOpacity
            style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
            disabled={!canContinue}
            onPress={onContinue}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.continueBtnText,
                !canContinue && styles.continueBtnTextDisabled,
              ]}
            >
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF" },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  heading: {
    fontSize: 26,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: Colors.body,
    lineHeight: 21,
    marginBottom: 24,
  },
  clipboardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  clipboardChipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#000",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.offWhite,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 2,
    gap: 10,
  },
  textInput: {
    flex: 1,
    height: 52,
    fontSize: 15,
    color: "#000",
    fontWeight: "500",
    // Android pads single-line text with extra font-metric space by
    // default, pushing text/placeholder visibly below center — kill it and
    // force vertical centering explicitly instead of relying on padding.
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  hint: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 10,
    fontWeight: "500",
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  footerKeyboard: { paddingBottom: 12 },
  continueBtn: {
    backgroundColor: "#000",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
  },
  continueBtnDisabled: { backgroundColor: Colors.border },
  continueBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  continueBtnTextDisabled: { color: Colors.faint },
});
