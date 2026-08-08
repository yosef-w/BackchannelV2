// DismissibleSheet — a bottom-sheet body you can drag down (by its handle) to
// dismiss, in addition to whatever backdrop-tap the parent already wires up.
//
// Why a dedicated component: React Native's <Modal> renders its content in a
// separate native view hierarchy, so react-native-gesture-handler's
// GestureDetector won't work unless a GestureHandlerRootView is an ancestor
// *inside* the modal — hence the wrapper here.
//
// Three drag modes:
// - default: the grey handle pill is the drag target (the universal iOS
//   "drag me" affordance). Keeping the gesture on the handle — not the whole
//   sheet — avoids fighting a plain ScrollView inside the sheet.
// - `fullSheetGesture`: the whole sheet drags. For sheets WITHOUT inner
//   scrollables.
// - `scrollDismiss` + <SheetScrollView>: the whole sheet drags, but only
//   once the inner scroll sits at the top — scroll up through the content,
//   keep pulling, and the sheet follows the finger down into a dismiss.
//   The scroll view reports its offset on the UI thread and runs
//   simultaneously with the sheet's pan, so the handoff is seamless.

import React, { createContext, useContext } from "react";
import { Dimensions, StyleSheet, View, ViewStyle } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import type { ScrollViewProps } from "react-native";
import Animated, {
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Colors } from "@/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
// Drag down past this many px — or flick down faster than this — to dismiss.
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;

interface SheetScrollContextValue {
  /** Inner scroll offset, written on the UI thread. */
  scrollOffset: SharedValue<number>;
  /**
   * The sheet-owned Gesture.Native() the SheetScrollView must attach to
   * its scroll view. The sheet configures IT and its pan as mutually
   * simultaneous — both directions matter: the orchestrator consults the
   * ACTIVATING gesture's config when deciding whether to cancel the other,
   * so a one-sided declaration still let the scroll cancel the pan.
   */
  nativeGesture: ReturnType<typeof Gesture.Native>;
}

const SheetScrollContext = createContext<SheetScrollContextValue | null>(
  null,
);

/**
 * The scrollable body of a `scrollDismiss` DismissibleSheet. Reports its
 * offset to the sheet (so the drag-to-close only engages at the top) and
 * exposes its native scroll gesture so the sheet's pan can run
 * simultaneously — the same finger movement hands over from scrolling to
 * dragging without lifting.
 */
export function SheetScrollView({
  children,
  ...props
}: ScrollViewProps & { children?: React.ReactNode }) {
  const ctx = useContext(SheetScrollContext);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      if (ctx) ctx.scrollOffset.value = e.contentOffset.y;
    },
  });
  const scrollView = (
    <Animated.ScrollView
      bounces={false}
      showsVerticalScrollIndicator={false}
      {...props}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {children}
    </Animated.ScrollView>
  );
  if (!ctx) return scrollView;
  return (
    <GestureDetector gesture={ctx.nativeGesture}>{scrollView}</GestureDetector>
  );
}

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
  /**
   * When true, the whole sheet drags to dismiss but yields to an inner
   * <SheetScrollView>: while the content is scrolled, downward pans scroll;
   * once it reaches the top, continuing the pull drags the sheet with the
   * finger. Sheets without a SheetScrollView get whole-surface dragging.
   */
  scrollDismiss?: boolean;
}

export function DismissibleSheet({
  onDismiss,
  style,
  children,
  fullSheetGesture = false,
  scrollDismiss = false,
}: DismissibleSheetProps) {
  const translateY = useSharedValue(0);
  const scrollOffset = useSharedValue(0);
  // While the finger is down but the content isn't at the top yet, the pan
  // "rebases" here so the sheet only starts moving from the moment the
  // scroll hits the top — no jump equal to the distance already scrolled.
  const dragBase = useSharedValue(0);
  // The inner SheetScrollView attaches this to its scroll view (via
  // context); created here so the pan and the scroll can be declared
  // mutually simultaneous with direct object references.
  const nativeGesture = Gesture.Native();

  const settle = (velocityY: number) => {
    "worklet";
    if (
      translateY.value > DISMISS_DISTANCE ||
      (velocityY > DISMISS_VELOCITY && translateY.value > 0)
    ) {
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
  };

  // Handle-pill pan — always available, unconditional (the handle never
  // scrolls, so no gating).
  const handlePan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => settle(e.velocityY));

  // Whole-surface pan for fullSheetGesture mode (10 px tolerance keeps
  // taps working).
  let bodyPan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => settle(e.velocityY));
  if (fullSheetGesture) {
    bodyPan = bodyPan.activeOffsetY(10);
  }

  // Scroll-aware pan for scrollDismiss mode: runs simultaneously with the
  // inner SheetScrollView and only moves the sheet while that scroll sits
  // at (or above) the top.
  const scrollPan = Gesture.Pan()
    // Vertical intent only — sideways movement (stat rails, chip rows)
    // fails the gesture instead of dragging the sheet diagonally.
    .activeOffsetY(10)
    .failOffsetX([-20, 20])
    .onStart(() => {
      dragBase.value = 0;
    })
    .onUpdate((e) => {
      if (scrollOffset.value > 0 && translateY.value <= 0) {
        // Content still scrolled — keep rebasing so the sheet starts
        // moving from wherever the finger is when the top is reached.
        dragBase.value = e.translationY;
        translateY.value = 0;
        return;
      }
      translateY.value = Math.max(0, e.translationY - dragBase.value);
    })
    .onEnd((e) => settle(e.velocityY));
  // BOTH directions — see SheetScrollContextValue.nativeGesture.
  scrollPan.simultaneousWithExternalGesture(nativeGesture);
  nativeGesture.simultaneousWithExternalGesture(scrollPan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Handle pill (always visible — universal "drag me" affordance).
  const handle = (
    <View style={styles.handleZone}>
      <View style={styles.handle} />
    </View>
  );

  const inner = (
    <>
      {fullSheetGesture || scrollDismiss ? (
        handle
      ) : (
        <GestureDetector gesture={handlePan}>{handle}</GestureDetector>
      )}
      {scrollDismiss ? (
        <SheetScrollContext.Provider value={{ scrollOffset, nativeGesture }}>
          {children}
        </SheetScrollContext.Provider>
      ) : (
        children
      )}
    </>
  );

  const sheet = (
    <Animated.View
      entering={SlideInDown}
      exiting={SlideOutDown}
      style={[style, animatedStyle]}
    >
      {inner}
    </Animated.View>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      {scrollDismiss ? (
        <GestureDetector gesture={scrollPan}>{sheet}</GestureDetector>
      ) : fullSheetGesture ? (
        <GestureDetector gesture={bodyPan}>{sheet}</GestureDetector>
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
    backgroundColor: Colors.border,
    borderRadius: 3,
  },
});
