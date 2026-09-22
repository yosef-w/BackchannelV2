import { BlurView } from "expo-blur";
import { X } from "@/components/ui/icons";
import { ConfirmPop } from "@/components/cinema/ConfirmPop";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { Colors, Fonts, Radii, Type } from "@/constants/theme";
import { sheetColumn } from "@/lib/responsive";

interface GetSponsorModalProps {
  visible: boolean;
  applyStep: "select" | "requested";
  companyName?: string;
  isRequestingSponsor: boolean;
  onClose: () => void;
  onGetSponsor: () => void;
  onDone: () => void;
}

/**
 * "Ask for a sponsor" — the sheet behind WAITLIST on a role with no sponsor.
 * Render-only: applyStep / pendingJob / isRequestingSponsor are owned by
 * HomeView (the swipe intercept and handleGetSponsor / handleApplyModalDone)
 * and passed down.
 *
 * 2026-08 rebrand: a serif statement, one sentence in the light body voice,
 * and a single ink pill in the verdict bar's verb language — no boxed
 * option row, no bell-in-a-circle. Both backend writes (request a sponsor +
 * join the waitlist) still fire from the one action.
 */
export function GetSponsorModal({
  visible,
  applyStep,
  companyName,
  isRequestingSponsor,
  onClose,
  onGetSponsor,
  onDone,
}: GetSponsorModalProps) {
  const company = companyName ?? "this company";
  return (
    <View style={styles.modalOverlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <Animated.View
        entering={SlideInDown}
        exiting={SlideOutDown}
        style={styles.sheet}
      >
        <View style={styles.handle} />
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X color={Colors.ink} size={22} strokeWidth={1.8} />
        </TouchableOpacity>

        {applyStep === "select" ? (
          <>
            <Text style={styles.eyebrow}>THIS ROLE · {company.toUpperCase()}</Text>
            <Text style={styles.title}>
              No sponsor on this role{" "}
              <Text style={styles.titleEm}>yet.</Text>
            </Text>
            <Text style={styles.body}>
              Ask, and we&apos;ll let people at {company} know you&apos;re
              interested — and you&apos;ll hear the moment someone puts their
              name on it.
            </Text>
            <TouchableOpacity
              style={[styles.pill, isRequestingSponsor && styles.pillBusy]}
              onPress={onGetSponsor}
              disabled={isRequestingSponsor}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Ask for a sponsor"
            >
              {isRequestingSponsor ? (
                <ActivityIndicator size="small" color={Colors.paper} />
              ) : (
                <Text style={styles.pillText}>ASK FOR A SPONSOR</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.footnote}>
              You&apos;re also on the waitlist — any sponsor who signs on will see you.
            </Text>
          </>
        ) : (
          <View style={styles.success}>
            <ConfirmPop size={64} />
            <Text style={[styles.title, styles.titleCenter]}>
              Request <Text style={styles.titleEm}>sent.</Text>
            </Text>
            <Text style={[styles.body, styles.bodyCenter]}>
              Everyone we have at {company} has been asked. If someone can
              sponsor this role, you&apos;ll be notified right away.
            </Text>
            <TouchableOpacity
              style={styles.pill}
              onPress={onDone}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.pillText}>DONE</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    // Capped + centered (sheetColumn) — this sheet doesn't go through
    // DismissibleSheet (its own gesture-root wrapper carries the cap for
    // every other bottom sheet), so it needs its own or it spans the full
    // 744–1376pt iPad window edge to edge.
    ...sheetColumn,
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 22,
  },
  closeBtn: {
    position: "absolute",
    top: 24,
    right: 24,
    padding: 4,
  },
  eyebrow: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.muted,
    marginBottom: 12,
  },
  title: {
    ...Type.title,
    fontSize: 28,
    lineHeight: 33,
    color: Colors.ink,
  },
  titleEm: {
    fontFamily: Fonts.serifItalic,
    color: Colors.muted,
  },
  titleCenter: { textAlign: "center", marginTop: 18 },
  body: {
    fontFamily: Fonts.sansLight,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.body,
    marginTop: 12,
  },
  bodyCenter: { textAlign: "center" },
  pill: {
    marginTop: 26,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  pillBusy: { opacity: 0.7 },
  pillText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: Colors.paper,
  },
  footnote: {
    fontFamily: Fonts.serifItalic,
    fontSize: 13.5,
    color: Colors.muted,
    textAlign: "center",
    marginTop: 14,
  },
  success: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
});
