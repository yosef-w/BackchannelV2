import type { Job } from "@/types/jobs";
import { DollarSign, MapPin, MoreHorizontal, Users } from "@/components/ui/icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CompanyLogo } from "../ui/CompanyLogo";
import { StatusChip } from "../ui/StatusChip";

interface JobCardProps {
  job: Job;
  isSponsored?: boolean;
  /** Present on Browse cards only — its absence marks a My Sponsored card. */
  onSponsor?: () => void;
  onPress?: () => void;
  onMenu?: () => void;
  onApplicantPress?: () => void;
}

/**
 * A job listing card, shared by the Browse and My Sponsored tabs.
 *
 * Applicant counts only render on sponsored cards — the list is gated
 * behind sponsoring, and Browse data hardcodes the count to zero, so the
 * old always-on "0 Applicants" badge promised data that wasn't there.
 * Sponsored state reads as a StatusChip + black border instead of the old
 * banner + dimmed-card treatment, so "already sponsoring" no longer makes
 * a card look disabled.
 */
export function JobCard({
  job,
  isSponsored,
  onSponsor,
  onPress,
  onMenu,
  onApplicantPress,
}: JobCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, isSponsored && styles.cardSponsored]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <CompanyLogo
          logoUrl={job.image}
          name={job.company}
          size={52}
          borderRadius={16}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.companyName} numberOfLines={1}>
            {job.company}
          </Text>
          <Text style={styles.jobTitleText} numberOfLines={1}>
            {job.title}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={(e) => {
            e.stopPropagation();
            onMenu?.();
          }}
          activeOpacity={0.7}
        >
          <MoreHorizontal color="#999" size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.tagsRow}>
        <View style={styles.tag}>
          <MapPin size={10} color="#666" />
          <Text style={styles.tagText}>{job.location}</Text>
        </View>
        <View style={styles.tag}>
          <DollarSign size={10} color="#666" />
          <Text style={styles.tagText}>{job.salary}</Text>
        </View>
      </View>

      <Text style={styles.cardDescription} numberOfLines={2}>
        {job.description}
      </Text>

      <View style={styles.cardFooter}>
        {isSponsored ? (
          <TouchableOpacity
            onPress={onApplicantPress}
            activeOpacity={0.7}
            style={styles.applicantBadge}
          >
            <Users color="#000" size={12} />
            <Text style={styles.applicantText}>
              {job.applicants} Applicants
            </Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        {isSponsored ? (
          <StatusChip label="Sponsoring" tone="active" />
        ) : (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onSponsor?.();
            }}
            style={styles.sponsorBtn}
          >
            <Text style={styles.sponsorBtnText}>Sponsor</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 14,
    padding: 16,
  },
  cardSponsored: { borderColor: "#000", borderWidth: 1.5 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  headerInfo: { flex: 1 },
  companyName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  jobTitleText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.4,
  },
  moreBtn: { padding: 12, margin: -8, alignSelf: "flex-start" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: { fontSize: 12, fontWeight: "600", color: "#444" },
  cardDescription: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  applicantBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  applicantText: { fontSize: 12, fontWeight: "700", color: "#000" },
  sponsorBtn: {
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#000",
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 20,
    minWidth: 100,
    alignItems: "center",
  },
  sponsorBtnText: { fontSize: 13, fontWeight: "700", color: "#000" },
});
