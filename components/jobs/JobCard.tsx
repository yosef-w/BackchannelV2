import type { Job } from "@/types/jobs";
import {
  DollarSign,
  MapPin,
  MoreHorizontal,
} from "@/components/ui/icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CompanyLogo } from "../ui/CompanyLogo";
import { Colors } from "@/constants/theme";

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
 * A Browse-tab job listing — the old cards' anatomy (soft offWhite fill,
 * header → tag pills → footer action) in the rebrand's
 * language: hairline border, company caps overline, paper tag chips, an
 * outlined SPONSOR chip in the footer, and quiet "✓ SPONSORING" caps
 * once the role carries the sponsor's name (never a disabled-looking
 * card).
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
          {/* Two lines before truncating — real titles ("Senior Staff
              Software Engineer, Infrastructure") lose their meaning cut
              at one. */}
          <Text style={styles.title} numberOfLines={2}>
            {job.title}
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

      <View style={styles.cardFooter}>
        {isSponsored && !!onApplicantPress ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onApplicantPress();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 12 }}
          >
            <Text style={styles.applicantsLink}>
              {job.applicants === 1
                ? "1 APPLICANT ›"
                : `${job.applicants} APPLICANTS ›`}
            </Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        {isSponsored ? (
          <Text style={styles.sponsoringText}>✓ SPONSORING</Text>
        ) : (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onSponsor?.();
            }}
            style={styles.sponsorChip}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Sponsor ${job.title}`}
          >
            <Text style={styles.sponsorChipText}>SPONSOR</Text>
          </TouchableOpacity>
        )}
      </View>
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
  // Paper chips on the soft fill — the old tags, crisper.
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
  applicantsLink: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: Colors.ink,
  },
  sponsorChip: {
    borderWidth: 1.2,
    borderColor: Colors.ink,
    borderRadius: 999,
    backgroundColor: Colors.paper,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  sponsorChipText: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: Colors.ink,
  },
  sponsoringText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: Colors.muted,
  },
});
