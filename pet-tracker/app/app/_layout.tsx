// Background location task must be defined at startup (expo-task-manager).
import '../src/tracking/background';

import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from '../src/AppProvider';
import { configureNotifications } from '../src/notifications/push';
import { fonts, ThemePrefProvider, useTheme } from '../src/theme';

configureNotifications();

function ThemedStack() {
  const t = useTheme();
  return (
    <>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'My cats', headerLargeTitle: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ title: 'Reset password' }} />
        <Stack.Screen name="add-cat" options={{ title: 'Add a cat', presentation: 'modal' }} />
        <Stack.Screen name="cat/[id]" options={{ title: '' }} />
        <Stack.Screen name="edit-cat/[id]" options={{ title: 'Edit cat', presentation: 'modal' }} />
        <Stack.Screen name="zone/new" options={{ title: 'New zone', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Fonts are bundled from @expo-google-fonts, so the first frame waits for them.
  const [loaded] = useFonts({
    BricolageGrotesque_700Bold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_500Medium,
  });
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <ThemePrefProvider>
        <AppProvider>
          <ThemedStack />
        </AppProvider>
      </ThemePrefProvider>
    </SafeAreaProvider>
  );
}
