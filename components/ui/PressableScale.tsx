// PressableScale — the marketing site's press feedback, ported.
//
// The site's cards and primary buttons shrink slightly on press
// (`:active { transform: scale(0.98) }`) instead of dimming. Most of the
// app uses TouchableOpacity's opacity dim, which is fine for utility
// chrome — this component exists for HERO moments (role cards, primary
// pills) where the tactile scale reads as more deliberate. Not a
// wholesale TouchableOpacity replacement; use sparingly.

import React from "react";
import { Pressable, type PressableProps, type ViewStyle, type StyleProp } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  /** Scale while pressed. Site uses 0.98 for cards, 0.96 for small pills. */
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function PressableScale({
  pressedScale = 0.98,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withTiming(pressedScale, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 140 });
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
