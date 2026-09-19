import { Linking } from "react-native";
import { openExternalUrl } from "../openExternalUrl";

jest.mock("react-native", () => ({
  Linking: { openURL: jest.fn().mockResolvedValue(undefined) },
}));

describe("openExternalUrl", () => {
  beforeEach(() => {
    (Linking.openURL as jest.Mock).mockClear();
  });

  it("opens a plain https URL", () => {
    openExternalUrl("https://example.com/job/123");
    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com/job/123");
  });

  it("opens a plain http URL", () => {
    openExternalUrl("http://example.com");
    expect(Linking.openURL).toHaveBeenCalledWith("http://example.com");
  });

  it("trims whitespace before checking the scheme", () => {
    openExternalUrl("  https://example.com  ");
    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com");
  });

  it("is case-insensitive on the scheme", () => {
    openExternalUrl("HTTPS://example.com");
    expect(Linking.openURL).toHaveBeenCalled();
  });

  it.each([
    "javascript:alert(1)",
    "intent://evil.app/#Intent;scheme=https;end",
    "tel:+15555555555",
    "itms-apps://apps.apple.com/app/id123",
    "file:///etc/passwd",
    "mailto:someone@example.com",
    "backchannelv2://verify-email?token=x",
  ])("refuses a non-http(s) scheme: %s", (url) => {
    openExternalUrl(url);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it("does nothing for empty, whitespace-only, or missing input", () => {
    openExternalUrl("");
    openExternalUrl("   ");
    openExternalUrl(null);
    openExternalUrl(undefined);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
