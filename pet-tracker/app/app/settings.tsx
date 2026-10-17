/**
 * Settings: household sharing, appearance, alerts, account (password change,
 * sign out, delete account).
 */
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { useApp } from '../src/AppProvider';
import { supabase } from '../src/backend/supabaseClient';
import type { HouseholdPerson } from '../src/backend/types';
import { Button, Card, ErrorText, SectionTitle, Segmented } from '../src/components/ui';
import { ask, messageOf } from '../src/dialogs';
import { capabilities, isExpoGo } from '../src/runtime';
import { radius, space, useTheme, useThemePref, type ThemePref } from '../src/theme';

export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const { pref, setPref } = useThemePref();
  const { backend, signOut, push, enablePush, refresh } = useApp();
  const [people, setPeople] = useState<HouseholdPerson[]>([]);
  const [invite, setInvite] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  const loadPeople = useCallback(async () => {
    if (backend?.mode === 'supabase') setPeople(await backend.listHousehold().catch(() => []));
  }, [backend]);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

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

  const pretty = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
  const members = people.filter((p) => p.role === 'member');
  const joined = people.filter((p) => p.role === 'owner');
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

  const stopSharing = async (m: HouseholdPerson) => {
    if (!(await ask(`Stop sharing with ${m.email}?`, 'They will no longer see your cats.', 'Stop sharing', true))) return;
    await run('rm', async () => {
      await backend.removeMember(m.userId);
      await loadPeople();
    });
  };

  const leaveHousehold = async (o: HouseholdPerson) => {
    if (!(await ask(`Leave ${o.email}'s household?`, 'Their cats disappear from your list.', 'Leave', true))) return;
    await run('leave', async () => {
      await backend.leaveHousehold(o.userId);
      await Promise.all([loadPeople(), refresh()]);
    });
  };

  const turnOnAlerts = async () => {
    const yes = await ask(
      'Turn on alerts?',
      'Your phone asks for permission next. We only use it to tell your household when a cat leaves or returns home, has a low battery, or is in lost mode.',
      'Continue',
    );
    if (yes) await run('push', enablePush);
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <ErrorText>{message?.tone === 'error' ? message.text : null}</ErrorText>
      {message?.tone === 'info' && <Text style={{ color: t.live, lineHeight: 20 }}>{message.text}</Text>}

      <Card style={{ gap: space.md }}>
        <SectionTitle>Household</SectionTitle>
        {demo ? (
          <Text style={{ color: t.textMuted, lineHeight: 20 }}>Sharing needs an account. Exit the demo and sign in to invite your household.</Text>
        ) : (
          <>
            <Text style={{ color: t.textMuted, lineHeight: 20 }}>
              Everyone you invite sees all your cats, also the ones you add later, gets the same alerts and can switch lost mode on. Only you can edit or delete cats.
            </Text>
            {members.map((m) => (
              <View key={m.userId} style={styles.personRow}>
                <Ionicons name="person-circle-outline" size={24} color={t.textMuted} />
                <Text style={[styles.personText, { color: t.text }]} numberOfLines={1}>
                  {m.email}
                </Text>
                <Button
                  title="Stop sharing"
                  variant="ghost"
                  onPress={() => void stopSharing(m)}
                />
              </View>
            ))}
            {invite ? (
              <View style={[styles.codeBox, { backgroundColor: t.accentSoft }]}>
                <Text style={{ color: t.textMuted }}>Invite code · valid 7 days, single use</Text>
                <Text selectable style={[styles.code, { color: t.text }]}>{pretty(invite)}</Text>
                <Button
                  title="Share code"
                  icon="share-outline"
                  onPress={() => void Share.share({ message: `Join my cats on Cat Tracker: open Settings → "Join a household" and enter ${pretty(invite)}` })}
                />
              </View>
            ) : (
              <Button title="Invite someone" icon="person-add-outline" busy={busy === 'invite'} onPress={() => void run('invite', async () => setInvite(await backend.createInvite()))} />
            )}

            <SectionTitle>Join a household</SectionTitle>
            {joined.map((o) => (
              <View key={o.userId} style={styles.personRow}>
                <Ionicons name="home-outline" size={22} color={t.textMuted} />
                <Text style={[styles.personText, { color: t.text }]} numberOfLines={1}>
                  {o.email}'s cats
                </Text>
                <Button
                  title="Leave"
                  variant="ghost"
                  onPress={() => void leaveHousehold(o)}
                />
              </View>
            ))}
            <View style={styles.row}>
              <TextInput
                style={[input, { flex: 1 }]}
                placeholder="ABCD-2345"
                placeholderTextColor={t.textMuted}
                accessibilityLabel="Invite code"
                autoCapitalize="characters"
                value={joinCode}
                onChangeText={setJoinCode}
                maxLength={9}
              />
              <Button
                title="Join"
                busy={busy === 'join'}
                disabled={joinCode.replace(/[^A-Za-z0-9]/g, '').length !== 8}
                onPress={() =>
                  void run(
                    'join',
                    async () => {
                      await backend.acceptInvite(joinCode);
                      setJoinCode('');
                      await Promise.all([loadPeople(), refresh()]);
                    },
                    'Joined. Their cats are now in your list.',
                  )
                }
              />
            </View>
          </>
        )}
      </Card>

      <Card style={{ gap: space.md }}>
        <SectionTitle>Appearance</SectionTitle>
        <Segmented<ThemePref>
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={pref}
          onChange={setPref}
        />
      </Card>

      <Card style={{ gap: space.md }}>
        <SectionTitle>Alerts</SectionTitle>
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
        <Text style={{ color: t.text }}>{demo ? 'Demo mode · nothing is stored' : `Signed in as ${backend.userLabel}`}</Text>
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
  personRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  personText: { flex: 1, fontSize: 15 },
  codeBox: { borderRadius: radius.md, padding: space.md, gap: space.sm, alignItems: 'center' },
  code: { fontSize: 30, fontWeight: '900', letterSpacing: 4 },
});
