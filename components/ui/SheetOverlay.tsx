// SheetOverlay — the in-tree bottom-sheet host (backdrop + sheet), with the
// VoiceOver behavior these overlays were missing.
//
// These sheets are absolutely-positioned Views, not RN <Modal>s, so iOS does
// not confine VoiceOver to them: without accessibilityViewIsModal a
// screen-reader user can swipe straight into the screen behind the sheet.
// The dimmed backdrop is a touch-only dismiss target (accessible={false});
// the accessible ways out are the sheet's own Close/Cancel and the two-finger
// scrub (onAccessibilityEscape). Touch behavior is identical to the inline
// version this replaces.

import { BlurView } from "expo-blur";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

interface SheetOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Style for the full-screen host (positioning, justifyContent, zIndex). */
  style?: StyleProp<ViewStyle>;
  /** Blur strength behind the sheet; 0 renders the bare (transparent) tap layer. */
  blurIntensity?: number;
  /** Wrap in a KeyboardAvoidingView (sheets with text inputs). */
  keyboardAvoiding?: boolean;
}

export function SheetOverlay({
  onClose,
  children,
  style,
  blurIntensity = 60,
  keyboardAvoiding = false,
}: SheetOverlayProps) {
  const backdrop = (
    <TouchableOpacity
      style={StyleSheet.absoluteFill}
      activeOpacity={1}
      onPress={onClose}
      accessible={false}
    >
      {blurIntensity > 0 && (
        <BlurView
          intensity={blurIntensity}
          style={StyleSheet.absoluteFill}
          tint="dark"
        />
      )}
    </TouchableOpacity>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={style}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
      >
        {backdrop}
        {children}
      </KeyboardAvoidingView>
    );
  }
  return (
    <View
      style={style}
      accessibilityViewIsModal
      onAccessibilityEscape={onClose}
    >
      {backdrop}
      {children}
    </View>
  );
}
