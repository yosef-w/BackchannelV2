// StageTrack — the tappable pipeline control at the heart of the check-in
// redesign. One horizontal track of stage nodes (package-tracker style):
// tapping a node selects that stage and the rail fills up to it with a
// left-to-right cascade. The track IS the input — it replaces the old
// timeline-display + separate radio-list pairing that rendered the same six
// stages twice.
//
// The terminal "ended" option (applicant: "Didn't move forward", sponsor:
// "No Longer Active") deliberately lives BELOW the track as a quiet text
// affordance — it's an exit from the pipeline, not a stage on the happy
// path, and shouldn't occupy a node.

import { Check } from "@/components/ui/icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Colors } from "@/constants/theme";

interface StageTrackProps {
  /** Pipeline stages in order (terminal value excluded — see terminalLabel). */
  stages: readonly string[];
  /** Selected stage index, or null when the user hasn't chosen yet. */
  selectedIndex: number | null;
  terminalSelected: boolean;
  terminalLabel: string;
  onSelectStage: (index: number) => void;
  onSelectTerminal: () => void;
}

/** One rail segment between two nodes; fills with a staggered cascade. */
function Rail({ filled, index }: { filled: boolean; index: number }) {
  const fill = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    fill.value = filled
      ? withDelay(index * 45, withTiming(1, { duration: 180 }))
      : withTiming(0, { duration: 120 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled, index]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fill.value }));

  return (
    <View style={styles.rail}>
      <Animated.View style={[styles.railFill, overlayStyle]} />
    </View>
  );
}

/** One tappable node (dot + label). */
function Node({
  label,
  state,
  onPress,
}: {
  label: string;
  state: "completed" | "active" | "upcoming";
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value =
      state === "active"
        ? withSpring(1.25, { damping: 12, stiffness: 180 })
        : withSpring(1, { damping: 14, stiffness: 160 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      style={styles.node}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: state === "active" }}
    >
      <Animated.View
        style={[
          styles.dot,
          state === "completed" && styles.dotCompleted,
          state === "active" && styles.dotActive,
          dotStyle,
        ]}
      >
        {state === "completed" && (
          <Check color="#FFF" size={9} strokeWidth={3.5} />
        )}
        {state === "active" && <View style={styles.dotCore} />}
      </Animated.View>
      <Text
        style={[
          styles.label,
          state === "active" && styles.labelActive,
          state === "upcoming" && styles.labelMuted,
        ]}
        numberOfLines={3}
      >
        {/* Break multi-word labels at the space deliberately: the active
            state's heavier weight makes words a touch wider, and letting RN
            wrap inside the narrow node column mid-word turned "Recruiter
            Screen" into "Recruite / r Screen" the moment it was selected.
            One word per line can never mid-word break. */}
        {label.split(" ").join("\n")}
      </Text>
    </TouchableOpacity>
  );
}

export function StageTrack({
  stages,
  selectedIndex,
  terminalSelected,
  terminalLabel,
  onSelectStage,
  onSelectTerminal,
}: StageTrackProps) {
  const effectiveIndex = terminalSelected ? -1 : selectedIndex;

  return (
    <View>
      <View style={styles.track}>
        {stages.map((stage, idx) => {
          const state: "completed" | "active" | "upcoming" =
            effectiveIndex === null || effectiveIndex < 0
              ? "upcoming"
              : idx < effectiveIndex
                ? "completed"
                : idx === effectiveIndex
                  ? "active"
                  : "upcoming";
          return (
            <React.Fragment key={stage}>
              {idx > 0 && (
                <Rail
                  index={idx - 1}
                  filled={effectiveIndex !== null && idx <= effectiveIndex}
                />
              )}
              <Node
                label={stage}
                state={state}
                onPress={() => {
                  Haptics.impactAsync(
                    Haptics.ImpactFeedbackStyle.Light,
                  ).catch(() => {});
                  onSelectStage(idx);
                }}
              />
            </React.Fragment>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.terminal, terminalSelected && styles.terminalSelected]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
          onSelectTerminal();
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ selected: terminalSelected }}
      >
        <Text
          style={[
            styles.terminalText,
            terminalSelected && styles.terminalTextSelected,
          ]}
        >
          {terminalLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  node: {
    alignItems: "center",
    width: 46,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  dotCompleted: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  dotActive: {
    borderColor: Colors.ink,
  },
  dotCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.ink,
  },
  // Rails sit at dot-centre height (18/2 - 1) and stretch between nodes.
  rail: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    marginTop: 8,
    marginHorizontal: -8,
    borderRadius: 1,
    overflow: "hidden",
  },
  railFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.ink,
  },
  label: {
    fontSize: 9.5,
    fontWeight: "600",
    color: Colors.body,
    textAlign: "center",
    lineHeight: 12,
    // Wider render box than the 46pt node column (negative margins keep the
    // layout width unchanged) so the longest word still fits on one line at
    // the active state's heavier weight.
    width: 58,
    marginHorizontal: -6,
  },
  labelActive: {
    color: Colors.ink,
    fontWeight: "800",
  },
  labelMuted: {
    color: Colors.faint,
  },
  terminal: {
    alignSelf: "center",
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  terminalSelected: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  terminalText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.muted,
    textDecorationLine: "underline",
  },
  terminalTextSelected: {
    color: "#FFF",
    textDecorationLine: "none",
  },
});
