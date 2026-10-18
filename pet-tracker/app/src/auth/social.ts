/**
 * Native "Sign in with Apple" / "Sign in with Google" -> Supabase session via
 * signInWithIdToken (no browser redirect). Modules are required lazily so the
 * app still runs in Expo Go, which lacks the Google native module.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { capabilities } from '../runtime';

export async function appleSignInAvailable(): Promise<boolean> {
  if (!capabilities.appleSignIn) return false;
  const Apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
  return Apple.isAvailableAsync();
}

export async function signInWithApple(db: SupabaseClient): Promise<void> {
  const Apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
  const Crypto = require('expo-crypto') as typeof import('expo-crypto');

  // Apple gets the SHA-256 of the nonce; Supabase verifies the raw value.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const credential = await Apple.signInAsync({
    requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('Apple did not return an identity token.');

  const { error } = await db.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
  if (error) throw new Error(error.message);
}

export async function signInWithGoogle(db: SupabaseClient): Promise<void> {
  const { GoogleSignin, isSuccessResponse } =
    require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');

  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return; // user cancelled
  if (!response.data.idToken) throw new Error('Google did not return an ID token (check the web client ID).');

  const { error } = await db.auth.signInWithIdToken({ provider: 'google', token: response.data.idToken });
  if (error) throw new Error(error.message);
}

/** Map provider cancellation errors to "no error". */
export function isCancellation(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code ?? '';
  return code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED' || code === 'SIGN_IN_CANCELLED' || code === '12501';
}
