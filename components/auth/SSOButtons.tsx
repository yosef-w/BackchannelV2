// SSOButtons — "Continue with Apple" / "Continue with Google", stacked.
//
// Apple renders the provider's official AppleAuthenticationButton (App
// Store guideline 4.8 wants Apple's own button, and it supports the
// cornerRadius customization we need to match the app's pills). Google is
// a CUSTOM button: Google's stock GoogleSigninButton widget accepts no
// styling at all — fixed boxy shape, its own shadow — and can never match
// this app's design language. Google's brand guidelines explicitly allow
// custom buttons provided the unmodified multicolor "G" mark, readable
// contrast, and standard wording are used, which is what every polished
// app (Airbnb, Notion, Spotify) does. The G mark is drawn inline as SVG —
// Google's published vector, unaltered.
//
// This component stays a dumb trigger: it handles tap → native sheet →
// backend exchange and reports the outcome upward. Callers own routing
// (login vs. signup differ on `needs_onboarding`). Gated by SSO_ENABLED at
// the call site; each button additionally hides itself when its own
// prerequisites aren't met (Apple: iOS + native module; Google: native
// module + client IDs configured), so callers can render unconditionally.

import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  isAppleSignInSupported,
  isGoogleSignInSupported,
  signInWithApple,
  signInWithGoogle,
  type SsoIdentity,
} from "@/lib/sso";
import { authApi, type SsoLoginResponse } from "@/lib/auth-api";
import { Colors } from "@/constants/theme";

// Lazy/guarded exactly like lib/sso.ts's native calls — this is the
// PROVIDER'S OWN rendered button (a native view), so importing it eagerly
// carries the same "native module not linked in this binary yet" risk as
// calling the SDK directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AppleAuthenticationButton: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AppleAuthenticationButtonType: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AppleAuthenticationButtonStyle: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("expo-apple-authentication");
  AppleAuthenticationButton = mod.AppleAuthenticationButton;
  AppleAuthenticationButtonType = mod.AppleAuthenticationButtonType;
  AppleAuthenticationButtonStyle = mod.AppleAuthenticationButtonStyle;
} catch {
  // Guarded no-op — see lib/sso.ts's header comment for why.
}

/** Google's official multicolor "G" mark (their published vector,
 * unmodified — a brand-guideline requirement for custom buttons). */
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

type Provider = "apple" | "google";

interface SSOButtonsProps {
  /** The exchange succeeded — caller owns tokens/routing from here (the
   * two call sites, login vs. signup, route differently on `needs_onboarding`). */
  onSuccess: (
    response: SsoLoginResponse,
    identity: SsoIdentity,
    provider: Provider,
  ) => void;
  /** Fires for anything other than a plain user cancel (which resolves
   * silently — no error to show for someone just backing out of the sheet). */
  onError?: (error: Error, provider: Provider) => void;
  /** e.g. while a password-form submit is already in flight. */
  disabled?: boolean;
}

const BUTTON_HEIGHT = 50;

export function SSOButtons({ onSuccess, onError, disabled }: SSOButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(
    null,
  );

  const appleSupported = isAppleSignInSupported();
  const googleSupported = isGoogleSignInSupported();
  if (!appleSupported && !googleSupported) return null;

  const handle = async (
    provider: Provider,
    getIdentity: () => Promise<SsoIdentity | null>,
  ) => {
    if (loadingProvider || disabled) return;
    setLoadingProvider(provider);
    try {
      const identity = await getIdentity();
      if (!identity) return; // user cancelled — nothing to report
      const response = await authApi.ssoLogin(
        provider,
        identity.identityToken,
        provider === "apple"
          ? {
              // Only meaningful on the user's first-ever authorization —
              // both null afterward, and ssoLogin omits null fields.
              fullName:
                identity.givenName || identity.familyName
                  ? {
                      givenName: identity.givenName,
                      familyName: identity.familyName,
                    }
                  : undefined,
              // Sent every time — backend exchanges it so it can revoke
              // Apple credentials on account deletion (Apple mandate).
              authorizationCode: identity.authorizationCode,
            }
          : undefined,
      );
      onSuccess(response, identity, provider);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.warn(`[SSOButtons] ${provider} sign-in failed:`, error);
      onError?.(error, provider);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.stack}>
      {appleSupported && (
        <View style={styles.buttonWrap}>
          <AppleAuthenticationButton
            buttonType={AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={BUTTON_HEIGHT / 2}
            style={styles.appleButton}
            onPress={() => handle("apple", signInWithApple)}
          />
          {/* The native button is a fixed asset we can't render loading
              state inside (App Store rules bar customizing it) — an
              overlay + pointerEvents="none" on the button underneath
              gives clear feedback without touching the compliant asset. */}
          {loadingProvider === "apple" && (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator color="#FFF" />
            </View>
          )}
        </View>
      )}
      {googleSupported && (
        <TouchableOpacity
          style={[
            styles.googleButton,
            (!!loadingProvider || disabled) && { opacity: 0.6 },
          ]}
          onPress={() => handle("google", signInWithGoogle)}
          disabled={!!loadingProvider || disabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          {loadingProvider === "google" ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <GoogleLogo />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  buttonWrap: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    overflow: "hidden",
  },
  appleButton: { width: "100%", height: BUTTON_HEIGHT },
  // NOTE: the GoogleLogo SVG's four path fills above are Google's brand
  // colors and must never be tokenized/changed (brand guideline).
  googleButton: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.ink,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
