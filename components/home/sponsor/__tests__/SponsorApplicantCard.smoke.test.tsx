import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { DecisionPills } from "../DecisionPills";
import { SponsorApplicantCard } from "../SponsorApplicantCard";
import type { ApplicantFacts, FitSummary, RoleContext } from "../model";

// lucide's ESM deep imports aren't transformed by jest — stub every icon,
// as the other smoke tests do.
jest.mock("@/components/ui/icons", () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub });
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

const ROLE: RoleContext = {
  jobId: "j1",
  title: "Senior Product Designer",
  company: "Northline",
  logoUrl: "https://logo.example/northline.png",
  salaryMin: 160000,
  salaryMax: 190000,
  salaryCurrency: "USD",
  remote: false,
  experienceLevel: "Senior",
  employmentType: "Full-time",
  skills: ["Figma", "Prototyping", "Design systems"],
};

const AMY: ApplicantFacts = {
  userId: "u1",
  name: "Amy Smith",
  firstName: "Amy",
  photoUrl: "https://img.example/amy.jpg",
  location: "New York, NY",
  currentTitle: "Product Design Lead",
  currentCompany: "Capital One",
  desiredRole: "Senior Product Designer",
  bio: "Designer who ships. Seven years building consumer finance products, most recently leading the card-servicing redesign at Capital One. I care about the boring details that make money feel calm.",
  bioSummary: "Designer who ships.",
  likedRole: true,
  likedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  years: 7,
  workPreferences: ["Hybrid", "Remote", "Full-time"],
  workStyle: "Hybrid · Remote",
  seeking: "Full-time",
  targetComp: { min: 150000, max: 175000, currency: "USD" },
  startAvailability: "2 weeks",
  level: "Senior IC",
  skills: ["Figma", "Prototyping", "User research"],
  experienceGroups: [
    {
      company: "Capital One",
      logoUrl: null,
      tenureLabel: null,
      roles: [
        {
          title: "Product Design Lead",
          employmentType: "Full-time",
          dateLabel: "Oct 2025 - Present · 11 mos",
          location: "New York, NY",
          description: "Leads card servicing.",
        },
      ],
    },
    {
      company: "The New York Times",
      logoUrl: null,
      tenureLabel: "5 yrs 4 mos",
      roles: [
        { title: "Senior Product Designer", employmentType: "Full-time", dateLabel: "Jan 2024 - Oct 2025 · 1 yr 10 mos", location: null, description: null },
        { title: "Product Designer", employmentType: null, dateLabel: "2020 - 2024", location: null, description: null },
      ],
    },
  ],
  education: [
    { school: "Parsons", degree: "B.F.A. Communication Design", years: "2012 - 2016", detail: null, logoUrl: null },
  ],
  achievements: [
    { title: "Grew activation 18%", detail: "Redesigned onboarding." },
    { title: "Webby honoree", detail: null },
  ],
  prompts: [
    { question: "Known for", answer: "Making the hard thing feel obvious." },
    { question: "Best coffee order", answer: "Cortado, no sugar." },
  ],
  enriched: true,
};

const FIT: FitSummary = {
  rows: [
    { key: "comp", label: "Comp", applicantValue: "$150–175K", roleValue: "$160–190K", status: "match" },
    { key: "workStyle", label: "Work style", applicantValue: "Hybrid · Remote", roleValue: "Hybrid", status: "match" },
    { key: "experience", label: "Experience", applicantValue: "7 yrs", roleValue: "6+ yrs", status: "match" },
    { key: "level", label: "Level", applicantValue: "Senior IC", roleValue: "Lead", status: "stretch" },
  ],
  matched: 3,
  total: 4,
  strength: "strong",
  headline: "Three of four line up with what you posted.",
  stretchNote: "Level · a step up for Amy",
};

const SPARSE: ApplicantFacts = {
  userId: "u2",
  name: "Sam",
  firstName: "Sam",
  photoUrl: null,
  location: null,
  currentTitle: null,
  currentCompany: null,
  desiredRole: null,
  bio: null,
  bioSummary: null,
  likedRole: false,
  likedAt: null,
  years: null,
  workPreferences: [],
  workStyle: null,
  seeking: null,
  targetComp: null,
  startAvailability: null,
  level: null,
  skills: [],
  experienceGroups: [],
  education: [],
  achievements: [],
  prompts: [],
  enriched: false,
};

const EMPTY_FIT: FitSummary = {
  rows: [],
  matched: 0,
  total: 0,
  strength: null,
  headline: null,
  stretchNote: null,
};

function allText(json: ReturnType<ReturnType<typeof render>["toJSON"]>): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (node == null) return;
    if (typeof node === "string") return void out.push(node);
    if (Array.isArray(node)) return node.forEach(walk);
    const n = node as { children?: unknown };
    walk(n.children);
  };
  walk(json);
  return out.join(" | ");
}

describe("SponsorApplicantCard", () => {
  it("hero: role row, strong-match pill, identity and sections", () => {
    const r = render(<SponsorApplicantCard facts={AMY} role={ROLE} fit={FIT} layout="hero" />);
    expect(r.getByText("STRONG MATCH")).toBeTruthy();
    expect(r.getByText("INTERESTED IN YOUR ROLE")).toBeTruthy();
    expect(r.getByText("Amy Smith")).toBeTruthy();
    // Section eyebrow + the hero stat label.
    expect(r.getAllByText("EXPERIENCE").length).toBeGreaterThan(0);
    expect(r.getByText("The New York Times")).toBeTruthy();
    expect(r.getByText("ACHIEVEMENTS")).toBeTruthy();
    expect(r.getByText("MORE ABOUT AMY")).toBeTruthy();
    // Proposal 1 goes straight from the photo card to EXPERIENCE — the
    // card's bio summary stands in for About.
    expect(r.queryByText("ABOUT AMY")).toBeNull();
    // The report link closes every layout.
    expect(r.queryByText("Report Amy")).toBeNull(); // no onReport passed
  });

  it("connector: 'Amy wants your role.' with the stats card", () => {
    const r = render(<SponsorApplicantCard facts={AMY} role={ROLE} fit={FIT} layout="connector" />);
    expect(r.getByText(/Amy wants/)).toBeTruthy();
    expect(r.getByText("your role.")).toBeTruthy();
    expect(r.getByText(/^INTERESTED/)).toBeTruthy();
    expect(r.getByText("MORE ABOUT AMY")).toBeTruthy();
  });

  it("fit: header, fit table columns and stretch note", () => {
    const r = render(
      <SponsorApplicantCard facts={AMY} role={ROLE} fit={FIT} layout="fit" onViewProfile={() => {}} />,
    );
    // Column heads are hidden from screen readers (each row reads as a
    // sentence), so query them with hidden elements included.
    expect(r.getByText("YOUR ROLE", { includeHiddenElements: true })).toBeTruthy();
    expect(r.getByText("AMY", { includeHiddenElements: true })).toBeTruthy();
    expect(r.getByText("$150–175K")).toBeTruthy();
    expect(r.getByText("LEVEL · A STEP UP FOR AMY")).toBeTruthy();
    expect(r.getByText("View profile")).toBeTruthy();
    expect(r.getByLabelText("Comp: Amy $150–175K, your role $160–190K, matches")).toBeTruthy();
  });

  it("falls back to the hero when there is no role", () => {
    const r = render(<SponsorApplicantCard facts={AMY} role={null} fit={FIT} layout="fit" />);
    expect(r.queryByText("YOUR ROLE", { includeHiddenElements: true })).toBeNull();
    expect(r.getByText("STRONG MATCH")).toBeTruthy();
  });

  it.each(["hero", "connector", "fit"] as const)(
    "sparse applicant (%s): omits empty sections, never renders placeholders",
    (layout) => {
      const r = render(<SponsorApplicantCard facts={SPARSE} role={ROLE} fit={EMPTY_FIT} layout={layout} />);
      expect(r.queryByText("STRONG MATCH")).toBeNull();
      expect(r.queryByText("YOUR ROLE", { includeHiddenElements: true })).toBeNull();
      expect(r.queryByText("ACHIEVEMENTS")).toBeNull();
      expect(r.queryByText("EXPERIENCE")).toBeNull();
      expect(r.queryByText("SKILLS")).toBeNull();
      expect(r.queryByText(/^MORE ABOUT/)).toBeNull();
      expect(r.queryByText(/^ABOUT/)).toBeNull();
      const text = allText(r.toJSON());
      expect(text).not.toMatch(/N\/A|undefined|null|NaN/);
      if (layout === "hero") expect(r.getByText("SUGGESTED FOR YOUR ROLE")).toBeTruthy();
      if (layout === "connector") expect(r.getByText("SUGGESTED FOR YOU")).toBeTruthy();
    },
  );
});

describe("DecisionPills", () => {
  it("calls onPass / onAccept", () => {
    const onPass = jest.fn();
    const onAccept = jest.fn();
    const r = render(<DecisionPills acceptLabel="Connect" onPass={onPass} onAccept={onAccept} />);
    fireEvent.press(r.getByLabelText("Pass"));
    fireEvent.press(r.getByLabelText("Connect"));
    expect(onPass).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", () => {
    const onPass = jest.fn();
    const r = render(<DecisionPills acceptLabel="Connect" onPass={onPass} onAccept={() => {}} disabled />);
    fireEvent.press(r.getByLabelText("Pass"));
    expect(onPass).not.toHaveBeenCalled();
  });
});
