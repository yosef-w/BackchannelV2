import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { AccountSideCard } from "../AccountSideCard";
import { SideSwitcherSheet } from "../SideSwitcherSheet";

// lucide's ESM deep imports aren't transformed by jest — stub every icon,
// as the other smoke tests do.
jest.mock("@/components/ui/icons", () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub });
});

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

// The real sheet wraps its children in a gesture root that needs a native
// module jest doesn't have; the drag-to-dismiss isn't what's under test.
jest.mock("@/components/ui/DismissibleSheet", () => {
  const { View } = jest.requireActual("react-native");
  return {
    DismissibleSheet: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock("expo-blur", () => {
  const { View } = jest.requireActual("react-native");
  return { BlurView: View };
});

describe("AccountSideCard", () => {
  it("invites a sponsor to add a job search, naming who can't see it", () => {
    const onAdd = jest.fn();
    const { getByText } = render(
      <AccountSideCard
        roles={["Sponsor"]}
        activeRole="Sponsor"
        company="Meridian Health"
        canAdd
        onSwitch={jest.fn()}
        onAdd={onAdd}
      />,
    );
    expect(getByText(/Nobody at Meridian Health will see it/)).toBeTruthy();
    fireEvent.press(getByText("Set it up"));
    expect(onAdd).toHaveBeenCalledWith("Applicant");
  });

  it("never offers an applicant a sponsor side", () => {
    const { queryByText, toJSON } = render(
      <AccountSideCard
        roles={["Applicant"]}
        activeRole="Applicant"
        canAdd
        onSwitch={jest.fn()}
        onAdd={jest.fn()}
      />,
    );
    expect(queryByText(/sponsor/i)).toBeNull();
    expect(toJSON()).toBeNull();
  });

  it("makes no offer when adding a side can't work yet", () => {
    const { queryByText } = render(
      <AccountSideCard
        roles={["Sponsor"]}
        activeRole="Sponsor"
        canAdd={false}
        onSwitch={jest.fn()}
        onAdd={jest.fn()}
      />,
    );
    expect(queryByText("Set it up")).toBeNull();
  });

  it("switches between two held sides, ignoring a tap on the active one", () => {
    const onSwitch = jest.fn();
    const { getByText } = render(
      <AccountSideCard
        roles={["Sponsor", "Applicant"]}
        activeRole="Sponsor"
        canAdd
        onSwitch={onSwitch}
        onAdd={jest.fn()}
      />,
    );
    fireEvent.press(getByText("SPONSOR"));
    expect(onSwitch).not.toHaveBeenCalled();
    fireEvent.press(getByText("JOB SEARCH"));
    expect(onSwitch).toHaveBeenCalledWith("Applicant");
  });
});

describe("SideSwitcherSheet", () => {
  it("lists both sides and switches to the other", () => {
    const onSwitch = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <SideSwitcherSheet
        visible
        roles={["Sponsor", "Applicant"]}
        activeRole="Applicant"
        company="Meridian Health"
        onSwitch={onSwitch}
        onClose={onClose}
      />,
    );
    expect(getByText(/Meridian Health can't see your job search/)).toBeTruthy();
    fireEvent.press(getByText("Job search"));
    expect(onSwitch).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    fireEvent.press(getByText("Sponsor at Meridian Health"));
    expect(onSwitch).toHaveBeenCalledWith("Sponsor");
  });

  it("shows what's waiting on the other side when the server can say", () => {
    const { getByText, queryByText } = render(
      <SideSwitcherSheet
        visible
        roles={["Sponsor", "Applicant"]}
        activeRole="Applicant"
        company="Meridian Health"
        summaries={{
          Sponsor: { newInterest: 3, newMatches: 0, unreadMessages: 2, referralUpdates: 0 },
        }}
        onSwitch={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText("3 new applicants · 2 unread messages")).toBeTruthy();
    expect(getByText("5")).toBeTruthy();
    // No summary for the job search: it falls back to what the side is for.
    expect(getByText("Find your own next role")).toBeTruthy();
    expect(queryByText("Refer people into roles at your company")).toBeNull();
  });
});
