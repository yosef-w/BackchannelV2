import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * "Held" likes — the cards a free user swiped right on after the daily
 * like cap closed. Instead of dropping the intent, the deck holds the
 * card: it shows up on the like-cap gate ("also held today: …") and on
 * the end-of-deck card ("3 you wanted are still waiting"), and a
 * Premium purchase sends every held like at once.
 *
 * Day-scoped like lib/dailyLikeLimit.ts (same local-midnight rollover),
 * per role, in AsyncStorage so a tab switch or app restart mid-day
 * doesn't lose them. Capacity is the caller's call — HomeView holds at
 * most (premium cap − used today), so "join and they all go now" is
 * always literally true.
 */

export interface HeldLike {
  id: string;
  kind: "job" | "profile";
  /** Job title, or the applicant's name. */
  title: string;
  /** Company, or the applicant's desired role. */
  sub: string;
  image: string | null;
}

interface HeldRecord {
  date: string;
  items: HeldLike[];
}

type Role = "applicant" | "sponsor";

const STORAGE_KEY = (role: Role) => `@bc/heldLikes_${role}`;

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

async function readToday(role: Role): Promise<HeldLike[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY(role));
    if (!raw) return [];
    const parsed: HeldRecord = JSON.parse(raw);
    if (!parsed || parsed.date !== todayKey() || !Array.isArray(parsed.items)) {
      return [];
    }
    return parsed.items;
  } catch {
    return [];
  }
}

async function write(role: Role, items: HeldLike[]): Promise<void> {
  try {
    const record: HeldRecord = { date: todayKey(), items };
    await AsyncStorage.setItem(STORAGE_KEY(role), JSON.stringify(record));
  } catch (err) {
    console.warn("[heldLikes] Failed to persist:", err);
  }
}

export async function getHeldLikes(role: Role): Promise<HeldLike[]> {
  return readToday(role);
}

/** Hold a card; a repeat of the same id is a no-op. Returns today's list. */
export async function holdLike(role: Role, item: HeldLike): Promise<HeldLike[]> {
  const items = await readToday(role);
  if (items.some((h) => h.id === item.id)) return items;
  const next = [...items, item];
  await write(role, next);
  return next;
}

/** Drop the given ids (sent, or liked some other way). Returns what's left. */
export async function releaseHeldLikes(
  role: Role,
  ids: readonly string[],
): Promise<HeldLike[]> {
  const items = await readToday(role);
  const drop = new Set(ids);
  const next = items.filter((h) => !drop.has(h.id));
  if (next.length !== items.length) await write(role, next);
  return next;
}
