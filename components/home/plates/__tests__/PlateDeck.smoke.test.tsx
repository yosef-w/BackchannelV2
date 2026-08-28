import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { PlateView } from "../PlateViews";
import { PlateDeck } from "../PlateDeck";
import { buildApplicantPlates, buildJobPlates, deriveAnchor, type Plate } from "../plateContent";
import type { Job } from "@/types/jobs";
import type { ProfileDeckCard } from "@/types/profiles";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
}));

const CARD: ProfileDeckCard = {
  id: "u1", USER_ID: "u1", name: "Jordan Okafor", location: "Chicago, IL",
  skills: ["Go"], desiredRole: "Staff Engineer", bio: "Six years of platform work.",
  prompts: [{ question: "Known for", answer: "Calm under fire." }], image: "", company: "",
};
const JOB: Job = {
  id: "j1", title: "Staff Platform Engineer", company: "Northline", location: "Remote", locations: [],
  type: "Full-time", salary: "$210k", salaryMin: null, salaryMax: null, salaryCurrency: null, postedAt: "",
  description: "", summary: "", skills: ["Go"], highlights: [], experienceLevel: "Senior",
  workArrangement: "Remote", isRemote: true, url: "", applicants: 3, image: "", currentSponsors: [],
  benefits: [], isSponsored: true, sponsorInfo: { name: "Dana Whitfield", role: "VP Eng", image: "", canRefer: true, userId: "s1" },
};

describe("PlateView", () => {
  it("renders every plate kind without throwing", () => {
    const plates: Plate[] = [
      ...buildApplicantPlates(CARD, null),
      ...buildJobPlates(JOB, { bio: "", insights: [{ question: "Why", answer: "Ships." }], companiesCanReferTo: [], verified: true }),
    ];
    expect(new Set(plates.map((p) => p.kind))).toEqual(
      new Set(["placard", "voice", "fit", "role", "needs", "vouch"]),
    );
    for (const plate of plates) {
      const { unmount } = render(
        <PlateView plate={plate} width={360} height={500} underAnchor={false} onTapZone={() => {}} />,
      );
      unmount();
    }
  });

  it("shows the derived claim and the fit line", () => {
    const plates = buildApplicantPlates(CARD, null, { roleTitle: "Platform Lead", roleSkills: ["Go"] });
    const { getByText } = render(
      <PlateView plate={plates[0]} width={360} height={500} underAnchor={false} onTapZone={() => {}} />,
    );
    expect(getByText("Jordan Okafor")).toBeTruthy();
    const fit = plates[plates.length - 1];
    const r = render(
      <PlateView plate={fit} width={360} height={500} underAnchor onTapZone={() => {}} />,
    );
    expect(r.getByText("WHY YOU'RE SEEING THEM")).toBeTruthy();
  });
});

describe("PlateDeck", () => {
  it("mounts with the full read as children and reports plate count", () => {
    const plates = buildApplicantPlates(CARD, null);
    const onPlateChange = jest.fn();
    const scrollY = { value: 0 } as never;
    const { getByText } = render(
      <PlateDeck
        plates={plates}
        anchor={deriveAnchor(plates)}
        scrollRef={React.createRef()}
        onScroll={undefined}
        scrollY={scrollY}
        bleed={24}
        onPlateChange={onPlateChange}
      >
        <Text>READ BODY</Text>
      </PlateDeck>,
    );
    expect(getByText("THE FULL READ")).toBeTruthy();
    expect(getByText("READ BODY")).toBeTruthy();
    expect(getByText("THE FULL READ ↓")).toBeTruthy();
    expect(onPlateChange).toHaveBeenCalledWith(0, plates.length);
  });
});
