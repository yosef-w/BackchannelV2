import { countUnreadFromInbox, countUnreadThreads } from "../unreadThreadsCount";
import type { ConversationRow } from "@/lib/api";

const row = (over: Partial<ConversationRow>): ConversationRow =>
  ({ CONVERSATION_ID: "c", APPLICANT_HAS_UNREAD: false, SPONSOR_HAS_UNREAD: false, ...over }) as ConversationRow;

describe("countUnreadThreads", () => {
  const rows = [
    row({ APPLICANT_HAS_UNREAD: true, SPONSOR_HAS_UNREAD: false }),
    row({ APPLICANT_HAS_UNREAD: true, SPONSOR_HAS_UNREAD: true }),
    row({ APPLICANT_HAS_UNREAD: false, SPONSOR_HAS_UNREAD: true }),
    row({}),
  ];
  it("counts threads by the viewer's own role flag", () => {
    expect(countUnreadThreads(rows, "applicant")).toBe(2);
    expect(countUnreadThreads(rows, "sponsor")).toBe(2);
    expect(countUnreadThreads([], "applicant")).toBe(0);
  });
});

describe("countUnreadFromInbox", () => {
  it("counts threads, not messages", () => {
    expect(countUnreadFromInbox([{ unreadCount: 5 }, { unreadCount: 1 }, { unreadCount: 0 }, {}])).toBe(2);
  });
});
