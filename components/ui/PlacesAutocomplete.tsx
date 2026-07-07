// PlacesAutocomplete — thin React Native UI over Google's Places API (New).
//
// Why this exists instead of a third-party library: the popular RN Places
// libraries target the legacy `maps.googleapis.com/maps/api` endpoints. The
// New API (`places.googleapis.com/v1`) has a much better pricing model
// (10K sessions/mo free per SKU, FieldMask billing) but no mature RN library,
// so we build the small piece of UI we need ourselves.
//
// Billing model: we use Autocomplete + Place Details with a shared session
// token. As long as the Details FieldMask only requests fields in the
// "Essentials" tier (e.g. addressComponents), the whole interaction bills
// as one "Autocomplete Session Usage" unit — first 10K/mo are free.

import Constants from "expo-constants";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
} from "react-native";
import { GOOGLE_PLACES_API_KEY } from "@/constants/config";
import {
  AddressComponent,
  ParsedAddress,
  parseAddressComponents,
} from "@/lib/addressParser";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL_BASE = "https://places.googleapis.com/v1/places";
const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 5;
// Module-level default so the reference is stable across renders. If this
// were declared inline as `regionCodes = ["us"]`, every render would create a
// fresh array, the useEffect deps would change every render, and the effect
// would loop forever.
const DEFAULT_REGION_CODES: readonly string[] = ["us"];

// When an API key is restricted to iOS apps in GCP, Google's REST API expects
// the bundle ID in the `X-Ios-Bundle-Identifier` header. Google's native iOS
// SDK sets this automatically — plain fetch() does not, so we set it here.
// Same idea for Android (`X-Android-Package` + `X-Android-Cert`).
const IOS_BUNDLE_ID = Constants.expoConfig?.ios?.bundleIdentifier ?? "";
const ANDROID_PACKAGE = Constants.expoConfig?.android?.package ?? "";

const googleAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
  };
  if (Platform.OS === "ios" && IOS_BUNDLE_ID) {
    headers["X-Ios-Bundle-Identifier"] = IOS_BUNDLE_ID;
  } else if (Platform.OS === "android" && ANDROID_PACKAGE) {
    // Android key restrictions also require an SHA-1 cert fingerprint via
    // X-Android-Cert. Add that header alongside this one when the Android
    // restriction is set up in GCP.
    headers["X-Android-Package"] = ANDROID_PACKAGE;
  }
  return headers;
};

type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

type AutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      structuredFormat?: {
        mainText?: { text: string };
        secondaryText?: { text: string };
      };
    };
  }[];
};

type DetailsResponse = {
  addressComponents?: AddressComponent[];
};

const newSessionToken = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

interface PlacesAutocompleteProps {
  onSelect: (address: ParsedAddress) => void;
  onSwitchToManual?: () => void;
  onError?: (message: string) => void;
  initialValue?: string;
  placeholder?: string;
  inputStyle?: TextStyle;
  autoFocus?: boolean;
  /** ISO 3166-1 alpha-2 lowercase. Defaults to ["us"]. Pass a stable reference. */
  regionCodes?: readonly string[];
  /**
   * "address" (default) → full street-address autocomplete; requires a street
   * on selection. "city" → restrict suggestions to cities and resolve to a
   * standardized city + state (no street), so a free-text city gets normalized.
   */
  mode?: "address" | "city";
}

export function PlacesAutocomplete({
  onSelect,
  onSwitchToManual,
  onError,
  initialValue = "",
  placeholder = "Start typing your address",
  inputStyle,
  autoFocus,
  regionCodes = DEFAULT_REGION_CODES,
  mode = "address",
}: PlacesAutocompleteProps) {
  // Stable string key for the deps array — guards against callers passing
  // a fresh array every render, which would otherwise loop the effect.
  const regionCodesKey = regionCodes.join(",");
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const sessionTokenRef = useRef<string>(newSessionToken());
  const requestIdRef = useRef(0);
  const justSelectedRef = useRef(false);
  // Editing an existing value (e.g. Edit Profile prefilling the user's saved
  // city) sets `query` to a non-empty `initialValue` on mount. Without this
  // guard that non-empty value alone would trigger the suggestions fetch
  // below and pop the dropdown open over the rest of the form before the
  // user has touched anything.
  const skipNextFetchRef = useRef(true);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    if (justSelectedRef.current) {
      // Skip the fetch triggered by our own setQuery() after a selection.
      justSelectedRef.current = false;
      return;
    }
    if (query.trim().length < MIN_QUERY_LENGTH) {
      // Guard: only update state if it actually needs to change. Calling
      // setSuggestions([]) creates a new array reference and would re-render
      // even when the list is already empty.
      setSuggestions((prev) => (prev.length === 0 ? prev : []));
      setLoading((prev) => (prev ? false : prev));
      return;
    }

    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(AUTOCOMPLETE_URL, {
          method: "POST",
          headers: {
            ...googleAuthHeaders(),
            "Content-Type": "application/json",
            "X-Goog-FieldMask":
              "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat",
          },
          body: JSON.stringify({
            input: query,
            sessionToken: sessionTokenRef.current,
            // Reconstruct from the stable key so we don't depend on the
            // (possibly unstable) regionCodes array reference.
            includedRegionCodes: regionCodesKey ? regionCodesKey.split(",") : [],
            // City mode: restrict predictions to cities so the user can't pick
            // a street/business — the "(cities)" type collection covers
            // localities and their administrative equivalents.
            ...(mode === "city"
              ? { includedPrimaryTypes: ["(cities)"] }
              : {}),
          }),
        });

        // Bail if a newer request has been issued.
        if (myRequestId !== requestIdRef.current) return;

        if (!res.ok) {
          console.warn(
            "Places autocomplete failed:",
            res.status,
            await res.text().catch(() => ""),
          );
          setSuggestions([]);
          return;
        }

        const data: AutocompleteResponse = await res.json();
        const parsed: Suggestion[] = (data.suggestions ?? [])
          .map((s) => s.placePrediction)
          .filter((p): p is NonNullable<typeof p> => !!p)
          .slice(0, MAX_SUGGESTIONS)
          .map((p) => ({
            placeId: p.placeId,
            mainText: p.structuredFormat?.mainText?.text ?? "",
            secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
          }));
        setSuggestions(parsed);
      } catch (err) {
        if (myRequestId !== requestIdRef.current) return;
        console.warn("Places autocomplete error:", err);
        setSuggestions([]);
      } finally {
        if (myRequestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query, regionCodesKey, mode]);

  const handleSelect = async (suggestion: Suggestion) => {
    Keyboard.dismiss();
    setResolving(true);
    try {
      const url = `${DETAILS_URL_BASE}/${encodeURIComponent(suggestion.placeId)}?sessionToken=${encodeURIComponent(sessionTokenRef.current)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          ...googleAuthHeaders(),
          "X-Goog-FieldMask": "addressComponents",
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn("Places details failed:", res.status, text);
        onError?.("Couldn't fetch that address. Please try another or enter manually.");
        return;
      }

      const data: DetailsResponse = await res.json();
      const parsed = parseAddressComponents(data.addressComponents);
      // Cities have no street — validate on the field that matters per mode.
      if (mode === "city" ? !parsed.city : !parsed.street) {
        onError?.(
          mode === "city"
            ? "Couldn't read that city. Please try another or enter manually."
            : "Couldn't read that address. Please try another or enter manually.",
        );
        return;
      }

      // Reflect the selection in the input visually, but suppress the next
      // autocomplete fetch (we don't want a fresh suggestions list popping up
      // right as the parent swaps this component out for the saved display).
      justSelectedRef.current = true;
      setQuery(`${suggestion.mainText}, ${suggestion.secondaryText}`);
      setSuggestions([]);
      onSelect(parsed);
    } catch (err) {
      console.warn("Places details error:", err);
      onError?.("Network error fetching address. Please try again.");
    } finally {
      setResolving(false);
      // Selection ends the session per Google's billing model — rotate.
      sessionTokenRef.current = newSessionToken();
    }
  };

  return (
    <View style={styles.container}>
      {/* Anchor view: the absolute-positioned suggestions list anchors to the
          bottom of THIS view via top: 100%, so it lands directly under the
          input — not below the manual link. */}
      <View style={styles.inputAnchor}>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, inputStyle]}
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor="#999"
            autoFocus={autoFocus}
            autoCorrect={false}
            autoCapitalize="words"
            editable={!resolving}
          />
          {(loading || resolving) && (
            <ActivityIndicator
              size="small"
              color="#666"
              style={styles.spinner}
            />
          )}
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <ScrollView
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
            >
              {suggestions.map((s) => (
                <TouchableOpacity
                  key={s.placeId}
                  style={styles.suggestionItem}
                  onPress={() => handleSelect(s)}
                  disabled={resolving}
                >
                  <Text style={styles.suggestionMain} numberOfLines={1}>
                    {s.mainText}
                  </Text>
                  {!!s.secondaryText && (
                    <Text style={styles.suggestionSecondary} numberOfLines={1}>
                      {s.secondaryText}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {onSwitchToManual && (
        <TouchableOpacity
          onPress={onSwitchToManual}
          style={styles.manualLink}
        >
          <Text style={styles.manualLinkText}>Or enter manually</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 1000,
    flex: 1,
  },
  inputAnchor: {
    position: "relative",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  spinner: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    maxHeight: 240,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
    zIndex: 1001,
  },
  suggestionsList: {
    maxHeight: 240,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  suggestionMain: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
  },
  suggestionSecondary: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  manualLink: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  manualLinkText: {
    color: "#666",
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
