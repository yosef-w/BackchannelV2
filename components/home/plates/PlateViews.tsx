// The plate renderers — one composition per plate kind, all centered
// editorial type on paper. A plate is a Pressable whose tap steps the
// row: the right two-thirds advances, the left third goes back (the
// Stories convention). Dragging is the horizontal ScrollView's job; the
// Pressable never interferes with it.

import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { Image } from "expo-image";
import React from "react";
import {
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
} from "react-native";
import type { Plate, RichLine } from "./plateContent";
import { DECIDE_BAND, plateStyles as s } from "./plateStyles";

/** A serif line with italic-muted accent spans. */
export function Rich({
  line,
  style,
  numberOfLines,
}: {
  line: RichLine;
  style: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {line.map((seg, i) =>
        seg.accent ? (
          <Text key={i} style={s.accent}>
            {seg.text}
          </Text>
        ) : (
          <Text key={i}>{seg.text}</Text>
        ),
      )}
    </Text>
  );
}

function Avatar({ uri, name, styleKey }: { uri?: string; name: string; styleKey: "avatar" | "vouchAvatar" }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={s[styleKey]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
      />
    );
  }
  const fallback = styleKey === "avatar" ? s.avatarFallback : s.vouchAvatarFallback;
  const initial = styleKey === "avatar" ? s.avatarInitial : s.vouchAvatarInitial;
  return (
    <View style={fallback}>
      <Text style={initial}>{(name || "?")[0].toUpperCase()}</Text>
    </View>
  );
}

function Chips({ items, fillFirstIf }: { items: string[]; fillFirstIf?: string }) {
  if (items.length === 0) return null;
  return (
    <View style={s.chipsRow}>
      {items.map((label, i) => {
        const fill = !!fillFirstIf && label === fillFirstIf;
        return (
          <View key={`${i}-${label}`} style={[s.chip, fill && s.chipFill]}>
            <Text style={[s.chipText, fill && s.chipFillText]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function PlateBody({ plate }: { plate: Plate }) {
  switch (plate.kind) {
    case "placard":
      return (
        <>
          <Text style={s.eyebrow} numberOfLines={1}>{plate.eyebrow}</Text>
          <Avatar uri={plate.image} name={plate.name} styleKey="avatar" />
          <Text style={s.name} numberOfLines={2}>{plate.name}</Text>
          {!!plate.sub && (
            <Text style={s.sub} numberOfLines={1}>{plate.sub}</Text>
          )}
          <Rich line={plate.claim} style={s.claim} numberOfLines={3} />
        </>
      );
    case "brief":
      return (
        <>
          <Text style={s.eyebrow}>{plate.eyebrow}</Text>
          <Text style={s.brief} numberOfLines={7}>{plate.text}</Text>
        </>
      );
    case "record":
      return (
        <>
          <Text style={s.eyebrow}>{plate.eyebrow}</Text>
          <View style={s.statRow}>
            <Text style={s.stat}>{plate.stat}</Text>
            <Text style={s.statSuffix}>{plate.statSuffix}</Text>
          </View>
          {plate.statline.length > 0 && (
            <Rich line={plate.statline} style={s.statline} numberOfLines={2} />
          )}
          {plate.receipts.length > 0 && <View style={s.rule} />}
          {plate.receipts.map((r, i) => (
            <Text key={`${i}-${r}`} style={s.receipt} numberOfLines={1}>{r}</Text>
          ))}
        </>
      );
    case "voice":
      return (
        <>
          <Text style={s.quote} numberOfLines={7}>“{plate.quote}”</Text>
          <Text style={s.attribution} numberOfLines={2}>{plate.attribution}</Text>
        </>
      );
    case "role":
      return (
        <>
          <Text style={s.eyebrow} numberOfLines={1}>{plate.eyebrow}</Text>
          <View style={s.logoWrap}>
            <CompanyLogo
              logoUrl={plate.logoUrl}
              name={plate.company}
              size={88}
              borderRadius={20}
              initialFontSize={34}
            />
          </View>
          <Text style={s.title} numberOfLines={3}>{plate.title}</Text>
          {plate.sub.length > 0 && (
            <Rich line={plate.sub} style={s.roleSub} numberOfLines={2} />
          )}
        </>
      );
    case "needs":
      return (
        <>
          <Text style={s.eyebrow}>{plate.eyebrow}</Text>
          {plate.setupLine.length > 0 && (
            <Rich line={plate.setupLine} style={s.statline} numberOfLines={2} />
          )}
          <Chips items={plate.skills} />
          {!!plate.requirement && (
            <>
              <View style={s.rule} />
              <Text style={s.receipt} numberOfLines={3}>{plate.requirement}</Text>
            </>
          )}
        </>
      );
    case "vouch":
      return (
        <>
          <Text style={s.eyebrow}>THE VOUCH</Text>
          <Rich line={plate.statement} style={s.vouchStatement} numberOfLines={3} />
          <View style={s.vouchId}>
            <Avatar uri={plate.image} name={plate.sponsorName} styleKey="vouchAvatar" />
            <View style={{ flexShrink: 1 }}>
              <Text style={s.vouchName} numberOfLines={1}>{plate.sponsorName}</Text>
              {!!plate.sponsorRole && (
                <Text style={s.vouchRole} numberOfLines={1}>{plate.sponsorRole}</Text>
              )}
            </View>
          </View>
          {!!plate.quote && (
            <>
              <View style={s.rule} />
              <Text style={s.vouchQuote} numberOfLines={5}>“{plate.quote}”</Text>
              {!!plate.attribution && (
                <Text style={s.attribution} numberOfLines={2}>{plate.attribution}</Text>
              )}
            </>
          )}
          <Chips items={plate.chips} fillFirstIf="VERIFIED" />
        </>
      );
    case "fit":
      return (
        <>
          <Text style={s.eyebrow}>{plate.eyebrow}</Text>
          <Rich line={plate.line} style={s.fitLine} numberOfLines={4} />
          <Chips items={plate.receipts} />
        </>
      );
    default:
      return null;
  }
}

interface PlateViewProps {
  plate: Plate;
  width: number;
  height: number;
  /** Plates after the first sit under the pinned anchor strip. */
  underAnchor: boolean;
  /** Small caps line under the plate's content (the placard's slide cue). */
  hint?: string;
  /** The plate's deep link into the full read — "ALL EXPERIENCE ↓". */
  readLabel?: string;
  onOpenRead?: () => void;
  onTapZone: (zone: "back" | "forward") => void;
}

export function PlateView({
  plate,
  width,
  height,
  underAnchor,
  hint,
  readLabel,
  onOpenRead,
  onTapZone,
}: PlateViewProps) {
  const handlePress = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    onTapZone(x < width / 3 ? "back" : "forward");
  };
  return (
    <Pressable
      onPress={handlePress}
      style={[
        s.plate,
        { width, height, paddingBottom: DECIDE_BAND },
        underAnchor && s.plateUnderAnchor,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Next plate"
    >
      <View style={s.plateBody}>
        <PlateBody plate={plate} />
        {!!readLabel && (
          <Pressable
            onPress={onOpenRead}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={readLabel.replace(" ↓", "").toLowerCase()}
          >
            <Text style={s.readLink}>{readLabel}</Text>
          </Pressable>
        )}
        {!!hint && <Text style={s.slideHint}>{hint}</Text>}
      </View>
    </Pressable>
  );
}
