import { Platform, ViewStyle } from "react-native";
import { Colors, Radii } from "@/constants/theme";

/**
 * Shared visual shell for the app's three autocomplete fields
 * (AutocompleteInput, CompanyAutocomplete, PlacesAutocomplete) — same
 * floating-menu role, three different implementations for the underlying
 * data (local filter, ATS org search, Google Places), but they should look
 * like one interaction pattern. Audit found three different corner radii,
 * border widths, and shadow recipes for this exact shell; this is the one
 * place to fix that instead of three.
 */

/** Corner radius for both the text input and its dropdown menu. */
export const AUTOCOMPLETE_RADIUS = Radii.md;

/** The floating suggestions menu — paper background, hairline border, one shadow recipe. */
export const autocompleteDropdownShell: ViewStyle = {
  backgroundColor: Colors.paper,
  borderRadius: AUTOCOMPLETE_RADIUS,
  borderWidth: 1,
  borderColor: Colors.border,
  ...Platform.select({
    ios: {
      shadowColor: Colors.ink,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    android: { elevation: 8 },
  }),
};
