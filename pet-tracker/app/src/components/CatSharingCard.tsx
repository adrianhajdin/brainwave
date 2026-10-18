/**
 * Who else sees a cat, on the owner's edit screen: the household it is in
 * (or private), and cat sitters who follow just this cat, optionally until a
 * date.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../AppProvider';
import type { Cat, CatSitter, Household } from '../backend/types';
import { ask, messageOf } from '../dialogs';
import { shortDate } from '../time';
import { fonts, radius, space, useTheme } from '../theme';
import { HouseholdPicker } from './HouseholdPicker';
import { prettyCode } from './HouseholdsCard';
import { Button, ErrorText, Segmented } from './ui';

const DAY_MS = 24 * 3600 * 1000;
const DURATIONS = [
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
  { value: 30, label: '1 month' },
  { value: 0, label: 'No end' },
] as const;
type Days = (typeof DURATIONS)[number]['value'];

export function CatSharingCard({ cat }: { cat: Cat }) {
  const t = useTheme();
  const { backend, refresh } = useApp();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [sitters, setSitters] = useState<CatSitter[]>([]);
  const [days, setDays] = useState<Days>(7);
  const [code, setCode] = useState<{ code: string; until: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!backend) return;
    const [h, s] = await Promise.all([backend.listHouseholds().catch(() => []), backend.listCatSitters(cat.id).catch(() => [])]);
    setHouseholds(h);
    setSitters(s);
  }, [backend, cat.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!backend) return null;
  const demo = backend.mode === 'demo';

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  const moveTo = (householdId: string | null) =>
    run(`hh-${householdId ?? 'private'}`, async () => {
      await backend.setCatHousehold(cat.id, householdId);
      await refresh();
    });

  const invite = () =>
    run('invite', async () => {
      const until = days ? new Date(Date.now() + days * DAY_MS).toISOString() : null;
      setCode({ code: await backend.createSitterInvite(cat.id, until), until });
    });

  const removeSitter = async (s: CatSitter) => {
    if (!(await ask(`Stop ${s.email} looking after ${cat.name}?`, `${cat.name} disappears from their list straight away.`, 'Remove', true))) return;
    await run(`rm-${s.userId}`, () => backend.removeCatSitter(cat.id, s.userId));
  };

  return (
    <View style={[styles.card, { backgroundColor: t.surface }]}>
      <View style={styles.rowAlign}>
        <View style={[styles.iconTile, { backgroundColor: t.accentSoft }]}>
          <Ionicons name="people-outline" size={20} color={t.accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.text, fontFamily: fonts.bodySemibold, fontSize: 16 }}>Who sees {cat.name}</Text>
          <Text style={{ color: t.textMuted, fontSize: 13 }}>A household, and cat sitters for a while</Text>
        </View>
      </View>

      <Text style={[styles.label, { color: t.textMuted }]}>Household</Text>
      <HouseholdPicker
        households={households}
        value={cat.householdId ?? null}
        onChange={(id) => void moveTo(id)}
        catName={cat.name}
        busyId={busy?.startsWith('hh-') ? (busy === 'hh-private' ? null : busy.slice(3)) : undefined}
        disabled={busy !== null}
      />
      <Text style={{ color: t.textMuted, fontSize: 13, lineHeight: 18 }}>Create households and invite people in Settings.</Text>

      <Text style={[styles.label, { color: t.textMuted, marginTop: space.sm }]}>Cat sitters</Text>
      <Text style={{ color: t.textMuted, fontSize: 13, lineHeight: 18 }}>
        A neighbour or friend follows only {cat.name}: location, alerts and lost mode. They don't join a household.
      </Text>
      {sitters.map((s) => (
        <View key={s.userId} style={styles.rowAlign}>
          <Ionicons name="person-circle-outline" size={22} color={t.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 15 }} numberOfLines={1}>{s.email}</Text>
            <Text style={{ color: t.textMuted, fontSize: 13 }}>{s.until ? `Until ${shortDate(s.until)}` : 'No end date'}</Text>
          </View>
          <Button title="Remove" variant="ghost" busy={busy === `rm-${s.userId}`} onPress={() => void removeSitter(s)} />
        </View>
      ))}

      {code ? (
        <View style={[styles.codeBox, { backgroundColor: t.surfaceAlt }]}>
          <Text style={{ color: t.textMuted, fontSize: 13, textAlign: 'center' }}>
            Cat-sitter code for {cat.name} · {code.until ? `access until ${shortDate(code.until)}` : 'no end date'} · use within 7 days
          </Text>
          <Text selectable style={[styles.code, { color: t.text }]}>{prettyCode(code.code)}</Text>
          <Button
            title="Share code"
            icon="share-outline"
            onPress={() =>
              void Share.share({
                message: `Can you keep an eye on ${cat.name}? In Cat Tracker, open Settings → Households → "Join with a code" and enter ${prettyCode(code.code)}`,
              })
            }
          />
          <Button title="Done" variant="ghost" onPress={() => setCode(null)} />
        </View>
      ) : demo ? (
        <Text style={{ color: t.textMuted, fontSize: 13 }}>Inviting cat sitters needs an account.</Text>
      ) : (
        <>
          <Segmented<Days> options={DURATIONS} value={days} onChange={setDays} />
          <Button title="Invite a cat sitter" icon="person-add-outline" variant="secondary" busy={busy === 'invite'} onPress={() => void invite()} />
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 18, gap: 12 },
  rowAlign: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  codeBox: { borderRadius: radius.md, padding: space.md, gap: space.sm, alignItems: 'center' },
  code: { fontSize: 28, fontFamily: 'GeistMono_500Medium', letterSpacing: 4 },
});
