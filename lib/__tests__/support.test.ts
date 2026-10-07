import { buildSupportMailto } from "../support";

describe("buildSupportMailto", () => {
  const base = { appVersion: "1.0.0", os: "iOS", osVersion: "18.2" };

  it("addresses the support inbox with a topic-specific subject", () => {
    const url = buildSupportMailto({ ...base, topic: "problem" });
    expect(url.startsWith("mailto:support@backchannel.app?subject=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("something's not working");
  });

  it("pre-fills a diagnostic footer the user can see and edit", () => {
    const body = decodeURIComponent(buildSupportMailto(base).split("&body=")[1]);
    expect(body).toContain("App version: 1.0.0");
    expect(body).toContain("Device: iOS 18.2");
  });

  it("includes the account id only when known", () => {
    const withId = decodeURIComponent(buildSupportMailto({ ...base, userId: "u_42" }));
    const without = decodeURIComponent(buildSupportMailto(base));
    expect(withId).toContain("Account ID: u_42");
    expect(without).not.toContain("Account ID");
  });

  it("URL-encodes everything (spaces, newlines, apostrophes)", () => {
    const url = buildSupportMailto(base);
    expect(url).not.toMatch(/\s/);
    expect(url).toContain("%0A");
  });
});
