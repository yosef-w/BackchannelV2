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
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { markDeckSwipeLearned, shouldPlayDeckSwipeHint } from "@/utils/deckSwipeHint";
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
  /** Fires on mount and whenever the plate changes — the gauge ticks. */
  onPlateChange?: (index: number, count: number) => void;
  /** The full read — the existing card content in "read" presentation. */
  children: React.ReactNode;
}

export interface PlateDeckHandle {
  goToSection: (id: SectionId) => void;
  scrollToTop: () => void;
}

export const PlateDeck = forwardRef<PlateDeckHandle, PlateDeckProps>(function PlateDeck(
  { plates, anchor, scrollRef, onScroll, scrollY, bleed, onPlateChange, children },
  ref,
) {
  // Deliberately window-derived, not container-measured: the plate row
  // cancels its parent's horizontal padding via `marginHorizontal: -bleed`
  // (below) so it always spans the full app window width, edge to edge —
  // an immersive full-bleed card, not clipped inside HomeView's capped
  // read column. That column cap (ScreenContainer below) only wraps the
  // read content that scrolls under the plates, never this row, so the
  // two never disagree about how wide the row actually renders.
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
      // Advancing past the first plate — by drag OR by tap, either counts —
      // is proof this device already knows the row slides. Retire the
      // swipe-teaching nudge for good; see deckSwipeHint's doc comment.
      if (clamped > 0) void markDeckSwipeLearned();
    },
    [count],
  );

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

  // Rotation, a Split View drag, or a Stage Manager resize changes
  // `plateWidth` (it's live off useWindowDimensions), but the ScrollView's
  // actual scroll offset doesn't move on its own — it stays at the OLD
  // `index * oldPlateWidth`, which now lands mid-plate or on the wrong
  // plate entirely under the new width. Snap it back to the correct
  // offset for the current index whenever the width changes. Instant,
  // not animated: this is a correction, not a user-initiated navigation,
  // so it should be invisible rather than visibly slide.
  useEffect(() => {
    rowRef.current?.scrollTo({ x: indexRef.current * plateWidth, animated: false });
  }, [plateWidth]);

  // ── swipe-teaching nudge: the first plate slides and springs back ──
  // The static peek + "SLIDE FOR MORE →" label weren't enough on their
  // own — testers didn't notice either cue on their first card. This
  // demonstrates the actual gesture instead of just hinting at it, but
  // only while shouldPlayDeckSwipeHint says this device still needs
  // teaching (see its doc comment for the exact play-count/learned
  // policy) and only when there's a second plate to reveal at all.
  const nudgeX = useSharedValue(0);
  const nudgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nudgeX.value }],
  }));
  useEffect(() => {
    if (count < 2) return;
    let cancelled = false;
    (async () => {
      const should = await shouldPlayDeckSwipeHint();
      if (cancelled || !should) return;
      // A beat to let the plate's own content register first, then slide
      // out, hold just long enough to read as deliberate, and spring back
      // with the same natural overshoot a released drag would have.
      nudgeX.value = withDelay(
        600,
        withSequence(
          withTiming(-40, { duration: 340, easing: Easing.out(Easing.cubic) }),
          withDelay(260, withSpring(0, { damping: 9, stiffness: 120, mass: 0.6 })),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per mount — PlateDeck remounts per card (see HomeView's
    // `key={currentItemId}`), which is exactly the "per card" granularity
    // shouldPlayDeckSwipeHint's cap is counting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** A real touch always wins — don't fight the user's own drag. */
  const cancelNudge = useCallback(() => {
    cancelAnimation(nudgeX);
    nudgeX.value = 0;
  }, [nudgeX]);

  // ── the read's section registry (ReadSections) ─────────────────────
  // Sections report their offsets as they lay out; a plate's cue scrolls
  // straight to its target section and flashes its landing hairline.
  //
  // Each ReadSection's onLayout `y` is relative to its own immediate
  // parent — which is the <ScreenContainer> column below, NOT the
  // ScrollView's content. That column's own onLayout `y` (captured here)
  // IS relative to the ScrollView (it's a direct child of it), so it's
  // exactly the piece missing from every section's reported position:
  // the height of the plate carousel above it. Without adding it back,
  // goToSection under-shoots by that entire amount — the scroll starts,
  // but stops well short of the tapped section.
  const readColumnOffsetRef = useRef(0);
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
        ? Math.max(
            0,
            readColumnOffsetRef.current + entry.y - ANCHOR_HEIGHT - 10,
          )
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
  const inRead = readLabel !== null;
  useEffect(() => {
    onPlateChange?.(index, count);
  }, [index, count, onPlateChange]);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollRef]);
  useImperativeHandle(ref, () => ({ goToSection, scrollToTop }), [goToSection, scrollToTop]);

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
              onScrollBeginDrag={cancelNudge}
              contentContainerStyle={{ paddingRight: PEEK }}
              bounces={false}
            >
              {plates.map((plate, i) => {
                const plateView = (
                  <PlateView
                    plate={plate}
                    width={plateWidth}
                    height={rowHeight}
                    underAnchor={i > 0}
                    hint={i === 0 ? "SLIDE FOR MORE →" : undefined}
                    readLabel={plate.readCta}
                    onOpenRead={() => goToSection(plate.readTarget)}
                    onTapZone={(zone) => goTo(zone === "forward" ? i + 1 : i - 1)}
                  />
                );
                // Only the first plate ever gets nudged — see the effect
                // above for when.
                return i === 0 ? (
                  <Animated.View key={`${plate.kind}-${i}`} style={nudgeStyle}>
                    {plateView}
                  </Animated.View>
                ) : (
                  <React.Fragment key={`${plate.kind}-${i}`}>
                    {plateView}
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* The full read runs at normal (padded) width already — this only
            matters on iPad, where that padded width is still ~130
            characters wide. Cap it to a real reading column, same as any
            other feed screen (lib/responsive's ScreenContainer).
            onLayout here feeds readColumnOffsetRef — see its comment by
            the section registry above for why goToSection needs it. */}
        <ScreenContainer
          variant="content"
          onLayout={(e) => {
            readColumnOffsetRef.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={s.readHead}>
            <Text style={s.readEyebrow}>THE FULL READ</Text>
            <Text style={s.readTitle}>
              Every detail, <Text style={s.accent}>in full.</Text>
            </Text>
          </View>
          <ReadSectionsContext.Provider value={sectionsApi}>
            {children}
          </ReadSectionsContext.Provider>
        </ScreenContainer>
      </Animated.ScrollView>

      {/* Pinned identity — box-none so only the "back up" label takes a
          tap; everything else passes through to the plates / the read. */}
      <Animated.View
        style={[s.anchor, { marginHorizontal: -bleed }, anchorStyle]}
        pointerEvents="box-none"
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
        {inRead ? (
          <Pressable onPress={scrollToTop} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to the plates">
            <Text style={s.anchorBack}>BACK UP ↑</Text>
          </Pressable>
        ) : (
          <Text style={s.anchorPos}>{posLabel}</Text>
        )}
      </Animated.View>
    </View>
  );
});
