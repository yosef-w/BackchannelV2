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
import { tokens } from "@/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
// Drag down past this many px — or flick down faster than this — to dismiss.
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;

interface DismissibleSheetProps {
  onDismiss: () => void;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
  /**
   * When true, the *entire* sheet surface is draggable instead of just the
   * handle pill. Use this for sheets WITHOUT inner ScrollViews — a scroll
   * gesture inside the sheet would fight the dismiss gesture otherwise. The
   * pan only activates after 10 px of vertical movement, so taps on inner
   * buttons still register normally.
   */
  fullSheetGesture?: boolean;
}

export function DismissibleSheet({
  onDismiss,
  style,
  children,
  fullSheetGesture = false,
}: DismissibleSheetProps) {
  const translateY = useSharedValue(0);

  let pan = Gesture.Pan()
    .onUpdate((e) => {
      // Only let the sheet move downward.
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: 220 },
          (finished) => {
            if (finished) runOnJS(onDismiss)();
          },
        );
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });
  if (fullSheetGesture) {
    // 10 px tolerance: a quick tap stays a tap; a deliberate swipe past 10 px
    // of downward movement activates the dismiss gesture and the underlying
    // button (if any) is released without firing.
    pan = pan.activeOffsetY(10);
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Handle pill (always visible — universal "drag me" affordance).
  const handle = (
    <View style={styles.handleZone}>
      <View style={styles.handle} />
    </View>
  );

  // In full-sheet mode the GestureDetector wraps the whole Animated.View, so
  // the handle inherits the gesture automatically (no need to wrap it again).
  // In handle-only mode the GestureDetector wraps just the handle so inner
  // buttons / scrollviews aren't hijacked.
  const sheet = (
    <Animated.View
      entering={SlideInDown}
      exiting={SlideOutDown}
      style={[style, animatedStyle]}
    >
      {fullSheetGesture ? (
        handle
      ) : (
        <GestureDetector gesture={pan}>{handle}</GestureDetector>
      )}
      {children}
    </Animated.View>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      {fullSheetGesture ? (
        <GestureDetector gesture={pan}>{sheet}</GestureDetector>
      ) : (
        sheet
      )}
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
    backgroundColor: tokens.colors.border,
    borderRadius: 3,
  },
});
