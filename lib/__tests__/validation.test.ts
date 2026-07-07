import {
    FIELD_LIMITS,
    cleanMultiline,
    cleanText,
    isValidEmail,
    isValidGpa,
    isValidPhone,
    isValidUrl,
    isValidYear,
    normalizeUrl,
    validateProfileField,
} from "../validation";

describe("cleanText", () => {
  it("trims and collapses whitespace runs", () => {
    expect(cleanText("  hello   world  ")).toBe("hello world");
    expect(cleanText("a\t\tb\n\nc")).toBe("a b c");
  });

  it("caps at the given max length", () => {
    expect(cleanText("abcdef", 3)).toBe("abc");
  });

  it("defaults to the generic 500-char cap", () => {
    expect(cleanText("x".repeat(600))).toHaveLength(FIELD_LIMITS.generic);
  });

  it("returns empty string for empty input", () => {
    expect(cleanText("")).toBe("");
  });
});

describe("cleanMultiline", () => {
  it("preserves single line breaks but collapses horizontal whitespace", () => {
    expect(cleanMultiline("line one\nline   two")).toBe("line one\nline two");
  });

  it("normalizes CRLF to LF", () => {
    expect(cleanMultiline("a\r\nb")).toBe("a\nb");
  });

  it("caps consecutive blank lines at one", () => {
    expect(cleanMultiline("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("strips spaces around line breaks", () => {
    expect(cleanMultiline("a   \n   b")).toBe("a\nb");
  });

  it("caps at the bio limit by default", () => {
    expect(cleanMultiline("x".repeat(2000))).toHaveLength(FIELD_LIMITS.bio);
  });
});

describe("isValidPhone", () => {
  it("accepts common formats", () => {
    expect(isValidPhone("555-867-5309")).toBe(true);
    expect(isValidPhone("+1 (415) 555-0100")).toBe(true);
    expect(isValidPhone("4155550100")).toBe(true);
  });

  it("rejects letters and junk characters", () => {
    expect(isValidPhone("call me maybe")).toBe(false);
    expect(isValidPhone("555-CALL")).toBe(false);
  });

  it("enforces 7-15 digit bounds", () => {
    expect(isValidPhone("123456")).toBe(false); // 6 digits
    expect(isValidPhone("1234567")).toBe(true); // 7 digits
    expect(isValidPhone("123456789012345")).toBe(true); // 15 digits
    expect(isValidPhone("1234567890123456")).toBe(false); // 16 digits
  });

  it("rejects empty input", () => {
    expect(isValidPhone("")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts normal addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("first.last+tag@sub.domain.co")).toBe(true);
  });

  it("rejects missing parts", () => {
    expect(isValidEmail("no-at-sign.com")).toBe(false);
    expect(isValidEmail("user@nodot")).toBe(false);
    expect(isValidEmail("user@domain.c")).toBe(false); // 1-char TLD
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects whitespace inside the address but tolerates padding", () => {
    expect(isValidEmail("  user@example.com  ")).toBe(true);
    expect(isValidEmail("us er@example.com")).toBe(false);
  });
});

describe("isValidUrl / normalizeUrl", () => {
  it("accepts bare domains, www, paths, and explicit protocols", () => {
    expect(isValidUrl("site.com")).toBe(true);
    expect(isValidUrl("www.site.com/portfolio")).toBe(true);
    expect(isValidUrl("https://site.com")).toBe(true);
  });

  it("rejects non-URLs", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });

  it("normalizeUrl prepends https:// only when missing", () => {
    expect(normalizeUrl("site.com")).toBe("https://site.com");
    expect(normalizeUrl("http://site.com")).toBe("http://site.com");
    expect(normalizeUrl("HTTPS://site.com")).toBe("HTTPS://site.com");
    expect(normalizeUrl("  ")).toBe("");
  });
});

describe("isValidYear", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-07T12:00:00Z"));
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it("accepts 1950 through current year + 10", () => {
    expect(isValidYear("1950")).toBe(true);
    expect(isValidYear("2026")).toBe(true);
    expect(isValidYear("2036")).toBe(true);
  });

  it("rejects out-of-range and non-4-digit input", () => {
    expect(isValidYear("1949")).toBe(false);
    expect(isValidYear("2037")).toBe(false);
    expect(isValidYear("95")).toBe(false);
    expect(isValidYear("20261")).toBe(false);
    expect(isValidYear("abcd")).toBe(false);
  });
});

describe("isValidGpa", () => {
  it("accepts 0-5 with up to two decimals", () => {
    expect(isValidGpa("3.8")).toBe(true);
    expect(isValidGpa("4")).toBe(true);
    expect(isValidGpa("5.0")).toBe(true);
    expect(isValidGpa("0")).toBe(true);
    expect(isValidGpa("3.85")).toBe(true);
  });

  it("rejects out-of-range and malformed values", () => {
    expect(isValidGpa("5.01")).toBe(false);
    expect(isValidGpa("3.855")).toBe(false); // three decimals
    expect(isValidGpa("-1")).toBe(false);
    expect(isValidGpa("10")).toBe(false); // two leading digits
    expect(isValidGpa("gpa")).toBe(false);
  });
});

describe("validateProfileField", () => {
  it("always allows empty values (fields are optional)", () => {
    for (const field of ["phone", "portfolio", "graduationYear", "gpa"]) {
      expect(validateProfileField(field, "")).toEqual({
        ok: true,
        cleaned: "",
      });
    }
  });

  it("rejects a non-empty invalid phone with a user-facing error", () => {
    const res = validateProfileField("phone", "not a phone");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/phone/i);
  });

  it("normalizes a valid portfolio URL to include a protocol", () => {
    const res = validateProfileField("portfolio", "  mysite.com  ");
    expect(res).toEqual({ ok: true, cleaned: "https://mysite.com" });
  });

  it("rejects an invalid portfolio URL", () => {
    expect(validateProfileField("portfolio", "not a url").ok).toBe(false);
  });

  it("cleans name fields to the name cap without validating content", () => {
    const res = validateProfileField("firstName", "  Sarah   Chen  ");
    expect(res).toEqual({ ok: true, cleaned: "Sarah Chen" });
    expect(
      validateProfileField("firstName", "x".repeat(100)).cleaned,
    ).toHaveLength(FIELD_LIMITS.name);
  });

  it("preserves line breaks in bio but not in single-line fields", () => {
    expect(validateProfileField("bio", "line1\n\nline2").cleaned).toBe(
      "line1\n\nline2",
    );
    expect(validateProfileField("company", "line1\nline2").cleaned).toBe(
      "line1 line2",
    );
  });

  it("falls back to the generic cleaner for unknown fields", () => {
    const res = validateProfileField("someFutureField", "  a   b  ");
    expect(res).toEqual({ ok: true, cleaned: "a b" });
  });
});
