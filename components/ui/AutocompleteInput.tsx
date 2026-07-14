import React, { useEffect, useRef, useState } from "react";
import {
    Dimensions,
    Keyboard,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    type StyleProp,
    type TextStyle,
} from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const DROPDOWN_MAX_HEIGHT = 200;

interface AutocompleteInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (item: string) => void;
  onBlur?: () => void;
  suggestions: string[];
  placeholder?: string;
  autoFocus?: boolean;
  style?: StyleProp<TextStyle>;
  maxSuggestions?: number;
}

export function AutocompleteInput({
  value,
  onChangeText,
  onSelect,
  onBlur,
  suggestions,
  placeholder,
  autoFocus,
  style,
  maxSuggestions = 5,
}: AutocompleteInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [justSelected, setJustSelected] = useState(false);
  // When the field sits low on the screen (e.g. the last question in a long
  // form) and the keyboard is up, a dropdown rendered *below* the input is
  // hidden behind the keyboard. Track the keyboard height and the input's
  // position so we can flip the dropdown to render *above* the input when
  // there isn't enough room beneath it.
  const [dropUp, setDropUp] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const containerRef = useRef<View>(null);

  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) =>
      setKeyboardHeight(e.endCoordinates?.height ?? 0),
    );
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    // Don't show suggestions if we just selected an item
    if (justSelected) {
      setShowSuggestions(false);
      return;
    }

    if (value.length > 0) {
      const filtered = suggestions
        .filter((item) => item.toLowerCase().includes(value.toLowerCase()))
        .slice(0, maxSuggestions);
      setFilteredSuggestions(filtered);
      // Only show if we have matches and the value isn't an exact match
      const hasExactMatch = filtered.some(
        (item) => item.toLowerCase() === value.toLowerCase(),
      );
      setShowSuggestions(filtered.length > 0 && !hasExactMatch);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value, suggestions, maxSuggestions, justSelected]);

  // Whenever the dropdown is about to show (or the keyboard moves), measure the
  // input and decide whether to drop down or flip up. Measuring on the next
  // tick lets layout settle so measureInWindow returns the on-screen frame.
  useEffect(() => {
    if (!showSuggestions) return;
    const id = setTimeout(() => {
      containerRef.current?.measureInWindow((_x, y, _w, h) => {
        const spaceBelow = SCREEN_HEIGHT - keyboardHeight - (y + h);
        // Flip up when the visible space below the field can't fit the menu.
        setDropUp(spaceBelow < DROPDOWN_MAX_HEIGHT + 24);
      });
    }, 0);
    return () => clearTimeout(id);
  }, [showSuggestions, keyboardHeight, filteredSuggestions.length]);

  const handleSelectSuggestion = (item: string) => {
    setJustSelected(true);
    setShowSuggestions(false);
    onSelect(item);
    Keyboard.dismiss();
    // Reset the flag after a short delay
    setTimeout(() => setJustSelected(false), 100);
  };

  const handleChangeText = (text: string) => {
    setJustSelected(false);
    onChangeText(text);
  };

  return (
    <View style={styles.container} ref={containerRef}>
      <TextInput
        ref={inputRef}
        style={[styles.input, style]}
        value={value}
        onChangeText={handleChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#999"
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="words"
      />

      {showSuggestions && filteredSuggestions.length > 0 && (
        <View
          style={[
            styles.suggestionsContainer,
            dropUp ? styles.suggestionsAbove : styles.suggestionsBelow,
          ]}
        >
          <ScrollView
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled={true}
          >
            {filteredSuggestions.map((item, index) => (
              <TouchableOpacity
                key={`${item}-${index}`}
                style={styles.suggestionItem}
                onPress={() => handleSelectSuggestion(item)}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
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
  input: {
    width: "100%",
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    // Single-line input alignment hardening: Android adds default vertical
    // padding and font ascent padding that sit placeholder text below
    // center (tester-reported on the signup city search); these pin it.
    textAlignVertical: "center",
    includeFontPadding: false,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  suggestionsContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    maxHeight: DROPDOWN_MAX_HEIGHT,
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
  // Default — menu hangs below the input.
  suggestionsBelow: {
    top: "100%",
    marginTop: 4,
  },
  // Flipped — menu sits above the input (used when the field is low on screen
  // and the keyboard would otherwise cover a below-positioned menu).
  suggestionsAbove: {
    bottom: "100%",
    marginBottom: 4,
  },
  suggestionsList: {
    maxHeight: DROPDOWN_MAX_HEIGHT,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    flex: 1,
  },
});
