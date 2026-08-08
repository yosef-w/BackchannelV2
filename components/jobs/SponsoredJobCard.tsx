import type { Job } from "@/types/jobs";
import {
  ChevronRight,
  DollarSign,
  MapPin,
  MoreHorizontal,
  Users,
} from "@/components/ui/icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CompanyLogo } from "../ui/CompanyLogo";
import { Colors } from "@/constants/theme";

interface SponsoredJobCardProps {
  job: Job;
  onPress?: () => void;
  onMenu?: () => void;
  onApplicantPress?: () => void;
}

/**
 * A sponsored job as a management card — the My Sponsored tab is where a
 * sponsor runs their listings, so unlike the Browse JobCard this leads
 * with applicant activity: the real applicant count (LIKES_COUNT) and a
 * black "N new" pill for unactioned interest (PENDING_LIKES_COUNT), with
 * a View Applicants action. The 2-line description is dropped — the
 * sponsor knows their own job; what changed since they last looked is
 * the point.
 */
export function SponsoredJobCard({
  job,
  onPress,
  onMenu,
  onApplicantPress,
}: SponsoredJobCardProps) {
  const pending = job.pendingApplicants ?? 0;
  return (
    <TouchableOpacity
      style={styles.card}
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

      <TouchableOpacity
        style={styles.applicantsRow}
        onPress={(e) => {
          e.stopPropagation();
          onApplicantPress?.();
        }}
        activeOpacity={0.7}
      >
        <Users color="#000" size={15} strokeWidth={2.2} />
        <Text style={styles.applicantsText}>
          {job.applicants === 1
            ? "1 applicant"
            : `${job.applicants} applicants`}
        </Text>
        {pending > 0 && (
          <View style={styles.newPill}>
            <Text style={styles.newPillText}>
              {pending} new
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Text style={styles.viewApplicantsText}>View</Text>
        <ChevronRight size={16} color="#999" />
      </TouchableOpacity>
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
    color: Colors.muted,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Below the serif's ~18px floor in a dense list context.
  jobTitleText: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.ink,
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
  applicantsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  applicantsText: { fontSize: 14, fontWeight: "700", color: "#000" },
  newPill: {
    backgroundColor: "#000",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newPillText: { fontSize: 11, fontWeight: "800", color: "#FFF" },
  viewApplicantsText: { fontSize: 13, fontWeight: "700", color: "#666" },
});
