import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Local mirror of the pipeline stage a user last submitted for a referral
 * check-in (e.g. "Recruiter Screen", "Offer").
 *
 * Why this exists: `POST /api/referrals/<id>/checkin/` (and the sponsor
 * batch equivalent) records the stage in `matching.referral_checkins`, but
 * `GET /api/referrals/` never reads it back — the list endpoint only ever
 * returns the row-level REFERRED/WITHDRAWN status (see
 * docs/BACKEND_CHANGES_NEEDED.md §N2). So today there's no way to show a
 * referral's current pipeline stage on the Matches screen without this
 * client-side cache of what *this device* last submitted.
 *
 * Real limitation: this only reflects what the CURRENT user submitted from
 * THIS device. A sponsor won't see the stage an applicant reported (or vice
 * versa) until the backend actually persists and returns it — that's the
 * cross-party visibility §N2 asks for. Until then this is a "did I already
 * check in, and what did I last say" convenience for the submitting user.
 */
const STORAGE_KEY = "@bc/localCheckInStages";
// Parallel map of referralId -> ISO timestamp of the last locally-submitted
// check-in. Separate key (not folded into the stage map) so existing
// consumers of the stage map keep reading plain strings.
const TIMES_KEY = "@bc/localCheckInTimes";

type StageMap = Record<string, string>;

async function readKey(key: string): Promise<StageMap> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function stampTimes(referralIds: string[]): Promise<void> {
  try {
    const times = await readKey(TIMES_KEY);
    const now = new Date().toISOString();
    for (const id of referralIds) {
      if (id) times[id] = now;
    }
    await AsyncStorage.setItem(TIMES_KEY, JSON.stringify(times));
  } catch {
    // Best-effort — see saveLocalCheckInStage.
  }
}

/** Record the stage most recently submitted for a single referral. */
export async function saveLocalCheckInStage(
  referralId: string,
  stage: string,
): Promise<void> {
  if (!referralId || !stage) return;
  try {
    const map = await readKey(STORAGE_KEY);
    map[referralId] = stage;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    await stampTimes([referralId]);
  } catch {
    // Best-effort — a failed cache write just means the stage won't show
    // inline until the next successful check-in; never block the submit.
  }
}

/** Record stages for multiple referrals at once (sponsor batch check-in). */
export async function saveLocalCheckInStages(
  updates: { referralId: string; stage: string }[],
): Promise<void> {
  if (!updates.length) return;
  try {
    const map = await readKey(STORAGE_KEY);
    for (const { referralId, stage } of updates) {
      if (referralId && stage) map[referralId] = stage;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    await stampTimes(updates.map((u) => u.referralId));
  } catch {
    // Best-effort, see saveLocalCheckInStage.
  }
}

/** Read the full referralId -> stage map (empty object on any failure). */
export async function getLocalCheckInStages(): Promise<StageMap> {
  return readKey(STORAGE_KEY);
}

/**
 * Read referralId -> ISO timestamp of the last check-in submitted from this
 * device. Drives "needs an update" staleness (header badge, Matches nudge):
 * a referral the user JUST checked in on shouldn't keep nagging them, even
 * though the backend never returns check-in recency (§N2). Device-local,
 * same limitation as the stage map.
 */
export async function getLocalCheckInTimes(): Promise<StageMap> {
  return readKey(TIMES_KEY);
}
