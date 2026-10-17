/**
 * Regression tests for the cinema engine's route-focus gate — the fix for
 * the "idle haptics after Continue with Apple" bug. /intro is pushed over
 * (never replaced), so the films stay mounted under sign-up for the whole
 * questionnaire, and their looping clock used to keep firing haptic beats
 * from a screen nobody could see.
 *   1. useRouteFocused reports true with no navigator at all — one-shot
 *      pops (ConfirmPop, BroadcastMoment) render in modals and in tests,
 *      and React Navigation's own useIsFocused throws there
 *   2. useRouteFocused tracks a navigator's focus/blur events
 * (The UI-thread haptic gate itself is a one-line worklet check; Reanimated's
 * Jest mock doesn't run useAnimatedReaction on `.value` writes, so it isn't
 * exercised here.)
 */

import { act, renderHook } from "@testing-library/react-native";
import { NavigationContext } from "expo-router/react-navigation";
import React from "react";
import { useRouteFocused } from "../engine";

/** A minimal stand-in for a React Navigation `navigation` object. */
function makeNavigation(initialFocused: boolean) {
  const listeners = { focus: new Set<() => void>(), blur: new Set<() => void>() };
  let focused = initialFocused;
  const nav = {
    isFocused: () => focused,
    addListener: (event: "focus" | "blur", cb: () => void) => {
      listeners[event].add(cb);
      return () => listeners[event].delete(cb);
    },
  };
  return {
    nav: nav as unknown as React.ContextType<typeof NavigationContext>,
    setFocused(next: boolean) {
      focused = next;
      listeners[next ? "focus" : "blur"].forEach((cb) => cb());
    },
  };
}

describe("useRouteFocused", () => {
  it("is true (and does not throw) when rendered outside any navigator", () => {
    const { result } = renderHook(() => useRouteFocused());
    expect(result.current).toBe(true);
  });

  it("follows the enclosing navigator's focus and blur events", () => {
    const { nav, setFocused } = makeNavigation(true);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NavigationContext.Provider value={nav}>{children}</NavigationContext.Provider>
    );
    const { result } = renderHook(() => useRouteFocused(), { wrapper });
    expect(result.current).toBe(true);

    act(() => setFocused(false)); // sign-up pushed on top of the film
    expect(result.current).toBe(false);

    act(() => setFocused(true)); // swipe-back to the film
    expect(result.current).toBe(true);
  });
});
