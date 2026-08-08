// EditorScreen — the shared full-screen shell for every Account editor
// (Edit Profile, Edit Resume, Privacy & Security, Notifications, Insights).
//
// Replaces the old pattern of small blur-overlay popups (and, in Privacy &
// Security's case, a modal opening a second modal on top of it) with one
// consistent full-screen page: slide up, white background, a header with
// back/close + title + an optional right-side slot (used for the
// autosave "Saved" indicator), safe-area aware throughout.
//
// Supports sub-steps within the same screen (pass onBack instead of relying
// on onClose) so flows like Change Password don't need to stack a second
// modal — they just push a step inside this one.

import { ChevronLeft, X } from "@/components/ui/icons";
import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "@/constants/theme";

interface EditorScreenProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  /**
   * When provided, the header shows a back chevron (not an X) and calls
   * this instead of onClose — use for a sub-step pushed within the same
   * screen (e.g. Change Password inside Privacy & Security).
   */
  onBack?: () => void;
  /** Right-side header slot — typically the autosave status pill. */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  /** Set false for screens that manage their own ScrollView/layout. */
  scrollable?: boolean;
}

export function EditorScreen({
  visible,
  title,
  onClose,
  onBack,
  headerRight,
  children,
  scrollable = true,
}: EditorScreenProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onBack ?? onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onBack ?? onClose}
              style={styles.headerBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={onBack ? "Back" : "Close"}
            >
              {onBack ? (
                <ChevronLeft color="#000" size={24} strokeWidth={2.2} />
              ) : (
                <X color="#000" size={22} strokeWidth={2.2} />
              )}
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.headerRightSlot}>{headerRight}</View>
          </View>

          {scrollable ? (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={styles.flex}>{children}</View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF" },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  // Compact nav-bar title (17px) — below the serif's readability floor,
  // system font kept, token color only. Shared by every settings
  // sub-screen (Change Password, Privacy & Security, Notifications, etc.).
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: Colors.ink,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  headerRightSlot: {
    minWidth: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },
});
