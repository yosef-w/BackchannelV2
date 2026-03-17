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

  // Filters
  filters: {
    type: string[];
    location: string[];
    department: string[];
    experience: string[];
    salaryMin: number | null;
    salaryMax: number | null;
    remote: boolean | null;
  };

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

  // Navigation actions
  setCurrentIndex: (index: number) => void;
  setProgress: (progress: number) => void;
  resetNavigation: () => void;

  // Filter actions
  setFilters: (filters: Partial<JobsState["filters"]>) => void;
  clearFilters: () => void;
  toggleFilter: (category: keyof JobsState["filters"], value: string) => void;

  // Computed
  getFilteredJobs: () => Job[];
  getJobById: (id: string) => Job | undefined;
}

const initialFilters: JobsState["filters"] = {
  type: [],
  location: [],
  department: [],
  experience: [],
  salaryMin: null,
  salaryMax: null,
  remote: null,
};

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
  filters: initialFilters,

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

  // Navigation actions
  setCurrentIndex: (currentIndex) => set({ currentIndex }),

  setProgress: (progress) => set({ progress }),

  resetNavigation: () => set({ currentIndex: 0, progress: 1 }),

  // Filter actions
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  clearFilters: () => set({ filters: initialFilters }),

  toggleFilter: (category, value) =>
    set((state) => {
      const currentValues = state.filters[category];

      // Handle array filters
      if (Array.isArray(currentValues)) {
        const newValues = currentValues.includes(value)
          ? currentValues.filter((v) => v !== value)
          : [...currentValues, value];

        return {
          filters: {
            ...state.filters,
            [category]: newValues,
          },
        };
      }

      return state;
    }),

  // Computed selectors
  getFilteredJobs: () => {
    const { jobs, filters } = get();

    return jobs.filter((job) => {
      // Filter by type
      if (filters.type.length > 0 && !filters.type.includes(job.type)) {
        return false;
      }

      // Filter by location
      if (filters.location.length > 0) {
        const hasMatchingLocation = filters.location.some((loc) => {
          if (loc === "Remote" && job.isRemote) return true;
          if (loc === "On-site" && job.workArrangement === "On-site")
            return true;
          if (loc === "Hybrid" && job.workArrangement === "Hybrid") return true;
          return job.location.toLowerCase().includes(loc.toLowerCase());
        });

        if (!hasMatchingLocation) return false;
      }

      // Filter by experience
      if (filters.experience.length > 0) {
        const hasMatchingExp = filters.experience.some((exp) => {
          const jobExp = job.experienceLevel;
          if (exp === "Entry Level" && (jobExp === "0-2" || jobExp === "2-5"))
            return true;
          if (exp === "Mid-Level" && (jobExp === "2-5" || jobExp === "5-10"))
            return true;
          if (exp === "Senior" && (jobExp === "5-10" || jobExp === "10+"))
            return true;
          if (exp === "Lead/Principal" && jobExp === "10+") return true;
          return false;
        });

        if (!hasMatchingExp) return false;
      }

      // Filter by salary min
      if (filters.salaryMin && job.salaryMin) {
        if (job.salaryMin < filters.salaryMin) return false;
      }

      // Filter by salary max
      if (filters.salaryMax && job.salaryMax) {
        if (job.salaryMax > filters.salaryMax) return false;
      }

      // Filter by remote
      if (filters.remote !== null && job.isRemote !== filters.remote) {
        return false;
      }

      return true;
    });
  },

  getJobById: (id) => {
    return get().jobs.find((job) => job.id === id);
  },
}));
