import type { Job } from "@/types/jobs";
import { MoreHorizontal } from "@/components/ui/icons";
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
 * A Browse-tab job listing — 2026-08 "Desk" rebrand: a flat classifieds
 * row between hairlines (the applicant marketplace's exact language —
 * one market, two sides), replacing the shadowed card. Square logo
 * tile, two-line title, location · salary in the caps ledger-key voice,
 * and the action on the right: an outlined SPONSOR chip, or quiet
 * "✓ SPONSORING" caps once the role carries the sponsor's name (never a
 * disabled-looking card). Sponsored rows keep their tappable applicant
 * count as a caps line under the meta.
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
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <CompanyLogo
        logoUrl={job.image}
        name={job.company}
        size={44}
        borderRadius={12}
        initialFontSize={18}
      />
      <View style={styles.main}>
        {/* Two lines before truncating — real titles ("Senior Staff
            Software Engineer, Infrastructure") lose their meaning cut
            at one. */}
        <Text style={styles.title} numberOfLines={2}>
          {job.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[job.location, job.salary].filter(Boolean).join(" · ")}
        </Text>
        {isSponsored && !!onApplicantPress && (
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
        )}
      </View>

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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  main: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 14.5,
    fontWeight: "700",
    color: Colors.ink,
    lineHeight: 19,
  },
  // Location · salary in the caps ledger-key voice.
  meta: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: Colors.body,
    marginTop: 3,
  },
  applicantsLink: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: Colors.ink,
    marginTop: 4,
  },
  // The row's action — outlined ink chip.
  sponsorChip: {
    borderWidth: 1.2,
    borderColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  sponsorChipText: {
    fontSize: 10,
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
  moreBtn: { padding: 4, marginLeft: -4 },
});
