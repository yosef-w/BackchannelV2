import React from "react";
import { Avatar } from "../ui/Avatar";
import { Match } from "./matchesQueries";
import { OpportunityRow } from "./OpportunityRow";

/**
 * A match exists per JOB_ID, so matching the same person on multiple roles
 * produces multiple cards with an identical name (and, on the applicant
 * side, an identical sponsor-title subtitle — literally indistinguishable).
 * Collapse them into one card per counterpart, keyed by the other person's
 * user id. The matched JOB rows stay separate underneath; only the card
 * collapses, and a "N roles" pill signals the multi-role relationship.
 */
const matchGroupKey = (
  m: Match,
  keyField: "sponsorUserId" | "applicantUserId",
) => (m[keyField] as string) || m.id;

function groupMatches(
  list: Match[],
  keyField: "sponsorUserId" | "applicantUserId",
) {
  const map = new Map<string, Match[]>();
  list.forEach((m) => {
    const key = matchGroupKey(m, keyField);
    const arr = map.get(key);
    if (arr) arr.push(m);
    else map.set(key, [m]);
  });
  // Preserve API order (matched_at DESC) for both groups and members; the
  // first member is the most-recent match and represents the group.
  return Array.from(map.values()).map((items) => ({
    key: matchGroupKey(items[0], keyField),
    items,
    latest: items[0],
  }));
}

/**
 * Render a section's matches as grouped rows. Single-match people render
 * exactly as before; multi-match people render one row with a roles pill
 * that opens the role picker instead of messaging/viewing directly. Used by
 * both roles' "Matched" MatchSection — only which fields represent "self"
 * vs. "counterpart" (keyField / getMessageUserId) differs.
 */
export function renderMatchRows(
  list: Match[],
  opts: {
    keyField: "sponsorUserId" | "applicantUserId";
    getMessageUserId: (m: Match) => string | undefined;
  },
  callbacks: {
    onOpenRoleGroup: (group: {
      items: Match[];
      getMessageUserId: (m: Match) => string | undefined;
    }) => void;
    onOpenProfile: (match: Match, mode: "view" | "message") => void;
    onMessageTapped: (match: Match, userId: string | undefined) => void;
  },
) {
  return groupMatches(list, opts.keyField).map((group) => {
    const match = group.latest;
    const grouped = group.items.length > 1;
    const openPicker = () =>
      callbacks.onOpenRoleGroup({
        items: group.items,
        getMessageUserId: opts.getMessageUserId,
      });
    const onRowPress = grouped
      ? openPicker
      : () => callbacks.onOpenProfile(match, "view");
    const onMessagePress = () => {
      if (grouped) {
        openPicker();
        return;
      }
      callbacks.onMessageTapped(match, opts.getMessageUserId(match));
    };
    return (
      <OpportunityRow
        key={group.key}
        onPress={onRowPress}
        leading={
          <Avatar
            photoUrl={match.image}
            name={match.name}
            size={48}
            borderRadius={16}
          />
        }
        title={match.name}
        subtitle={grouped ? `${group.items.length} roles` : match.role}
        cta="Message"
        onPressCta={onMessagePress}
      />
    );
  });
}
