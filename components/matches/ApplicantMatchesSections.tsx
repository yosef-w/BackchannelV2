import { Award, Heart } from "@/components/ui/icons";
import { getRelativeTime } from "@/utils/relativeTime";
import React from "react";
import { CompanyLogo } from "../ui/CompanyLogo";
import { PipelineStageTimeline } from "../ui/PipelineStageTimeline";
import { StatusChip } from "../ui/StatusChip";
import { Avatar } from "../ui/Avatar";
import { MatchesEmptyState } from "./MatchesEmptyState";
import { MatchListScreen } from "./MatchListScreen";
import { renderMatchRows } from "./matchRowBuilders";
import {
    InterestedSponsor,
    JobOpportunity,
    Match,
    Referral,
    WaitlistedJob,
} from "./matchesQueries";
import { MatchSection } from "./MatchSection";
import { MetaLine, OpportunityRow } from "./OpportunityRow";

const MATCH_SECTION_ROW_CAP = 4;

interface MatchRowCallbacks {
  onOpenRoleGroup: (group: {
    items: Match[];
    getMessageUserId: (m: Match) => string | undefined;
  }) => void;
  onOpenProfile: (match: Match, mode: "view" | "message") => void;
  onMessageTapped: (match: Match, userId: string | undefined) => void;
}

interface ApplicantMatchesSectionsProps {
  matches: Match[];
  matchesLoading: boolean;
  matchesError: string | null;
  interestedSponsors: InterestedSponsor[];
  interestedSponsorsLoading: boolean;
  interestedSponsorsError: string | null;
  waitlistedJobs: WaitlistedJob[];
  waitlistedJobsLoading: boolean;
  waitlistedJobsError: string | null;
  likedJobs: JobOpportunity[];
  likedJobsLoading: boolean;
  likedJobsError: string | null;
  referrals: Referral[];
  referralsLoading: boolean;
  referralsError: string | null;
  expandedGroup: "yourMove" | "matched" | "inProgress" | null;
  onSetExpandedGroup: (group: "yourMove" | "matched" | "inProgress" | null) => void;
  onSelectInterestedSponsor: (sponsor: InterestedSponsor) => void;
  onSelectWaitlistedJob: (job: WaitlistedJob) => void;
  onSelectJob: (job: JobOpportunity) => void;
  onSelectReferral: (referral: Referral) => void;
  matchRowCallbacks: MatchRowCallbacks;
}

/**
 * Applicant-view match sections — "one card per opportunity", grouped by
 * whose move it is: Your Move (sponsor interest + newly-sponsored waitlist
 * jobs) → Matched (mutual, ready to message) → In Progress (applied/
 * waitlisted/referred, passively tracked). Extracted from MatchesView as
 * part of the M3 section/row-builder breakup.
 */
export function ApplicantMatchesSections({
  matches,
  matchesLoading,
  matchesError,
  interestedSponsors,
  interestedSponsorsLoading,
  interestedSponsorsError,
  waitlistedJobs,
  waitlistedJobsLoading,
  waitlistedJobsError,
  likedJobs,
  likedJobsLoading,
  likedJobsError,
  referrals,
  referralsLoading,
  referralsError,
  expandedGroup,
  onSetExpandedGroup,
  onSelectInterestedSponsor,
  onSelectWaitlistedJob,
  onSelectJob,
  onSelectReferral,
  matchRowCallbacks,
}: ApplicantMatchesSectionsProps) {
  const sponsoredWaitlist = waitlistedJobs.filter((j) => j.is_now_sponsored);
  const pendingWaitlist = waitlistedJobs.filter((j) => !j.is_now_sponsored);
  const yourMoveCount = interestedSponsors.length + sponsoredWaitlist.length;
  const yourMoveLoading = interestedSponsorsLoading || waitlistedJobsLoading;
  const inProgressCount =
    likedJobs.length + pendingWaitlist.length + referrals.length;
  const inProgressLoading =
    likedJobsLoading || waitlistedJobsLoading || referralsLoading;
  const nothingToShow =
    !yourMoveLoading &&
    !matchesLoading &&
    !inProgressLoading &&
    yourMoveCount === 0 &&
    matches.length === 0 &&
    inProgressCount === 0;

  if (nothingToShow) {
    return <MatchesEmptyState userType="applicant" />;
  }

  const applicantYourMoveRows = [
    ...interestedSponsors.map((sponsor) => (
      <OpportunityRow
        key={sponsor.likeId}
        onPress={() => onSelectInterestedSponsor(sponsor)}
        leading={
          <Avatar
            photoUrl={sponsor.image}
            name={sponsor.name}
            size={48}
            borderRadius={16}
          />
        }
        title={sponsor.name}
        subtitle={
          sponsor.jobTitle || sponsor.jobCompany
            ? `Wants you for ${[sponsor.jobTitle, sponsor.jobCompany].filter(Boolean).join(" · ")}`
            : [sponsor.role, sponsor.company].filter(Boolean).join(" · ")
        }
        meta={
          sponsor.likedAt ? (
            <MetaLine
              icon={<Heart size={10} color="#DC2626" />}
              text={getRelativeTime(sponsor.likedAt)}
            />
          ) : undefined
        }
        cta="View"
      />
    )),
    ...sponsoredWaitlist.map((job) => (
      <OpportunityRow
        key={job.waitlist_id}
        onPress={() => onSelectWaitlistedJob(job)}
        leading={
          <CompanyLogo
            logoUrl={job.organization_logo}
            name={job.organization}
            size={48}
            borderRadius={16}
          />
        }
        title={job.title}
        subtitle={
          job.location ? `${job.organization} · ${job.location}` : job.organization
        }
        meta={
          <MetaLine
            icon={<Award size={10} color="#000" />}
            text="Now sponsored"
          />
        }
        cta="View"
      />
    )),
  ];

  const applicantMatchedRows = renderMatchRows(
    matches,
    {
      keyField: "sponsorUserId",
      getMessageUserId: (m) => m.applicantUserId,
    },
    matchRowCallbacks,
  );

  const applicantInProgressRows = [
    ...likedJobs.map((job) => (
      <OpportunityRow
        key={String(job.id)}
        onPress={() => onSelectJob(job)}
        leading={
          <CompanyLogo
            logoUrl={job.companyLogoUrl}
            name={job.company}
            size={48}
            borderRadius={16}
          />
        }
        title={job.title}
        subtitle={job.location ? `${job.company} · ${job.location}` : job.company}
        right={
          job.status === "MATCHED" ? (
            <StatusChip label="Matched" tone="active" />
          ) : (
            <StatusChip label="Pending" tone="waiting" />
          )
        }
      />
    )),
    ...pendingWaitlist.map((job) => (
      <OpportunityRow
        key={job.waitlist_id}
        onPress={() => onSelectWaitlistedJob(job)}
        leading={
          <CompanyLogo
            logoUrl={job.organization_logo}
            name={job.organization}
            size={48}
            borderRadius={16}
          />
        }
        title={job.title}
        subtitle={
          job.location ? `${job.organization} · ${job.location}` : job.organization
        }
        right={<StatusChip label="Waitlisted" tone="waiting" />}
      />
    )),
    ...referrals.map((referral, index) => {
      const isReferred = referral.status === "REFERRED";
      const sponsorName =
        [referral.sponsorFirstName, referral.sponsorLastName]
          .filter(Boolean)
          .join(" ") || "Your sponsor";
      return (
        <OpportunityRow
          key={`recv-referral-${referral.referralId || index}`}
          onPress={() => onSelectReferral(referral)}
          muted={!isReferred}
          leading={
            <CompanyLogo
              logoUrl={referral.jobLogoUrl}
              name={referral.jobCompany}
              size={48}
              borderRadius={16}
            />
          }
          title={referral.jobTitle || "Open Role"}
          subtitle={`Referred by ${sponsorName}`}
          meta={
            referral.createdAt ? (
              <MetaLine text={getRelativeTime(referral.createdAt)} />
            ) : undefined
          }
          right={
            <StatusChip
              label={isReferred ? "Referred" : "Withdrawn"}
              tone={isReferred ? "active" : "muted"}
            />
          }
          detail={
            isReferred ? (
              <PipelineStageTimeline currentStage={referral.checkInStage} />
            ) : undefined
          }
        />
      );
    }),
  ];

  return (
    <>
      <MatchSection
        title="Your Move"
        subtitle="Sponsors interested in you, and jobs that just found a sponsor"
        count={yourMoveCount}
        loading={yourMoveLoading}
        error={interestedSponsorsError || waitlistedJobsError}
        hidden={!yourMoveLoading && yourMoveCount === 0}
        maxRows={MATCH_SECTION_ROW_CAP}
        onSeeAll={() => onSetExpandedGroup("yourMove")}
      >
        {applicantYourMoveRows}
      </MatchSection>

      <MatchSection
        title="Matched"
        subtitle="You and the sponsor both said yes — start chatting"
        count={matches.length}
        loading={matchesLoading}
        error={matchesError}
        hidden={!matchesLoading && matches.length === 0}
        maxRows={MATCH_SECTION_ROW_CAP}
        onSeeAll={() => onSetExpandedGroup("matched")}
      >
        {applicantMatchedRows}
      </MatchSection>

      <MatchSection
        title="In Progress"
        subtitle="Jobs and referrals you're tracking"
        count={inProgressCount}
        loading={inProgressLoading}
        error={likedJobsError || referralsError}
        hidden={!inProgressLoading && inProgressCount === 0}
        maxRows={MATCH_SECTION_ROW_CAP}
        onSeeAll={() => onSetExpandedGroup("inProgress")}
      >
        {applicantInProgressRows}
      </MatchSection>

      <MatchListScreen
        visible={expandedGroup === "yourMove"}
        onClose={() => onSetExpandedGroup(null)}
        title="Your Move"
      >
        {applicantYourMoveRows}
      </MatchListScreen>
      <MatchListScreen
        visible={expandedGroup === "matched"}
        onClose={() => onSetExpandedGroup(null)}
        title="Matched"
      >
        {applicantMatchedRows}
      </MatchListScreen>
      <MatchListScreen
        visible={expandedGroup === "inProgress"}
        onClose={() => onSetExpandedGroup(null)}
        title="In Progress"
      >
        {applicantInProgressRows}
      </MatchListScreen>
    </>
  );
}
