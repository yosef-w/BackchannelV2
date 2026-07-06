import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface MatchSectionProps {
  title: string;
  /** One-line explainer under the title — most useful on "Your Move", since it's new vocabulary. */
  subtitle?: string;
  count: number;
  loading?: boolean;
  /** Surfaces a query error inline instead of silently showing an empty group. */
  error?: string | null;
  /** OpportunityRow elements. When there are more than `maxRows`, only the
   * first `maxRows` render and a "See all" row is appended. */
  children: React.ReactNode;
  maxRows?: number;
  onSeeAll?: () => void;
  /** Groups render nothing at all when there's nothing to show — the caller
   * decides emptiness (usually `count === 0 && !loading`) since some lists
   * mean something different at zero (e.g. hide vs. show a CTA). */
  hidden?: boolean;
}

/**
 * The shared group container for every Matches section (Your Move / Matched
 * / In Progress, both roles). One `#F9F9F9` rounded card with hairline
 * dividers between rows — the same shell NotificationsScreen/
 * PrivacySecurityScreen use in the Account redesign, so Matches now reads
 * as the same design system instead of a different screen bolted on.
 */
export function MatchSection({
  title,
  subtitle,
  count,
  loading,
  error,
  children,
  maxRows,
  onSeeAll,
  hidden,
}: MatchSectionProps) {
  if (hidden) return null;

  const rows = React.Children.toArray(children);
  const overflow = maxRows != null && rows.length > maxRows;
  const visibleRows = overflow ? rows.slice(0, maxRows) : rows;
  const lastVisibleIndex = visibleRows.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {!loading && count > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
      </View>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.group}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#999" />
          </View>
        ) : (
          <>
            {visibleRows.map((row, i) =>
              React.isValidElement(row)
                ? React.cloneElement(row as React.ReactElement<any>, {
                    isLast: !overflow && i === lastVisibleIndex,
                  })
                : row,
            )}
            {overflow && (
              <TouchableOpacity style={styles.seeAllRow} onPress={onSeeAll}>
                <Text style={styles.seeAllText}>
                  See all {count}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 28 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  countPill: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 11, fontWeight: "800", color: "#FFF" },
  subtitle: {
    fontSize: 12,
    color: "#999",
    marginBottom: 10,
    lineHeight: 16,
  },
  error: {
    fontSize: 12,
    color: "#DC2626",
    marginBottom: 10,
  },
  group: {
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
  },
  loadingRow: {
    paddingVertical: 20,
    alignItems: "center",
  },
  seeAllRow: {
    paddingVertical: 12,
    alignItems: "center",
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
});
