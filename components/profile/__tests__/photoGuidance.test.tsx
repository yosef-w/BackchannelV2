/**
 * Photo-upload guidance:
 *   1. PhotoFramingGuide tells people how sponsors see the photo, before they
 *      crop — one accessible summary, the diagram hidden from screen readers
 *   2. PhotoSponsorPreview renders the REAL hero card from the picked photo —
 *      their name, nothing invented (no title/company/city they haven't given)
 *   3. the sponsor card accepts a fixed photo height + tail for the profile
 *      PREVIEW, which has no floating buttons to measure against
 */

import { render } from "@testing-library/react-native";
import React from "react";
import { SponsorApplicantCard } from "@/components/home/sponsor";
import { buildApplicantFacts, buildFitSummary } from "@/components/home/sponsor";
import { PhotoFramingGuide, PHOTO_GUIDE_TEXT } from "../PhotoFramingGuide";
import { PhotoSponsorPreview } from "../PhotoSponsorPreview";

// lucide ships ES modules Jest can't parse; the icons add nothing here.
jest.mock("@/components/ui/icons", () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub });
});

describe("PhotoFramingGuide", () => {
  it("states how sponsors see the photo, with one accessible summary", () => {
    const r = render(<PhotoFramingGuide />);
    expect(r.getByText("HOW SPONSORS SEE YOUR PHOTO")).toBeTruthy();
    expect(r.getByText(PHOTO_GUIDE_TEXT)).toBeTruthy();
    expect(
      r.getByLabelText(`How sponsors see your photo. ${PHOTO_GUIDE_TEXT}`),
    ).toBeTruthy();
  });

  it("tells them where the face goes and that the name sits at the bottom", () => {
    expect(PHOTO_GUIDE_TEXT).toMatch(/upper middle/i);
    expect(PHOTO_GUIDE_TEXT).toMatch(/name/i);
  });
});

describe("PhotoSponsorPreview", () => {
  it("renders the real card from the picked photo and the person's name", () => {
    const r = render(
      <PhotoSponsorPreview uri="file:///tmp/me.jpg" name="  Priya Raghunathan " />,
    );
    expect(r.getByText("HOW SPONSORS WILL SEE YOU")).toBeTruthy();
    expect(r.getByText("Priya Raghunathan")).toBeTruthy();
    expect(r.getByText(/Tap Change photo/)).toBeTruthy();
  });

  it("invents nothing it doesn't know (no title, company or city)", () => {
    const r = render(<PhotoSponsorPreview uri="file:///tmp/me.jpg" name="Priya Raghunathan" />);
    // No visible text says undefined/null, and the subline (title · company ·
    // city) is absent because none of them were provided.
    expect(r.queryByText(/undefined|null/)).toBeNull();
    expect(r.queryByText(/·/)).toBeNull();
  });

  it("shows a known city when given one", () => {
    const r = render(
      <PhotoSponsorPreview uri="file:///tmp/me.jpg" name="Priya R" location="Dallas, TX" />,
    );
    expect(r.getByText("Dallas, TX")).toBeTruthy();
  });
});

describe("SponsorApplicantCard overrides (profile PREVIEW)", () => {
  const facts = buildApplicantFacts(
    {
      id: "me",
      USER_ID: "me",
      name: "Priya Raghunathan",
      location: "Dallas, TX",
      skills: [],
      desiredRole: "",
      bio: "",
      prompts: [],
      image: "file:///tmp/me.jpg",
      company: "",
    },
    null,
  );

  it("honours a fixed photo height and a shorter tail", () => {
    const r = render(
      <SponsorApplicantCard
        facts={facts}
        role={null}
        fit={buildFitSummary(facts, null)}
        layout="hero"
        photoHeight={333}
        tail={20}
      />,
    );
    const flat = JSON.stringify(r.toJSON());
    expect(flat).toContain('"minHeight":333');
    // The tail spacer's style is [default 140, override 20] — the override wins.
    expect(flat).toContain('[{"height":140},{"height":20}]');
  });
});
