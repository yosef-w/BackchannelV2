// ExpandableText — renders user-generated text safely:
//   • truncates to `numberOfLines` with an ellipsis,
//   • shows a "Read more" / "Show less" toggle only when the text actually
//     overflows (measured, not guessed), and
//   • leaves short text completely untouched (no toggle).
//
// Use this anywhere a free-text field of unbounded length is displayed (bios,
// achievements, job descriptions, insight answers) so one long entry can't
// push the rest of the layout off-screen.

import React, { useState } from "react";
import {
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  TouchableOpacity,
} from "react-native";
import { Colors } from "@/constants/theme";

interface ExpandableTextProps {
  children: string;
  /** Collapsed line count before truncating. */
  numberOfLines?: number;
  /** Style for the text itself. */
  style?: StyleProp<TextStyle>;
  /** Style for the "Read more" / "Show less" toggle. */
  toggleStyle?: StyleProp<TextStyle>;
  readMoreLabel?: string;
  readLessLabel?: string;
}

export function ExpandableText({
  children,
  numberOfLines = 4,
  style,
  toggleStyle,
  readMoreLabel = "Read more",
  readLessLabel = "Show less",
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  // `true` once we've confirmed the collapsed text overflowed. Until then we
  // don't render a toggle, so short text shows nothing extra.
  const [isTruncatable, setIsTruncatable] = useState(false);

  const text = children ?? "";
  if (!text) return null;

  return (
    <>
      <Text
        style={style}
        numberOfLines={expanded ? undefined : numberOfLines}
        // Fires with the laid-out lines on every layout pass (not just the
        // first) — a bio that fit collapsed at a wide window can truncate
        // after a rotation or a Split View resize, and the "Read more"
        // toggle needs to reflect that, not a stale first measurement.
        onTextLayout={(e) => {
          const overflowing = e.nativeEvent.lines.length > numberOfLines;
          setIsTruncatable((prev) =>
            prev === overflowing ? prev : overflowing,
          );
        }}
      >
        {text}
      </Text>

      {isTruncatable && (
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.6}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          <Text style={[styles.toggle, toggleStyle]}>
            {expanded ? readLessLabel : readMoreLabel}
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  toggle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.ink,
  },
});
