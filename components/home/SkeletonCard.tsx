import React, { useEffect } from "react";
import { ScrollView, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/**
 * Shimmering placeholder shown while a profile/job card is loading.
 * Extracted from HomeView verbatim — it was already fully self-contained
 * (no props, no dependency on HomeView state).
 */
export function SkeletonCard() {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 }),
      ),
      -1,
      true,
    );
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    // flex:1 + alignSelf:"stretch" fills fullEmptyContainer top-to-bottom and
    // edge-to-edge, defeating its justifyContent:"center"/alignItems:"center".
    // paddingTop/paddingBottom mirror profileScrollContent so the skeleton hero
    // lands at the exact same Y position as a real profile's hero avatar.
    <ScrollView
      style={{ flex: 1, alignSelf: "stretch" }}
      contentContainerStyle={{ paddingTop: 4, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 24 }}>
        {/* 96×96 circular avatar */}
        <Animated.View
          style={[
            {
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: "#EBEBEB",
            },
            shimmerStyle,
          ]}
        />
        {/* Name shimmer ~60% */}
        <Animated.View
          style={[
            {
              backgroundColor: "#EBEBEB",
              width: "58%",
              height: 26,
              borderRadius: 6,
              marginTop: 16,
            },
            shimmerStyle,
          ]}
        />
        {/* Subtitle shimmer ~38% */}
        <Animated.View
          style={[
            {
              backgroundColor: "#EBEBEB",
              width: "38%",
              height: 16,
              borderRadius: 4,
              marginTop: 8,
            },
            shimmerStyle,
          ]}
        />
        {/* Fact-pill row */}
        <View
          style={{
            flexDirection: "row",
            gap: 7,
            marginTop: 14,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {([80, 90, 75, 65] as number[]).map((w, i) => (
            <Animated.View
              key={i}
              style={[
                {
                  backgroundColor: "#EBEBEB",
                  width: w,
                  height: 28,
                  borderRadius: 999,
                },
                shimmerStyle,
              ]}
            />
          ))}
        </View>
      </View>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <View
        style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 }}
      />

      {/* ── ABOUT section ────────────────────────────────────────── */}
      <View style={{ paddingVertical: 18 }}>
        {/* Section label */}
        <Animated.View
          style={[
            {
              backgroundColor: "#F0F0F0",
              width: "28%",
              height: 11,
              borderRadius: 4,
              marginBottom: 10,
            },
            shimmerStyle,
          ]}
        />
        {/* 3 body-text lines */}
        <View style={{ gap: 8 }}>
          <Animated.View
            style={[
              { backgroundColor: "#EBEBEB", height: 15, borderRadius: 4 },
              shimmerStyle,
            ]}
          />
          <Animated.View
            style={[
              { backgroundColor: "#EBEBEB", height: 15, borderRadius: 4 },
              shimmerStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                backgroundColor: "#EBEBEB",
                width: "70%",
                height: 15,
                borderRadius: 4,
              },
              shimmerStyle,
            ]}
          />
        </View>
      </View>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <View
        style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 }}
      />

      {/* ── AT-A-GLANCE stats strip ───────────────────────────────── */}
      <View style={{ paddingVertical: 18 }}>
        <Animated.View
          style={[
            {
              backgroundColor: "#F0F0F0",
              width: "38%",
              height: 11,
              borderRadius: 4,
              marginBottom: 10,
            },
            shimmerStyle,
          ]}
        />
        {/* 3-cell strip — single block that mirrors hingeStatsRow shape */}
        <Animated.View
          style={[
            {
              backgroundColor: "#F4F4F5",
              borderRadius: 16,
              height: 64,
              overflow: "hidden",
            },
            shimmerStyle,
          ]}
        />
      </View>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <View
        style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 }}
      />

      {/* ── INSIGHTS section ─────────────────────────────────────── */}
      <View style={{ paddingVertical: 18, gap: 10 }}>
        <Animated.View
          style={[
            {
              backgroundColor: "#F0F0F0",
              width: "32%",
              height: 11,
              borderRadius: 4,
            },
            shimmerStyle,
          ]}
        />
        {/* 2 insight card placeholders matching hingeInsightCard shape */}
        <Animated.View
          style={[
            {
              backgroundColor: "#F4F4F5",
              borderRadius: 14,
              height: 80,
              borderWidth: 1,
              borderColor: "#EFEFEF",
            },
            shimmerStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              backgroundColor: "#F4F4F5",
              borderRadius: 14,
              height: 80,
              borderWidth: 1,
              borderColor: "#EFEFEF",
            },
            shimmerStyle,
          ]}
        />
      </View>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <View
        style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 }}
      />

      {/* ── TOP SKILLS chips ─────────────────────────────────────── */}
      <View style={{ paddingVertical: 18 }}>
        <Animated.View
          style={[
            {
              backgroundColor: "#F0F0F0",
              width: "30%",
              height: 11,
              borderRadius: 4,
              marginBottom: 10,
            },
            shimmerStyle,
          ]}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {([70, 90, 60, 80, 75] as number[]).map((w, i) => (
            <Animated.View
              key={i}
              style={[
                {
                  backgroundColor: "#EBEBEB",
                  width: w,
                  height: 30,
                  borderRadius: 999,
                },
                shimmerStyle,
              ]}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
