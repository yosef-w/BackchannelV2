// Unread-thread count for the Inbox tab badge.
//
// Two sources, one number: while the inbox has been opened this session,
// its own React Query list cache (fed live by the inbox WebSocket and by
// mark-read) is the truth — we subscribe to the query cache and recount
// whenever that entry changes, so the badge clears the instant a thread is
// read. Before the inbox has ever been opened, a light poll of the
// conversations endpoint fills in (same cadence as the bell's unread
// count). Counts THREADS with something unread, not messages — "3" means
// three people are waiting on you, which is the actionable number.

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getConversations } from "@/lib/api";
import {
  countUnreadFromInbox,
  countUnreadThreads,
  type InboxRole,
} from "./unreadThreadsCount";

export { countUnreadFromInbox, countUnreadThreads, type InboxRole };

export const unreadThreadsQuery = (role: InboxRole, enabled: boolean) => ({
  queryKey: ["conversations", "unreadThreads", role] as const,
  enabled,
  staleTime: 30_000,
  refetchInterval: 60_000,
  queryFn: async (): Promise<number> => {
    try {
      const response = await getConversations({ limit: 50, offset: 0 });
      return countUnreadThreads(response.conversations || [], role);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 404 = endpoint not available / no conversations — no badge.
      if (msg.includes("Not found") || msg.includes("404")) return 0;
      throw err;
    }
  },
});

/** MessagesView's list cache, if it exists for any user id. */
function readInboxCache(client: QueryClient): number | null {
  const entries = client.getQueriesData<{ unreadCount?: number }[]>({
    queryKey: ["conversations", "list"],
  });
  const live = entries.find(([, data]) => Array.isArray(data));
  return live ? countUnreadFromInbox(live[1] as { unreadCount?: number }[]) : null;
}

export function useUnreadThreadCount(role: InboxRole, enabled: boolean): number {
  const client = useQueryClient();
  const { data: polled = 0 } = useQuery(unreadThreadsQuery(role, enabled));
  const [fromInbox, setFromInbox] = useState<number | null>(() => readInboxCache(client));

  useEffect(() => {
    return client.getQueryCache().subscribe((event) => {
      const key = event?.query?.queryKey;
      if (Array.isArray(key) && key[0] === "conversations" && key[1] === "list") {
        setFromInbox(readInboxCache(client));
      }
    });
  }, [client]);

  if (!enabled) return 0;
  return fromInbox ?? polled;
}
