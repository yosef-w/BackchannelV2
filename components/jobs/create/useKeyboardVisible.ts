import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Tracks whether the keyboard is currently shown. Used to drop a footer's
 * bottom safe-area padding while the keyboard is up — that padding exists to
 * clear the home indicator, but once the keyboard is docked at the bottom it
 * just reads as a dead gap between the button and the keyboard.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return visible;
}
