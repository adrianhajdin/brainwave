/**
 * Settings: household sharing, appearance, alerts, account (password change,
 * sign out, delete account).
 */
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useApp } from '../src/AppProvider';
import { supabase } from '../src/backend/supabaseClient';
import { HouseholdsCard } from '../src/components/HouseholdsCard';
import { Button, Card, ErrorText, SectionTitle, Segmented } from '../src/components/ui';
import { ask, messageOf } from '../src/dialogs';
import { capabilities, isExpoGo } from '../src/runtime';
import { fonts, radius, space, useTheme, useThemePref, type ThemePref } from '../src/theme';

export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const { pref, setPref } = useThemePref();
  const { backend, signOut, push, enablePush } = useApp();
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  if (!backend) return null;
  const demo = backend.mode === 'demo';

  const run = async (key: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage({ text: ok, tone: 'info' });
    } catch (e) {
      setMessage({ text: messageOf(e), tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }];

  const pushText = {
    idle: 'Off. Turn alerts on to hear when a cat leaves or returns home, has a low battery, or is in lost mode.',
    pending: 'Checking…',
    registered: 'On. You get alerts when a cat leaves or returns home, has a low battery, or is in lost mode.',
    denied: 'Blocked for Cat Tracker. Allow notifications in your phone settings to get alerts.',
    unsupported: demo
      ? 'Not available in demo mode.'
      : isExpoGo
        ? 'Needs the installed app (development or store build). Expo Go cannot receive push alerts.'
        : 'Not set up for this build yet.',
    error: `Could not turn on alerts: ${push.error ?? 'unknown error'}`,
  }[push.status];

  const turnOnAlerts = async () => {
    const yes = await ask(
      'Turn on alerts?',
      'Your phone asks for permission next. We only use it to tell you and the people who see your cats when a cat leaves or returns home, has a low battery, or is in lost mode.',
      'Continue',
    );
    if (yes) await run('push', enablePush);
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <ErrorText>{message?.tone === 'error' ? message.text : null}</ErrorText>
      {message?.tone === 'info' && <Text style={{ color: t.live, lineHeight: 20 }}>{message.text}</Text>}

      <HouseholdsCard />

      <Card style={{ gap: space.md }}>
        <SectionTitle>Appearance</SectionTitle>
        <View style={styles.tiles}>
          {(
            [
              { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
              { value: 'light', label: 'Light', icon: 'sunny-outline' },
              { value: 'dark', label: 'Dark', icon: 'moon-outline' },
            ] as const
          ).map((o) => {
            const selected = pref === o.value;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setPref(o.value as ThemePref)}
                style={[styles.tile, { backgroundColor: t.surfaceAlt, borderColor: selected ? t.primary : 'transparent' }]}
              >
                <Ionicons name={o.icon} size={22} color={t.text} />
                <Text style={{ color: t.text, fontFamily: selected ? fonts.bodySemibold : fonts.bodyMedium }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={{ gap: space.md }}>
        <View style={styles.rowBetween}>
          <Text style={{ color: t.text, fontFamily: fonts.display, fontSize: 18 }}>Push alerts</Text>
          <View style={[styles.onPill, { backgroundColor: push.status === 'registered' ? t.liveSoft : t.surfaceAlt }]}>
            <Text style={{ color: push.status === 'registered' ? t.live : t.textMuted, fontFamily: fonts.bodySemibold, fontSize: 12 }}>
              {push.status === 'registered' ? 'On' : 'Off'}
            </Text>
          </View>
        </View>
        <Text style={{ color: t.textMuted, lineHeight: 20 }}>{pushText}</Text>
        {!demo && push.status === 'idle' && (
          <Button title="Turn on alerts" icon="notifications-outline" busy={busy === 'push'} onPress={() => void turnOnAlerts()} />
        )}
        {!demo && push.status === 'denied' && (
          <Button title="Open phone settings" variant="secondary" icon="settings-outline" onPress={() => void Linking.openSettings().catch(() => undefined)} />
        )}
      </Card>

      <Card style={{ gap: space.md }}>
        <SectionTitle>Account</SectionTitle>
        <View style={styles.account}>
          <View style={[styles.accountAvatar, { backgroundColor: t.primary }]}>
            <Text style={{ color: t.primaryText, fontFamily: fonts.display, fontSize: 18 }}>
              {(backend.userLabel ?? 'D').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: t.text, flex: 1 }} numberOfLines={1}>
            {demo ? 'Demo mode · nothing is stored' : `Signed in as ${backend.userLabel}`}
          </Text>
        </View>
        {!demo && supabase && (
          <View style={styles.row}>
            <TextInput
              style={[input, { flex: 1 }]}
              placeholder="New password"
              placeholderTextColor={t.textMuted}
              accessibilityLabel="New password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <Button
              title="Change"
              variant="secondary"
              busy={busy === 'pw'}
              disabled={newPassword.length < 8}
              onPress={() =>
                void run(
                  'pw',
                  async () => {
                    const { error } = await supabase!.auth.updateUser({ password: newPassword });
                    if (error) throw new Error(error.message);
                    setNewPassword('');
                  },
                  'Password changed.',
                )
              }
            />
          </View>
        )}
        {!demo && newPassword.length > 0 && newPassword.length < 8 && (
          <Text style={{ color: t.textMuted, fontSize: 13 }}>A new password needs at least 8 characters.</Text>
        )}
        <Button title={demo ? 'Exit demo' : 'Sign out'} variant="secondary" icon="log-out-outline" onPress={() => void signOut().then(() => router.replace('/login'))} />
        {!demo && (
          <Button
            title="Delete account"
            variant="danger"
            icon="trash-outline"
            busy={busy === 'delete'}
            onPress={() =>
              void ask(
                'Delete your account?',
                'This permanently deletes your account, location history, zones, photos and household links. Collars are released so they can be claimed again. This cannot be undone.',
                'Delete everything',
                true,
              ).then((yes) => {
                if (!yes) return;
                return run('delete', async () => {
                  await backend.deleteAccount();
                  await signOut();
                  router.replace('/login');
                });
              })
            }
          />
        )}
      </Card>

      <Text style={{ color: t.textMuted, textAlign: 'center', fontSize: 12 }}>
        Cat Tracker {Constants.expoConfig?.version ?? ''} · {isExpoGo ? 'Expo Go' : 'installed build'}
        {capabilities.backgroundLocation ? ' · background tracking available' : ''}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2, maxWidth: 640, width: '100%', alignSelf: 'center' },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16 },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.md, borderRadius: radius.lg, borderWidth: 1.5 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  onPill: { paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill },
  account: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  accountAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
