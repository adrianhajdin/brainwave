/**
 * Edit a cat: photo, name and colour, night watch, the phone tracker's report
 * interval, and deleting the cat. Only the owner can open this screen.
 * Layout follows the "Clean Signal" design (08-edit-cat).
 */
import { Ionicons } from '@expo/vector-icons';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { REPORT_INTERVALS, useApp } from '../../src/AppProvider';
import { CAT_COLORS, isOwner, type NightWatch } from '../../src/backend/types';
import { Button, CatAvatar, ErrorText, Segmented } from '../../src/components/ui';
import { TimeField } from '../../src/components/TimeField';
import { usePhotoUrl } from '../../src/components/usePhotoUrl';
import { ask, messageOf } from '../../src/dialogs';
import { deviceTimezone } from '../../src/time';
import { fonts, radius, space, useTheme } from '../../src/theme';

const NIGHT_INTERVALS = [
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
] as const;

type Key = 'photo' | 'save' | 'night' | 'delete';

async function resizeForUpload(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 512 });
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return result.uri;
}

/** Night window as 0..1 segments of the day, split at midnight when it wraps. */
function nightSegments(startMin: number, endMin: number): [number, number][] {
  const s = startMin / 1440;
  const e = endMin / 1440;
  return s < e ? [[s, e]] : [[s, 1], [0, e]];
}

export default function EditCat() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { backend, cats, intervalS, setIntervalS, trackedCatId, setTrackedCatId, removeCatLocal } = useApp();
  const cat = cats.find((c) => c.id === id);
  const photoUrl = usePhotoUrl(cat?.photoPath);

  const [name, setName] = useState(cat?.name ?? '');
  const [color, setColor] = useState(cat?.color ?? CAT_COLORS[0]);
  const [busy, setBusy] = useState<Key | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});

  if (!backend || !cat) return null;
  if (!isOwner(cat, backend)) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.textMuted, textAlign: 'center' }}>Only the owner of {cat.name} can change it.</Text>
      </View>
    );
  }

  const run = async (key: Key, fn: () => Promise<void>) => {
    setBusy(key);
    setErrors((e) => ({ ...e, [key]: undefined }));
    try {
      await fn();
    } catch (e) {
      setErrors((s) => ({ ...s, [key]: messageOf(e) }));
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run('save', async () => {
      await backend.updateCat(cat.id, { name, color });
      router.back();
    });

  const pick = (source: 'library' | 'camera') =>
    run('photo', async () => {
      const perm =
        source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) throw new Error(`Permission to use the ${source === 'camera' ? 'camera' : 'photo library'} was not granted.`);
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (res.canceled || !res.assets[0]) return;
      await backend.setPhoto(cat.id, await resizeForUpload(res.assets[0].uri));
    });

  const saveNight = (night: NightWatch) => void run('night', () => backend.setNightWatch(cat.id, night, deviceTimezone()));

  const deleteCat = async () => {
    const yes = await ask(
      `Delete ${cat.name}?`,
      'Its location history, zones and alerts are deleted for everyone in your household. This cannot be undone.',
      'Delete',
      true,
    );
    if (!yes) return;
    await run('delete', async () => {
      await backend.removeCat(cat.id);
      if (trackedCatId === cat.id) setTrackedCatId(null);
      removeCatLocal(cat.id);
      router.replace('/');
    });
  };

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }];

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          title: `Edit ${cat.name}`,
          headerLeft: () => (
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}>
              <Text style={{ color: t.text, fontSize: 16 }}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Save" disabled={!name.trim() || busy === 'save'} onPress={() => void save()} hitSlop={10}>
              <Text style={{ color: name.trim() ? t.accent : t.textMuted, fontSize: 16, fontFamily: fonts.bodySemibold }}>Save</Text>
            </Pressable>
          ),
        }}
      />

      <View style={[styles.card, { backgroundColor: t.surface, paddingTop: 22, alignItems: 'center', gap: 16 }]}>
        <View style={styles.avatarWrap}>
          <CatAvatar name={name || cat.name} color={color} size={96} photoUrl={photoUrl} />
          <View style={[styles.cameraBadge, { backgroundColor: t.primary, borderColor: t.surface }]}>
            <Ionicons name="camera" size={16} color={t.primaryText} />
          </View>
        </View>
        <View style={styles.row}>
          <Button style={{ flex: 1 }} variant="secondary" title="Choose photo" icon="image-outline" busy={busy === 'photo'} onPress={() => void pick('library')} />
          <Button style={{ flex: 1 }} variant="secondary" title="Take photo" icon="camera-outline" onPress={() => void pick('camera')} />
        </View>
        {cat.photoPath && <Button title="Remove photo" variant="ghost" onPress={() => void run('photo', () => backend.removePhoto(cat.id))} />}
        <Text style={{ color: t.textMuted, fontSize: 13, lineHeight: 18, textAlign: 'center' }}>
          Photos are resized and visible to everyone in your household.
        </Text>
        <ErrorText>{errors.photo}</ErrorText>
      </View>

      <View style={[styles.card, { backgroundColor: t.surface, gap: 16 }]}>
        <View style={{ gap: 6 }}>
          <Text style={[styles.label, { color: t.textMuted }]}>Name</Text>
          <TextInput style={input} value={name} onChangeText={setName} maxLength={64} accessibilityLabel="Cat name" />
        </View>
        <View style={{ gap: 10 }}>
          <Text style={[styles.label, { color: t.textMuted }]}>Map colour</Text>
          <View style={styles.swatches}>
            {CAT_COLORS.map((c) => {
              const selected = c === color;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={`Colour ${c}`}
                  accessibilityState={{ selected }}
                  onPress={() => setColor(c)}
                  style={[styles.swatchRing, { borderColor: selected ? t.text : 'transparent' }]}
                >
                  <View style={[styles.swatch, { backgroundColor: c }]} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <ErrorText>{errors.save}</ErrorText>
      </View>

      <View style={[styles.card, { backgroundColor: t.surface, gap: 16 }]}>
        <View style={styles.rowAlign}>
          <View style={[styles.iconTile, { backgroundColor: t.nightSoft }]}>
            <Ionicons name="moon-outline" size={20} color={t.night} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: t.text, fontFamily: fonts.bodySemibold, fontSize: 16 }}>Night watch</Text>
            <Text style={{ color: t.textMuted, fontSize: 13 }}>Track more often at night</Text>
          </View>
          <Switch
            accessibilityLabel="Night watch"
            value={cat.night.enabled}
            onValueChange={(v) => saveNight({ ...cat.night, enabled: v })}
            trackColor={{ true: t.night, false: t.surfaceAlt }}
            thumbColor="#FFFFFF"
            disabled={busy === 'night'}
          />
        </View>
        <Text style={{ color: t.textMuted, lineHeight: 21, fontSize: 14 }}>
          Cats roam at night. During these hours, positions update more often while {cat.name} is on the move.{' '}
          {cat.kind === 'collar' ? 'The collar picks up changes at its next check-in.' : 'Applies to this phone while it tracks.'}
        </Text>
        {cat.night.enabled && (
          <>
            <View style={styles.timeRow}>
              <TimeField label="From" minutes={cat.night.startMin} onChange={(m) => saveNight({ ...cat.night, startMin: m })} />
              <TimeField label="Until" minutes={cat.night.endMin} onChange={(m) => saveNight({ ...cat.night, endMin: m })} />
            </View>
            <View style={{ gap: 6 }}>
              <View style={[styles.timeline, { backgroundColor: t.surfaceAlt }]}>
                {nightSegments(cat.night.startMin, cat.night.endMin).map(([from, to]) => (
                  <View key={from} style={{ position: 'absolute', top: 0, bottom: 0, left: `${from * 100}%`, width: `${(to - from) * 100}%`, backgroundColor: t.night }} />
                ))}
              </View>
              <View style={styles.ticks}>
                {['00', '06', '12', '18', '24'].map((h) => (
                  <Text key={h} style={[styles.tick, { color: t.textMuted }]}>{h}</Text>
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: t.textMuted }]}>Update every</Text>
              <Segmented options={NIGHT_INTERVALS} value={cat.night.intervalS as 120 | 300 | 600} onChange={(v) => saveNight({ ...cat.night, intervalS: v })} />
            </View>
          </>
        )}
        <ErrorText>{errors.night}</ErrorText>
      </View>

      {cat.kind === 'phone' && (
        <View style={[styles.card, { backgroundColor: t.surface, gap: 12, paddingBottom: 8 }]}>
          <View style={styles.rowAlign}>
            <View style={[styles.iconTile, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="phone-portrait-outline" size={20} color={t.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: t.text, fontFamily: fonts.bodySemibold, fontSize: 16 }}>Phone tracker</Text>
              <Text style={{ color: t.textMuted, fontSize: 13 }}>How often this phone sends its location</Text>
            </View>
          </View>
          {REPORT_INTERVALS.map((r) => {
            const selected = intervalS === r.seconds;
            return (
              <Pressable
                key={r.seconds}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setIntervalS(r.seconds)}
                style={[styles.radioRow, { borderBottomColor: t.surfaceAlt }]}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={{ color: t.text, fontFamily: fonts.bodySemibold, fontSize: 16, minWidth: 54 }}>{r.label}</Text>
                  <Text style={{ color: t.textMuted, fontSize: 14 }}>{r.hint}</Text>
                </View>
                <View style={[styles.radio, { borderColor: selected ? t.text : t.border }]}>
                  {selected && <View style={[styles.radioDot, { backgroundColor: t.text }]} />}
                </View>
              </Pressable>
            );
          })}
          <Text style={{ color: t.textMuted, fontSize: 13, lineHeight: 18, paddingBottom: 8 }}>
            Lost mode and night watch can shorten this automatically.
          </Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: t.surface, gap: 12, borderWidth: 1, borderColor: t.dangerSoft }]}>
        <Text style={{ color: t.text, fontFamily: fonts.bodySemibold, fontSize: 16 }}>Delete {cat.name}</Text>
        <Text style={{ color: t.textMuted, lineHeight: 20 }}>
          Removes {cat.name} with its location history, zones and alerts for everyone in your household. This cannot be undone.
        </Text>
        <ErrorText>{errors.delete}</ErrorText>
        <Button title={`Delete ${cat.name} and its history`} variant="danger" icon="trash-outline" busy={busy === 'delete'} onPress={() => void deleteCat()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  scroll: { padding: space.lg, gap: 14, paddingBottom: space.xl * 2, maxWidth: 560, width: '100%', alignSelf: 'center' },
  card: { borderRadius: 24, padding: 18 },
  avatarWrap: { width: 96, height: 108 },
  cameraBadge: {
    position: 'absolute', right: -4, bottom: -2, width: 36, height: 36, borderRadius: 18,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  rowAlign: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, height: 48, fontSize: 17, fontFamily: fonts.body },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 40, height: 40, borderRadius: 20 },
  timeRow: { flexDirection: 'row', gap: 8 },
  timeline: { height: 10, borderRadius: 5, overflow: 'hidden' },
  ticks: { flexDirection: 'row', justifyContent: 'space-between' },
  tick: { fontFamily: 'GeistMono_500Medium', fontSize: 11 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
