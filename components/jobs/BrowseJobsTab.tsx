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
                    <ChevronRight size={18} color="#BBB" />
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
        <Search size={16} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search roles or locations"
          placeholderTextColor="#BBB"
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
            <X size={16} color="#999" />
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
                <View style={styles.sponsoredTogglePill}>
                  <Text style={styles.sponsoredTogglePillText}>
                    {sponsoredInBrowse.length}
                  </Text>
                </View>
                <View style={{ flex: 1 }} />
                <ChevronRight
                  size={16}
                  color="#BBB"
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
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  didYouMeanTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  didYouMeanSub: {
    fontSize: 14,
    color: "#666",
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
    borderColor: "#EEE",
    overflow: "hidden",
  },
  didYouMeanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
  },
  didYouMeanRowText: { flex: 1, minWidth: 0 },
  didYouMeanRowName: { fontSize: 15, fontWeight: "700", color: "#111" },
  didYouMeanRowMeta: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
    marginTop: 1,
  },
  didYouMeanFootnote: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 22,
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  didYouMeanCreateBtn: {
    backgroundColor: "#000",
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#000" },
  noMatchesWrap: { paddingVertical: 32, alignItems: "center" },
  noMatchesText: { fontSize: 14, color: "#999", fontWeight: "600" },
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    letterSpacing: -0.2,
  },
  sponsoredToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  sponsoredToggleText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
  },
  sponsoredTogglePill: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  sponsoredTogglePillText: { fontSize: 11, fontWeight: "800", color: "#FFF" },
});
