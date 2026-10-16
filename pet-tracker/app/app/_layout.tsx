// Background location task must be defined at startup (expo-task-manager).
import '../src/tracking/background';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from '../src/AppProvider';
import { configureNotifications } from '../src/notifications/push';
import { ThemePrefProvider, useTheme } from '../src/theme';

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
          headerTitleStyle: { fontWeight: '800' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'My cats' }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ title: 'Reset password' }} />
        <Stack.Screen name="add-cat" options={{ title: 'Add a cat', presentation: 'modal' }} />
        <Stack.Screen name="cat/[id]" options={{ title: '' }} />
        <Stack.Screen name="edit-cat/[id]" options={{ title: 'Edit cat', presentation: 'modal' }} />
        <Stack.Screen name="zone/[catId]" options={{ title: 'New zone', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
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
