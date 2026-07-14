/**
 * ApplicantJobsBrowseView
 *
 * Read-only job search for applicants, reachable from the Jobs tab
 * (previously sponsor-only). The daily 10-card deck is deliberately scarce
 * — this gives a motivated applicant who wants a specific company or role a
 * way to look beyond it, without touching the deck's connect-a-day economy:
 * there's no "like"/swipe here, only search, view details, and the existing
 * "join waitlist + request a sponsor" actions applicants already have
 * access to from the deck's non-sponsored-job flow (see HomeView's apply
 * modal — this reuses the exact same two API calls).
 *
 * Backend note: `GET /api/jobs/browse/` was built for a SPONSOR browsing
 * their own company's ATS listings (server-side filtered by the caller's
 * sponsor_profiles.COMPANY) — see docs/BACKEND_CHANGES_NEEDED.md §R for
 * why this may need a backend adjustment to return sensible cross-company
 * results for an applicant caller. Degrades to an empty "check back soon"
 * state rather than an error if the response comes back empty/unexpected.
 */

import {
  browseJobs,
  getWaitlistedJobs,
  joinWaitlist,
  requestSponsorForJob,
} from "@/lib/api";
import { formatSalary } from "@/types/jobs";
import type { BrowseJobResponse } from "@/types/jobs";
import {
  Briefcase,
  Check,
  MapPin,
  Search,
  X,
} from "@/components/ui/icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useToastStore } from "@/stores/useToastStore";
import { CompanyLogo } from "./ui/CompanyLogo";

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

export function ApplicantJobsBrowseView() {
  const showToast = useToastStore((s) => s.showToast);
  const [jobs, setJobs] = useState<BrowseJobResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [titleQuery, setTitleQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<BrowseJobResponse | null>(
    null,
  );
  const [waitlistedIds, setWaitlistedIds] = useState<Set<string>>(new Set());
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  const loadJobs = async (filters?: { title?: string; location?: string }) => {
    setLoading(true);
    try {
      const response = await browseJobs({
        title: filters?.title || undefined,
        location: filters?.location || undefined,
        limit: 50,
      });
      setJobs((response.jobs || []) as BrowseJobResponse[]);
    } catch (err) {
      console.warn("[ApplicantJobsBrowseView] Failed to browse jobs:", err);
      // Degrade to the empty state rather than an error screen — this
      // endpoint's behavior for an applicant caller isn't fully pinned
      // down server-side yet (see file header), so a failure here reads
      // more like "nothing to show" than a broken feature.
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // Applicants already have real waitlist entries from the deck's
    // non-sponsored-job apply flow — pre-mark those so this screen doesn't
    // offer to waitlist something they've already requested.
    getWaitlistedJobs()
      .then((res) => {
        setWaitlistedIds(
          new Set((res.jobs || []).map((j) => String(j.job_id))),
        );
      })
      .catch(() => {});
  }, []);

  const handleSearch = () => {
    loadJobs({ title: titleQuery.trim(), location: locationQuery.trim() });
  };

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Browse Jobs</Text>
          <Text style={styles.subtitle}>
            Search beyond your daily deck — join a waitlist or request a
            sponsor for any open role.
          </Text>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Search size={16} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Role title"
              placeholderTextColor="#BBB"
              value={titleQuery}
              onChangeText={setTitleQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
          <View style={styles.searchInputWrap}>
            <MapPin size={16} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Location"
              placeholderTextColor="#BBB"
              value={locationQuery}
              onChangeText={setLocationQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={handleSearch}
            activeOpacity={0.85}
          >
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color="#000" />
          </View>
        ) : jobs.length === 0 ? (
          <View style={styles.centerBlock}>
            <View style={styles.emptyIconCircle}>
              <Briefcase size={28} color="#CCC" />
            </View>
            <Text style={styles.emptyTitle}>No roles found</Text>
            <Text style={styles.emptySub}>
              {titleQuery || locationQuery
                ? "Try a different search, or check back soon."
                : "Check back soon for open roles, or try searching a specific title or location."}
            </Text>
          </View>
        ) : (
          jobs.map((job, index) => {
            const isDone = waitlistedIds.has(job.JOB_ID);
            return (
              <Animated.View
                key={job.JOB_ID}
                entering={FadeInUp.delay(Math.min(index, 10) * 40)}
              >
                <TouchableOpacity
                  style={styles.jobCard}
                  activeOpacity={0.85}
                  onPress={() => setSelectedJob(job)}
                >
                  <CompanyLogo
                    logoUrl={job.ORGANIZATION_LOGO ?? undefined}
                    name={job.ORGANIZATION}
                    size={48}
                    borderRadius={14}
                    initialFontSize={18}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobCardTitle} numberOfLines={1}>
                      {job.TITLE}
                    </Text>
                    <Text style={styles.jobCardCompany} numberOfLines={1}>
                      {job.ORGANIZATION}
                      {job.FULL_LOCATION ? ` · ${job.FULL_LOCATION}` : ""}
                    </Text>
                  </View>
                  {isDone && (
                    <View style={styles.jobCardDoneBadge}>
                      <Check size={12} color="#FFF" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* Job detail modal */}
      <Modal
        visible={!!selectedJob}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSelectedJob(null);
          setRequestMessage(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setSelectedJob(null);
              setRequestMessage(null);
            }}
          />
          {selectedJob && (
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <CompanyLogo
                  logoUrl={selectedJob.ORGANIZATION_LOGO ?? undefined}
                  name={selectedJob.ORGANIZATION}
                  size={52}
                  borderRadius={16}
                  initialFontSize={20}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalJobTitle}>
                    {selectedJob.TITLE}
                  </Text>
                  <Text style={styles.modalJobCompany}>
                    {selectedJob.ORGANIZATION}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedJob(null);
                    setRequestMessage(null);
                  }}
                  style={styles.modalCloseBtn}
                >
                  <X size={18} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ maxHeight: 320 }}
                contentContainerStyle={{ paddingBottom: 12 }}
              >
                <View style={styles.modalPillRow}>
                  {!!selectedJob.FULL_LOCATION && (
                    <View style={styles.modalPill}>
                      <MapPin size={11} color="#666" />
                      <Text style={styles.modalPillText}>
                        {selectedJob.FULL_LOCATION}
                      </Text>
                    </View>
                  )}
                  <View style={styles.modalPill}>
                    <Text style={styles.modalPillText}>
                      {formatSalary(
                        selectedJob.SALARY_ANNUAL_MIN,
                        selectedJob.SALARY_ANNUAL_MAX,
                        selectedJob.SALARY_CURRENCY,
                      )}
                    </Text>
                  </View>
                </View>

                {parseSkillsField(selectedJob.SKILLS).length > 0 && (
                  <View style={styles.modalChipsWrap}>
                    {parseSkillsField(selectedJob.SKILLS).map((skill) => (
                      <View key={skill} style={styles.modalChip}>
                        <Text style={styles.modalChipText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {!!selectedJob.DESCRIPTION_TEXT && (
                  <Text style={styles.modalDescription}>
                    {cleanJobText(selectedJob.DESCRIPTION_TEXT)}
                  </Text>
                )}
              </ScrollView>

              {requestMessage ? (
                <View style={styles.modalDoneBlock}>
                  <Check size={16} color="#000" strokeWidth={3} />
                  <Text style={styles.modalDoneText}>{requestMessage}</Text>
                </View>
              ) : waitlistedIds.has(selectedJob.JOB_ID) ? (
                <View style={styles.modalDoneBlock}>
                  <Check size={16} color="#000" strokeWidth={3} />
                  <Text style={styles.modalDoneText}>
                    You are on the waitlist for this role.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.modalActionBtn,
                    isRequesting && { opacity: 0.6 },
                  ]}
                  onPress={() => handleRequestSponsor(selectedJob)}
                  disabled={isRequesting}
                  activeOpacity={0.85}
                >
                  {isRequesting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.modalActionText}>
                      Get a Sponsor
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "800", color: "#000", letterSpacing: -0.8 },
  subtitle: { fontSize: 14, color: "#666", marginTop: 6, lineHeight: 20 },
  searchRow: { gap: 8, marginBottom: 20 },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#000" },
  searchBtn: {
    backgroundColor: "#000",
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  centerBlock: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 20 },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#000" },
  emptySub: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  jobCardTitle: { fontSize: 15, fontWeight: "700", color: "#000" },
  jobCardCompany: { fontSize: 13, color: "#999", marginTop: 2 },
  jobCardDoneBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E5E5E5",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  modalJobTitle: { fontSize: 18, fontWeight: "800", color: "#000" },
  modalJobCompany: { fontSize: 13, color: "#999", marginTop: 2 },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  modalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F5F5F5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modalPillText: { fontSize: 12, fontWeight: "600", color: "#666" },
  modalChipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  modalChip: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modalChipText: { fontSize: 11, fontWeight: "600", color: "#000" },
  modalDescription: { fontSize: 13, color: "#444", lineHeight: 20 },
  modalActionBtn: {
    backgroundColor: "#000",
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  modalActionText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  modalDoneBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F5F5",
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  modalDoneText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#000" },
});
