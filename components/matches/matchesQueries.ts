import { getInterestedSponsors } from "@/lib/api";

// React Query keys for every list on the Matches screen. Caching these is
// what makes the tab render instantly on re-entry instead of re-spinning
// every time: each cached list paints immediately while a fresh fetch runs
// in the background (stale-while-revalidate). All keys share the
// "matchesScreen" root so a single invalidate refetches the whole screen
// after a mutation that changes any of them.
//
// Lives in its own module (rather than inside MatchesView) so other screens
// can subscribe to the SAME cache entries — e.g. HomeView's "Your Move"
// strip reads interestedSponsors without issuing a competing fetch or
// duplicating the transform.
const MATCHES_SCREEN_ROOT = "matchesScreen";
export const matchesScreenKeys = {
  root: [MATCHES_SCREEN_ROOT] as const,
  matches: (u: string) => [MATCHES_SCREEN_ROOT, "matches", u] as const,
  likedJobs: (u: string) => [MATCHES_SCREEN_ROOT, "likedJobs", u] as const,
  waitlistedJobs: (u: string) =>
    [MATCHES_SCREEN_ROOT, "waitlistedJobs", u] as const,
  interestedSponsors: (u: string) =>
    [MATCHES_SCREEN_ROOT, "interestedSponsors", u] as const,
  sponsorRequests: (u: string) =>
    [MATCHES_SCREEN_ROOT, "sponsorRequests", u] as const,
  interestedApplicants: (u: string) =>
    [MATCHES_SCREEN_ROOT, "interestedApplicants", u] as const,
  referrals: (u: string) => [MATCHES_SCREEN_ROOT, "referrals", u] as const,
};

export interface InterestedSponsor {
  likeId: string;
  userId: string;
  likedAt: string;
  name: string;
  firstName: string;
  role: string;
  company: string;
  image: string;
  // The role the sponsor liked the applicant FOR — distinct from `role` /
  // `company` (which describe the sponsor's own job/employer). Empty strings
  // when the backend hasn't yet wired §4 of BACKEND_CHANGES_NEEDED.md (or
  // for legacy profile-likes that pre-date the JOB_ID-carrying change). UI
  // renders the role-context line only when both are present.
  jobId?: string;
  jobTitle: string;
  jobCompany: string;
}

/**
 * Shared query definition for "sponsors who liked this applicant" — spread
 * into useQuery so every consumer (MatchesView's Your Move group, HomeView's
 * deck strip) shares one key, one fetcher, one transform, one cache entry.
 */
export const interestedSponsorsQuery = (userType: string) => ({
  queryKey: matchesScreenKeys.interestedSponsors(userType),
  enabled: userType === "applicant",
  queryFn: async (): Promise<InterestedSponsor[]> => {
    try {
      const response = await getInterestedSponsors();
      const sponsorArray = Array.isArray(response) ? response : [];

      return sponsorArray.map((s: any) => ({
        likeId: s.LIKE_ID || String(Math.random()),
        userId: s.SPONSOR_USER_ID || "",
        likedAt: s.LIKED_AT || "",
        name:
          s.SPONSOR_FIRST_NAME && s.SPONSOR_LAST_NAME
            ? `${s.SPONSOR_FIRST_NAME} ${s.SPONSOR_LAST_NAME}`
            : s.SPONSOR_FIRST_NAME || "Sponsor",
        firstName: s.SPONSOR_FIRST_NAME || "Sponsor",
        role: s.SPONSOR_JOB_TITLE || "",
        company: s.SPONSOR_COMPANY || "",
        image: s.SPONSOR_PHOTO_URL || "",
        jobId: s.JOB_ID || "",
        // Job context shipped in PR #55 — the role the sponsor was
        // viewing when they liked. Drives the "Wants you for ..."
        // line on the Interested-in-You card.
        jobTitle: s.JOB_TITLE || "",
        jobCompany: s.JOB_COMPANY || "",
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 404 = endpoint not yet deployed on backend — treat as empty state.
      if (msg === "Not found" || msg.includes("404")) return [];
      throw err;
    }
  },
});
