import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from '../src/AppProvider';
import { useTheme } from '../src/theme';

function ThemedStack() {
  const t = useTheme();
  return (
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
      <Stack.Screen name="add-cat" options={{ title: 'Add a cat', presentation: 'modal' }} />
      <Stack.Screen name="cat/[id]" options={{ title: '' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="auto" />
        <ThemedStack />
      </AppProvider>
    </SafeAreaProvider>
  );
}
