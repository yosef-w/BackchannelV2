import type { Job } from "@/types/jobs";
import { MoreHorizontal } from "@/components/ui/icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CompanyLogo } from "../ui/CompanyLogo";
import { Colors, Fonts } from "@/constants/theme";

interface SponsoredJobCardProps {
  job: Job;
  onPress?: () => void;
  onMenu?: () => void;
  onApplicantPress?: () => void;
}

/**
 * A sponsored job as a management row — 2026-08 "Desk" rebrand. The
 * Sponsoring tab is where a sponsor runs their book, so the row leads
 * with momentum: a serif applicant count sits where the marketplace
 * puts the price (tappable — it opens the applicant list), an ink
 * "N NEW" pill flags unactioned interest, and a role nobody has liked
 * yet reads QUIET honestly. No description — the sponsor knows their
 * own job; what changed since they last looked is the point.
 */
export function SponsoredJobCard({
  job,
  onPress,
  onMenu,
  onApplicantPress,
}: SponsoredJobCardProps) {
  const pending = job.pendingApplicants ?? 0;
  const applicants = job.applicants ?? 0;
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <CompanyLogo
        logoUrl={job.image}
        name={job.company}
        size={52}
        borderRadius={14}
        initialFontSize={21}
      />
      <View style={styles.main}>
        {/* Two lines before truncating — real titles lose their meaning
            cut at one. */}
        <Text style={styles.title} numberOfLines={2}>
          {job.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[job.location, job.salary].filter(Boolean).join(" · ")}
        </Text>
        {pending > 0 && (
          <View style={styles.newPill}>
            <Text style={styles.newPillText}>{pending} NEW</Text>
          </View>
        )}
      </View>

      {/* The row's "price": who wants this role. Tappable → applicants. */}
      <TouchableOpacity
        style={styles.countCol}
        onPress={(e) => {
          e.stopPropagation();
          onApplicantPress?.();
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          applicants === 1
            ? "View 1 applicant"
            : `View ${applicants} applicants`
        }
      >
        <Text style={[styles.countNum, applicants === 0 && styles.countZero]}>
          {applicants}
        </Text>
        <Text style={styles.countLabel}>
          {applicants === 0
            ? "QUIET"
            : applicants === 1
              ? "APPLICANT"
              : "APPLICANTS"}
        </Text>
      </TouchableOpacity>

      {!!onMenu && (
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={(e) => {
            e.stopPropagation();
            onMenu();
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          accessibilityLabel="More options"
        >
          <MoreHorizontal color={Colors.faint} size={18} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Mid-weight management rows — see JobCard for the rationale.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  main: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.ink,
    lineHeight: 21,
    letterSpacing: -0.3,
  },
  meta: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: Colors.body,
    marginTop: 4,
  },
  newPill: {
    alignSelf: "flex-start",
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 7,
  },
  newPillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: Colors.paper,
  },
  countCol: {
    alignItems: "flex-end",
    minWidth: 56,
  },
  // The serif stat-number voice.
  countNum: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 27,
    color: Colors.ink,
  },
  countZero: { color: Colors.faint },
  countLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    color: Colors.faint,
    marginTop: 2,
  },
  moreBtn: { padding: 4, marginLeft: -4 },
});
