// Pure counting for the Inbox tab badge — kept free of React / React Query
// so it can be unit-tested and reused anywhere. Counts THREADS with
// something unread, not messages: "3" means three people are waiting on
// you, which is the actionable number.

import type { ConversationRow } from "@/lib/api";

export type InboxRole = "applicant" | "sponsor";

/** Threads with something unread for this role, from raw conversation rows. */
export function countUnreadThreads(rows: ConversationRow[], role: InboxRole): number {
  return rows.filter((c) =>
    role === "applicant" ? !!c.APPLICANT_HAS_UNREAD : !!c.SPONSOR_HAS_UNREAD,
  ).length;
}

/** Threads with something unread, from the inbox's UI-shaped list cache. */
export function countUnreadFromInbox(list: { unreadCount?: number }[]): number {
  return list.filter((c) => (c.unreadCount ?? 0) > 0).length;
}
