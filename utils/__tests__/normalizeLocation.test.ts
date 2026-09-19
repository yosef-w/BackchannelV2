import { normalizeLocation } from "../normalizeLocation";

describe("normalizeLocation", () => {
  it("returns empty for empty or whitespace input", () => {
    expect(normalizeLocation("")).toBe("");
    expect(normalizeLocation("   ")).toBe("");
  });

  it("snaps a typed 'city, code' to the canonical list spelling", () => {
    expect(normalizeLocation("san francisco, ca")).toBe("San Francisco, CA");
    expect(normalizeLocation("  SAN FRANCISCO ,  CA ")).toBe("San Francisco, CA");
  });

  it("collapses Google's long state name to the code", () => {
    expect(normalizeLocation("San Francisco, California")).toBe(
      "San Francisco, CA",
    );
    expect(normalizeLocation("Portland, Oregon")).toBe("Portland, OR");
  });

  it("strips a trailing country", () => {
    expect(normalizeLocation("San Francisco, CA, USA")).toBe("San Francisco, CA");
    expect(normalizeLocation("Austin, TX, United States")).toBe("Austin, TX");
    expect(normalizeLocation("Austin USA")).toBe("Austin, TX");
  });

  it("peels a trailing state typed without a comma", () => {
    expect(normalizeLocation("san francisco ca")).toBe("San Francisco, CA");
    expect(normalizeLocation("portland oregon")).toBe("Portland, OR");
    expect(normalizeLocation("new york new york")).toBe("New York, NY");
    expect(normalizeLocation("salt lake city utah")).toBe("Salt Lake City, UT");
  });

  it("fills in the state for a bare city that exists in only one state", () => {
    expect(normalizeLocation("boise")).toBe("Boise, ID");
    expect(normalizeLocation("New York")).toBe("New York, NY");
    expect(normalizeLocation("san francisco")).toBe("San Francisco, CA");
  });

  it("does not guess a state for an ambiguous bare city", () => {
    // Springfield exists in five states in the list.
    expect(normalizeLocation("springfield")).toBe("Springfield");
    expect(normalizeLocation("springfield, il")).toBe("Springfield, IL");
  });

  it("expands common nicknames", () => {
    expect(normalizeLocation("SF")).toBe("San Francisco, CA");
    expect(normalizeLocation("san fran")).toBe("San Francisco, CA");
    expect(normalizeLocation("nyc")).toBe("New York, NY");
    expect(normalizeLocation("LA")).toBe("Los Angeles, CA");
    expect(normalizeLocation("philly")).toBe("Philadelphia, PA");
    expect(normalizeLocation("vegas")).toBe("Las Vegas, NV");
    expect(normalizeLocation("washington dc")).toBe("Washington, DC");
    expect(normalizeLocation("Washington, D.C.")).toBe("Washington, DC");
  });

  it("matches list entries with punctuation the user left out", () => {
    expect(normalizeLocation("st louis, mo")).toBe("St. Louis, MO");
    expect(normalizeLocation("mcallen tx")).toBe("McAllen, TX");
  });

  it("tidies an unknown city with a known state", () => {
    expect(normalizeLocation("smallville, ks")).toBe("Smallville, KS");
    expect(normalizeLocation("smallville kansas")).toBe("Smallville, KS");
  });

  it("recovers a misspelled state when the city is unambiguous", () => {
    expect(normalizeLocation("San Francisco, Calfornia")).toBe(
      "San Francisco, CA",
    );
  });

  it("keeps an unrecognized state for an unknown city rather than dropping it", () => {
    expect(normalizeLocation("Smallville, Calfornia")).toBe(
      "Smallville, Calfornia",
    );
  });

  it("caps runaway input at the location field limit", () => {
    expect(normalizeLocation("x".repeat(500)).length).toBeLessThanOrEqual(80);
  });
});
