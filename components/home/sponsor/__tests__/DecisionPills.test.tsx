/**
 * DecisionPills — the letterpress Pass / Connect capsule:
 *   1. labels render as spaced caps, regardless of the casing passed in
 *   2. each segment calls its own handler, with its haptic
 *   3. disabled blocks both
 */

import { fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import React from "react";
import { DecisionPills } from "../DecisionPills";

// lucide ships ES modules Jest can't parse; the icons add nothing here.
jest.mock("@/components/ui/icons", () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub });
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

function setup(disabled = false) {
  const onPass = jest.fn();
  const onAccept = jest.fn();
  const r = render(
    <DecisionPills
      acceptLabel="Connect"
      onPass={onPass}
      onAccept={onAccept}
      passAccessibilityLabel="Pass on Priya"
      acceptAccessibilityLabel="Connect with Priya"
      disabled={disabled}
    />,
  );
  return { r, onPass, onAccept };
}

beforeEach(() => jest.clearAllMocks());

describe("DecisionPills", () => {
  it("renders PASS and CONNECT in caps", () => {
    const { r } = setup();
    expect(r.getByText("PASS")).toBeTruthy();
    expect(r.getByText("CONNECT")).toBeTruthy();
  });

  it("pass calls onPass with a light haptic only", () => {
    const { r, onPass, onAccept } = setup();
    fireEvent.press(r.getByLabelText("Pass on Priya"));
    expect(onPass).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
  });

  it("connect calls onAccept with a medium haptic only", () => {
    const { r, onPass, onAccept } = setup();
    fireEvent.press(r.getByLabelText("Connect with Priya"));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onPass).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).toHaveBeenCalledWith("medium");
  });

  it("does nothing while disabled", () => {
    const { r, onPass, onAccept } = setup(true);
    fireEvent.press(r.getByLabelText("Pass on Priya"));
    fireEvent.press(r.getByLabelText("Connect with Priya"));
    expect(onPass).not.toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });
});
