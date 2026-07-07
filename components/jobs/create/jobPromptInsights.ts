// Serializes Hinge-style job prompt answers into the backend's fixed
// insights object. The API contract for createJobFromUrl expects exactly
// { dayToDay, teamCulture, idealCandidate, insiderInsights } — prompts are a
// pure client-side presentation, so each answer is stored under its
// category's insightKey as "PROMPT — answer", newline-joined when a sponsor
// answers multiple prompts in the same category.

import {
  JOB_PROMPT_CATEGORIES,
  type JobInsightKey,
} from "@/constants/prompts";
import type { PromptAnswer } from "@/components/ui/PromptsIntake";

export type JobInsights = Record<JobInsightKey, string>;

const PROMPT_TO_KEY: Record<string, JobInsightKey> = Object.fromEntries(
  JOB_PROMPT_CATEGORIES.flatMap((cat) =>
    cat.prompts.map((p) => [p, cat.insightKey] as const),
  ),
);

export const EMPTY_JOB_INSIGHTS: JobInsights = {
  dayToDay: "",
  teamCulture: "",
  idealCandidate: "",
  insiderInsights: "",
};

export function promptAnswersToInsights(answers: PromptAnswer[]): JobInsights {
  const out: JobInsights = { ...EMPTY_JOB_INSIGHTS };
  for (const { question, answer } of answers) {
    const trimmed = answer.trim();
    if (!trimmed) continue;
    // Unknown prompts (catalog drift) still ship rather than silently drop —
    // insiderInsights is the catch-all field.
    const key = PROMPT_TO_KEY[question] ?? "insiderInsights";
    const entry = `${question} — ${trimmed}`;
    out[key] = out[key] ? `${out[key]}\n\n${entry}` : entry;
  }
  return out;
}
