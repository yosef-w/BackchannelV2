// The read's section registry — how a plate deep-links into the full read.
//
// Each section of the read wraps itself in <ReadSection id label>; on layout
// it reports its offset (relative to the scroll content) to PlateDeck via
// context. PlateDeck can then scroll straight to any section, flash a
// hairline at its top so the landing is unmistakable, and show the section's
// label in the pinned anchor as the reader scrolls — a "you are here".
//
// Sections render identically without a provider (the classic card path),
// so the cards can wrap unconditionally.

import React, { createContext, useContext, useEffect } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Colors } from "@/constants/theme";

export type SectionId =
  | "top"
  | "glance"
  | "about"
  | "insights"
  | "skills"
  | "experience"
  | "education"
  | "certifications"
  | "languages"
  | "achievements"
  | "description"
  | "responsibilities"
  | "requirements"
  | "highlights"
  | "source"
  | "vouch";

export interface ReadSectionsApi {
  register: (id: SectionId, y: number, label: string) => void;
  /** The section whose landing hairline should flash right now. */
  flashId: SectionId | null;
}

export const ReadSectionsContext = createContext<ReadSectionsApi | null>(null);

export function ReadSection({
  id,
  label,
  children,
}: {
  id: SectionId;
  label: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(ReadSectionsContext);
  const flash = useSharedValue(0);
  const flashing = ctx?.flashId === id;

  useEffect(() => {
    if (!flashing) return;
    flash.value = 1;
    flash.value = withDelay(520, withTiming(0, { duration: 700 }));
  }, [flashing, flash]);

  const lineStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  return (
    <View
      onLayout={(e: LayoutChangeEvent) =>
        ctx?.register(id, e.nativeEvent.layout.y, label)
      }
    >
      {!!ctx && (
        <Animated.View style={[styles.flashLine, lineStyle]} pointerEvents="none" />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // The landing hairline — sits on the section's top edge, ink, and
  // breathes out after the scroll settles.
  flashLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.ink,
    opacity: 0,
  },
});
