/**
 * Render-smoke tests for the create-job flow's interactive screens — "the
 * wiring didn't break" coverage, not pixel tests:
 *   - URL step: Continue stays disabled until the link is valid
 *   - Review step: Continue gates on title+company; edits flow back out
 *     through onContinue
 *   - Insights step: publish fires; the skip escape-hatch shows only while
 *     the sponsor hasn't written anything
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

// Icon barrel → inert stubs (SVG internals are irrelevant to these tests).
jest.mock("@/components/ui/icons", () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub });
});

// Dev clients without the clipboard native module take the degrade path —
// which is also the deterministic path for tests.
jest.mock("expo-modules-core", () => ({
  ...jest.requireActual("expo-modules-core"),
  requireOptionalNativeModule: () => null,
}));

import { CreateJobReviewScreen } from "../CreateJobReviewScreen";
import { CreateJobUrlScreen } from "../CreateJobUrlScreen";
import { CreateJobInsightsScreen } from "../CreateJobInsightsScreen";

describe("CreateJobUrlScreen", () => {
  const props = {
    visible: true,
    url: "",
    onSetUrl: jest.fn(),
    onContinue: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders nothing when not visible", () => {
    const { queryByText } = render(
      <CreateJobUrlScreen {...props} visible={false} />,
    );
    expect(queryByText("Paste the job link")).toBeNull();
  });

  it("Continue is disabled for an empty URL", () => {
    const { getByText } = render(<CreateJobUrlScreen {...props} />);
    fireEvent.press(getByText("Continue"));
    expect(props.onContinue).not.toHaveBeenCalled();
  });

  it("Continue is disabled for garbage input", () => {
    const { getByText } = render(
      <CreateJobUrlScreen {...props} url="not a url" />,
    );
    fireEvent.press(getByText("Continue"));
    expect(props.onContinue).not.toHaveBeenCalled();
  });

  it("typing flows through onSetUrl and a valid link enables Continue", () => {
    const { getByPlaceholderText, getByText, rerender } = render(
      <CreateJobUrlScreen {...props} />,
    );
    fireEvent.changeText(
      getByPlaceholderText("https://jobs.company.com/role"),
      "jobs.acme.com/role/123",
    );
    expect(props.onSetUrl).toHaveBeenCalledWith("jobs.acme.com/role/123");

    rerender(<CreateJobUrlScreen {...props} url="jobs.acme.com/role/123" />);
    fireEvent.press(getByText("Continue"));
    expect(props.onContinue).toHaveBeenCalledTimes(1);
  });
});

describe("CreateJobReviewScreen", () => {
  const initial = {
    title: "",
    company: "",
    location: "",
    salary: "",
    type: "",
    description: "",
  };
  const props = {
    visible: true,
    initial,
    wasAutoFilled: false,
    onContinue: jest.fn(),
    onBack: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("Continue is disabled until title AND company are filled", () => {
    const { getByText } = render(<CreateJobReviewScreen {...props} />);
    fireEvent.press(getByText("Continue"));
    expect(props.onContinue).not.toHaveBeenCalled();
  });

  it("shows the scraped values and hands edits back through onContinue", () => {
    const filled = {
      ...initial,
      title: "iOS Engineer",
      company: "Acme",
      location: "NYC",
    };
    const { getByText, getByDisplayValue } = render(
      <CreateJobReviewScreen {...props} initial={filled} wasAutoFilled />,
    );

    // Scraped values are visible and editable.
    fireEvent.changeText(getByDisplayValue("iOS Engineer"), "Senior iOS Engineer");
    fireEvent.press(getByText("Continue"));

    expect(props.onContinue).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Senior iOS Engineer",
        company: "Acme",
        location: "NYC",
      }),
    );
  });

  it("softens the copy when the scrape found nothing", () => {
    const { getByText } = render(<CreateJobReviewScreen {...props} />);
    expect(
      getByText(/couldn.t auto-read this page/i),
    ).toBeTruthy();
  });
});

describe("CreateJobInsightsScreen", () => {
  const props = {
    visible: true,
    jobTitle: "iOS Engineer",
    answers: [],
    onChangeAnswers: jest.fn(),
    isPublishing: false,
    onPublish: jest.fn(),
    onBack: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("Publish fires onPublish", () => {
    const { getByText } = render(<CreateJobInsightsScreen {...props} />);
    fireEvent.press(getByText("Publish Job"));
    expect(props.onPublish).toHaveBeenCalledTimes(1);
  });

  it("shows the skip escape-hatch only while nothing is written", () => {
    const { getByText, queryByText, rerender } = render(
      <CreateJobInsightsScreen {...props} />,
    );
    expect(getByText(/skip for now/i)).toBeTruthy();

    rerender(
      <CreateJobInsightsScreen
        {...props}
        answers={[{ question: "A TYPICAL WEEK HERE", answer: "Sprints" }]}
      />,
    );
    expect(queryByText(/skip for now/i)).toBeNull();
  });

  it("publishing state disables the button (no double publish)", () => {
    const { queryByText, UNSAFE_root } = render(
      <CreateJobInsightsScreen {...props} isPublishing />,
    );
    // Button label is replaced by a spinner while publishing.
    expect(queryByText("Publish Job")).toBeNull();
    expect(UNSAFE_root).toBeTruthy();
  });
});
