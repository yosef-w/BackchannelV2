import { Briefcase, DollarSign, MapPin } from "@/components/ui/icons";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { CompanyLogo } from "../../ui/CompanyLogo";

export interface JobPreviewFields {
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  logoUrl?: string | null;
}

interface JobPreviewCardProps {
  /** Field-by-field readiness — each row shimmers until its field arrives,
   * so the card visibly fills itself in as the scrape resolves instead of
   * popping from full-skeleton to full-content in one jump. */
  fields: JobPreviewFields;
  /** Which fields are still pending (shimmer) vs resolved (real text). */
  pending: {
    title?: boolean;
    company?: boolean;
    location?: boolean;
    salary?: boolean;
    type?: boolean;
  };
}

/**
 * The "magic import" card — the exact JobCard shape applicants will see,
 * rendered as a self-filling preview during the create-from-URL flow. Each
 * field independently swaps from a shimmering placeholder to real text the
 * moment its value resolves, so the sponsor watches their listing get built
 * in front of them instead of staring at a spinner.
 */
export function JobPreviewCard({ fields, pending }: JobPreviewCardProps) {
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 700 }),
        withTiming(0.35, { duration: 700 }),
      ),
      -1,
      true,
    );
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {pending.company ? (
          <Animated.View style={[styles.logoShimmer, shimmerStyle]} />
        ) : (
          <CompanyLogo
            logoUrl={fields.logoUrl}
            name={fields.company}
            size={52}
            borderRadius={16}
          />
        )}
        <View style={styles.headerInfo}>
          {pending.company ? (
            <Animated.View
              style={[styles.textShimmer, { width: "40%", height: 12 }, shimmerStyle]}
            />
          ) : (
            <Text style={styles.companyName} numberOfLines={1}>
              {fields.company || "Company"}
            </Text>
          )}
          {pending.title ? (
            <Animated.View
              style={[
                styles.textShimmer,
                { width: "70%", height: 18, marginTop: 6 },
                shimmerStyle,
              ]}
            />
          ) : (
            <Text style={styles.jobTitleText} numberOfLines={1}>
              {fields.title || "Job title"}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.tagsRow}>
        <PreviewTag
          icon={<MapPin size={10} color="#666" />}
          text={fields.location}
          pending={pending.location}
          placeholder="Location"
        />
        <PreviewTag
          icon={<DollarSign size={10} color="#666" />}
          text={fields.salary}
          pending={pending.salary}
          placeholder="Competitive"
        />
        <PreviewTag
          icon={<Briefcase size={10} color="#666" />}
          text={fields.type}
          pending={pending.type}
          placeholder="Full-time"
        />
      </View>
    </View>
  );
}

function PreviewTag({
  icon,
  text,
  pending,
  placeholder,
}: {
  icon: React.ReactNode;
  text: string;
  pending?: boolean;
  placeholder: string;
}) {
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 700 }),
        withTiming(0.35, { duration: 700 }),
      ),
      -1,
      true,
    );
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (pending) {
    return <Animated.View style={[styles.tagShimmer, shimmerStyle]} />;
  }
  return (
    <View style={styles.tag}>
      {icon}
      <Text style={styles.tagText} numberOfLines={1}>
        {text || placeholder}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F9F9F9",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  headerInfo: { flex: 1 },
  logoShimmer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EBEBEB",
  },
  textShimmer: {
    backgroundColor: "#EBEBEB",
    borderRadius: 4,
  },
  companyName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  jobTitleText: {
    fontSize: 19,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.4,
    marginTop: 3,
  },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagText: { fontSize: 12, fontWeight: "600", color: "#444" },
  tagShimmer: {
    width: 76,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#EBEBEB",
  },
});
