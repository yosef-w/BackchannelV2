// DismissibleSheet — a bottom-sheet body you can drag down (by its handle) to
// dismiss, in addition to whatever backdrop-tap the parent already wires up.
//
// Why a dedicated component: React Native's <Modal> renders its content in a
// separate native view hierarchy, so react-native-gesture-handler's
// GestureDetector won't work unless a GestureHandlerRootView is an ancestor
// *inside* the modal — hence the wrapper here.
//
// The grey handle pill is the drag target (the universal iOS "drag me"
// affordance). Keeping the gesture on the handle — not the whole sheet —
// avoids fighting the ScrollView that lives inside most of these sheets.

import React from "react";
import { Dimensions, StyleSheet, View, ViewStyle } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
// Drag down past this many px — or flick down faster than this — to dismiss.
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;

interface DismissibleSheetProps {
  onDismiss: () => void;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
}

export function DismissibleSheet({
  onDismiss,
  style,
  children,
}: DismissibleSheetProps) {
  const translateY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // Only let the sheet move downward.
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        // Continue the motion off-screen, then unmount via onDismiss. The
        // parent's `exiting` (SlideOutDown) is a no-op by then — the sheet is
        // already gone — so there's no double animation.
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: 220 },
          (finished) => {
            if (finished) runOnJS(onDismiss)();
          },
        );
      } else {
        // Not far/fast enough — snap back.
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <GestureHandlerRootView style={styles.root}>
      <Animated.View
        entering={SlideInDown}
        exiting={SlideOutDown}
        style={[style, animatedStyle]}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.handleZone}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // No flex — the sheet keeps sizing to its own content (the parent overlay's
  // justifyContent: "flex-end" anchors it to the bottom).
  root: { width: "100%" },
  // Full-width touch target around the visible pill so it's easy to grab.
  handleZone: {
    width: "100%",
    paddingBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 24,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#EEE",
    borderRadius: 3,
  },
});
