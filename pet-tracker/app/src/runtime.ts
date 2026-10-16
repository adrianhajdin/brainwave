/** Where the app is running, and which native features are usable there. */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/** Expo Go from the app store: no custom native code, no remote push on Android. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const easProjectId: string | undefined =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
  Constants.easConfig?.projectId;

export const capabilities = {
  /** Push needs a development / store build (and an EAS project id). */
  push: Platform.OS !== 'web' && !isExpoGo && !!easProjectId,
  /** Background location needs a development / store build. */
  backgroundLocation: Platform.OS !== 'web' && !isExpoGo,
  /** Native Google Sign-In is custom native code (not in Expo Go). */
  googleSignIn: Platform.OS !== 'web' && !isExpoGo && !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  appleSignIn: Platform.OS === 'ios',
};
