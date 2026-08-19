import type { Job } from "@/types/jobs";
import {
  ChevronRight,
  DollarSign,
  MapPin,
  MoreHorizontal,
} from "@/components/ui/icons";
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
 * A sponsored job as a management card — the old cards' anatomy (soft
 * offWhite fill, header → tag pills → footer action) in the rebrand's
 * language. The header carries the momentum: a serif applicant count on
 * the right (the marketplace's "price" position) with QUIET for roles
 * nobody has liked yet, and the footer is the applicants doorway — an
 * ink N NEW pill for unactioned interest plus VIEW APPLICANTS. No
 * description — the sponsor knows their own job; what changed since
 * they last looked is the point.
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
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.cardHeader}>
        <CompanyLogo
          logoUrl={job.image}
          name={job.company}
          size={52}
          borderRadius={14}
          initialFontSize={21}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.company} numberOfLines={1}>
            {job.company}
          </Text>
          {/* Two lines before truncating — real titles lose their meaning
              cut at one. */}
          <Text style={styles.title} numberOfLines={2}>
            {job.title}
          </Text>
        </View>
        <View style={styles.countCol}>
          <Text
            style={[styles.countNum, applicants === 0 && styles.countZero]}
          >
            {applicants}
          </Text>
          <Text style={styles.countLabel}>
            {applicants === 0
              ? "QUIET"
              : applicants === 1
                ? "APPLICANT"
                : "APPLICANTS"}
          </Text>
        </View>
        {!!onMenu && (
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={(e) => {
              e.stopPropagation();
              onMenu();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="More options"
          >
            <MoreHorizontal color={Colors.faint} size={18} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tagsRow}>
        {!!job.location && (
          <View style={styles.tag}>
            <MapPin size={10} color={Colors.body} />
            <Text style={styles.tagText} numberOfLines={1}>
              {job.location}
            </Text>
          </View>
        )}
        {!!job.salary && (
          <View style={styles.tag}>
            <DollarSign size={10} color={Colors.body} />
            <Text style={styles.tagText} numberOfLines={1}>
              {job.salary}
            </Text>
          </View>
        )}
      </View>

      {/* Footer — the applicants doorway. */}
      <TouchableOpacity
        style={styles.cardFooter}
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
        {pending > 0 ? (
          <View style={styles.newPill}>
            <Text style={styles.newPillText}>{pending} NEW</Text>
          </View>
        ) : (
          <View />
        )}
        <View style={styles.footerLinkRow}>
          <Text style={styles.footerLinkText}>VIEW APPLICANTS</Text>
          <ChevronRight size={14} color={Colors.ink} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.offWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 12,
  },
  headerInfo: { flex: 1, minWidth: 0 },
  company: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Colors.muted,
    marginBottom: 3,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.ink,
    lineHeight: 22,
    letterSpacing: -0.4,
  },
  countCol: {
    alignItems: "flex-end",
    minWidth: 52,
  },
  // The serif stat-number voice — who wants this role.
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
  moreBtn: {
    padding: 6,
    marginTop: -6,
    marginRight: -6,
    alignSelf: "flex-start",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tagText: { fontSize: 12, fontWeight: "600", color: Colors.body },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  newPill: {
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  newPillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: Colors.paper,
  },
  footerLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  footerLinkText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: Colors.ink,
  },
});
