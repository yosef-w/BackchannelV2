// DismissibleSheet — a bottom-sheet body you can drag down to dismiss, in
// addition to whatever backdrop-tap the parent already wires up.
//
// Three drag modes:
//   • default                 — drag the handle pill to dismiss; inner taps /
//                               scrolls untouched. Safest for sheets with rich
//                               inner UI you don't want to hijack.
//   • fullSheetGesture        — the whole sheet is draggable. Use for sheets
//                               with NO inner scrollable content (confirmations
//                               etc.). Activates after 10 px of pull.
//   • scrollCoupled           — iOS-style "pull-to-dismiss". The whole sheet
//                               is draggable, but the inner SheetScrollView's
//                               scroll wins as long as it's mid-content. Only
//                               when the scroll is parked at the top does a
//                               downward drag start dismissing the sheet. This
//                               matches the iOS native sheet feel (TikTok,
//                               Apple Maps detail cards, etc.).
//
// Why a dedicated component: React Native's <Modal> renders its content in a
// separate native view hierarchy, so react-native-gesture-handler's
// GestureDetector won't work unless a GestureHandlerRootView is an ancestor
// *inside* the modal — hence the wrapper here.

import { tokens } from "@/constants/theme";
import React, { createContext, useContext, useMemo } from "react";
import {
  Dimensions,
  ScrollView as RNScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  type NativeGesture,
} from "react-native-gesture-handler";
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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
// Drag down past this many px — or flick down faster than this — to dismiss.
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;
// Pull-tolerance before the sheet starts following the finger. Below this the
// touch stays "owned" by the inner ScrollView (when scrollCoupled) or just
// reads as a tap.
const PAN_ACTIVATION_PX = 10;

// ─── Context that lets <SheetScrollView> hand its scroll offset and native
// gesture back up to the parent sheet's pan gesture. Null outside a
// scroll-coupled sheet — <SheetScrollView> falls back to a plain ScrollView. ─
interface SheetScrollCtxValue {
  scrollOffset: SharedValue<number>;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
  nativeGesture: NativeGesture;
}
const SheetScrollCtx = createContext<SheetScrollCtxValue | null>(null);

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
   * iOS-style pull-to-dismiss. Whole sheet is draggable, but the gesture only
   * activates when the inner <SheetScrollView> is parked at scrollOffset 0 —
   * so mid-scroll downward drags scroll the content, and once you're at the
   * top, the same drag dismisses. Requires inner scrollable content to be
   * rendered with <SheetScrollView> from this module.
   */
  scrollCoupled?: boolean;
}

export function DismissibleSheet({
  onDismiss,
  style,
  children,
  fullSheetGesture = false,
  scrollCoupled = false,
}: DismissibleSheetProps) {
  const translateY = useSharedValue(0);
  const scrollOffset = useSharedValue(0);
  // Snapshot of the scroll position when each new pan gesture begins. If the
  // user starts dragging from the top, the pan is allowed to dismiss; if they
  // start mid-content, the pan defers entirely so the scroll feels normal.
  const startedAtTop = useSharedValue(false);

  // Native gesture lets the pan and the inner ScrollView run together rather
  // than fight for ownership of the touch. Stable identity across renders so
  // the SheetScrollView's GestureDetector doesn't churn.
  const nativeGesture = useMemo(() => Gesture.Native(), []);

  // UI-thread scroll handler — keeps scrollOffset in sync without round-
  // tripping to JS on every frame.
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollOffset.value = e.contentOffset.y;
    },
  });

  let pan = Gesture.Pan()
    .onBegin(() => {
      "worklet";
      // Snapshot once per gesture so a mid-gesture scroll-to-top doesn't
      // suddenly start translating the sheet under the user.
      startedAtTop.value = scrollCoupled ? scrollOffset.value <= 0 : true;
    })
    .onUpdate((e) => {
      "worklet";
      if (!startedAtTop.value) {
        // Mid-content drag — sheet stays put, ScrollView owns the gesture.
        translateY.value = 0;
        return;
      }
      // Only let the sheet move downward.
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      "worklet";
      if (!startedAtTop.value) {
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
        return;
      }
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

  if (fullSheetGesture || scrollCoupled) {
    // PAN_ACTIVATION_PX tolerance so a quick tap stays a tap; a deliberate
    // downward swipe past the threshold engages the dismiss gesture and the
    // underlying button (if any) is released without firing.
    pan = pan.activeOffsetY(PAN_ACTIVATION_PX);
  }
  if (scrollCoupled) {
    // Run pan and the inner SheetScrollView's native gesture concurrently —
    // the pan's onUpdate worklet is what arbitrates which one "wins" based
    // on the snapshotted scroll position.
    pan = pan.simultaneousWithExternalGesture(nativeGesture);
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

  const wholeSheetDraggable = fullSheetGesture || scrollCoupled;

  // In whole-sheet modes the GestureDetector wraps the whole Animated.View,
  // so the handle inherits the gesture automatically. In handle-only mode the
  // GestureDetector wraps just the handle so inner buttons / scrollviews
  // aren't hijacked.
  const sheet = (
    <Animated.View
      entering={SlideInDown}
      exiting={SlideOutDown}
      style={[style, animatedStyle]}
    >
      {wholeSheetDraggable ? (
        handle
      ) : (
        <GestureDetector gesture={pan}>{handle}</GestureDetector>
      )}
      {scrollCoupled ? (
        <SheetScrollCtx.Provider
          value={{ scrollOffset, scrollHandler, nativeGesture }}
        >
          {children}
        </SheetScrollCtx.Provider>
      ) : (
        children
      )}
    </Animated.View>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      {wholeSheetDraggable ? (
        <GestureDetector gesture={pan}>{sheet}</GestureDetector>
      ) : (
        sheet
      )}
    </GestureHandlerRootView>
  );
}

// ─── SheetScrollView ────────────────────────────────────────────────────────
// Drop-in replacement for ScrollView when rendered inside
// <DismissibleSheet scrollCoupled>. Wires the scroll offset back up to the
// sheet so a downward drag at the top of the scroll dismisses the sheet,
// while mid-scroll drags scroll content normally.
//
// Outside a scrollCoupled sheet this just renders a regular ScrollView, so
// it's safe to use everywhere.

interface SheetScrollViewProps extends ScrollViewProps {
  children?: React.ReactNode;
}

export function SheetScrollView({ children, ...rest }: SheetScrollViewProps) {
  const ctx = useContext(SheetScrollCtx);

  if (!ctx) {
    // Not inside a scrollCoupled sheet — behave like a normal ScrollView.
    return <RNScrollView {...rest}>{children}</RNScrollView>;
  }

  return (
    <GestureDetector gesture={ctx.nativeGesture}>
      <Animated.ScrollView
        // Default to bounces:false so the pull-down doesn't visually double
        // up with iOS overscroll bounce when the sheet starts to follow the
        // finger. Callers can opt back in.
        bounces={false}
        {...rest}
        onScroll={ctx.scrollHandler}
        scrollEventThrottle={16}
      >
        {children}
      </Animated.ScrollView>
    </GestureDetector>
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
    height: 4,
    backgroundColor: tokens.colors.border,
    borderRadius: 2,
  },
});
