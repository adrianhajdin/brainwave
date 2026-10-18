/**
 * Households in Settings: every household you are in, its people, cats and
 * home zones, inviting (admins), renaming, leaving, creating a new one, and
 * joining with a code (a household code or a cat-sitter code).
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { useApp } from '../AppProvider';
import type { HomeZone, Household, HouseholdMember } from '../backend/types';
import { ask, messageOf } from '../dialogs';
import { formatDistance } from '../geo';
import { fonts, radius, space, useTheme } from '../theme';
import { Button, Card, ErrorText, Pill, SectionTitle } from './ui';

export const prettyCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

export function HouseholdsCard() {
  const t = useTheme();
  const router = useRouter();
  const { backend, refresh } = useApp();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [zones, setZones] = useState<Record<string, HomeZone[]>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  const load = useCallback(async () => {
    if (!backend) return;
    const list = await backend.listHouseholds().catch(() => []);
    setHouseholds(list);
    const pairs = await Promise.all(list.map(async (h) => [h.id, await backend.getHouseholdZones(h.id).catch(() => [])] as const));
    setZones(Object.fromEntries(pairs));
  }, [backend]);

  // Also when coming back from adding a zone.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!backend) return null;
  const demo = backend.mode === 'demo';
  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }];

  const run = async (key: string, fn: () => Promise<void | string>, ok?: string) => {
    setBusy(key);
    setMessage(null);
    try {
      const result = await fn();
      await Promise.all([load(), refresh()]);
      if (ok || typeof result === 'string') setMessage({ text: typeof result === 'string' ? result : ok!, tone: 'info' });
    } catch (e) {
      setMessage({ text: messageOf(e), tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const invite = (h: Household) =>
    run(`invite-${h.id}`, async () => {
      const code = await backend.createHouseholdInvite(h.id);
      setCodes((c) => ({ ...c, [h.id]: code }));
    });

  const removeMember = async (h: Household, m: HouseholdMember) => {
    if (!(await ask(`Remove ${m.email}?`, `They will no longer see the cats in ${h.name}. Their own cats leave the household with them.`, 'Remove', true))) return;
    await run(`rm-${h.id}-${m.userId}`, () => backend.removeMember(h.id, m.userId));
  };

  const removeZone = async (h: Household, z: HomeZone) => {
    if (!(await ask(`Delete ${z.name}?`, `Alerts for ${z.name} stop for every cat in ${h.name}.`, 'Delete zone', true))) return;
    await run(`zone-${z.id}`, () => backend.removeZone(z.id));
  };

  const leave = async (h: Household) => {
    if (!(await ask(`Leave ${h.name}?`, 'Its cats disappear from your list. Your own cats in it become private.', 'Leave', true))) return;
    await run(`leave-${h.id}`, () => backend.leaveHousehold(h.id));
  };

  const remove = async (h: Household) => {
    if (!(await ask(`Delete ${h.name}?`, 'Everyone loses access to its cats. The cats stay with their owners as private cats.', 'Delete', true))) return;
    await run(`del-${h.id}`, () => backend.deleteHousehold(h.id));
  };

  const join = () =>
    run('join', async () => {
      const result = await backend.acceptInvite(joinCode);
      setJoinCode('');
      return result.kind === 'household'
        ? `You joined ${result.name}. Its cats are now in your list.`
        : `You're now looking after ${result.name}.`;
    });

  return (
    <Card style={{ gap: space.md }}>
      <SectionTitle>Households</SectionTitle>
      <Text style={{ color: t.textMuted, lineHeight: 20 }}>
        Everyone in a household sees its cats, gets their alerts and can switch lost mode on. Only a cat's owner edits it.
        You can be in more than one household, and choose per cat which household it is in.
      </Text>
      {message && (message.tone === 'error' ? <ErrorText>{message.text}</ErrorText> : <Text style={{ color: t.live, lineHeight: 20 }}>{message.text}</Text>)}

      {households.map((h) => {
        const admin = h.myRole === 'admin';
        const code = codes[h.id];
        return (
          <View key={h.id} style={[styles.household, { backgroundColor: t.surfaceAlt }]}>
            {renaming?.id === h.id ? (
              <View style={styles.row}>
                <TextInput
                  style={[...input, { flex: 1, backgroundColor: t.surface }]}
                  value={renaming.name}
                  onChangeText={(name) => setRenaming({ id: h.id, name })}
                  maxLength={64}
                  autoFocus
                  accessibilityLabel="Household name"
                />
                <Button
                  title="Save"
                  busy={busy === `ren-${h.id}`}
                  disabled={!renaming.name.trim()}
                  onPress={() => void run(`ren-${h.id}`, async () => {
                    await backend.renameHousehold(h.id, renaming.name);
                    setRenaming(null);
                  })}
                />
              </View>
            ) : (
              <View style={styles.row}>
                <Ionicons name="home-outline" size={20} color={t.text} />
                <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{h.name}</Text>
                <Pill label={admin ? 'Admin' : 'Member'} tone={admin ? 'accent' : 'neutral'} />
              </View>
            )}
            <Text style={{ color: t.textMuted, fontSize: 13 }}>
              {h.catCount === 1 ? '1 cat' : `${h.catCount} cats`} · {h.members.length === 1 ? '1 person' : `${h.members.length} people`}
            </Text>

            {h.members.map((m) => (
              <View key={m.userId} style={styles.row}>
                <Ionicons name="person-circle-outline" size={22} color={t.textMuted} />
                <Text style={[styles.email, { color: t.text }]} numberOfLines={1}>
                  {m.userId === backend.userId ? `${m.email} (you)` : m.email}
                </Text>
                {m.role === 'admin' && <Pill label="Admin" />}
                {admin && m.userId !== backend.userId && (
                  <Button title="Remove" variant="ghost" busy={busy === `rm-${h.id}-${m.userId}`} onPress={() => void removeMember(h, m)} />
                )}
              </View>
            ))}

            <Text style={[styles.label, { color: t.textMuted }]}>Home zones</Text>
            {(zones[h.id] ?? []).length === 0 && (
              <Text style={{ color: t.textMuted, fontSize: 13, lineHeight: 18 }}>
                No zones yet. Set where home is once, and every cat in {h.name} gets "left home" and "back home" alerts.
              </Text>
            )}
            {(zones[h.id] ?? []).map((z) => (
              <View key={z.id} style={styles.row}>
                <Ionicons name="location-outline" size={20} color={t.live} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontFamily: fonts.bodySemibold }} numberOfLines={1}>{z.name}</Text>
                  <Text style={{ color: t.textMuted, fontSize: 13 }}>{formatDistance(z.radiusM)} radius · all cats</Text>
                </View>
                <Button title="Delete" variant="ghost" busy={busy === `zone-${z.id}`} onPress={() => void removeZone(h, z)} />
              </View>
            ))}
            <Button
              title={(zones[h.id] ?? []).length ? 'Add a zone' : 'Set home'}
              icon="home-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: '/zone/new', params: { householdId: h.id } })}
            />

            {code && (
              <View style={[styles.codeBox, { backgroundColor: t.surface }]}>
                <Text style={{ color: t.textMuted, fontSize: 13 }}>Invite code for {h.name} · valid 7 days, single use</Text>
                <Text selectable style={[styles.code, { color: t.text }]}>{prettyCode(code)}</Text>
                <Button
                  title="Share code"
                  icon="share-outline"
                  onPress={() =>
                    void Share.share({
                      message: `Join "${h.name}" on Cat Tracker: open Settings → Households → "Join with a code" and enter ${prettyCode(code)}`,
                    })
                  }
                />
              </View>
            )}

            <View style={styles.actions}>
              {admin && !code && (
                <Button title="Invite" icon="person-add-outline" variant="secondary" style={styles.action} busy={busy === `invite-${h.id}`} onPress={() => void invite(h)} />
              )}
              {admin && renaming?.id !== h.id && (
                <Button title="Rename" variant="ghost" style={styles.action} onPress={() => setRenaming({ id: h.id, name: h.name })} />
              )}
              <Button title="Leave" variant="ghost" style={styles.action} busy={busy === `leave-${h.id}`} onPress={() => void leave(h)} />
              {admin && (
                <Button title="Delete" variant="ghost" textColor={t.danger} style={styles.action} busy={busy === `del-${h.id}`} onPress={() => void remove(h)} />
              )}
            </View>
          </View>
        );
      })}

      <Text style={[styles.label, { color: t.textMuted }]}>New household</Text>
      <View style={styles.row}>
        <TextInput
          style={[...input, { flex: 1 }]}
          placeholder={households.length ? 'e.g. Holiday home' : 'e.g. Home'}
          placeholderTextColor={t.textMuted}
          value={newName}
          onChangeText={setNewName}
          maxLength={64}
          accessibilityLabel="New household name"
        />
        <Button
          title="Create"
          busy={busy === 'create'}
          disabled={!newName.trim()}
          onPress={() => void run('create', async () => {
            await backend.createHousehold(newName);
            setNewName('');
          }, `${newName.trim()} created. Invite people, and choose per cat (Edit cat) whether it is in this household.`)}
        />
      </View>

      <Text style={[styles.label, { color: t.textMuted }]}>Join with a code</Text>
      <Text style={{ color: t.textMuted, fontSize: 13, lineHeight: 18 }}>
        A household code adds you to that household. A cat-sitter code lets you follow one cat.
      </Text>
      <View style={styles.row}>
        <TextInput
          style={[...input, { flex: 1 }]}
          placeholder="ABCD-2345"
          placeholderTextColor={t.textMuted}
          accessibilityLabel="Invite code"
          autoCapitalize="characters"
          value={joinCode}
          onChangeText={setJoinCode}
          maxLength={9}
        />
        <Button title="Join" busy={busy === 'join'} disabled={joinCode.replace(/[^A-Za-z0-9]/g, '').length !== 8} onPress={() => void join()} />
      </View>
      {demo && <Text style={{ color: t.textMuted, fontSize: 13 }}>In demo mode you can try households, but invites need an account.</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  household: { borderRadius: radius.lg, padding: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, fontFamily: fonts.display, fontSize: 18 },
  email: { flex: 1, fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  action: { minHeight: 40, paddingHorizontal: space.md },
  codeBox: { borderRadius: radius.md, padding: space.md, gap: space.sm, alignItems: 'center' },
  code: { fontSize: 28, fontFamily: 'GeistMono_500Medium', letterSpacing: 4 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, marginTop: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16, fontFamily: fonts.body },
});
