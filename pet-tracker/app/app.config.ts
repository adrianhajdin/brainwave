/**
 * Expo app config. Secrets and per-environment values come from environment
 * variables (local .env, or EAS environment variables for cloud builds), so
 * nothing sensitive is committed. See README "Own app (EAS Build)".
 */
import { existsSync } from 'node:fs';

import type { ConfigContext, ExpoConfig } from 'expo/config';

const LOCATION_TEXT =
  'Cat Tracker uses your location to show it next to your cats, and - if you use this phone as a test tracker - to report its position as the cat.';
const BACKGROUND_TEXT =
  'When this phone is used as a cat tracker, Cat Tracker keeps reporting its position in the background so the cat stays visible on the map.';

const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME; // com.googleusercontent.apps.<id>
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? (existsSync('./google-services.json') ? './google-services.json' : undefined);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Cat Tracker',
  slug: 'cat-tracker',
  scheme: 'cattracker',
  version: '0.2.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
  ios: {
    bundleIdentifier: process.env.IOS_BUNDLE_ID ?? 'eu.example.cattracker',
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: LOCATION_TEXT,
      NSLocationAlwaysAndWhenInUseUsageDescription: BACKGROUND_TEXT,
      NSPhotoLibraryUsageDescription: 'Choose a profile photo for your cat.',
      NSCameraUsageDescription: 'Take a profile photo of your cat.',
      UIBackgroundModes: ['location', 'remote-notification'],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: process.env.ANDROID_PACKAGE ?? 'eu.example.cattracker',
    ...(googleServicesFile ? { googleServicesFile } : {}),
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'POST_NOTIFICATIONS',
    ],
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
    config: process.env.GOOGLE_MAPS_ANDROID_API_KEY
      ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } }
      : undefined,
  },
  web: { bundler: 'metro', output: 'single' },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationWhenInUsePermission: LOCATION_TEXT,
        locationAlwaysAndWhenInUsePermission: BACKGROUND_TEXT,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
    ['expo-notifications', { color: '#D97706' }],
    'expo-apple-authentication',
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose a profile photo for your cat.',
        cameraPermission: 'Take a profile photo of your cat.',
        microphonePermission: false,
      },
    ],
    ...(googleIosUrlScheme
      ? ([['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }]] as ExpoConfig['plugins'] & object)
      : []),
  ],
  // Over-the-air updates: `eas update` publishes the JS bundle to this URL,
  // and Expo Go (or a dev build) opens it from a link or QR code.
  ...(process.env.EAS_PROJECT_ID
    ? {
        updates: { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` },
        // Expo Go only loads updates built for its own SDK runtime.
        runtimeVersion: { policy: 'sdkVersion' } as const,
      }
    : {}),
  extra: {
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
