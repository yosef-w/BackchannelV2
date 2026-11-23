import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { JobBriefCard } from "../JobBriefCard";
import type { JobFacts } from "../jobFacts";

// lucide's ESM deep imports aren't transformed by jest — stub every icon,
// as the other smoke tests do.
jest.mock("@/components/ui/icons", () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub });
});

const FACTS: JobFacts = {
  id: "7",
  title: "Senior Product Designer",
  company: "Meridian Health",
  logoUrl: "",
  subline: "Meridian Health · Hybrid · Austin",
  brief: "Lead design for the scheduling app.",
  sponsor: {
    name: "Dana Okafor",
    firstName: "Dana",
    detail: "Design Manager · 4 years here",
    image: "",
    canRefer: true,
    verified: true,
    userId: "12",
  },
  unsponsored: false,
  ledger: [
    { label: "Salary", value: "$145–170k" },
    { label: "Your fit", value: "2 of 3 skills" },
  ],
  skillsMatched: ["Figma", "Design systems"],
  skillsOther: ["Healthcare"],
  needs: ["5+ years in product design"],
  quote: { question: "Why here?", answer: "Small team." },
  moreQuotes: [],
  insights: [],
  perks: ["Equity", "401(k) match"],
  fullRead: [{ label: "About the role", text: "The long description." }],
  companyDescription: "",
  sourceUrl: "",
};

describe("JobBriefCard", () => {
  it("leads with the role and the way in, and keeps the long read closed", () => {
    const { getByText, queryByText } = render(<JobBriefCard facts={FACTS} stageHeight={700} />);
    expect(getByText("Senior Product Designer")).toBeTruthy();
    expect(getByText("Dana can refer you")).toBeTruthy();
    expect(getByText("YOUR FIT · 2 OF 3 SKILLS")).toBeTruthy();
    expect(getByText("5+ years in product design")).toBeTruthy();
    expect(queryByText("The long description.")).toBeNull();

    fireEvent.press(getByText("Full job description"));
    expect(getByText("The long description.")).toBeTruthy();
  });

  it("says so when nobody has sponsored the role yet", () => {
    const { getByText, queryByText } = render(
      <JobBriefCard
        facts={{ ...FACTS, sponsor: null, unsponsored: true, quote: null }}
        statusLabel="WAITLISTED"
      />,
    );
    expect(getByText("No sponsor yet")).toBeTruthy();
    expect(getByText("WAITLISTED")).toBeTruthy();
    expect(queryByText("YOUR WAY IN")).toBeNull();
    expect(queryByText("From Dana")).toBeNull();
  });
});
