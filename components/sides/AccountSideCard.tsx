// AccountSideCard — the Account tab's "which side am I on" block
// (docs/DUAL_SIDES.md). Two states:
//
//   one side  — for a sponsor only, an invitation to add a job search.
//               Applicants see nothing: the dual role is a sponsor feature
//               (see lib/sides addableRole).
//   two sides — a two-segment control (the decision capsule's shape: one
//               ink-filled half) to switch between them.
//
// Presentational. The tabs shell exposes the switch and the add-a-side
// route through ShellContext; ProfileView just renders this.

import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { ChevronRight } from "@/components/ui/icons";
import { Colors, Fonts } from "@/constants/theme";
import { FontScale } from "@/lib/responsive";
import { addableRole, holdsBoth, sideLabel, type Role } from "@/lib/sides";

interface AccountSideCardProps {
  roles: Role[];
  activeRole: Role;
  /** The sponsor side's company — names who can't see the job search. */
  company?: string | null;
  /** Whether adding a side can work right now (the backend supports it,
   * or this is a development preview). False hides the invitation. */
  canAdd: boolean;
  onSwitch: (role: Role) => void;
  onAdd: (role: "Applicant") => void;
}

export function AccountSideCard({
  roles,
  activeRole,
  company,
  canAdd,
  onSwitch,
  onAdd,
}: AccountSideCardProps) {
  if (holdsBoth(roles)) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.eyebrow}>YOU&apos;RE USING BACKCHANNEL AS</Text>
        <View style={styles.capsule} accessibilityRole="tablist">
          {(["Sponsor", "Applicant"] as Role[]).map((role) => {
            const active = role === activeRole;
            return (
              <PressableScale
                key={role}
                pressedScale={0.97}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => {
                  if (active) return;
                  Haptics.selectionAsync().catch(() => {});
                  onSwitch(role);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={sideLabel(role)}
              >
                <Text
                  style={[styles.segmentText, active && styles.segmentTextActive]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={FontScale.label}
                >
                  {sideLabel(role).toUpperCase()}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
    );
  }

  const missing = addableRole(roles);
  if (!missing || !canAdd) return null;
  const employer = (company || "").trim();
  const copy = {
    title: "Looking for your own next role?",
    body: `Add a job search to this account. ${
      employer ? `Nobody at ${employer}` : "Nobody at your company"
    } will see it.`,
    cta: "Set it up",
  };

  return (
    <Pressable
      onPress={() => onAdd(missing)}
      style={({ pressed }) => [styles.invite, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${copy.title} ${copy.body}`}
      accessibilityHint={copy.cta}
    >
      <Text style={styles.inviteTitle}>{copy.title}</Text>
      <Text style={styles.inviteBody}>{copy.body}</Text>
      <View style={styles.inviteCta}>
        <Text style={styles.inviteCtaText}>{copy.cta}</Text>
        <ChevronRight size={16} color={Colors.ink} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 20 },
  eyebrow: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    color: Colors.muted,
    marginBottom: 10,
  },
  // The decision capsule's proportions (DecisionPills): hairline in ink,
  // 4pt padding, one filled half.
  capsule: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.ink,
    borderRadius: 32,
    backgroundColor: Colors.paper,
  },
  segment: {
    flex: 1,
    minHeight: 46,
    borderRadius: 28,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: Colors.ink },
  segmentText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    letterSpacing: 1.8,
    color: Colors.ink,
  },
  segmentTextActive: { color: Colors.paper },

  invite: {
    marginTop: 20,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    padding: 18,
  },
  pressed: { opacity: 0.7 },
  inviteTitle: {
    fontFamily: Fonts.serif,
    fontSize: 21,
    lineHeight: 26,
    color: Colors.ink,
  },
  inviteBody: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.body,
    marginTop: 6,
  },
  inviteCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
    minHeight: 24,
  },
  inviteCtaText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: Colors.ink,
  },
});
