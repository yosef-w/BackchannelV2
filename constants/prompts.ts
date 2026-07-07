// Profile "prompts" (personality intake) — categorized for the Hinge-style
// prompt library. Shared by the applicant + sponsor signup steps (and available
// to ProfileView's edit-insights later). Prompt strings are the canonical keys
// stored on the profile as { question, answer }, so keep them stable.

export interface PromptCategory {
  title: string;
  prompts: string[];
}

// ── Applicant ──────────────────────────────────────────────────────────────
export const APPLICANT_PROMPT_CATEGORIES: PromptCategory[] = [
  {
    title: "Working style",
    prompts: [
      "MY WORK STYLE",
      "WHAT ENERGIZES ME",
      "MY FAVORITE BRAINSTORMING FUEL",
    ],
  },
  {
    title: "What I bring",
    prompts: [
      "MY SECRET SUPERPOWER",
      "I'M BEST KNOWN FOR",
      "THE PROJECT I'M MOST PROUD OF",
      "MY DESIGN PHILOSOPHY",
    ],
  },
  {
    title: "What I value",
    prompts: [
      "WHAT I LOOK FOR IN A TEAM",
      "WHY I CHOSE THIS CAREER",
      "THE BEST ADVICE I'VE RECEIVED",
      "MY UNPOPULAR OPINION",
    ],
  },
  {
    title: "Fun & personal",
    prompts: [
      "IF I WASN'T IN TECH",
      "HOW I RECHARGE",
      "WHAT I'M LEARNING RIGHT NOW",
      "ONE THING THAT SURPRISED ME",
    ],
  },
];

export const APPLICANT_PROMPT_EXAMPLES: Record<string, string> = {
  "MY SECRET SUPERPOWER": "e.g., Turning fuzzy ideas into a shippable plan",
  "I'M BEST KNOWN FOR": "e.g., Being the calm one when a launch is on fire",
  "IF I WASN'T IN TECH": "e.g., I'd be running a small coffee roastery",
  "MY FAVORITE BRAINSTORMING FUEL": "e.g., A whiteboard and way too much coffee",
  "WHAT I LOOK FOR IN A TEAM": "e.g., People who disagree kindly and ship fast",
  "ONE THING THAT SURPRISED ME": "e.g., How much of the job is good writing",
  "THE PROJECT I'M MOST PROUD OF": "e.g., Rebuilt onboarding, cut drop-off 40%",
  "MY DESIGN PHILOSOPHY": "e.g., Make the right thing the easy thing",
  "WHAT ENERGIZES ME": "e.g., Untangling a messy problem into something simple",
  "MY UNPOPULAR OPINION": "e.g., Most meetings should have been a doc",
  "THE BEST ADVICE I'VE RECEIVED": "e.g., Strong opinions, loosely held",
  "HOW I RECHARGE": "e.g., A long trail run with no podcast",
  "WHAT I'M LEARNING RIGHT NOW": "e.g., Getting fluent with Rust on weekends",
  "MY WORK STYLE": "e.g., Deep-focus mornings, collaborative afternoons",
  "WHY I CHOSE THIS CAREER": "e.g., I like building things people actually use",
};

// ── Sponsor ────────────────────────────────────────────────────────────────
export const SPONSOR_PROMPT_CATEGORIES: PromptCategory[] = [
  {
    title: "How I mentor",
    prompts: [
      "MY MENTORSHIP STYLE",
      "MY LEADERSHIP PHILOSOPHY",
      "THE BEST ADVICE I'VE RECEIVED",
    ],
  },
  {
    title: "What I look for",
    prompts: ["WHAT I LOOK FOR IN TALENT", "ONE THING THAT SURPRISED ME"],
  },
  {
    title: "Why I sponsor",
    prompts: [
      "WHY I SPONSOR",
      "THE PROJECT I'M MOST PROUD OF",
      "WHAT ENERGIZES ME",
    ],
  },
  {
    title: "What I bring",
    prompts: ["MY SECRET SUPERPOWER", "I'M BEST KNOWN FOR"],
  },
  {
    title: "Fun & personal",
    prompts: [
      "IF I WASN'T IN TECH",
      "MY FAVORITE BRAINSTORMING FUEL",
      "MY UNPOPULAR OPINION",
      "HOW I RECHARGE",
      "WHAT I'M LEARNING RIGHT NOW",
    ],
  },
];

export const SPONSOR_PROMPT_EXAMPLES: Record<string, string> = {
  "MY SECRET SUPERPOWER": "e.g., Spotting talent others overlook",
  "I'M BEST KNOWN FOR": "e.g., Opening doors for people early in their careers",
  "IF I WASN'T IN TECH": "e.g., I'd be coaching a college debate team",
  "MY FAVORITE BRAINSTORMING FUEL": "e.g., A long walk and a good question",
  "WHAT I LOOK FOR IN TALENT": "e.g., Curiosity and follow-through over pedigree",
  "ONE THING THAT SURPRISED ME": "e.g., The best hires rarely look best on paper",
  "THE PROJECT I'M MOST PROUD OF": "e.g., Mentored 5 juniors into senior roles",
  "MY MENTORSHIP STYLE": "e.g., Ask more than I tell, then get out of the way",
  "WHY I SPONSOR": "e.g., Someone took a chance on me — paying it forward",
  "WHAT ENERGIZES ME": "e.g., Watching someone level up faster than they expected",
  "MY UNPOPULAR OPINION": "e.g., Culture fit is overrated; culture add isn't",
  "THE BEST ADVICE I'VE RECEIVED": "e.g., Hire for slope, not intercept",
  "HOW I RECHARGE": "e.g., Weekends fully offline with family",
  "WHAT I'M LEARNING RIGHT NOW": "e.g., How to give feedback that actually lands",
  "MY LEADERSHIP PHILOSOPHY": "e.g., Set the bar, then clear the obstacles",
};

// ── Job insights (create-a-job flow) ───────────────────────────────────────
// Same Hinge-style prompt system, but the answers describe a job, not a
// person. Each category maps 1:1 onto a field of the backend's fixed
// insights object ({ dayToDay, teamCulture, idealCandidate, insiderInsights })
// — the create flow serializes answers under their category's insightKey, so
// the API payload shape never changes. Prompt strings are baked into the
// stored answer text ("PROMPT — answer"), so keep them stable.

export type JobInsightKey =
  | "dayToDay"
  | "teamCulture"
  | "idealCandidate"
  | "insiderInsights";

export interface JobPromptCategory extends PromptCategory {
  insightKey: JobInsightKey;
}

export const JOB_PROMPT_CATEGORIES: JobPromptCategory[] = [
  {
    title: "The real day-to-day",
    insightKey: "dayToDay",
    prompts: [
      "A TYPICAL WEEK HERE",
      "THE MEETING LOAD, HONESTLY",
      "THE PACE OF THIS TEAM",
      "WHERE THE TIME ACTUALLY GOES",
    ],
  },
  {
    title: "Team & culture",
    insightKey: "teamCulture",
    prompts: [
      "THE TEAM YOU'D JOIN",
      "REMOTE VS. IN-OFFICE REALITY",
      "THE MANAGER'S STYLE",
      "HOW DECISIONS GET MADE",
    ],
  },
  {
    title: "Who actually thrives",
    insightKey: "idealCandidate",
    prompts: [
      "YOU'LL LOVE THIS ROLE IF",
      "YOU'LL STRUGGLE HERE IF",
      "PEOPLE WHO SUCCEED HERE",
      "WHAT MATTERS MORE THAN THE RESUME",
    ],
  },
  {
    title: "The inside track",
    insightKey: "insiderInsights",
    prompts: [
      "THE INTERVIEW PROCESS, FOR REAL",
      "GROWTH FROM THIS ROLE",
      "THE COMP CONVERSATION",
      "WHAT NOBODY TELLS YOU",
    ],
  },
];

export const JOB_PROMPT_EXAMPLES: Record<string, string> = {
  "A TYPICAL WEEK HERE":
    "e.g., Two feature sprints, one demo Friday, real focus time in between",
  "THE MEETING LOAD, HONESTLY":
    "e.g., Standup daily, everything else is async — calendars stay light",
  "THE PACE OF THIS TEAM":
    "e.g., Fast but sane — we ship weekly without weekend fire drills",
  "WHERE THE TIME ACTUALLY GOES":
    "e.g., 60% building, 20% reviews and pairing, 20% planning",
  "THE TEAM YOU'D JOIN":
    "e.g., Eight engineers, mostly senior, low ego, high trust",
  "REMOTE VS. IN-OFFICE REALITY":
    "e.g., Officially hybrid; in practice most people come in Tuesdays",
  "THE MANAGER'S STYLE":
    "e.g., Hands-off on the how, very clear on the what and why",
  "HOW DECISIONS GET MADE":
    "e.g., Written proposals, quick debate, then one owner decides",
  "YOU'LL LOVE THIS ROLE IF":
    "e.g., You like owning something end-to-end without a playbook",
  "YOU'LL STRUGGLE HERE IF":
    "e.g., You need lots of structure and a fully groomed backlog",
  "PEOPLE WHO SUCCEED HERE":
    "e.g., Self-starters who over-communicate and ask for help early",
  "WHAT MATTERS MORE THAN THE RESUME":
    "e.g., Curiosity and shipped side projects beat brand-name experience",
  "THE INTERVIEW PROCESS, FOR REAL":
    "e.g., Recruiter chat, one take-home, a half-day loop — about two weeks",
  "GROWTH FROM THIS ROLE":
    "e.g., Last two people in this seat are now leading their own teams",
  "THE COMP CONVERSATION":
    "e.g., Bands are public internally; equity refreshes actually happen",
  "WHAT NOBODY TELLS YOU":
    "e.g., The CEO reads every product feedback ticket — visibility is real",
};
