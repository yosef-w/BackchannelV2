import React, { useEffect, useRef, useState } from "react";
import {
    Keyboard,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface AutocompleteInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (item: string) => void;
  suggestions: string[];
  placeholder?: string;
  autoFocus?: boolean;
  style?: any;
  maxSuggestions?: number;
}

export function AutocompleteInput({
  value,
  onChangeText,
  onSelect,
  suggestions,
  placeholder,
  autoFocus,
  style,
  maxSuggestions = 5,
}: AutocompleteInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [justSelected, setJustSelected] = useState(false);
  const inputRef = useRef<TextInput>(null);

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
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={[styles.input, style]}
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="words"
      />

      {showSuggestions && filteredSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
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
    maxHeight: 200,
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
    maxHeight: 200,
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
