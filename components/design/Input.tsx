import { tokens } from "@/constants/theme";
import { forwardRef, useState } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Text } from "./Text";

export interface InputProps extends Omit<TextInputProps, "style"> {
  /** Small uppercase label rendered above the field (matches modal-input-label). */
  label?: string;
  /** Error text rendered below the field. When set, the border switches to danger. */
  error?: string;
  /** Container style. The TextInput style is set internally. */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Editorial-style text input — off-white pill background, soft border,
 * tightens on focus. Mirrors the website's `.modal-input` look.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, containerStyle, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="eyebrow" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={tokens.colors.textFaint}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
        {...rest}
      />
      {error ? (
        <Text
          variant="meta"
          color={tokens.colors.dangerFg}
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    marginBottom: 8,
  },
  input: {
    fontFamily: tokens.fontFamilies.sans500,
    fontSize: 15,
    color: tokens.colors.text,
    backgroundColor: tokens.colors.bgOffWhite,
    borderWidth: tokens.borders.hairline,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.m,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  inputFocused: {
    borderColor: tokens.colors.borderStrong,
  },
  inputError: {
    borderColor: tokens.colors.dangerFg,
  },
  error: {
    marginTop: 6,
  },
});
