/**
 * Render-smoke tests for the CheckInStack session engine: card flow, skip,
 * immediate-vs-accumulate submit modes, error handling (card stays open),
 * and the recap exit.
 */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

jest.mock("@/components/ui/icons", () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub });
});

import { CheckInStack, type StackCardItem } from "../CheckInStack";

const STAGES = [
  "Referred",
  "Recruiter Screen",
  "HM Interview",
  "Final Round",
  "Offer",
  "Hired",
] as const;

const items: StackCardItem[] = [
  { id: "r1", heading: "Snowflake", subheading: "Backend Engineer", meta: "via Jordan · 12 days ago", stale: true },
  { id: "r2", heading: "Google", subheading: "iOS Engineer", meta: "via Sam · 3 days ago" },
];

const baseProps = {
  items,
  stages: STAGES,
  terminalLabel: "Didn't move forward",
  recapSubtitle: (n: number) => `${n} updates sent.`,
  onDone: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe("CheckInStack — immediate mode (applicant)", () => {
  it("walks the stack: select stage → send → next card → recap → done", async () => {
    const onSubmitCard = jest.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <CheckInStack {...baseProps} onSubmitCard={onSubmitCard} />,
    );

    // Card 1 (stale-first ordering is the caller's job; engine renders order given).
    expect(getByText("Snowflake")).toBeTruthy();
    expect(getByText("NEEDS AN UPDATE")).toBeTruthy();

    fireEvent.press(getByText("Offer"));
    await act(async () => {
      fireEvent.press(getByText("Send update"));
    });
    expect(onSubmitCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1" }),
      expect.objectContaining({ stageIndex: 4, terminal: false }),
    );

    // Card 2 appears after submit.
    await waitFor(() => expect(getByText("Google")).toBeTruthy());
    fireEvent.press(getByText("Hired"));
    await act(async () => {
      fireEvent.press(getByText("Send update"));
    });

    // Recap: both updated, Done exits.
    await waitFor(() => expect(getByText("All caught up")).toBeTruthy());
    expect(getByText("2 updates sent.")).toBeTruthy();
    fireEvent.press(getByText("Done"));
    expect(baseProps.onDone).toHaveBeenCalled();
  });

  it("a failed submit keeps the card open (nothing lost)", async () => {
    const onSubmitCard = jest.fn().mockRejectedValue(new Error("network"));
    const { getByText, queryByText } = render(
      <CheckInStack {...baseProps} onSubmitCard={onSubmitCard} />,
    );
    fireEvent.press(getByText("Offer"));
    await act(async () => {
      fireEvent.press(getByText("Send update"));
    });
    // Still on Snowflake; no recap.
    expect(getByText("Snowflake")).toBeTruthy();
    expect(queryByText("All caught up")).toBeNull();
  });

  it("Send is disabled until a stage is chosen", () => {
    const onSubmitCard = jest.fn();
    const { getByText } = render(
      <CheckInStack {...baseProps} onSubmitCard={onSubmitCard} />,
    );
    fireEvent.press(getByText("Send update"));
    expect(onSubmitCard).not.toHaveBeenCalled();
  });

  it("skipping everything reaches the recap with the skip message", async () => {
    const { getByText } = render(
      <CheckInStack {...baseProps} onSubmitCard={jest.fn()} />,
    );
    fireEvent.press(getByText("Skip"));
    fireEvent.press(getByText("Skip"));
    await waitFor(() => expect(getByText("Nothing updated")).toBeTruthy());
    fireEvent.press(getByText("Done"));
    expect(baseProps.onDone).toHaveBeenCalled();
  });
});

describe("CheckInStack — overview + bulk (scale features)", () => {
  it("overview lists all cards with status and jumps on tap", async () => {
    const { getByText, getByLabelText } = render(
      <CheckInStack {...baseProps} onSubmitCard={jest.fn()} />,
    );
    // Skip Snowflake → now on Google; open the overview.
    fireEvent.press(getByText("Skip"));
    await waitFor(() => expect(getByText("Google")).toBeTruthy());
    fireEvent.press(getByLabelText("See all referrals"));

    expect(getByText("This pass")).toBeTruthy();
    expect(getByText("Skipped")).toBeTruthy(); // Snowflake's row
    expect(getByText("Pending")).toBeTruthy(); // Google's row

    // Jump back to Snowflake's card.
    fireEvent.press(getByText("Snowflake"));
    expect(getByText("Backend Engineer")).toBeTruthy();
  });

  it("bulk action submits every pending card (immediate mode) and reaches the recap", async () => {
    const onSubmitCard = jest.fn().mockResolvedValue(undefined);
    const { getByText, getByLabelText } = render(
      <CheckInStack
        {...baseProps}
        onSubmitCard={onSubmitCard}
        bulkAction={{
          label: (n) => `Mark ${n} remaining as still waiting`,
          stageIndex: 0,
        }}
      />,
    );
    fireEvent.press(getByLabelText("See all referrals"));
    await act(async () => {
      fireEvent.press(getByText("Mark 2 remaining as still waiting"));
    });

    expect(onSubmitCard).toHaveBeenCalledTimes(2);
    expect(onSubmitCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1" }),
      expect.objectContaining({ stageIndex: 0, terminal: false }),
    );
    await waitFor(() => expect(getByText("All caught up")).toBeTruthy());
    expect(getByText("2 updates sent.")).toBeTruthy();
  });

  it("skip never downgrades a card already updated this session", async () => {
    const { getByText, getByLabelText } = render(
      <CheckInStack {...baseProps} onSubmitCard={jest.fn().mockResolvedValue(undefined)} />,
    );
    // Update Snowflake to Offer.
    fireEvent.press(getByText("Offer"));
    await act(async () => {
      fireEvent.press(getByText("Send update"));
    });
    await waitFor(() => expect(getByText("Google")).toBeTruthy());
    // Jump back to the already-updated Snowflake and skip it.
    fireEvent.press(getByLabelText("See all referrals"));
    fireEvent.press(getByText("Snowflake"));
    fireEvent.press(getByText("Skip"));
    // Google still pending; finish it, then the recap must show Snowflake
    // as UPDATED (Offer), not skipped.
    await waitFor(() => expect(getByText("Google")).toBeTruthy());
    fireEvent.press(getByText("Hired"));
    await act(async () => {
      fireEvent.press(getByText("Send update"));
    });
    await waitFor(() => expect(getByText("All caught up")).toBeTruthy());
    expect(getByText("Offer")).toBeTruthy();
    expect(getByText("2 updates sent.")).toBeTruthy();
  });
});

describe("CheckInStack — accumulate mode (sponsor)", () => {
  it("collects answers and finalizes once from the recap", async () => {
    const onFinalize = jest.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <CheckInStack
        {...baseProps}
        terminalLabel="No Longer Active"
        onFinalize={onFinalize}
        finalizeLabel={(n) => `Send ${n} updates`}
      />,
    );

    fireEvent.press(getByText("Recruiter Screen"));
    await act(async () => {
      fireEvent.press(getByText("Send update"));
    });
    await waitFor(() => expect(getByText("Google")).toBeTruthy());
    fireEvent.press(getByText("No Longer Active"));
    await act(async () => {
      fireEvent.press(getByText("Send update"));
    });

    await waitFor(() => expect(getByText("Send 2 updates")).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText("Send 2 updates"));
    });

    expect(onFinalize).toHaveBeenCalledWith([
      { id: "r1", stageIndex: 1, terminal: false },
      { id: "r2", stageIndex: -1, terminal: true },
    ]);
    expect(baseProps.onDone).toHaveBeenCalled();
  });

  it("a failed finalize stays on the recap", async () => {
    const onFinalize = jest.fn().mockRejectedValue(new Error("500"));
    const { getByText } = render(
      <CheckInStack
        {...baseProps}
        items={[items[0]]}
        onFinalize={onFinalize}
        finalizeLabel={(n) => `Send ${n} updates`}
      />,
    );
    fireEvent.press(getByText("Offer"));
    await act(async () => {
      fireEvent.press(getByText("Send update"));
    });
    await waitFor(() => expect(getByText("Send 1 updates")).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText("Send 1 updates"));
    });
    expect(baseProps.onDone).not.toHaveBeenCalled();
    expect(getByText("All caught up")).toBeTruthy();
  });
});
