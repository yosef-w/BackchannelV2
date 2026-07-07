/**
 * Contract tests for the jobs store — the sponsored-job dedupe/active-id
 * rules that HomeView's role-switcher default depends on, and the deck
 * session counters the end-of-deck recap card reads.
 */
import type { Job } from "@/types/jobs";
import { useJobsStore } from "../useJobsStore";

const store = () => useJobsStore.getState();

const job = (id: string, title = "Engineer"): Job =>
  ({ id, title, company: "Acme" }) as unknown as Job;

beforeEach(() => {
  store().reset();
});

describe("addSponsoredJob", () => {
  const entry = {
    jobId: "jp-1",
    atsJobId: "ats-1",
    title: "Engineer",
    company: "Acme",
  };

  it("first job becomes the active sponsored job", () => {
    store().addSponsoredJob({ ...entry, likesCount: 3 });
    expect(store().sponsoredJobs).toHaveLength(1);
    expect(store().activeSponsoredJobId).toBe("jp-1");
  });

  it("a second new job does NOT steal active", () => {
    store().addSponsoredJob(entry);
    store().addSponsoredJob({ ...entry, jobId: "jp-2", atsJobId: "ats-2" });
    expect(store().sponsoredJobs).toHaveLength(2);
    expect(store().activeSponsoredJobId).toBe("jp-1");
  });

  it("re-adding an existing jobId merges instead of duplicating", () => {
    store().addSponsoredJob({ ...entry, likesCount: 3 });
    store().addSponsoredJob({ ...entry, title: "Sr Engineer", likesCount: 7 });
    expect(store().sponsoredJobs).toHaveLength(1);
    expect(store().sponsoredJobs[0]).toMatchObject({
      title: "Sr Engineer",
      likesCount: 7,
    });
  });

  it("merge preserves the previous likesCount when the new payload omits it", () => {
    store().addSponsoredJob({ ...entry, likesCount: 5 });
    store().addSponsoredJob({ ...entry, title: "Renamed" }); // no likesCount
    expect(store().sponsoredJobs[0].likesCount).toBe(5);
  });

  it("re-add never touches activeSponsoredJobId", () => {
    store().addSponsoredJob(entry);
    store().addSponsoredJob({ ...entry, jobId: "jp-2", atsJobId: "ats-2" });
    store().setActiveSponsoredJobId("jp-2");
    store().addSponsoredJob({ ...entry, likesCount: 1 }); // re-add jp-1
    expect(store().activeSponsoredJobId).toBe("jp-2");
  });
});

describe("removeMyJob", () => {
  it("removes the job from BOTH myJobs and sponsoredJobs", () => {
    store().setMyJobs([job("jp-1"), job("jp-2")]);
    store().addSponsoredJob({
      jobId: "jp-1",
      atsJobId: "ats-1",
      title: "Engineer",
      company: "Acme",
    });

    store().removeMyJob("jp-1");

    expect(store().myJobs.map((j) => j.id)).toEqual(["jp-2"]);
    expect(store().sponsoredJobs).toHaveLength(0);
  });
});

describe("deck session counters", () => {
  it("increment and survive until resetNavigation", () => {
    store().setCurrentIndex(4);
    store().incrementSessionLikes();
    store().incrementSessionLikes();
    store().incrementSessionMatches();
    expect(store().sessionLikes).toBe(2);
    expect(store().sessionMatches).toBe(1);

    store().resetNavigation();
    expect(store()).toMatchObject({
      currentIndex: 0,
      progress: 1,
      sessionLikes: 0,
      sessionMatches: 0,
    });
  });
});

describe("reset (logout)", () => {
  it("clears every slice back to initial state", () => {
    store().setJobs([job("j-1")]);
    store().addSponsoredJob({
      jobId: "jp-1",
      atsJobId: "ats-1",
      title: "Engineer",
      company: "Acme",
    });
    store().setMyJobs([job("jp-1")]);
    store().incrementSessionLikes();

    store().reset();

    expect(store()).toMatchObject({
      jobs: [],
      sponsoredJobs: [],
      activeSponsoredJobId: null,
      myJobs: [],
      sessionLikes: 0,
      lastFetched: null,
    });
  });
});

describe("getJobById", () => {
  it("finds by id and returns undefined for misses", () => {
    store().setJobs([job("j-1"), job("j-2")]);
    expect(store().getJobById("j-2")?.id).toBe("j-2");
    expect(store().getJobById("nope")).toBeUndefined();
  });
});
