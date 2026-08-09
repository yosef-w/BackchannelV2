/**
 * ApplicantJobsBrowseView
 *
 * Read-only job search for applicants, reachable from the Jobs tab
 * (previously sponsor-only). The daily 10-card deck is deliberately scarce
 * — this gives a motivated applicant who wants a specific company or role a
 * way to look beyond it, without touching the deck's connect-a-day economy:
 * there's no "like"/swipe here, only search, view details, and the existing
 * "join waitlist + request a sponsor" actions applicants already have
 * access to from the deck's non-sponsored-job flow.
 *
 * Backend: `GET /api/jobs/browse/` (§R, shipped 2026-07-21) is role-aware —
 * sponsors keep their own-company view unchanged; any other authenticated
 * caller (applicants) gets a cross-company search where `title` matches
 * title, organization, OR skills, plus real `limit`+`offset` pagination
 * and `IS_SPONSORED` per row for action branching. A hard failure (network
 * / non-2xx) falls back to clearly-labeled SAMPLE listings so the screen
 * never dead-ends offline; a genuine zero-result search shows the real
 * empty state instead — those are deliberately NOT the same code path.
 */

import {
  browseJobs,
  getWaitlistedJobs,
  joinWaitlist,
  likeJob,
  requestSponsorForJob,
} from "@/lib/api";
import { formatSalary } from "@/types/jobs";
import type { BrowseJobResponse } from "@/types/jobs";
import { Check, Heart, MapPin, Search, X } from "@/components/ui/icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  ZoomIn, FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useToastStore } from "@/stores/useToastStore";
import {
  BarFooter,
  canvasSheet,
  PosterHero,
  ReadMoreText,
  SectionCard,
  SkillChips,
  SkeletonCard,
  StatStrip,
} from "./matches/JobSheetKit";
import {
  DismissibleSheet,
  SheetScrollView,
} from "./ui/DismissibleSheet";
import { CompanyLogo } from "./ui/CompanyLogo";
import { MarketplaceGateModal } from "./jobs/MarketplaceGateModal";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { PREMIUM_ENABLED } from "@/constants/config";
import { Colors, Fonts, Type } from "@/constants/theme";

function parseSkillsField(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((s: unknown) => String(s).trim()).filter(Boolean);
      }
    } catch {
      // fall through to comma-split
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function cleanJobText(raw: string | null | undefined): string {
  if (!raw) return "";
  const noTags = raw
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h1|h2|h3|h4|h5|h6)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'");
  return noTags
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Sample listings shown only when the live search hard-fails (network /
 * non-2xx) — a genuinely empty result set gets the real empty state, not
 * these. IDs are prefixed so actions can be disabled; the list carries a
 * visible banner.
 */
const MOCK_ID_PREFIX = "sample-";
const MOCK_JOBS: BrowseJobResponse[] = [
  {
    JOB_ID: `${MOCK_ID_PREFIX}1`,
    TITLE: "Senior Data Engineer",
    ORGANIZATION: "Snowflake",
    FULL_LOCATION: "San Mateo, CA",
    DESCRIPTION_TEXT:
      "Build and scale the pipelines behind our analytics platform. You'll own ingestion end to end — modeling, orchestration, and the tooling other teams build on. We're looking for someone who treats data quality as a product, not a chore, and who's comfortable moving between Spark jobs and stakeholder conversations in the same afternoon.",
    EMPLOYMENT_TYPES: "Full-time",
    IS_REMOTE: false,
    SALARY_ANNUAL_MIN: 165000,
    SALARY_ANNUAL_MAX: 215000,
    SALARY_CURRENCY: "USD",
    EXPERIENCE_LEVEL: "Senior",
    SKILLS: '["Python","Spark","Airflow","Snowflake","dbt"]',
    DATE_POSTED: "2026-07-08",
    ORGANIZATION_LOGO: null,
  },
  {
    JOB_ID: `${MOCK_ID_PREFIX}2`,
    TITLE: "Product Designer",
    ORGANIZATION: "Figma",
    FULL_LOCATION: "New York, NY",
    DESCRIPTION_TEXT:
      "Design core editor experiences used by millions of designers daily. You'll partner with research and engineering from problem framing through polish, and you'll ship — our design team prototypes in production.",
    EMPLOYMENT_TYPES: "Full-time",
    IS_REMOTE: true,
    SALARY_ANNUAL_MIN: 140000,
    SALARY_ANNUAL_MAX: 185000,
    SALARY_CURRENCY: "USD",
    EXPERIENCE_LEVEL: "Mid-Senior",
    SKILLS: '["Product design","Prototyping","Design systems","Figma"]',
    DATE_POSTED: "2026-07-10",
    ORGANIZATION_LOGO: null,
    IS_SPONSORED: true,
  },
  {
    JOB_ID: `${MOCK_ID_PREFIX}3`,
    TITLE: "Backend Engineer, Payments",
    ORGANIZATION: "Stripe",
    FULL_LOCATION: "Seattle, WA",
    DESCRIPTION_TEXT:
      "Work on the money-movement rails that process billions in volume. High ownership, high scrutiny, high leverage — you'll write code where correctness genuinely matters and design reviews are a team sport.",
    EMPLOYMENT_TYPES: "Full-time",
    IS_REMOTE: false,
    SALARY_ANNUAL_MIN: 170000,
    SALARY_ANNUAL_MAX: 230000,
    SALARY_CURRENCY: "USD",
    EXPERIENCE_LEVEL: "Senior",
    SKILLS: '["Go","Ruby","Distributed systems","PostgreSQL"]',
    DATE_POSTED: "2026-07-11",
    ORGANIZATION_LOGO: null,
  },
  {
    JOB_ID: `${MOCK_ID_PREFIX}4`,
    TITLE: "Growth Marketing Manager",
    ORGANIZATION: "Notion",
    FULL_LOCATION: "Austin, TX",
    DESCRIPTION_TEXT:
      "Own paid and lifecycle experiments across our self-serve funnel. You'll run the full loop — hypothesis, launch, measure, decide — with a budget and the autonomy to spend it well.",
    EMPLOYMENT_TYPES: "Full-time",
    IS_REMOTE: true,
    SALARY_ANNUAL_MIN: 115000,
    SALARY_ANNUAL_MAX: 150000,
    SALARY_CURRENCY: "USD",
    EXPERIENCE_LEVEL: "Mid",
    SKILLS: '["Lifecycle marketing","SQL","A/B testing","Paid acquisition"]',
    DATE_POSTED: "2026-07-09",
    ORGANIZATION_LOGO: null,
  },
  {
    JOB_ID: `${MOCK_ID_PREFIX}5`,
    TITLE: "iOS Engineer",
    ORGANIZATION: "Airbnb",
    FULL_LOCATION: "San Francisco, CA",
    DESCRIPTION_TEXT:
      "Ship guest-facing features in one of the most polished consumer apps on the platform. Swift, careful animation work, and a design partnership tighter than most teams ever get.",
    EMPLOYMENT_TYPES: "Full-time",
    IS_REMOTE: false,
    SALARY_ANNUAL_MIN: 160000,
    SALARY_ANNUAL_MAX: 210000,
    SALARY_CURRENCY: "USD",
    EXPERIENCE_LEVEL: "Mid-Senior",
    SKILLS: '["Swift","SwiftUI","UIKit","GraphQL"]',
    DATE_POSTED: "2026-07-12",
    ORGANIZATION_LOGO: null,
    IS_SPONSORED: true,
  },
  {
    JOB_ID: `${MOCK_ID_PREFIX}6`,
    TITLE: "Customer Success Lead",
    ORGANIZATION: "Datadog",
    FULL_LOCATION: "Denver, CO",
    DESCRIPTION_TEXT:
      "Lead a pod of CSMs owning enterprise renewals and expansion. You'll be the customer's voice internally and the roadmap's translator externally.",
    EMPLOYMENT_TYPES: "Full-time",
    IS_REMOTE: true,
    SALARY_ANNUAL_MIN: 105000,
    SALARY_ANNUAL_MAX: 135000,
    SALARY_CURRENCY: "USD",
    EXPERIENCE_LEVEL: "Senior",
    SKILLS: '["Enterprise SaaS","Renewals","Onboarding","Salesforce"]',
    DATE_POSTED: "2026-07-07",
    ORGANIZATION_LOGO: null,
  },
];

/** Client-side filter for the sample listings so search still demos. */
function filterMocks(title: string, location: string): BrowseJobResponse[] {
  const t = title.trim().toLowerCase();
  const l = location.trim().toLowerCase();
  return MOCK_JOBS.filter((j) => {
    const matchesTitle =
      !t ||
      j.TITLE.toLowerCase().includes(t) ||
      j.ORGANIZATION.toLowerCase().includes(t) ||
      (j.SKILLS || "").toLowerCase().includes(t);
    const matchesLocation =
      !l ||
      j.FULL_LOCATION.toLowerCase().includes(l) ||
      (l === "remote" && j.IS_REMOTE);
    return matchesTitle && matchesLocation;
  });
}

const isMockJob = (job: BrowseJobResponse) =>
  job.JOB_ID.startsWith(MOCK_ID_PREFIX);

/** Debounce for search-as-you-type. */
const SEARCH_DEBOUNCE_MS = 400;
/** Results per page — also the "View more" page size via `offset`. */
const PAGE_SIZE = 20;

export function ApplicantJobsBrowseView() {
  const showToast = useToastStore((s) => s.showToast);
  const [jobs, setJobs] = useState<BrowseJobResponse[]>([]);
  const [showingSamples, setShowingSamples] = useState(false);
  const [loading, setLoading] = useState(true);
  const [titleQuery, setTitleQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<BrowseJobResponse | null>(
    null,
  );
  const [waitlistedIds, setWaitlistedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  // Premium velvet rope: browsing/searching stays free — ACTIONS are the
  // members' privilege. Non-null = the gate sheet is up, holding the
  // action the user attempted; a successful in-gate purchase runs it.
  // Inert while PREMIUM_ENABLED is false (isPremium is hardwired false
  // then, but the guard checks the flag first so behavior is unchanged).
  const [gateAction, setGateAction] = useState<(() => void) | null>(null);
  const isPremium = useSubscriptionStore((state) => state.isPremium);
  const guardPremium = (action: () => void) => {
    if (PREMIUM_ENABLED && !isPremium) {
      setGateAction(() => action);
      return;
    }
    action();
  };
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  // total_count powers "View more"'s visibility + remaining-count label.
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // Stale-response guard for the debounced search.
  const searchSeq = useRef(0);

  const loadJobs = async (
    title: string,
    location: string,
    offset: number,
    isMore = false,
  ) => {
    const seq = ++searchSeq.current;
    if (isMore) setLoadingMore(true);
    else setLoading(true);
    try {
      const response = await browseJobs({
        title: title.trim() || undefined,
        location: location.trim() || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      if (seq !== searchSeq.current) return; // superseded by a newer keystroke
      const live = (response.jobs || []) as BrowseJobResponse[];
      // offset > 0 ("View more") appends to what's already showing;
      // a fresh search (offset 0) replaces it outright.
      setJobs((prev) => (isMore ? [...prev, ...live] : live));
      setTotalCount(response.total_count ?? live.length);
      setShowingSamples(false);
    } catch (err) {
      console.warn("[ApplicantJobsBrowseView] Failed to browse jobs:", err);
      if (seq !== searchSeq.current) return;
      if (isMore) {
        // Don't blow away the real results already on screen — let them
        // retry the button instead of silently swapping in samples.
        showToast("Couldn't load more roles. Please try again.", "error");
      } else {
        // Hard failure (network / non-2xx) on the primary search — fall
        // back to samples so the screen still demos rather than dead-
        // ending. A genuinely empty SUCCESSFUL search never reaches this
        // branch (see the try above) — it renders the real "No roles
        // found" empty state instead.
        const mocks = filterMocks(title, location);
        setJobs(mocks);
        setTotalCount(mocks.length);
        setShowingSamples(true);
      }
    }
    if (seq === searchSeq.current) {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Initial load + waitlist pre-marks.
  useEffect(() => {
    loadJobs("", "", 0);
    getWaitlistedJobs()
      .then((res) => {
        setWaitlistedIds(
          new Set((res.jobs || []).map((j) => String(j.job_id))),
        );
      })
      .catch(() => {});

  }, []);

  // Search-as-you-type, debounced — no Search button to find.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      loadJobs(titleQuery, locationQuery, 0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);

  }, [titleQuery, locationQuery]);

  const handleRequestSponsor = async (job: BrowseJobResponse) => {
    setIsRequesting(true);
    setRequestMessage(null);
    const [requestRes] = await Promise.allSettled([
      requestSponsorForJob(job.JOB_ID),
      joinWaitlist(job.JOB_ID),
    ]);
    setIsRequesting(false);
    setWaitlistedIds((prev) => new Set([...prev, job.JOB_ID]));
    if (requestRes.status === "fulfilled") {
      setRequestMessage(requestRes.value.message ?? null);
    } else {
      showToast(
        "Couldn't send the request right now. Please try again.",
        "error",
      );
    }
  };

  // Sponsored roles get the deck's real action: a like (same
  // POST /api/jobs/like/ the home swipe uses), matches included.
  const handleLikeSponsored = async (job: BrowseJobResponse) => {
    setIsRequesting(true);
    try {
      const response = await likeJob(job.JOB_ID);
      setLikedIds((prev) => new Set([...prev, job.JOB_ID]));
      setRequestMessage(
        response.matched
          ? "It's a match! Find them in Matches."
          : "Interest sent — you'll match when the sponsor likes back.",
      );
    } catch (err) {
      console.warn("[ApplicantJobsBrowseView] Failed to like job:", err);
      showToast("Couldn't send your interest right now. Please try again.", "error");
    } finally {
      setIsRequesting(false);
    }
  };

  const closeDetail = () => {
    setSelectedJob(null);
    setRequestMessage(null);
  };

  // Detail-sheet derivations.
  const detailStats: { label: string; value: string }[] = [];
  if (selectedJob) {
    if (selectedJob.SALARY_ANNUAL_MIN || selectedJob.SALARY_ANNUAL_MAX) {
      detailStats.push({
        label: "Salary",
        value: formatSalary(
          selectedJob.SALARY_ANNUAL_MIN,
          selectedJob.SALARY_ANNUAL_MAX,
          selectedJob.SALARY_CURRENCY,
        ).replace(" - ", "–"),
      });
    }
    if (selectedJob.EXPERIENCE_LEVEL)
      detailStats.push({ label: "Level", value: selectedJob.EXPERIENCE_LEVEL });
    if (selectedJob.EMPLOYMENT_TYPES)
      detailStats.push({ label: "Type", value: selectedJob.EMPLOYMENT_TYPES });
  }
  const detailSkills = selectedJob ? parseSkillsField(selectedJob.SKILLS) : [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
          <Text style={styles.title}>
            The <Text style={styles.titleEm}>marketplace.</Text>
          </Text>
          <Text style={styles.subtitle}>
            Search beyond your daily deck — join a waitlist or request a
            sponsor for any open role.
          </Text>
        </Animated.View>

        {/* Search — as-you-type, with clear buttons; no Search button to
            hunt for. */}
        <View style={styles.searchStack}>
          <View style={styles.searchInputWrap}>
            <Search size={17} color={Colors.body} strokeWidth={2.2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Role, company, or skill"
              placeholderTextColor={Colors.muted}
              value={titleQuery}
              onChangeText={setTitleQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {titleQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setTitleQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Clear role search"
              >
                <X size={15} color={Colors.muted} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.searchInputWrap}>
            <MapPin size={17} color={Colors.body} strokeWidth={2.2} />
            <TextInput
              style={styles.searchInput}
              placeholder={'Location (or "remote")'}
              placeholderTextColor={Colors.muted}
              value={locationQuery}
              onChangeText={setLocationQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {locationQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setLocationQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Clear location search"
              >
                <X size={15} color={Colors.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sample-data banner — honest about §R until the backend serves
            applicant callers. */}
        {showingSamples && !loading && jobs.length > 0 && (
          <Animated.View entering={FadeIn}>
            <Text style={styles.sampleBannerText}>
              Sample listings — live roles are coming soon.
            </Text>
          </Animated.View>
        )}

        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : jobs.length === 0 ? (
          <View style={styles.centerBlock}>
            <View style={styles.emptyIconCircle}>
              <Search size={26} color={Colors.muted} strokeWidth={2} />
            </View>
            <Text style={styles.emptyTitle}>No roles found</Text>
            <Text style={styles.emptySub}>
              Try a different role, company, or location.
            </Text>
          </View>
        ) : (
          <>
          {/* The market's size, stated — then the classifieds rules. */}
          <Text style={styles.countLine}>
            {(showingSamples ? jobs.length : totalCount) || jobs.length} OPEN
            {" "}ROLE
            {((showingSamples ? jobs.length : totalCount) || jobs.length) === 1
              ? ""
              : "S"}
          </Text>
          {jobs.map((job, index) => {
            const isDone =
              waitlistedIds.has(job.JOB_ID) || likedIds.has(job.JOB_ID);
            const doneLabel = likedIds.has(job.JOB_ID)
              ? "Liked"
              : "Waitlisted";
            return (
              <Animated.View
                key={job.JOB_ID}
                entering={FadeInUp.delay(Math.min(index, 8) * 40)}
              >
                <TouchableOpacity
                  style={styles.jobCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    // The search keyboard may be up — drop it so the
                    // detail sheet gets the whole bottom half.
                    Keyboard.dismiss();
                    setSelectedJob(job);
                  }}
                >
                  <CompanyLogo
                    logoUrl={job.ORGANIZATION_LOGO ?? undefined}
                    name={job.ORGANIZATION}
                    size={44}
                    borderRadius={12}
                    initialFontSize={18}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {/* Two lines before truncating — real titles ("Senior
                        Staff Software Engineer, Infrastructure") lose
                        their meaning cut at one. */}
                    <Text style={styles.jobCardTitle} numberOfLines={2}>
                      {job.TITLE}
                    </Text>
                    <Text style={styles.jobCardCompany} numberOfLines={1}>
                      {job.ORGANIZATION}
                      {job.FULL_LOCATION ? ` · ${job.FULL_LOCATION}` : ""}
                      {job.IS_REMOTE ? " · Remote" : ""}
                    </Text>
                  </View>
                  {/* Right column: the done-state, or the price in serif. */}
                  {isDone ? (
                    <Animated.View
                      entering={ZoomIn.duration(240)}
                      style={styles.doneChip}
                    >
                      <Check size={10} color={Colors.muted} strokeWidth={3} />
                      <Text style={styles.doneChipText}>
                        {doneLabel.toUpperCase()}
                      </Text>
                    </Animated.View>
                  ) : job.SALARY_ANNUAL_MIN || job.SALARY_ANNUAL_MAX ? (
                    <Text style={styles.jobRowSalary} numberOfLines={1}>
                      {formatSalary(
                        job.SALARY_ANNUAL_MIN,
                        job.SALARY_ANNUAL_MAX,
                        job.SALARY_CURRENCY,
                      ).replace(" - ", "–")}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
          </>
        )}

        {/* View More — real offset pagination: fetch the next page and
            append rather than refetching a larger window. */}
        {!loading && !showingSamples && jobs.length < totalCount && (
          <TouchableOpacity
            style={styles.viewMoreBtn}
            onPress={() =>
              loadJobs(titleQuery, locationQuery, jobs.length, true)
            }
            disabled={loadingMore}
            activeOpacity={0.75}
          >
            <Text style={styles.viewMoreText}>
              {loadingMore
                ? "Loading…"
                : `View more (${totalCount - jobs.length} remaining)`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Job detail — the same Gallery sheet language as every other job
          surface: poster hero, stat strip, cards, pinned action bar. */}
      <Modal
        visible={!!selectedJob}
        transparent
        animationType="none"
        onRequestClose={closeDetail}
      >
        <View style={styles.detailOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeDetail}
          />
          {selectedJob && (
            <DismissibleSheet
              scrollDismiss
              onDismiss={closeDetail}
              style={[styles.detailSheet, canvasSheet]}
            >
              <SheetScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                <PosterHero
                  logoUrl={selectedJob.ORGANIZATION_LOGO ?? undefined}
                  logoName={selectedJob.ORGANIZATION}
                  title={selectedJob.TITLE}
                  company={selectedJob.ORGANIZATION}
                  location={selectedJob.FULL_LOCATION || undefined}
                  remote={!!selectedJob.IS_REMOTE}
                  onClose={closeDetail}
                />
                <StatStrip stats={detailStats} />
                {/* Description first — it's what a candidate reads to
                    decide (PM feedback); the ATS skill wall follows,
                    capped by SkillChips. */}
                {!!selectedJob.DESCRIPTION_TEXT && (
                  <SectionCard title="About the Role">
                    <ReadMoreText
                      text={cleanJobText(selectedJob.DESCRIPTION_TEXT)}
                    />
                  </SectionCard>
                )}
                {detailSkills.length > 0 && (
                  <SectionCard title="Skills">
                    <SkillChips skills={detailSkills} />
                  </SectionCard>
                )}
              </SheetScrollView>

              {isMockJob(selectedJob) ? (
                // Samples show the REAL action (disabled) so both CTA
                // types are visualizable before §R lands.
                <BarFooter
                  context={{
                    title: "Sample listing",
                    sub: "Actions unlock on live roles",
                  }}
                  button={{
                    label: selectedJob.IS_SPONSORED
                      ? "Like this Role"
                      : "Get a Sponsor",
                    icon: selectedJob.IS_SPONSORED ? (
                      <Heart color="#FFF" size={16} strokeWidth={2.5} />
                    ) : undefined,
                    disabled: true,
                    onPress: () => {},
                  }}
                />
              ) : requestMessage ? (
                <BarFooter
                  context={{ title: requestMessage, done: true }}
                  button={{ label: "Done", onPress: closeDetail }}
                />
              ) : likedIds.has(selectedJob.JOB_ID) ? (
                <BarFooter
                  context={{
                    title: "Interest sent",
                    sub: "You'll match when the sponsor likes back",
                    done: true,
                  }}
                />
              ) : waitlistedIds.has(selectedJob.JOB_ID) ? (
                <BarFooter
                  context={{
                    title: "You're on the waitlist",
                    sub: "We'll notify you when a sponsor picks this up",
                    done: true,
                  }}
                />
              ) : selectedJob.IS_SPONSORED ? (
                // Sponsored — the deck's real action: like it, match and
                // all, exactly as a right-swipe on Home would.
                <BarFooter
                  button={{
                    label: "Like this Role",
                    icon: <Heart color="#FFF" size={16} strokeWidth={2.5} />,
                    loading: isRequesting,
                    spinnerOnLoading: true,
                    onPress: () =>
                      guardPremium(() => handleLikeSponsored(selectedJob)),
                  }}
                />
              ) : (
                <BarFooter
                  button={{
                    label: "Get a Sponsor",
                    loading: isRequesting,
                    spinnerOnLoading: true,
                    onPress: () =>
                      guardPremium(() => handleRequestSponsor(selectedJob)),
                  }}
                />
              )}
            </DismissibleSheet>
          )}

          {/* Rendered inside the detail Modal so it stacks above the
              sheet (a sibling outside the Modal never would). */}
          <MarketplaceGateModal
            visible={!!gateAction}
            onClose={() => setGateAction(null)}
            onUnlocked={() => gateAction?.()}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // #FFF to match every other tab screen (Home/Matches/Jobs) — the
  // canvas tint is for SHEETS; screens are white.
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  header: { marginBottom: 18 },
  title: {
    ...Type.title,
    fontSize: 28,
    lineHeight: 32,
    color: Colors.ink,
  },
  titleEm: { fontFamily: Fonts.serifItalic, color: Colors.muted },
  subtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 14,
    color: Colors.body,
    marginTop: 6,
    lineHeight: 20,
  },
  searchStack: { marginBottom: 4 },
  // Letterpress rule-line inputs (AC "Listings") — no filled boxes; each
  // field is a hairline underline, the classifieds' own vocabulary.
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 2,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    // The wrap owns the height — zero the input's own padding and pin
    // vertical centering so the placeholder can't ride low (Android adds
    // default vertical + font ascent padding otherwise).
    paddingVertical: 0,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  // Serif-italic footnote — honest, quiet, editorial.
  sampleBannerText: {
    fontFamily: Fonts.serifItalic,
    fontSize: 13,
    color: Colors.muted,
    marginTop: 10,
  },
  centerBlock: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  // Below the serif's ~18px floor (constants/theme.ts) — too small to read
  // cleanly in DM Serif Display, so this keeps the system font, token color only.
  emptyTitle: { fontSize: 17, fontWeight: "800", color: Colors.ink },
  emptySub: {
    fontSize: 13,
    color: Colors.body,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  // The market's size, stated — doubles as the list's top rule.
  countLine: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 2,
    color: Colors.muted,
    marginTop: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  // Flat classifieds rows between hairlines (AC "Listings") — the cards,
  // shadows, and recessed logo tiles retire.
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  jobCardTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: Colors.ink,
    lineHeight: 19,
  },
  // Company · location in the caps ledger-key voice.
  jobCardCompany: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: Colors.body,
    marginTop: 3,
  },
  // The price, in serif — the site's stat-number language.
  jobRowSalary: {
    fontFamily: Fonts.serif,
    fontSize: 14.5,
    color: Colors.ink,
    marginLeft: 8,
  },
  doneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 8,
  },
  doneChipText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: Colors.muted,
  },
  detailOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  detailSheet: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    // Fixed (not max) height — same stuck-sheet class as the Matches
    // sheets: a fixed frame presents full-height from the first frame
    // and nothing can clip outside the scroll. Absolute px — a % would
    // resolve against DismissibleSheet's content-sized gesture root.
    height: Dimensions.get("window").height * 0.88,
  },
  // Quiet centered link — the ledger's "there is more" note.
  viewMoreBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  viewMoreText: { fontSize: 13, fontWeight: "700", color: Colors.muted },
});
