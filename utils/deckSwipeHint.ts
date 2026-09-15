import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Local-only "have they learned they can slide the deck's plates" state.
 *
 * The plate row's own peek (PlateDeck's PEEK constant) plus the small
 * "SLIDE FOR MORE →" label under the first plate turned out not to be
 * enough on their own — testers landed on their first card and never
 * noticed either cue. PlateDeck now plays a one-off "rubber-band" nudge
 * (the first plate slides left and springs back) to demonstrate the
 * gesture instead of just hinting at it — but only while the user hasn't
 * yet proven they've learned it, and only for a couple of cards, so it
 * teaches without turning into a recurring animation a fluent user has to
 * tune out. Device-local by design: this is a first-run teaching moment,
 * not profile data, so there's nothing here worth syncing to the backend.
 */
const STATE_KEY = "@bc/deckSwipeHint";
/** Cards the nudge will play on before giving up regardless of `learned`. */
const MAX_SHOWN = 2;

interface DeckSwipeHintState {
  /** True forever, from the first time the user advances past a deck's
   * first plate by ANY means (drag or tap) — proof they already know it's
   * swipeable, so there's nothing left to teach. */
  learned: boolean;
  /** How many cards the nudge has actually played on so far. */
  shownCount: number;
}

const DEFAULT_STATE: DeckSwipeHintState = { learned: false, shownCount: 0 };

async function readState(): Promise<DeckSwipeHintState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      learned: !!parsed?.learned,
      shownCount:
        typeof parsed?.shownCount === "number" ? parsed.shownCount : 0,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

async function writeState(state: DeckSwipeHintState): Promise<void> {
  try {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort — worst case the nudge plays once more than intended.
  }
}

/**
 * Call once per fresh deck mount (PlateDeck remounts per card via its
 * `key` — see HomeView). Resolves true if THIS card should play the
 * swipe-teaching nudge, and if so immediately records the attempt, so a
 * burst of fast card changes can't all sneak in under the cap before any
 * of them finish settling.
 */
export async function shouldPlayDeckSwipeHint(): Promise<boolean> {
  const state = await readState();
  if (state.learned || state.shownCount >= MAX_SHOWN) return false;
  await writeState({ ...state, shownCount: state.shownCount + 1 });
  return true;
}

/**
 * Call the first time a user advances past a deck's first plate, by any
 * means (drag or tap) — permanently retires the nudge for this device.
 */
export async function markDeckSwipeLearned(): Promise<void> {
  const state = await readState();
  if (state.learned) return;
  await writeState({ ...state, learned: true });
}
