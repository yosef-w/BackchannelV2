// PlateDeck — the "Skim & Dive" deck card body.
//
// One long vertical page. Its first screen is a ROW of full-bleed plates
// (one idea each) that slides horizontally at decide-speed: tap the right
// two-thirds to advance, the left third to go back, or drag — the next
// plate peeks at the right edge so the gesture teaches itself. Scroll
// down from ANY plate and the page continues into the full dossier at
// read-speed (the existing card content, minus the hero the plates already
// carried), with the identity strip going sticky as it passes. The
// floating ✕/✓ decide from anywhere; nothing below the fold is required.
//
// Owns the vertical Animated.ScrollView so HomeView's hide-on-scroll chrome
// handler and scroll ref keep working unchanged — HomeView just swaps this
// in for its old ScrollView and feeds it the same props. Reports the plate
// position up so the deck gauge can tick the current card's segment in
// quarters (one bar answers "which card" AND "where in it").

import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { Plate, PlateAnchor } from "./plateContent";
import { PlateView } from "./PlateViews";
import { plateStyles as s, ROW_CLEARANCE, ROW_MIN_HEIGHT } from "./plateStyles";

/** How much of the next plate shows at the right edge — the slide affordance. */
const PEEK = 22;

type AnimatedScrollProps = React.ComponentProps<typeof Animated.ScrollView>;

interface PlateDeckProps {
  plates: Plate[];
  anchor: PlateAnchor;
  /** HomeView's ref — it scrolls to top on card change. */
  scrollRef: React.RefObject<ScrollView | null>;
  /** HomeView's chrome hide-on-scroll worklet handler. */
  onScroll: AnimatedScrollProps["onScroll"];
  /** Vertical offset mirrored by HomeView's handler — drives the anchor. */
  scrollY: SharedValue<number>;
  /** The parent's horizontal padding, cancelled so plates run edge to edge. */
  bleed: number;
  onPlateChange?: (index: number, count: number) => void;
  /** The dossier — the existing card content in "dossier" presentation. */
  children: React.ReactNode;
}

export function PlateDeck({
  plates,
  anchor,
  scrollRef,
  onScroll,
  scrollY,
  bleed,
  onPlateChange,
  children,
}: PlateDeckProps) {
  const { width: screenWidth } = useWindowDimensions();
  const plateWidth = screenWidth - PEEK;
  const count = plates.length;

  // The stage is whatever height the card area gives us. The plate row
  // takes the stage minus a clearance band at the bottom (the floating
  // ✕/✓ and the tab bar live there), so plate one is the first impression
  // AND its foot is never under the chrome.
  const [stageHeight, setStageHeight] = useState(0);
  const rowHeight = Math.max(ROW_MIN_HEIGHT, stageHeight - ROW_CLEARANCE);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setStageHeight(Math.round(e.nativeEvent.layout.height));
  }, []);

  const rowRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  const commitIndex = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(count - 1, next));
      if (clamped === indexRef.current) return;
      indexRef.current = clamped;
      setIndex(clamped);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [count],
  );

  useEffect(() => {
    onPlateChange?.(index, count);
  }, [index, count, onPlateChange]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(count - 1, next));
      rowRef.current?.scrollTo({ x: clamped * plateWidth, animated: true });
      commitIndex(clamped);
    },
    [count, plateWidth, commitIndex],
  );

  const onRowSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    commitIndex(Math.round(e.nativeEvent.contentOffset.x / plateWidth));
  };

  const openDossier = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, rowHeight - 4), animated: true });
  }, [scrollRef, rowHeight]);

  // ── the anchor: on from plate two, or once the dossier scrolls under it ──
  const anchorOn = useSharedValue(0);
  useEffect(() => {
    anchorOn.value = withTiming(index > 0 ? 1 : 0, { duration: 240 });
  }, [index, anchorOn]);
  const stage = useSharedValue(0);
  useEffect(() => {
    stage.value = rowHeight;
  }, [rowHeight, stage]);

  const anchorStyle = useAnimatedStyle(() => {
    const h = stage.value || 1;
    const fromScroll = interpolate(
      scrollY.value,
      [h * 0.45, h * 0.8],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const on = Math.max(anchorOn.value, fromScroll);
    return { opacity: on, transform: [{ translateY: (1 - on) * -10 }] };
  });

  const [inDossier, setInDossier] = useState(false);
  useAnimatedReaction(
    () => scrollY.value > (stage.value || 1) * 0.7,
    (now, prev) => {
      if (now !== prev) runOnJS(setInDossier)(now);
    },
  );

  const posLabel = inDossier ? "THE DOSSIER" : `PLATE ${index + 1} / ${count}`;

  return (
    <View style={s.root} onLayout={onLayout}>
      <Animated.ScrollView
        ref={scrollRef as never}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {stageHeight > 0 && (
          <View style={[s.rowWrap, { height: rowHeight, marginHorizontal: -bleed }]}>
            <ScrollView
              ref={rowRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={plateWidth}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              onMomentumScrollEnd={onRowSettle}
              onScrollEndDrag={onRowSettle}
              contentContainerStyle={{ paddingRight: PEEK }}
              bounces={false}
            >
              {plates.map((plate, i) => (
                <PlateView
                  key={`${plate.kind}-${i}`}
                  plate={plate}
                  width={plateWidth}
                  height={rowHeight}
                  underAnchor={i > 0}
                  hint={i === 0 ? "SLIDE FOR MORE  ·  SCROLL FOR THE FULL DOSSIER" : undefined}
                  onTapZone={(zone) => goTo(zone === "forward" ? i + 1 : i - 1)}
                  onOpenDossier={openDossier}
                />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={s.dossierHead}>
          <Text style={s.dossierEyebrow}>THE FULL DOSSIER</Text>
          <Text style={s.dossierTitle}>
            Every detail, <Text style={s.accent}>in full.</Text>
          </Text>
        </View>
        {children}
      </Animated.ScrollView>

      {/* Pinned identity — pointerEvents none so it never steals a tap
          from the plate row or the dossier beneath it. */}
      <Animated.View
        style={[s.anchor, { marginHorizontal: -bleed }, anchorStyle]}
        pointerEvents="none"
      >
        {anchor.logoName ? (
          <CompanyLogo logoUrl={anchor.image} name={anchor.logoName} size={42} borderRadius={11} initialFontSize={17} />
        ) : anchor.image ? (
          <Image
            source={{ uri: anchor.image }}
            style={s.anchorAvatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={s.anchorAvatarFallback}>
            <Text style={s.anchorAvatarInitial}>{(anchor.name || "?")[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={s.anchorText}>
          <Text style={s.anchorName} numberOfLines={1}>{anchor.name}</Text>
          {!!anchor.claim && (
            <Text style={s.anchorClaim} numberOfLines={1}>{anchor.claim}</Text>
          )}
        </View>
        <Text style={s.anchorPos}>{posLabel}</Text>
      </Animated.View>
    </View>
  );
}
