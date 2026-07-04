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
