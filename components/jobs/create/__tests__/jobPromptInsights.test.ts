import {
  EMPTY_JOB_INSIGHTS,
  promptAnswersToInsights,
} from "../jobPromptInsights";

describe("promptAnswersToInsights", () => {
  it("returns all-empty insights for no answers", () => {
    expect(promptAnswersToInsights([])).toEqual(EMPTY_JOB_INSIGHTS);
  });

  it("stores an answer under its category's backend key as 'PROMPT — answer'", () => {
    const result = promptAnswersToInsights([
      { question: "A TYPICAL WEEK HERE", answer: "Two sprints, demo Friday" },
    ]);
    expect(result.dayToDay).toBe(
      "A TYPICAL WEEK HERE — Two sprints, demo Friday",
    );
    expect(result.teamCulture).toBe("");
    expect(result.idealCandidate).toBe("");
    expect(result.insiderInsights).toBe("");
  });

  it("routes each category to its own key", () => {
    const result = promptAnswersToInsights([
      { question: "THE MANAGER'S STYLE", answer: "Hands-off" },
      { question: "YOU'LL STRUGGLE HERE IF", answer: "You need structure" },
      { question: "THE COMP CONVERSATION", answer: "Bands are public" },
    ]);
    expect(result.teamCulture).toBe("THE MANAGER'S STYLE — Hands-off");
    expect(result.idealCandidate).toBe(
      "YOU'LL STRUGGLE HERE IF — You need structure",
    );
    expect(result.insiderInsights).toBe(
      "THE COMP CONVERSATION — Bands are public",
    );
  });

  it("newline-joins multiple answers in the same category, preserving order", () => {
    const result = promptAnswersToInsights([
      { question: "A TYPICAL WEEK HERE", answer: "Sprints" },
      { question: "THE PACE OF THIS TEAM", answer: "Fast but sane" },
    ]);
    expect(result.dayToDay).toBe(
      "A TYPICAL WEEK HERE — Sprints\n\nTHE PACE OF THIS TEAM — Fast but sane",
    );
  });

  it("skips blank answers", () => {
    const result = promptAnswersToInsights([
      { question: "A TYPICAL WEEK HERE", answer: "   " },
    ]);
    expect(result).toEqual(EMPTY_JOB_INSIGHTS);
  });

  it("trims answer whitespace", () => {
    const result = promptAnswersToInsights([
      { question: "GROWTH FROM THIS ROLE", answer: "  Fast promotions  " },
    ]);
    expect(result.insiderInsights).toBe(
      "GROWTH FROM THIS ROLE — Fast promotions",
    );
  });

  it("routes unknown prompts to insiderInsights instead of dropping them", () => {
    const result = promptAnswersToInsights([
      { question: "A PROMPT WE REMOVED FROM THE CATALOG", answer: "Still ships" },
    ]);
    expect(result.insiderInsights).toBe(
      "A PROMPT WE REMOVED FROM THE CATALOG — Still ships",
    );
  });
});
