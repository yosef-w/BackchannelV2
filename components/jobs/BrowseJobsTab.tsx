import type { AtsOrganization } from "@/lib/api";
import {
    Briefcase,
    ChevronRight,
    Search,
    X,
} from "@/components/ui/icons";
import type { Job } from "@/types/jobs";
import React from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { CompanyLogo } from "../ui/CompanyLogo";
import { JobCard } from "./JobCard";
import { JobsEmptyState } from "./JobsEmptyState";
import { Colors, Fonts, Type } from "@/constants/theme";

interface BrowseJobsTabProps {
  jobs: Job[];
  sponsorCompany: string | null | undefined;
  companySuggestions: AtsOrganization[];
  applyingCompany: string | null;
  onApplyCompany: (organization: string) => void;
  onOpenCreateModal: () => void;
  // Search / paging / collapse state lives in the parent so it survives tab
  // switches (this component unmounts when the tab changes).
  searchQuery: string;
  onSetSearchQuery: (q: string) => void;
  displayLimit: number;
  onLoadMore: () => void;
  showSponsoredInBrowse: boolean;
  onToggleSponsoredInBrowse: () => void;
  onSponsor: (job: Job) => void;
  onPressJob: (job: Job) => void;
  onMenuJob: (job: Job) => void;
  onApplicantPress: (job: Job) => void;
}

/**
 * Browse tab body — "did you mean…" company correction for an empty board,
 * client-side search over the loaded company-scoped list, the available-jobs
 * card list with staggered entrances and Load More, and the collapsed
 * "Already Sponsoring" section. Extracted from JobsView.
 */
export function BrowseJobsTab({
  jobs,
  sponsorCompany,
  companySuggestions,
  applyingCompany,
  onApplyCompany,
  onOpenCreateModal,
  searchQuery,
  onSetSearchQuery,
  displayLimit,
  onLoadMore,
  showSponsoredInBrowse,
  onToggleSponsoredInBrowse,
  onSponsor,
  onPressJob,
  onMenuJob,
  onApplicantPress,
}: BrowseJobsTabProps) {
  if (jobs.length === 0) {
    if (companySuggestions.length > 0) {
      /* "Did you mean…" — the board is empty for the sponsor's stored
         company, but the ATS has close matches. Likely a typo or
         naming-convention mismatch; offer one-tap fixes that update their
         company and reload the board. */
      return (
        <View style={styles.didYouMeanCard}>
          <View style={styles.didYouMeanIcon}>
            <Search size={28} color="#000" strokeWidth={2.5} />
          </View>
          <Text style={styles.didYouMeanTitle}>
            No jobs found for &ldquo;{sponsorCompany}&rdquo;
          </Text>
          <Text style={styles.didYouMeanSub}>
            We couldn&apos;t match that to a company in our listings. Did you mean
            one of these?
          </Text>

          <View style={styles.didYouMeanList}>
            {companySuggestions.map((org) => {
              const applying = applyingCompany === org.organization;
              return (
                <TouchableOpacity
                  key={org.organization}
                  style={styles.didYouMeanRow}
                  activeOpacity={0.7}
                  disabled={!!applyingCompany}
                  onPress={() => onApplyCompany(org.organization)}
                >
                  <CompanyLogo
                    logoUrl={org.logo_url ?? undefined}
                    name={org.organization}
                    size={38}
                    borderRadius={10}
                    initialFontSize={16}
                  />
                  <View style={styles.didYouMeanRowText}>
                    <Text style={styles.didYouMeanRowName} numberOfLines={1}>
                      {org.organization}
                    </Text>
                    {org.job_count > 0 && (
                      <Text style={styles.didYouMeanRowMeta}>
                        {org.job_count}{" "}
                        {org.job_count === 1 ? "open role" : "open roles"}
                      </Text>
                    )}
                  </View>
                  {applying ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <ChevronRight size={18} color={Colors.faint} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.didYouMeanFootnote}>
            Not here? Check the spelling in your profile, or create your own
            listing.
          </Text>
          <TouchableOpacity
            style={styles.didYouMeanCreateBtn}
            onPress={onOpenCreateModal}
            activeOpacity={0.85}
          >
            <Text style={styles.didYouMeanCreateText}>Create a Listing</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <JobsEmptyState
        icon={<Briefcase size={28} color="#000" strokeWidth={2} />}
        title="No available jobs"
        description="Check back soon for new opportunities, or create your own listing."
        actionText="Create Listing"
        onAction={onOpenCreateModal}
      />
    );
  }

  const q = searchQuery.trim().toLowerCase();
  const matchesQuery = (job: Job) =>
    !q ||
    job.title.toLowerCase().includes(q) ||
    (job.location || "").toLowerCase().includes(q);
  const availableJobs = jobs.filter((j) => !j.isSponsored && matchesQuery(j));
  const sponsoredInBrowse = jobs.filter(
    (j) => j.isSponsored && matchesQuery(j),
  );

  return (
    <>
      <View style={styles.searchWrap}>
        <Search size={16} color={Colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search roles or locations"
          placeholderTextColor={Colors.faint}
          value={searchQuery}
          onChangeText={onSetSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => onSetSearchQuery("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={16} color={Colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {availableJobs.length === 0 && sponsoredInBrowse.length === 0 ? (
        <View style={styles.noMatchesWrap}>
          <Text style={styles.noMatchesText}>No roles match your search</Text>
        </View>
      ) : (
        <>
          {/* Nothing left to sponsor (everything matching is already
              sponsored) — say so, or the list above the collapsed toggle
              just looks mysteriously empty. */}
          {availableJobs.length === 0 && (
            <View style={styles.noMatchesWrap}>
              <Text style={styles.noMatchesText}>
                {q
                  ? "Only roles you already sponsor match — see below"
                  : "You're sponsoring every open role at your company"}
              </Text>
            </View>
          )}
          {availableJobs.length > 0 && (
            <Text style={styles.countLine} numberOfLines={1}>
              {availableJobs.length} OPEN
              {sponsorCompany ? ` AT ${sponsorCompany.toUpperCase()}` : " ROLES"}
            </Text>
          )}
          {availableJobs.slice(0, displayLimit).map((job, index) => (
            <Animated.View
              key={job.id}
              // Cap the stagger — a full 20-card page shouldn't take a
              // second to finish animating in past the first screenful.
              entering={FadeInUp.delay(100 + Math.min(index, 8) * 40).duration(
                300,
              )}
            >
              <JobCard
                job={job}
                isSponsored={false}
                onSponsor={() => onSponsor(job)}
                onPress={() => onPressJob(job)}
                onMenu={() => onMenuJob(job)}
              />
            </Animated.View>
          ))}

          {/* Load More Button */}
          {availableJobs.length > displayLimit && (
            <TouchableOpacity style={styles.loadMoreBtn} onPress={onLoadMore}>
              <Text style={styles.loadMoreText}>Load More Jobs</Text>
              <ChevronRight size={16} color="#000" />
            </TouchableOpacity>
          )}

          {/* Jobs you already sponsor — collapsed out of the shopping list
              (same pattern as the inbox's Past Connections). */}
          {sponsoredInBrowse.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.sponsoredToggle}
                onPress={onToggleSponsoredInBrowse}
                activeOpacity={0.7}
              >
                <Text style={styles.sponsoredToggleText}>
                  ALREADY SPONSORING
                </Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.sponsoredTogglePillText}>
                  {sponsoredInBrowse.length}
                </Text>
                <ChevronRight
                  size={16}
                  color={Colors.faint}
                  style={
                    showSponsoredInBrowse && {
                      transform: [{ rotate: "90deg" }],
                    }
                  }
                />
              </TouchableOpacity>
              {showSponsoredInBrowse &&
                sponsoredInBrowse.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isSponsored
                    onPress={() => onPressJob(job)}
                    onMenu={() => onMenuJob(job)}
                    onApplicantPress={() => onApplicantPress(job)}
                  />
                ))}
            </>
          )}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  didYouMeanCard: {
    marginTop: 24,
    marginHorizontal: 4,
    alignItems: "center",
  },
  didYouMeanIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  didYouMeanTitle: {
    fontFamily: Type.heading.fontFamily,
    fontSize: 19,
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  didYouMeanSub: {
    fontSize: 14,
    color: Colors.body,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
    paddingHorizontal: 16,
  },
  didYouMeanList: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  didYouMeanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  didYouMeanRowText: { flex: 1, minWidth: 0 },
  didYouMeanRowName: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  didYouMeanRowMeta: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: "500",
    marginTop: 1,
  },
  didYouMeanFootnote: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 22,
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  didYouMeanCreateBtn: {
    backgroundColor: Colors.ink,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  didYouMeanCreateText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  // Letterpress rule-line input — matches the applicant marketplace.
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 2,
    height: 46,
    marginTop: 6,
  },
  // The market's size, stated — anchors where the list begins and keeps
  // the search from bleeding into the rows.
  countLine: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 2,
    color: Colors.muted,
    marginTop: 20,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "500", color: Colors.ink },
  noMatchesWrap: { paddingVertical: 32, alignItems: "center" },
  noMatchesText: { fontSize: 14, color: Colors.muted, fontWeight: "600" },
  // Quiet centered link — the ledger's "there is more" note.
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
    marginBottom: 8,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.muted,
  },
  // Collapsed drawer row — the inbox archive's language (hairline top
  // rule, serif count).
  sponsoredToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 14,
    marginTop: 20,
  },
  sponsoredToggleText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 0.8,
  },
  sponsoredTogglePillText: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    color: Colors.faint,
  },
});
