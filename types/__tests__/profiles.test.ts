import type { ProfilePackRow } from "../profiles";
import {
    transformProfilePackRow,
    transformProfilePackRows,
} from "../profiles";

// A realistic GET /api/profiles/pack/ row (uppercase Postgres-adapter
// columns; SKILLS/POSITIONS/INSIGHTS arrive as JSON-encoded strings).
const row: ProfilePackRow = {
  USER_ID: "user-1",
  FIRST_NAME: "Sarah",
  LAST_NAME: "Chen",
  LOCATION: "Brooklyn, NY",
  SKILLS: '["Python", "dbt"]',
  POSITIONS: '["Data Engineer", "Analytics Engineer"]',
  BIO: "Data person.",
  INSIGHTS: '[{"question": "Fun fact?", "answer": "I bake."}]',
  PHOTO_URL: "https://cdn/x.jpg",
  HAS_LIKED_JOB: true,
};

describe("transformProfilePackRow", () => {
  it("maps a pack row into the deck-card shape", () => {
    const card = transformProfilePackRow(row);
    expect(card.id).toBe("user-1");
    expect(card.name).toBe("Sarah Chen");
    expect(card.location).toBe("Brooklyn, NY");
    expect(card.skills).toEqual(["Python", "dbt"]);
    expect(card.desiredRole).toBe("Data Engineer");
    expect(card.bio).toBe("Data person.");
    expect(card.prompts).toEqual([
      { question: "Fun fact?", answer: "I bake." },
    ]);
    expect(card.image).toBe("https://cdn/x.jpg");
    expect(card.company).toBe("");
  });

  it("keeps the original raw fields (HAS_LIKED_JOB drives the liked overlay)", () => {
    const card = transformProfilePackRow(row);
    expect(card.USER_ID).toBe("user-1");
    expect(card.HAS_LIKED_JOB).toBe(true);
  });

  it("accepts already-parsed arrays as well as JSON strings", () => {
    const card = transformProfilePackRow({
      ...row,
      SKILLS: ["Go", "Rust"],
      POSITIONS: ["Backend"],
    });
    expect(card.skills).toEqual(["Go", "Rust"]);
    expect(card.desiredRole).toBe("Backend");
  });

  it("degrades gracefully on missing/malformed fields", () => {
    const card = transformProfilePackRow({
      USER_ID: "user-2",
      SKILLS: "not json",
      POSITIONS: null,
      INSIGHTS: undefined,
    } as unknown as ProfilePackRow);
    expect(card.name).toBe("");
    expect(card.skills).toEqual([]);
    expect(card.prompts).toEqual([]);
    expect(card.desiredRole).toBe("Open to opportunities");
    expect(card.bio).toBe("Looking for new opportunities");
    expect(card.image).toBe("");
  });

  it("falls back from BIO to REASON before the default copy", () => {
    const card = transformProfilePackRow({
      ...row,
      BIO: null,
      REASON: "Referred by a friend",
    });
    expect(card.bio).toBe("Referred by a friend");
  });

  it("trims half-missing names instead of leaving stray spaces", () => {
    expect(
      transformProfilePackRow({ ...row, LAST_NAME: null }).name,
    ).toBe("Sarah");
  });
});

describe("transformProfilePackRows", () => {
  it("maps arrays and tolerates null/undefined input", () => {
    expect(transformProfilePackRows([row])).toHaveLength(1);
    expect(
      transformProfilePackRows(null as unknown as ProfilePackRow[]),
    ).toEqual([]);
  });
});
