import { Heart } from "@/components/ui/icons";
import { getRelativeTime } from "@/utils/relativeTime";
import React from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
} from "react-native";
import { Avatar } from "../ui/Avatar";
import { PipelineStageTimeline } from "../ui/PipelineStageTimeline";
import { StatusChip } from "../ui/StatusChip";
import { MatchesEmptyState } from "./MatchesEmptyState";
import { MatchListScreen } from "./MatchListScreen";
import { renderMatchRows } from "./matchRowBuilders";
import {
    InterestedApplicant,
    Match,
    Referral,
    SponsorRequest,
} from "./matchesQueries";
import { MatchSection } from "./MatchSection";
import { MetaLine, OpportunityRow } from "./OpportunityRow";
import { Colors } from "@/constants/theme";

const MATCH_SECTION_ROW_CAP = 4;

interface MatchRowCallbacks {
  onOpenRoleGroup: (group: {
    items: Match[];
    getMessageUserId: (m: Match) => string | undefined;
  }) => void;
  onOpenProfile: (match: Match, mode: "view" | "message") => void;
  onMessageTapped: (match: Match, userId: string | undefined) => void;
}

interface SponsorMatchesSectionsProps {
  matches: Match[];
  matchesLoading: boolean;
  matchesError: string | null;
  sponsorRequests: SponsorRequest[];
  sponsorRequestsLoading: boolean;
  sponsorRequestsError: string | null;
  interestedApplicants: InterestedApplicant[];
  interestedApplicantsLoading: boolean;
  interestedApplicantsError: string | null;
  referrals: Referral[];
  referralsLoading: boolean;
  referralsError: string | null;
  withdrawingReferralId: string | null;
  expandedGroup: "yourMove" | "matched" | "inProgress" | null;
  onSetExpandedGroup: (group: "yourMove" | "matched" | "inProgress" | null) => void;
  onSelectSponsorRequest: (request: SponsorRequest) => void;
  onSelectInterestedApplicant: (applicant: InterestedApplicant) => void;
  onOpenProfile: (match: Match, mode: "view" | "message") => void;
  onConfirmWithdrawReferral: (referral: Referral) => void;
  /** Open the referral detail (the permanent packet sheet). */
  onSelectReferral: (referral: Referral) => void;
  matchRowCallbacks: MatchRowCallbacks;
}

/**
 * Sponsor-view match sections — mirrors the applicant layout: Your Move
 * (incoming asks needing a response) → Matched (ready to message) → In
 * Progress (active referral pipeline). Extracted from MatchesView as part
 * of the M3 section/row-builder breakup; all data comes from the parent's
 * already-fetched React Query results, all mutation-triggering taps go back
 * up via callbacks.
 */
export function SponsorMatchesSections({
  matches,
  matchesLoading,
  matchesError,
  sponsorRequests,
  sponsorRequestsLoading,
  sponsorRequestsError,
  interestedApplicants,
  interestedApplicantsLoading,
  interestedApplicantsError,
  referrals,
  referralsLoading,
  referralsError,
  withdrawingReferralId,
  expandedGroup,
  onSetExpandedGroup,
  onSelectSponsorRequest,
  onSelectInterestedApplicant,
  onOpenProfile,
  onConfirmWithdrawReferral,
  onSelectReferral,
  matchRowCallbacks,
}: SponsorMatchesSectionsProps) {
  const yourMoveCount = sponsorRequests.length + interestedApplicants.length;
  const yourMoveLoading = sponsorRequestsLoading || interestedApplicantsLoading;
  const inProgressCount = referrals.length;
  const inProgressLoading = referralsLoading;
  const nothingToShow =
    !yourMoveLoading &&
    !matchesLoading &&
    !inProgressLoading &&
    yourMoveCount === 0 &&
    matches.length === 0 &&
    inProgressCount === 0;

  if (nothingToShow) {
    return <MatchesEmptyState userType="sponsor" />;
  }

  const sponsorYourMoveRows = [
    ...sponsorRequests.map((req) => (
      <OpportunityRow
        key={req.requestId}
        onPress={() => onSelectSponsorRequest(req)}
        leading={
          <Avatar
            photoUrl={req.applicantPhoto}
            name={req.applicantName}
            size={48}
            borderRadius={16}
          />
        }
        title={req.applicantName}
        subtitle={
          req.jobCompany ? `${req.jobTitle} · ${req.jobCompany}` : req.jobTitle
        }
        cta="Review"
      />
    )),
    ...interestedApplicants.map((applicant) => (
      <OpportunityRow
        key={applicant.applicantUserId}
        onPress={() => onSelectInterestedApplicant(applicant)}
        leading={
          <Avatar
            photoUrl={applicant.image}
            name={applicant.name}
            size={48}
            borderRadius={16}
          />
        }
        title={applicant.name}
        subtitle={
          applicant.jobTitle
            ? `Interested in ${applicant.jobTitle}${applicant.jobCompany ? ` · ${applicant.jobCompany}` : ""}`
            : [applicant.roleType, applicant.location]
                .filter(Boolean)
                .join(" · ")
        }
        meta={
          applicant.likedAt ? (
            <MetaLine
              icon={<Heart size={10} color={Colors.danger} />}
              text={getRelativeTime(applicant.likedAt)}
            />
          ) : undefined
        }
        cta="View"
      />
    )),
  ];

  const sponsorMatchedRows = renderMatchRows(
    matches,
    {
      keyField: "applicantUserId",
      getMessageUserId: (m) => m.sponsorUserId,
    },
    matchRowCallbacks,
  );

  const sponsorInProgressRows = referrals.map((referral, index) => {
    // Try to find the full match object so "View" opens the profile modal
    const matchForReferral = matches.find(
      (m) => m.applicantUserId === referral.applicantUserId,
    );
    const applicantName =
      [referral.applicantFirstName, referral.applicantLastName]
        .filter(Boolean)
        .join(" ") ||
      matchForReferral?.name ||
      "Applicant";
    const applicantImage =
      referral.applicantPhotoUrl || matchForReferral?.image || "";
    const isReferred = referral.status === "REFERRED";
    const isWithdrawing = withdrawingReferralId === referral.referralId;

    return (
      <OpportunityRow
        key={`referral-${referral.referralId || index}`}
        // Opens the referral detail — the permanent packet sheet — not the
        // person's profile (the packet is what a sponsor comes back for).
        onPress={() => onSelectReferral(referral)}
        muted={!isReferred}
        leading={
          <Avatar
            photoUrl={applicantImage}
            name={applicantName}
            size={48}
            borderRadius={16}
          />
        }
        title={applicantName}
        subtitle={
          referral.jobTitle || matchForReferral?.appliedRole
            ? `Referred for ${referral.jobTitle || matchForReferral?.appliedRole}`
            : "Referred"
        }
        right={
          isReferred ? (
            isWithdrawing ? (
              <ActivityIndicator size="small" color={Colors.danger} />
            ) : (
              <TouchableOpacity
                style={styles.withdrawBtn}
                onPress={() => onConfirmWithdrawReferral(referral)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.withdrawBtnText}>Withdraw</Text>
              </TouchableOpacity>
            )
          ) : (
            <StatusChip label="Withdrawn" tone="muted" />
          )
        }
        detail={
          isReferred ? (
            <PipelineStageTimeline currentStage={referral.checkInStage} />
          ) : undefined
        }
      />
    );
  });

  return (
    <>
      <MatchSection
        title="Your Move"
        subtitle="Applicants asking you to sponsor a role, and applicants interested in your jobs"
        count={yourMoveCount}
        loading={yourMoveLoading}
        error={sponsorRequestsError || interestedApplicantsError}
        hidden={!yourMoveLoading && yourMoveCount === 0}
        maxRows={MATCH_SECTION_ROW_CAP}
        onSeeAll={() => onSetExpandedGroup("yourMove")}
      >
        {sponsorYourMoveRows}
      </MatchSection>

      <MatchSection
        title="Matched"
        subtitle="Applicants you've matched with — message them to start a conversation"
        count={matches.length}
        loading={matchesLoading}
        error={matchesError}
        hidden={!matchesLoading && matches.length === 0}
        maxRows={MATCH_SECTION_ROW_CAP}
        onSeeAll={() => onSetExpandedGroup("matched")}
      >
        {sponsorMatchedRows}
      </MatchSection>

      <MatchSection
        title="In Progress"
        subtitle="Applicants you've formally referred — track their status here"
        count={inProgressCount}
        loading={inProgressLoading}
        error={referralsError}
        hidden={!inProgressLoading && inProgressCount === 0}
        maxRows={MATCH_SECTION_ROW_CAP}
        onSeeAll={() => onSetExpandedGroup("inProgress")}
      >
        {sponsorInProgressRows}
      </MatchSection>

      <MatchListScreen
        visible={expandedGroup === "yourMove"}
        onClose={() => onSetExpandedGroup(null)}
        title="Your Move"
      >
        {sponsorYourMoveRows}
      </MatchListScreen>
      <MatchListScreen
        visible={expandedGroup === "matched"}
        onClose={() => onSetExpandedGroup(null)}
        title="Matched"
      >
        {sponsorMatchedRows}
      </MatchListScreen>
      <MatchListScreen
        visible={expandedGroup === "inProgress"}
        onClose={() => onSetExpandedGroup(null)}
        title="In Progress"
      >
        {sponsorInProgressRows}
      </MatchListScreen>
    </>
  );
}

const styles = StyleSheet.create({
  withdrawBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 74,
  },
  withdrawBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.danger,
  },
});
