// useCheckInReferrals — the referral check-in subsystem extracted verbatim
// from MainApp: fetching + normalizing /api/referrals/ rows, local check-in
// time bookkeeping, nudge-notification scheduling, and the active/stale
// counts that drive the TopBar's contextual check-in icon.

import { listReferrals } from "@/lib/api";
import { cancelCheckInNudges, scheduleCheckInNudges } from "@/lib/checkInNudges";
import {
  getLocalCheckInStages,
  getLocalCheckInTimes,
} from "@/utils/checkInStageCache";
import { useEffect, useRef, useState } from "react";
import type { CheckInReferral } from "../checkin/ApplicantCheckInModal";
import type { SponsorCheckInReferral } from "../checkin/SponsorCheckInModal";
import type { UserType } from "./ShellContext";

// Accept both legacy and newer backend key variants so check-in modals stay
// resilient across backend response-shape drift. Rows are treated as open
// records on purpose — the key list IS the contract here.
const pickField = (
  row: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const k of keys) {
    const v = row?.[k];
    // All referral columns are text; the cast asserts that contract.
    if (v !== undefined && v !== null && v !== "") return v as string;
  }
  return null;
};

const normalizeReferralRow = (r: Record<string, unknown>) => ({
  referralId: String(
    pickField(r, ["REFERRAL_ID", "referral_id", "referralId", "id"]) || "",
  ),
  jobTitle: pickField(r, [
    "JOB_TITLE",
    "job_title",
    "jobTitle",
    // Fallbacks used by adjacent matching/messaging payloads.
    "SPONSOR_JOB_TITLE",
    "sponsor_job_title",
    "ROLE_TITLE",
    "role_title",
  ]),
  jobCompany: pickField(r, [
    "JOB_COMPANY",
    "job_company",
    "jobCompany",
    "SPONSOR_COMPANY",
    "sponsor_company",
    "COMPANY",
    "company",
  ]),
  sponsorFirstName: pickField(r, [
    "SPONSOR_FIRST_NAME",
    "sponsor_first_name",
    "sponsorFirstName",
  ]),
  sponsorLastName: pickField(r, [
    "SPONSOR_LAST_NAME",
    "sponsor_last_name",
    "sponsorLastName",
  ]),
  applicantFirstName: pickField(r, [
    "APPLICANT_FIRST_NAME",
    "applicant_first_name",
    "applicantFirstName",
  ]),
  applicantLastName: pickField(r, [
    "APPLICANT_LAST_NAME",
    "applicant_last_name",
    "applicantLastName",
  ]),
  status: String(pickField(r, ["STATUS", "status"]) || "REFERRED"),
  createdAt: String(
    pickField(r, ["CREATED_AT", "created_at", "createdAt"]) || "",
  ),
});

// Stale = created 7+ days ago (same threshold as MatchesView's nudge banner)
// AND no check-in submitted from this device within the last 7 days.
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export function useCheckInReferrals(
  userType: UserType,
  /** True while either check-in sheet is open — closing a sheet reloads the
   * local check-in times (which covers submits). */
  anySheetOpen: boolean,
) {
  const [referrals, setReferrals] = useState<
    CheckInReferral[] | SponsorCheckInReferral[]
  >([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const referralsRequestIdRef = useRef(0);

  /**
   * Fetch referrals from /api/referrals/ and shape them into the props each
   * check-in modal needs. Fetched fresh every time the user opens the
   * check-in panel so the modal is never stale. The backend returns the same
   * row shape for both roles.
   */
  const fetchReferralsForCheckIn = async () => {
    const requestId = ++referralsRequestIdRef.current;
    try {
      setReferralsLoading(true);
      const response = await listReferrals({ limit: 50, offset: 0 });
      const rows = Array.isArray(response?.referrals) ? response.referrals : [];
      const normalizedRows = rows.map((r) => normalizeReferralRow(r));
      const transformed = normalizedRows.filter((r) => !!r.referralId);

      // Ignore stale in-flight responses when the modal is opened repeatedly.
      if (requestId !== referralsRequestIdRef.current) return;
      setReferrals(transformed);
    } catch (err) {
      if (requestId !== referralsRequestIdRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      // 404 means no referrals yet — that's an empty state, not an error.
      if (!msg.includes("404") && !msg.toLowerCase().includes("not found")) {
        console.warn("[Shell] Failed to fetch referrals:", err);
      }
      setReferrals([]);
    } finally {
      if (requestId !== referralsRequestIdRef.current) return;
      setReferralsLoading(false);
    }
  };

  // Eager fetch at mount so the header's check-in icon can be contextual
  // (hidden with no active referrals, badged with the stale count). Opening
  // the sheet still refetches fresh, so this only needs to be roughly right.
  useEffect(() => {
    fetchReferralsForCheckIn();
    // Refetch when the role flips — the referral list is role-scoped.
  }, [userType]);

  // Last locally-submitted check-in per referral — a referral the user just
  // checked in on shouldn't keep the header badge lit for 7 more days.
  const [checkInTimes, setCheckInTimes] = useState<Record<string, string>>({});
  useEffect(() => {
    getLocalCheckInTimes().then(setCheckInTimes);
  }, [anySheetOpen]);

  // Recompute + reschedule this role's single check-in nudge notification
  // any time the referral list or local check-in times change.
  // scheduleCheckInNudges cancels any previously-pending nudge first, so
  // this is safe to run repeatedly.
  useEffect(() => {
    if (!referrals.length) {
      cancelCheckInNudges(userType);
      return;
    }
    getLocalCheckInStages().then((stages) => {
      scheduleCheckInNudges(
        userType,
        referrals as unknown as {
          referralId: string;
          status: string;
          createdAt: string;
          jobCompany?: string | null;
        }[],
        checkInTimes,
        stages,
      );
    });
  }, [referrals, checkInTimes, userType]);

  const activeReferralCount = referrals.filter(
    (r) => (r.status || "").toUpperCase() === "REFERRED",
  ).length;
  const staleReferralCount = referrals.filter((r) => {
    if ((r.status || "").toUpperCase() !== "REFERRED") return false;
    const created = Date.parse(r.createdAt || "");
    if (isNaN(created) || created > Date.now() - STALE_MS) return false;
    const lastCheckIn = Date.parse(checkInTimes[r.referralId] || "");
    return isNaN(lastCheckIn) || lastCheckIn <= Date.now() - STALE_MS;
  }).length;

  return {
    referrals,
    referralsLoading,
    fetchReferralsForCheckIn,
    activeReferralCount,
    staleReferralCount,
  };
}
