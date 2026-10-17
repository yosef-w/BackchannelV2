import { NavigationContext } from "expo-router/react-navigation";
import { useCallback, useContext, useSyncExternalStore } from "react";

/**
 * Whether the enclosing route is the one on screen.
 *
 * The pre-auth funnel pushes every screen (splash → choose-role → intro →
 * onboarding / sign-in) so iOS swipe-back works, which means a screen
 * stays mounted — state, refs, timers, animations and all — for as long
 * as anything sits on top of it. Anything that should only happen while
 * the user can actually see the screen (a looping clock, a one-shot tap
 * guard that must re-arm for the next visit) keys off this.
 *
 * React Navigation's own useIsFocused throws when rendered outside a
 * navigator; this reads the same context directly and reports `true` when
 * there is none (a component inside a modal, a unit test), so shared
 * components never pay for a focus check they don't need.
 */
export function useRouteFocused(): boolean {
  const navigation = useContext(NavigationContext);
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!navigation) return () => {};
      const offFocus = navigation.addListener("focus", onChange);
      const offBlur = navigation.addListener("blur", onChange);
      return () => {
        offFocus();
        offBlur();
      };
    },
    [navigation],
  );
  const read = useCallback(
    () => (navigation ? navigation.isFocused() : true),
    [navigation],
  );
  return useSyncExternalStore(subscribe, read, read);
}
