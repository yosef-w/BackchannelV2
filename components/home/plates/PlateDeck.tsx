// PlateDeck — the "Skim & Dive" deck card body.
//
// One long vertical page. Its first screen is a ROW of full-bleed plates
// (one idea each) that slides horizontally at decide-speed: tap the right
// two-thirds to advance, the left third to go back, or drag — the next
// plate peeks at the right edge so the gesture teaches itself. Scroll
// down from ANY plate and the page continues into the full read at
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
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
  FadeIn,
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
import { ANCHOR_HEIGHT, plateStyles as s } from "./plateStyles";
import {
  ReadSectionsContext,
  type ReadSectionsApi,
  type SectionId,
} from "./ReadSections";

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
  /** The full read — the existing card content in "read" presentation. */
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

  // The stage is whatever height the card area gives us; the plate row
  // fills it exactly, so the first view is one composed plate and nothing
  // from the read peeks up. Plates keep their content above the decide
  // band (PlateViews), and the read cue sits inside that band.
  const [stageHeight, setStageHeight] = useState(0);
  const rowHeight = stageHeight;
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

  // ── the read's section registry (ReadSections) ─────────────────────
  // Sections report their offsets as they lay out; a plate's cue scrolls
  // straight to its target section and flashes its landing hairline.
  const sectionsRef = useRef(new Map<SectionId, { y: number; label: string }>());
  const [flashId, setFlashId] = useState<SectionId | null>(null);
  const register = useCallback((id: SectionId, y: number, label: string) => {
    sectionsRef.current.set(id, { y, label });
  }, []);
  const sectionsApi = useMemo<ReadSectionsApi>(
    () => ({ register, flashId }),
    [register, flashId],
  );

  const rowHeightRef = useRef(0);
  rowHeightRef.current = rowHeight;

  const goToSection = useCallback(
    (id: SectionId) => {
      const entry = id === "top" ? undefined : sectionsRef.current.get(id);
      const y = entry
        ? Math.max(0, entry.y - ANCHOR_HEIGHT - 10)
        : Math.max(0, rowHeightRef.current - 4);
      scrollRef.current?.scrollTo({ y, animated: true });
      if (entry) {
        setFlashId(id);
        setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1400);
      }
    },
    [scrollRef],
  );

  // ── the anchor: on from plate two, or once the full read scrolls under it ──
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

  // "You are here" for the anchor: the plate position while skimming, the
  // section label once the read is under the strip.
  const [readLabel, setReadLabel] = useState<string | null>(null);
  const onScrollPos = useCallback((y: number) => {
    if (y < rowHeightRef.current * 0.7) {
      setReadLabel(null);
      return;
    }
    let label = "THE FULL READ";
    let bestY = -1;
    sectionsRef.current.forEach((v) => {
      if (v.y <= y + ANCHOR_HEIGHT + 24 && v.y > bestY) {
        bestY = v.y;
        label = v.label;
      }
    });
    setReadLabel(label);
  }, []);
  useAnimatedReaction(
    () => Math.round(scrollY.value / 16),
    (bucket, prev) => {
      if (bucket !== prev) runOnJS(onScrollPos)(bucket * 16);
    },
  );

  const posLabel = readLabel ?? `PLATE ${index + 1} / ${count}`;
  const cue = plates[index]?.readCta ?? "THE FULL READ ↓";

  // The read cue fades as soon as the read starts scrolling into view —
  // it has done its job.
  const readCueStyle = useAnimatedStyle(() => {
    const h = stage.value || 1;
    return {
      opacity: interpolate(scrollY.value, [0, h * 0.25], [1, 0], Extrapolation.CLAMP),
    };
  });

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
                  hint={i === 0 ? "SLIDE FOR MORE →" : undefined}
                  onTapZone={(zone) => goTo(zone === "forward" ? i + 1 : i - 1)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={s.readHead}>
          <Text style={s.readEyebrow}>THE FULL READ</Text>
          <Text style={s.readTitle}>
            Every detail, <Text style={s.accent}>in full.</Text>
          </Text>
        </View>
        <ReadSectionsContext.Provider value={sectionsApi}>
          {children}
        </ReadSectionsContext.Provider>
      </Animated.ScrollView>

      {/* The read cue — between ✕ and ✓, the decide band's free centre.
          box-none so only the label itself takes the tap. */}
      <Animated.View style={[s.readCue, readCueStyle]} pointerEvents="box-none">
        <Pressable
          onPress={() => goToSection(plates[index]?.readTarget ?? "top")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={cue.replace(" ↓", "").toLowerCase()}
        >
          <Animated.Text
            key={cue}
            entering={FadeIn.duration(220)}
            style={s.readCueText}
          >
            {cue}
          </Animated.Text>
        </Pressable>
      </Animated.View>

      {/* Pinned identity — pointerEvents none so it never steals a tap
          from the plate row or the full read beneath it. */}
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
