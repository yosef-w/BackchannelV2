/**
 * Contract tests for the check-in nudge planner — the dedupe rules that
 * prevent the reported "two notifications for the same Snowflake check-in"
 * bug:
 *   1. one pending nudge per role, soonest checkpoint wins
 *   2. a delivered checkpoint NEVER re-fires — the referral advances to its
 *      next future checkpoint (the actual bug: every recompute re-scheduled
 *      an unsatisfied past-due checkpoint "+60s from now")
 *   3. a recompute while a past-due nudge is still counting down re-anchors
 *      to the original fire time instead of resetting the countdown
 *   4. same-day checkpoints aggregate into one notification and are all
 *      stamped as covered
 *   5. terminal stages / non-REFERRED / post-cadence referrals go quiet
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  PAST_DUE_FIRE_DELAY_MS,
  planCheckInNudge,
  type SentNudgeRecords,
} from "../checkInNudges";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-07-10T15:00:00Z");

const referral = (
  id: string,
  createdDaysAgo: number,
  company = "Snowflake",
) => ({
  referralId: id,
  status: "REFERRED",
  createdAt: new Date(NOW - createdDaysAgo * DAY).toISOString(),
  jobCompany: company,
});

const plan = (
  referrals: ReturnType<typeof referral>[],
  {
    times = {},
    stages = {},
    records = {},
    now = NOW,
  }: {
    times?: Record<string, string>;
    stages?: Record<string, string>;
    records?: SentNudgeRecords;
    now?: number;
  } = {},
) => planCheckInNudge("applicant", referrals, times, stages, records, now);

describe("future checkpoints", () => {
  it("schedules at the checkpoint's absolute time (recompute-stable)", () => {
    // Created 1 day ago → day-3 checkpoint is 2 days from now.
    const p = plan([referral("r1", 1)]);
    expect(p).not.toBeNull();
    expect(p!.fireAt).toBe(NOW + 2 * DAY);
    expect(p!.title).toBe("Snowflake — time for a check-in");
    // Recomputing with the persisted records converges on the same instant.
    const p2 = plan([referral("r1", 1)], { records: p!.records });
    expect(p2!.fireAt).toBe(p!.fireAt);
  });

  it("stamps the scheduled checkpoint so it can't re-fire after delivery", () => {
    const p = plan([referral("r1", 1)]);
    expect(p!.records["r1"]).toEqual({
      checkpoint: NOW + 2 * DAY,
      firesAt: NOW + 2 * DAY,
    });
  });
});

describe("past-due checkpoints (the duplicate-notification bug)", () => {
  it("a newly-discovered past-due checkpoint fires once, shortly after recompute", () => {
    // Created 4 days ago → day-3 checkpoint passed yesterday; no record.
    const p = plan([referral("r1", 4)]);
    expect(p!.fireAt).toBe(NOW + PAST_DUE_FIRE_DELAY_MS);
    expect(p!.records["r1"].checkpoint).toBe(NOW - 1 * DAY + 0);
  });

  it("a DELIVERED past-due checkpoint never re-fires — advances to the next future one", () => {
    // The reported bug: nudge fired, user opened the app without checking
    // in, and the same "Snowflake — time for a check-in" fired again.
    const checkpoint = NOW - 1 * DAY; // day-3 mark, passed yesterday
    const records: SentNudgeRecords = {
      r1: { checkpoint, firesAt: checkpoint }, // fired when it hit
    };
    const p = plan([referral("r1", 4)], { records });
    // Must NOT schedule +60s again; next is the day-7 checkpoint (3 days out).
    expect(p!.fireAt).toBe(NOW + 3 * DAY);
    expect(p!.records["r1"]).toEqual({
      checkpoint: NOW + 3 * DAY,
      firesAt: NOW + 3 * DAY,
    });
  });

  it("a recompute during the +60s countdown re-anchors instead of resetting", () => {
    const checkpoint = NOW - 1 * DAY;
    const originalFiresAt = NOW - 10_000 + PAST_DUE_FIRE_DELAY_MS; // scheduled 10s ago
    const records: SentNudgeRecords = {
      r1: { checkpoint, firesAt: originalFiresAt },
    };
    const p = plan([referral("r1", 4)], { records });
    expect(p!.fireAt).toBe(originalFiresAt); // not NOW + 60s
  });

  it("a referral past its final checkpoint goes quiet after delivery", () => {
    // Created 40 days ago → all cadence checkpoints are in the past; the
    // last (day-35) was delivered.
    const lastCheckpoint = NOW - 5 * DAY; // day-35 mark
    const records: SentNudgeRecords = {
      r1: { checkpoint: lastCheckpoint, firesAt: lastCheckpoint },
    };
    expect(plan([referral("r1", 40)], { records })).toBeNull();
  });
});

describe("check-in submissions advance the cadence", () => {
  it("a check-in covering the current checkpoint moves to the next one", () => {
    // Created 4 days ago; user checked in today → day-3 satisfied,
    // day-7 (3 days out) is next.
    const p = plan([referral("r1", 4)], {
      times: { r1: new Date(NOW).toISOString() },
    });
    expect(p!.fireAt).toBe(NOW + 3 * DAY);
  });
});

describe("aggregation + filtering", () => {
  it("same-day checkpoints collapse into one aggregate notification, all stamped", () => {
    const p = plan([
      referral("r1", 4, "Snowflake"),
      referral("r2", 4, "Google"),
    ]);
    expect(p!.title).toBe("2 referrals need a check-in update");
    // Both past-due members are stamped as covered by this one notification.
    expect(p!.records["r1"]).toBeDefined();
    expect(p!.records["r2"]).toBeDefined();
    expect(p!.records["r1"].firesAt).toBe(p!.fireAt);
    expect(p!.records["r2"].firesAt).toBe(p!.fireAt);
  });

  it("skips terminal-stage and non-REFERRED referrals", () => {
    expect(
      plan([referral("r1", 4)], {
        stages: { r1: "Didn't move forward" },
      }),
    ).toBeNull();
    expect(
      plan([{ ...referral("r1", 4), status: "WITHDRAWN" }]),
    ).toBeNull();
  });

  it("prunes records for referrals that are no longer present", () => {
    const records: SentNudgeRecords = {
      gone: { checkpoint: NOW - DAY, firesAt: NOW - DAY },
    };
    const p = plan([referral("r1", 1)], { records });
    expect(p!.records["gone"]).toBeUndefined();
  });
});
