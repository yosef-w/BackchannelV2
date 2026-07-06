import { Briefcase, ChevronRight } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Avatar } from "../ui/Avatar";
import { StatusChip } from "../ui/StatusChip";

/**
 * The grouped Inbox list for one section (active / past / hidden).
 *
 * A conversation exists per JOB_ID, so matching the same person on N roles
 * yields N threads and the same name would repeat down the inbox. We
 * collapse threads by the other participant into a single row: one thread →
 * a normal row; multiple → a person row with a "N roles" pill that expands
 * (single-open accordion, state owned by the caller) into per-role
 * sub-threads. Threads stay separate underneath, so per-role context and
 * referrals are untouched — only the list collapses.
 */

export type InboxVariant = "active" | "past" | "hidden";

/** The subset of a conversation object the inbox rows actually read. */
export interface InboxConversation {
  id: string;
  otherParticipant?: {
    id?: string;
    name?: string;
    profileImageUrl?: string;
  };
  lastMessage?: { content?: string; createdAt?: string } | null;
  unreadCount?: number;
  jobContext?: {
    jobId?: string;
    jobTitle?: string;
    company?: string;
    logoUrl?: string;
  };
  role?: string;
}

interface InboxListProps {
  conversations: InboxConversation[];
  variant: InboxVariant;
  expandedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  onSelect: (conversationId: string) => void;
}

/** Normalize a backend ISO string to UTC (append 'Z' when no offset present). */
const normalizeToUtc = (s: string): string => {
  const t = s.trim();
  return /Z$/i.test(t) || /[+-]\d{2}:?\d{2}$/.test(t) ? s : `${s}Z`;
};

const formatInboxTime = (timestamp: string) => {
  const date = new Date(normalizeToUtc(timestamp));
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  // Guard against clock skew / future timestamps.
  if (diff < 0) return "just now";
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const convTimeMs = (conv: InboxConversation) => {
  const t = conv?.lastMessage?.createdAt;
  if (!t) return 0;
  const ms = new Date(t).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

const groupByParticipant = (list: InboxConversation[]) => {
  const map = new Map<string, InboxConversation[]>();
  list.forEach((c) => {
    const key = c.otherParticipant?.id || c.id;
    const arr = map.get(key);
    if (arr) arr.push(c);
    else map.set(key, [c]);
  });
  const groups = Array.from(map.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) => convTimeMs(b) - convTimeMs(a));
    return {
      key,
      items: sorted,
      latest: sorted[0],
      latestAt: convTimeMs(sorted[0]),
      // Count of threads with unread, used for the aggregated dot.
      unreadCount: items.reduce(
        (n, c) => n + ((c.unreadCount ?? 0) > 0 ? 1 : 0),
        0,
      ),
    };
  });
  groups.sort((a, b) => b.latestAt - a.latestAt);
  return groups;
};

function ConvAvatar({
  name,
  imageUrl,
  hidden,
  unread,
}: {
  name?: string;
  imageUrl?: string;
  hidden?: boolean;
  unread?: boolean;
}) {
  return (
    <View style={[styles.avatarWrapper, hidden && styles.avatarHidden]}>
      <Avatar photoUrl={imageUrl} name={name} size={48} borderRadius={16} />
      {unread && <View style={styles.unreadDot} />}
    </View>
  );
}

/** Right-hand slot of a row header: timestamp, or the Unmatched chip on past rows. */
function RowTrailing({
  conv,
  variant,
}: {
  conv: InboxConversation;
  variant: InboxVariant;
}) {
  if (variant === "past") {
    return <StatusChip label="Unmatched" tone="muted" />;
  }
  return (
    <Text style={styles.time}>
      {conv.lastMessage
        ? formatInboxTime(conv.lastMessage.createdAt!).toUpperCase()
        : variant === "hidden"
          ? "OLD"
          : "NEW"}
    </Text>
  );
}

function PreviewText({
  conv,
  variant,
  unread,
}: {
  conv: InboxConversation;
  variant: InboxVariant;
  unread?: boolean;
}) {
  return (
    <Text
      style={[
        styles.preview,
        variant !== "active" && styles.previewHidden,
        // Unread rows read as "something new here" at a glance, the way
        // every mainstream inbox bolds its unread previews.
        unread && styles.previewUnread,
      ]}
      numberOfLines={1}
    >
      {conv.lastMessage?.content ||
        (variant === "active" ? "Start a conversation..." : "No messages")}
    </Text>
  );
}

/** A single thread shown as a full inbox row (person primary). */
function LeafRow({
  conv,
  variant,
  isLast,
  onSelect,
}: {
  conv: InboxConversation;
  variant: InboxVariant;
  isLast: boolean;
  onSelect: (id: string) => void;
}) {
  const unread = variant === "active" && (conv.unreadCount ?? 0) > 0;
  // Threads exist per job in this product, but a leaf row previously never
  // said which one — the role only surfaced on grouped sub-rows. Show it
  // here too so every row answers "about what?" at a glance.
  const contextLine = [conv.jobContext?.jobTitle, conv.jobContext?.company]
    .filter(Boolean)
    .join(" · ");
  return (
    <TouchableOpacity
      onPress={() => onSelect(conv.id)}
      style={[styles.row, !isLast && styles.rowDivider]}
      activeOpacity={0.7}
    >
      <ConvAvatar
        name={conv.otherParticipant?.name}
        imageUrl={conv.otherParticipant?.profileImageUrl}
        hidden={variant !== "active"}
        unread={unread}
      />
      <View style={styles.main}>
        <View style={styles.rowHeader}>
          <Text
            style={[styles.name, variant !== "active" && styles.nameHidden]}
            numberOfLines={1}
          >
            {conv.otherParticipant?.name}
          </Text>
          <RowTrailing conv={conv} variant={variant} />
        </View>
        {!!contextLine && (
          <Text style={styles.contextLine} numberOfLines={1}>
            {contextLine}
          </Text>
        )}
        <PreviewText conv={conv} variant={variant} unread={unread} />
      </View>
    </TouchableOpacity>
  );
}

/** A per-role thread inside an expanded group — role/job primary, since the
 * person is already named on the group header above. */
function SubRow({
  conv,
  variant,
  onSelect,
}: {
  conv: InboxConversation;
  variant: InboxVariant;
  onSelect: (id: string) => void;
}) {
  const roleLabel = conv.jobContext?.jobTitle || conv.role || "Role";
  const unread = variant === "active" && (conv.unreadCount ?? 0) > 0;
  return (
    <TouchableOpacity
      onPress={() => onSelect(conv.id)}
      style={styles.subRow}
      activeOpacity={0.7}
    >
      <View style={unread ? styles.subRowUnreadDot : styles.subRowDotSpacer} />
      <View style={styles.main}>
        <View style={styles.rowHeader}>
          <Text
            style={[
              styles.subRowRole,
              variant !== "active" && styles.nameHidden,
            ]}
            numberOfLines={1}
          >
            {roleLabel}
          </Text>
          <RowTrailing conv={conv} variant={variant} />
        </View>
        <PreviewText conv={conv} variant={variant} unread={unread} />
      </View>
    </TouchableOpacity>
  );
}

/** A person with multiple role-threads: one collapsible row. */
function GroupRow({
  group,
  variant,
  expanded,
  isLast,
  onToggle,
  onSelect,
}: {
  group: ReturnType<typeof groupByParticipant>[number];
  variant: InboxVariant;
  expanded: boolean;
  isLast: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  const conv = group.latest;
  return (
    <View style={!isLast && styles.rowDivider}>
      <TouchableOpacity
        onPress={onToggle}
        style={styles.row}
        activeOpacity={0.7}
      >
        <ConvAvatar
          name={conv.otherParticipant?.name}
          imageUrl={conv.otherParticipant?.profileImageUrl}
          hidden={variant !== "active"}
          unread={variant === "active" && group.unreadCount > 0}
        />
        <View style={styles.main}>
          <View style={styles.rowHeader}>
            <Text
              style={[styles.name, variant !== "active" && styles.nameHidden]}
              numberOfLines={1}
            >
              {conv.otherParticipant?.name}
            </Text>
            <RowTrailing conv={conv} variant={variant} />
          </View>
          <View style={styles.previewRow}>
            <View style={{ flex: 1 }}>
              <PreviewText conv={conv} variant={variant} />
            </View>
            <View style={styles.rolesPill}>
              <Briefcase size={11} color="#666" />
              <Text style={styles.rolesPillText}>
                {group.items.length} roles
              </Text>
            </View>
          </View>
        </View>
        <ChevronRight
          size={18}
          color="#BBB"
          style={[
            styles.groupChevron,
            expanded && { transform: [{ rotate: "90deg" }] },
          ]}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.subList}>
          {group.items.map((c) => (
            <SubRow key={c.id} conv={c} variant={variant} onSelect={onSelect} />
          ))}
        </View>
      )}
    </View>
  );
}

export function InboxList({
  conversations,
  variant,
  expandedGroups,
  onToggleGroup,
  onSelect,
}: InboxListProps) {
  const groups = groupByParticipant(conversations);
  return (
    <>
      {groups.map((group, index) => (
        <Animated.View
          key={group.key}
          // Cap the stagger so a long inbox doesn't take seconds to finish
          // animating in — rows past the first screenful all animate
          // together instead of visibly cascading one by one.
          entering={FadeInDown.delay(Math.min(index, 8) * 50)}
        >
          {group.items.length === 1 ? (
            <LeafRow
              conv={group.items[0]}
              variant={variant}
              isLast={index === groups.length - 1}
              onSelect={onSelect}
            />
          ) : (
            <GroupRow
              group={group}
              variant={variant}
              expanded={expandedGroups.has(group.key)}
              isLast={index === groups.length - 1}
              onToggle={() => onToggleGroup(group.key)}
              onSelect={onSelect}
            />
          )}
        </Animated.View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  avatarWrapper: { position: "relative" },
  avatarHidden: { opacity: 0.55 },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#000",
    borderWidth: 2,
    borderColor: "#F9F9F9",
  },
  main: { flex: 1 },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  name: { fontSize: 15, fontWeight: "700", color: "#000", flexShrink: 1 },
  nameHidden: { color: "#999" },
  contextLine: {
    fontSize: 11,
    fontWeight: "700",
    color: "#666",
    marginBottom: 2,
  },
  time: { fontSize: 10, fontWeight: "800", color: "#BBB" },
  preview: { fontSize: 13, color: "#888" },
  previewHidden: { color: "#AAA" },
  previewUnread: { color: "#000", fontWeight: "600" },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rolesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rolesPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#666",
    letterSpacing: 0.3,
  },
  groupChevron: { marginLeft: -4 },
  // Expanded per-role sub-threads, indented under the person row with a
  // hairline rail aligned to the avatar's right edge (14 pad + 48 avatar).
  subList: {
    marginLeft: 62,
    marginRight: 14,
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: "#EDEDED",
    marginBottom: 10,
  },
  subRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  subRowUnreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#000",
    marginRight: 11,
  },
  subRowDotSpacer: { width: 7, marginRight: 11 },
  subRowRole: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    flexShrink: 1,
  },
});
