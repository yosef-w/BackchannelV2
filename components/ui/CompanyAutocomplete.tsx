// CompanyAutocomplete — a company text field that suggests real ATS
// organizations as the user types. Picking a suggestion guarantees the
// stored company string matches the ATS `ORGANIZATION` values the job-browse
// filter uses, which eliminates the misspelling / naming-mismatch problem
// at the source (see docs/BACKEND_CHANGES_NEEDED.md §G).
//
// It degrades gracefully: free-text is always allowed (a sponsor's company
// may legitimately have no ATS jobs yet), and if the backend search endpoint
// isn't deployed the field behaves like a plain TextInput.

import { searchAtsOrganizations, type AtsOrganization } from "@/lib/api";
import { Check } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { CompanyLogo } from "./CompanyLogo";

interface CompanyAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Fired when the user explicitly picks a suggestion (exact ATS string). */
  onSelectOrganization?: (organization: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Min characters before we hit the network. */
  minChars?: number;
  inputWrapperStyle?: ViewStyle | ViewStyle[];
  inputStyle?: TextStyle | TextStyle[];
}

const DEBOUNCE_MS = 250;

export function CompanyAutocomplete({
  value,
  onChangeText,
  onSelectOrganization,
  placeholder = "e.g., Google, Stripe, Goldman Sachs",
  autoFocus,
  minChars = 2,
  inputWrapperStyle,
  inputStyle,
}: CompanyAutocompleteProps) {
  const [results, setResults] = useState<AtsOrganization[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  // Once the endpoint 404s/errs we stop querying and behave as a plain field.
  const [endpointUnavailable, setEndpointUnavailable] = useState(false);

  // Guards: ignore stale responses, and suppress the dropdown immediately
  // after a pick (so it doesn't reopen against the just-filled value).
  const latestQuery = useRef("");
  const justPicked = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      latestQuery.current = q;
      setLoading(true);
      const res = await searchAtsOrganizations(q, 8);
      // Drop responses that arrived after a newer keystroke.
      if (latestQuery.current !== q) return;
      setLoading(false);
      if (res === null) {
        setEndpointUnavailable(true);
        setResults([]);
        return;
      }
      setResults(res);
    },
    [],
  );

  useEffect(() => {
    if (endpointUnavailable) return;
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    const q = value.trim();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (q.length < minChars) {
      setResults([]);
      setLoading(false);
      return;
    }
    debounceTimer.current = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [value, minChars, endpointUnavailable, runSearch]);

  const handlePick = (org: string) => {
    justPicked.current = true;
    setResults([]);
    onChangeText(org);
    onSelectOrganization?.(org);
  };

  // Show the dropdown only while focused, with a query worth showing, and not
  // when the value already equals the single match (i.e. they've picked it).
  const showDropdown =
    focused &&
    !endpointUnavailable &&
    value.trim().length >= minChars &&
    (loading || results.length > 0) &&
    !(results.length === 1 && results[0].organization === value.trim());

  return (
    <View>
      <View style={[styles.inputWrapper, inputWrapperStyle]}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#BBB"
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          // Delay blur so a tap on a suggestion registers before we hide it.
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          style={[styles.input, inputStyle]}
          autoFocus={autoFocus}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color="#999" />}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          {results.length === 0 && loading ? (
            <View style={styles.dropdownLoadingRow}>
              <ActivityIndicator size="small" color="#999" />
              <Text style={styles.dropdownLoadingText}>Searching…</Text>
            </View>
          ) : (
            results.map((org) => {
              const isExact = org.organization === value.trim();
              return (
                <TouchableOpacity
                  key={org.organization}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => handlePick(org.organization)}
                >
                  <CompanyLogo
                    logoUrl={org.logo_url ?? undefined}
                    name={org.organization}
                    size={34}
                    borderRadius={9}
                    initialFontSize={15}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {org.organization}
                    </Text>
                    {org.job_count > 0 && (
                      <Text style={styles.rowMeta}>
                        {org.job_count}{" "}
                        {org.job_count === 1 ? "open role" : "open roles"}
                      </Text>
                    )}
                  </View>
                  {isExact && <Check size={16} color="#000" strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#EEE",
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: "#FAFAFA",
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: "#000",
    fontWeight: "600",
  },
  dropdown: {
    marginTop: 8,
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
    overflow: "hidden",
    // Soft elevation so it reads as a floating menu.
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  dropdownLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropdownLoadingText: { color: "#999", fontSize: 14, fontWeight: "500" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
  },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: "700", color: "#111" },
  rowMeta: { fontSize: 12, color: "#999", fontWeight: "500", marginTop: 1 },
});
