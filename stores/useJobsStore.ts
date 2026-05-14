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
    atsJobId: string; // Original ATS/SILVER_JOBS ID
    title: string;
    company: string;
  }>;
  activeSponsoredJobId: string | null;

  // My Jobs — backend-fetched sponsored jobs (persists across sessions)
  myJobs: Job[];
  isMyJobsLoading: boolean;

  // Navigation state
  currentIndex: number;
  progress: number;

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
  addSponsoredJob: (job) =>
    set((state) => ({
      sponsoredJobs: [...state.sponsoredJobs, job],
      activeSponsoredJobId: job.jobId, // Set as active when sponsored
    })),

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

  resetNavigation: () => set({ currentIndex: 0, progress: 1 }),

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
    }),

  getJobById: (id) => {
    return get().jobs.find((job) => job.id === id);
  },
}));
