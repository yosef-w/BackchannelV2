// SSOButtons — "Continue with Apple" / "Continue with Google", stacked.
//
// Renders the providers' own official button components (required for
// Apple's App Store guidelines; Google's is the brand-compliant choice for
// the same reason on that side) — this component doesn't design the
// buttons, it places them, handles the tap → native-sheet → backend-
// exchange round trip, and reports the outcome upward. Callers own what
// happens next (routing differs between AuthScreen's login and signup
// modes), so this stays a dumb trigger: it hands back the raw SsoLoginResponse
// and SsoIdentity, and does nothing itself beyond the exchange + loading UI.
//
// Gated by SSO_ENABLED (constants/config.ts) at the call site, not in here —
// this component still individually hides whichever button isn't supported
// (Apple: iOS + native module present; Google: native module + real client
// IDs configured), so a caller can render it unconditionally once the
// feature flag is on and each button quietly no-ops if its own prerequisites
// aren't met, rather than every call site re-deriving that logic.

import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  isAppleSignInSupported,
  isGoogleSignInSupported,
  signInWithApple,
  signInWithGoogle,
  type SsoIdentity,
} from "@/lib/sso";
import { authApi, type SsoLoginResponse } from "@/lib/auth-api";

// Lazy/guarded exactly like lib/sso.ts's native calls — these are the
// PROVIDERS' OWN rendered button components (native views on Apple's side),
// so importing them eagerly carries the same "native module not linked in
// this binary yet" risk as calling the SDKs directly.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GoogleSigninButton: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@react-native-google-signin/google-signin");
  GoogleSigninButton = mod.GoogleSigninButton;
} catch {
  GoogleSigninButton = null;
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
          ? { givenName: identity.givenName, familyName: identity.familyName }
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
        <View style={styles.buttonWrap}>
          <GoogleSigninButton
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Light}
            style={styles.googleButton}
            disabled={!!loadingProvider || disabled}
            onPress={() => handle("google", signInWithGoogle)}
          />
          {loadingProvider === "google" && (
            <View
              style={[styles.loadingOverlay, styles.loadingOverlayLight]}
              pointerEvents="none"
            >
              <ActivityIndicator color="#000" />
            </View>
          )}
        </View>
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
  googleButton: { width: "100%", height: BUTTON_HEIGHT },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingOverlayLight: { backgroundColor: "rgba(255,255,255,0.7)" },
});
