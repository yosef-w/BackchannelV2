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

type StageMap = Record<string, string>;

async function readMap(): Promise<StageMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Record the stage most recently submitted for a single referral. */
export async function saveLocalCheckInStage(
  referralId: string,
  stage: string,
): Promise<void> {
  if (!referralId || !stage) return;
  try {
    const map = await readMap();
    map[referralId] = stage;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
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
    const map = await readMap();
    for (const { referralId, stage } of updates) {
      if (referralId && stage) map[referralId] = stage;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Best-effort, see saveLocalCheckInStage.
  }
}

/** Read the full referralId -> stage map (empty object on any failure). */
export async function getLocalCheckInStages(): Promise<StageMap> {
  return readMap();
}
