// RevealOnScroll — the record under a deck card's opening, invisible at
// the top of the scroll and fading in as the reader starts down.
//
// Why: the opening (role row + card) is sized to end just above the
// floating Pass/Connect capsule, so whatever follows it starts BEHIND the
// capsule and the tab bar. Shown outright it peeks out between and under
// them; pushed a full screen down to hide it, it leaves a tall blank band
// the moment you scroll. Faded, it does neither: the first screen is the
// card alone, and the record is simply there as soon as you move.
//
// Opacity (and a 14pt rise) track the scroll position directly — no timer,
// so it can't be out of step with the finger, and scrolling back to the
// top hides it again. Screen readers still read the content at any offset.

import React from "react";
import type { ViewProps } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from "react-native-reanimated";

/** Scroll offset where the fade starts, and where it has finished. */
export const REVEAL_START = 6;
export const REVEAL_END = 116;
const RISE = 14;

interface RevealOnScrollProps extends ViewProps {
  /** The deck scroll's vertical offset (HomeView's handler writes it). */
  scrollY: SharedValue<number>;
  children: React.ReactNode;
}

export function RevealOnScroll({ scrollY, style, children, ...rest }: RevealOnScrollProps) {
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedStyle(() => {
    const p = interpolate(
      scrollY.value,
      [REVEAL_START, REVEAL_END],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: p,
      transform: reduceMotion ? [] : [{ translateY: (1 - p) * RISE }],
    };
  }, [reduceMotion]);
  return (
    <Animated.View {...rest} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}
