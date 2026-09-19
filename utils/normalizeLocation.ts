// normalizeLocation — turn whatever a user typed (or Google returned) for
// their location into one canonical "City, ST" string.
//
// Why: the app matches and displays on `location`, and the same city was
// reaching the backend in several shapes — Google Places' "San Francisco,
// California", the seed data's "San Francisco, CA", and free text like
// "san francisco", "SF", or "san francisco ca" from the manual-entry
// fallback. This funnels all of them to the US_CITIES spelling
// ("San Francisco, CA") when the city is known, and to a tidied
// "City, ST" otherwise. It never guesses: an ambiguous bare city
// ("Springfield" exists in five states) is returned as just the city.

import { US_CITIES, US_STATE_CODES } from "@/constants/locations";
import { cleanText, FIELD_LIMITS } from "@/lib/validation";

/** Case/punctuation-insensitive comparison key ("St. Louis" → "st louis"). */
const fold = (s: string): string =>
  s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

// What people actually type for big cities. Each carries its state so a
// bare "sf" still lands on a fully qualified "San Francisco, CA".
// Deliberately excludes nicknames that are also real city names elsewhere
// (e.g. "Frisco" is a city in Texas).
const CITY_NICKNAMES: Record<string, { city: string; state: string }> = {
  sf: { city: "San Francisco", state: "CA" },
  "san fran": { city: "San Francisco", state: "CA" },
  nyc: { city: "New York", state: "NY" },
  "new york city": { city: "New York", state: "NY" },
  la: { city: "Los Angeles", state: "CA" },
  philly: { city: "Philadelphia", state: "PA" },
  vegas: { city: "Las Vegas", state: "NV" },
  dc: { city: "Washington", state: "DC" },
  "washington dc": { city: "Washington", state: "DC" },
  nola: { city: "New Orleans", state: "LA" },
  atl: { city: "Atlanta", state: "GA" },
  "chi-town": { city: "Chicago", state: "IL" },
  chitown: { city: "Chicago", state: "IL" },
};

const STATE_CODE_SET = new Set(Object.values(US_STATE_CODES));

// Built once: fold("city, st") → canonical entry, and fold(city) → every
// canonical entry with that city name (for the no-state lookup).
const canonicalByKey = new Map<string, string>();
const canonicalByCity = new Map<string, string[]>();
for (const entry of US_CITIES) {
  const [city, code] = entry.split(",").map((s) => s.trim());
  if (!city || !code) continue;
  canonicalByKey.set(fold(`${city}, ${code}`), entry);
  const list = canonicalByCity.get(fold(city)) ?? [];
  list.push(entry);
  canonicalByCity.set(fold(city), list);
}

/** "ca" / "CA" / "California" / "D.C." → "CA" / "DC"; null if unrecognized. */
function resolveStateCode(raw: string): string | null {
  const f = fold(raw);
  if (!f) return null;
  const upper = f.toUpperCase();
  if (upper.length === 2 && STATE_CODE_SET.has(upper)) return upper;
  return US_STATE_CODES[f] ?? null;
}

function titleCase(s: string): string {
  return s
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part,
        )
        .join("-"),
    )
    .join(" ");
}

export function normalizeLocation(input: string): string {
  let text = cleanText(input, FIELD_LIMITS.location);
  if (!text) return "";

  // Drop a trailing country: Google's "San Francisco, CA, USA", or a typed
  // "Austin USA" / "Austin, United States".
  text = text
    .replace(/(?:,|\s)\s*(?:u\.?s\.?a?\.?|united states(?: of america)?)$/i, "")
    .replace(/[,\s]+$/, "")
    .trim();

  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  let cityRaw = parts[0] ?? "";
  const stateRaw = parts[1] ?? "";
  let code = stateRaw ? resolveStateCode(stateRaw) : null;

  if (!stateRaw) {
    // No comma — peel a trailing state off the end if there is one:
    // "san francisco ca", "portland oregon", "new york new york".
    const words = cityRaw.split(" ");
    for (const n of [2, 1]) {
      if (words.length > n) {
        const peeled = resolveStateCode(words.slice(-n).join(" "));
        if (peeled) {
          code = peeled;
          cityRaw = words.slice(0, -n).join(" ");
          break;
        }
      }
    }
  }

  const nickname = CITY_NICKNAMES[fold(cityRaw)];
  if (nickname) {
    cityRaw = nickname.city;
    code = code ?? nickname.state;
  }

  const city = titleCase(cityRaw);
  if (!city) return "";

  if (code) {
    return canonicalByKey.get(fold(`${city}, ${code}`)) ?? `${city}, ${code}`;
  }

  // A city the list knows in exactly one state gets that state — this also
  // quietly recovers a misspelled one ("San Francisco, Calfornia" → CA).
  const matches = canonicalByCity.get(fold(city));
  if (matches && matches.length === 1) return matches[0];

  // Unknown city with a state we couldn't recognize ("Smallville,
  // Calfornia") — keep it, tidied, rather than silently dropping what the
  // user wrote.
  if (stateRaw) return `${city}, ${titleCase(stateRaw)}`;
  return city;
}
