jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  withScope: jest.fn(),
  captureMessage: jest.fn(),
  wrap: jest.fn((x) => x),
  addBreadcrumb: jest.fn(),
}));

import { redactPii } from "../sentry";

describe("redactPii", () => {
  it("redacts a bare email address", () => {
    expect(redactPii("no account for jane.doe@example.com")).toBe(
      "no account for [redacted-email]",
    );
  });

  it("redacts multiple emails in one string", () => {
    expect(redactPii("a@b.com and c@d.org both failed")).toBe(
      "[redacted-email] and [redacted-email] both failed",
    );
  });

  it("leaves ordinary error text untouched", () => {
    expect(redactPii("Internal Server Error")).toBe("Internal Server Error");
  });

  it("is case-insensitive", () => {
    expect(redactPii("contact ADMIN@EXAMPLE.COM")).toBe(
      "contact [redacted-email]",
    );
  });
});
