import type { Job } from "@/types/jobs";
import { create } from "zustand";

interface JobsState {
  // Jobs data
  jobs: Job[];
  isLoading: boolean;
  error: string | null;
  lastFetched: Date | null;

  // Sponsored jobs tracking (for sponsors)
  sponsoredJobs: Array<{
    jobId: string; // JOB_POSTINGS ID (from backend response)
    // Original ATS/SILVER_JOBS ID — empty for manually-created jobs that
    // weren't sponsored from an ATS listing (they're still real sponsored
    // jobs the sponsor owns; they just don't have an ATS reference to track
    // against the browse list for green-border display).
    atsJobId: string;
    title: string;
    company: string;
    // Backend's LIKES_COUNT for this job (applicants in ACTIVE or MATCHED
    // status). Drives both the HomeView role-switcher's smart default
    // (open to the role with the highest count) and the count badges
    // rendered in the picker sheet. Hydrated from getMyJobs(); freshly
    // sponsored jobs default to 0.
    likesCount?: number;
  }>;
  activeSponsoredJobId: string | null;

  // My Jobs — backend-fetched sponsored jobs (persists across sessions)
  myJobs: Job[];
  isMyJobsLoading: boolean;

  // Navigation state
  currentIndex: number;
  progress: number;

  // Session recap counters — power the end-of-deck "Today's recap" card so
  // the deck-complete screen isn't a dead end. Live here (not HomeView local
  // state) so they survive a tab switch and back, the same reason
  // currentIndex/progress do. Reset alongside them in resetNavigation() so a
  // fresh deck starts a fresh recap.
  sessionLikes: number;
  sessionMatches: number;

  // Actions
  setJobs: (jobs: Job[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Sponsored jobs actions
  addSponsoredJob: (job: {
    jobId: string;
    atsJobId: string;
    title: string;
    company: string;
    likesCount?: number;
  }) => void;
  setActiveSponsoredJobId: (jobId: string | null) => void;

  // My Jobs actions
  setMyJobs: (jobs: Job[]) => void;
  setMyJobsLoading: (loading: boolean) => void;
  removeMyJob: (jobId: string) => void;

  // Navigation actions
  setCurrentIndex: (index: number) => void;
  setProgress: (progress: number) => void;
  resetNavigation: () => void;
  incrementSessionLikes: () => void;
  incrementSessionMatches: () => void;

  // Reset all state (called on logout)
  reset: () => void;

  // Computed
  getJobById: (id: string) => Job | undefined;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  // Initial state
  jobs: [],
  isLoading: false,
  error: null,
  lastFetched: null,
  sponsoredJobs: [],
  activeSponsoredJobId: null,
  myJobs: [],
  isMyJobsLoading: false,
  currentIndex: 0,
  progress: 1,
  sessionLikes: 0,
  sessionMatches: 0,

  // Actions
  setJobs: (jobs) =>
    set({
      jobs,
      lastFetched: new Date(),
      error: null,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  // Sponsored jobs actions
  // Dedupe by jobId — HomeView's bootstrap and JobsView's initMyJobs both
  // call this for the same response, and a render that maps over the array
  // would throw on duplicate React keys.
  //
  // Behavior:
  //   - Already present → merge in updated fields (likesCount can change
  //     between fetches). Don't touch activeSponsoredJobId.
  //   - New entry, no active set yet → set this one active.
  //   - New entry, already have an active → leave active alone. Callers
  //     that explicitly want to switch context (e.g., right after the
  //     sponsor sponsors a brand-new job) should call
  //     setActiveSponsoredJobId themselves.
  //
  // The "leave active alone on re-add" rule is what lets HomeView's smart
  // default survive a subsequent JobsView initMyJobs re-fetch — otherwise
  // the last job in the response would always claim active.
  addSponsoredJob: (job) =>
    set((state) => {
      const idx = state.sponsoredJobs.findIndex(
        (sj) => sj.jobId === job.jobId,
      );
      if (idx >= 0) {
        const updated = [...state.sponsoredJobs];
        updated[idx] = {
          ...updated[idx],
          ...job,
          // Preserve the previous likesCount if the new payload doesn't
          // supply one (e.g., the sponsor-new flow that doesn't know the
          // count yet).
          likesCount:
            job.likesCount !== undefined
              ? job.likesCount
              : updated[idx].likesCount,
        };
        return { sponsoredJobs: updated };
      }
      return {
        sponsoredJobs: [...state.sponsoredJobs, job],
        activeSponsoredJobId: state.activeSponsoredJobId || job.jobId,
      };
    }),

  setActiveSponsoredJobId: (jobId) => set({ activeSponsoredJobId: jobId }),

  setMyJobs: (myJobs) => set({ myJobs }),

  setMyJobsLoading: (isMyJobsLoading) => set({ isMyJobsLoading }),

  removeMyJob: (jobId) =>
    set((state) => ({
      myJobs: state.myJobs.filter((j) => j.id !== jobId),
      sponsoredJobs: state.sponsoredJobs.filter((sj) => sj.jobId !== jobId),
    })),

  // Navigation actions
  setCurrentIndex: (currentIndex) => set({ currentIndex }),

  setProgress: (progress) => set({ progress }),

  resetNavigation: () =>
    set({ currentIndex: 0, progress: 1, sessionLikes: 0, sessionMatches: 0 }),

  incrementSessionLikes: () =>
    set((state) => ({ sessionLikes: state.sessionLikes + 1 })),
  incrementSessionMatches: () =>
    set((state) => ({ sessionMatches: state.sessionMatches + 1 })),

  reset: () =>
    set({
      jobs: [],
      isLoading: false,
      error: null,
      lastFetched: null,
      sponsoredJobs: [],
      activeSponsoredJobId: null,
      myJobs: [],
      isMyJobsLoading: false,
      currentIndex: 0,
      progress: 1,
      sessionLikes: 0,
      sessionMatches: 0,
    }),

  getJobById: (id) => {
    return get().jobs.find((job) => job.id === id);
  },
}));
