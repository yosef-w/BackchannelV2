/**
 * Render-smoke tests for StageTrack — the tappable pipeline control:
 * selection callbacks fire with the right index, the terminal option is a
 * separate affordance, and selection state renders without crashing.
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

jest.mock("@/components/ui/icons", () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub });
});

import { StageTrack } from "../StageTrack";

const STAGES = [
  "Referred",
  "Recruiter Screen",
  "HM Interview",
  "Final Round",
  "Offer",
  "Hired",
] as const;

const props = {
  stages: STAGES,
  selectedIndex: null,
  terminalSelected: false,
  terminalLabel: "Didn't move forward",
  onSelectStage: jest.fn(),
  onSelectTerminal: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe("StageTrack", () => {
  it("renders every stage label and the terminal option", () => {
    const { getByText } = render(<StageTrack {...props} />);
    for (const stage of STAGES) expect(getByText(stage)).toBeTruthy();
    expect(getByText("Didn't move forward")).toBeTruthy();
  });

  it("tapping a node reports its index", () => {
    const { getByText } = render(<StageTrack {...props} />);
    fireEvent.press(getByText("Offer"));
    expect(props.onSelectStage).toHaveBeenCalledWith(4);
    fireEvent.press(getByText("Referred"));
    expect(props.onSelectStage).toHaveBeenCalledWith(0);
  });

  it("tapping the terminal option fires its own callback, not a stage", () => {
    const { getByText } = render(<StageTrack {...props} />);
    fireEvent.press(getByText("Didn't move forward"));
    expect(props.onSelectTerminal).toHaveBeenCalledTimes(1);
    expect(props.onSelectStage).not.toHaveBeenCalled();
  });

  it("renders selected and terminal-selected states without crashing", () => {
    const { rerender, getByText } = render(
      <StageTrack {...props} selectedIndex={3} />,
    );
    expect(getByText("Final Round")).toBeTruthy();
    rerender(
      <StageTrack {...props} selectedIndex={null} terminalSelected />,
    );
    expect(getByText("Didn't move forward")).toBeTruthy();
  });
});
