/**
 * HeroLedger — the hero opening's decisive numbers, on paper under the photo:
 *   1. labels render as spaced caps, values as given
 *   2. no cells → nothing renders (DATA HONESTY RULE: no empty frame)
 *   3. at most four cells; two per row
 *   4. one accessible summary for the whole ledger
 */

import { render } from "@testing-library/react-native";
import React from "react";
import { HeroLedger } from "../HeroLedger";

const CELLS = [
  { label: "Experience", value: "8 years" },
  { label: "Work style", value: "Hybrid / Remote / On-site" },
  { label: "Seeking", value: "Full-time" },
  { label: "Location", value: "Dallas, TX" },
];

describe("HeroLedger", () => {
  it("renders caps labels and the values", () => {
    const r = render(<HeroLedger cells={CELLS} />);
    expect(r.getByText("EXPERIENCE")).toBeTruthy();
    expect(r.getByText("WORK STYLE")).toBeTruthy();
    expect(r.getByText("8 years")).toBeTruthy();
    expect(r.getByText("Hybrid / Remote / On-site")).toBeTruthy();
  });

  it("renders nothing without cells", () => {
    const r = render(<HeroLedger cells={[]} />);
    expect(r.toJSON()).toBeNull();
  });

  it("shows at most four cells", () => {
    const r = render(
      <HeroLedger cells={[...CELLS, { label: "Extra", value: "Nope" }]} />,
    );
    expect(r.queryByText("EXTRA")).toBeNull();
    expect(r.getAllByText(/^[A-Z ]+$/).length).toBe(4);
  });

  it("exposes one accessible summary", () => {
    const r = render(<HeroLedger cells={CELLS} />);
    expect(
      r.getByLabelText(
        "Experience: 8 years. Work style: Hybrid / Remote / On-site. Seeking: Full-time. Location: Dallas, TX",
      ),
    ).toBeTruthy();
  });
});
