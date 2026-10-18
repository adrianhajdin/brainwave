/**
 * New home zone: name, size and centre (a cat, this phone, or long-press on
 * the map). A zone belongs to a household (every cat in it, whoever owns the
 * cat) or to one cat. Opened from a cat (?catId=) or a household (?householdId=).
 * Layout follows the "Clean Signal" design (09-new-zone).
 */
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { useApp } from '../../src/AppProvider';
import { CatMap } from '../../src/components/CatMap';
import { Button, ErrorText, IconButton, Segmented } from '../../src/components/ui';
import { messageOf } from '../../src/dialogs';
import { fonts, radius, space, useTheme } from '../../src/theme';

// Radius presets: 15-25 m fits a house (with garden), larger ones a street or area.
const SIZES = [
  { value: 15, label: '15 m' },
  { value: 25, label: '25 m' },
  { value: 50, label: '50 m' },
  { value: 100, label: '100 m' },
  { value: 250, label: '250 m' },
] as const;

/** Fine-tuning range and step for the radius (the database accepts 10-5000 m). */
const MIN_RADIUS_M = 10;
const MAX_RADIUS_M = 500;
const STEP_M = 5;
/** Below this, indoor GPS error is about as large as the zone itself. */
const SMALL_ZONE_M = 25;

const SUGGESTED = ['Home', 'Garden', 'Neighbours', 'Holiday home'];

export default function NewZone() {
  const t = useTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ catId?: string; householdId?: string }>();
  const { backend, cats } = useApp();
  const cat = cats.find((c) => c.id === params.catId);
  // The household this zone can be for: the one asked for, or the cat's (not for cat sitters).
  const householdId = params.householdId ?? (cat && cat.access !== 'sitter' ? cat.householdId : null);
  const [householdName, setHouseholdName] = useState<string | null>(cat?.householdName ?? null);
  const canCatZone = cat !== undefined && cat.access === 'owner';

  const [name, setName] = useState('Home');
  const [radiusM, setRadiusM] = useState<number>(25);
  const [scope, setScope] = useState<'household' | 'cat'>(householdId ? 'household' : 'cat');
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const householdCats = householdId ? cats.filter((c) => c.householdId === householdId) : [];
  const shownCats = scope === 'household' && householdCats.length > 0 ? householdCats : cat ? [cat] : [];
  // Start at the cat (or the household's first cat with a position).
  const anchor = [cat, ...householdCats].find((c) => c?.lastLat != null && c.lastLng != null);

  useEffect(() => {
    if (!center && anchor) setCenter({ lat: anchor.lastLat!, lng: anchor.lastLng! });
  }, [anchor, center]);

  useEffect(() => {
    if (!householdName && householdId && backend) {
      void backend.listHouseholds().then((hs) => setHouseholdName(hs.find((h) => h.id === householdId)?.name ?? null)).catch(() => undefined);
    }
  }, [backend, householdId, householdName]);

  if (!backend || (!cat && !householdId) || (!householdId && !canCatZone)) return null;
  const forName = scope === 'household' ? householdName ?? 'the household' : cat?.name ?? '';

  const cancel = <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}><Text style={{ color: t.text, fontSize: 16 }}>Cancel</Text></Pressable>;

  const useMyLocation = async () => {
    setError(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return setError('Location permission is needed to use your position.');
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  };

  const save = async () => {
    if (!center) return;
    setBusy(true);
    setError(null);
    try {
      await backend.addZone(
        scope === 'household' && householdId ? { householdId } : { catId: cat!.id },
        name, center.lat, center.lng, radiusM,
      );
      router.back();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const hint = !center ? 'Set the centre first: use "At my position" or long-press the map.' : !name.trim() ? 'Give the zone a name.' : null;
  const centreIsCat = center !== null && anchor !== undefined && anchor.lastLat === center.lat && anchor.lastLng === center.lng;

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: scope === 'household' ? `Zone for ${forName}` : 'New zone', headerLeft: () => cancel }} />

      <View style={[styles.mapWrap, { height: Math.min(330, Math.round(height * 0.36)) }]}>
        <CatMap
          cats={shownCats}
          focusId={scope === 'cat' ? cat?.id : undefined}
          draftZone={center ? { ...center, radiusM } : null}
          onLongPress={(lat, lng) => setCenter({ lat, lng })}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.mapHint} pointerEvents="none">
          <Ionicons name="hand-left-outline" size={14} color={t.textMuted} />
          <Text style={{ color: t.textMuted, fontSize: 13 }}>Long-press the map to move the centre</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: t.surface }]}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.textMuted }]}>Centre</Text>
          <View style={styles.centreRow}>
            {anchor && (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: centreIsCat }}
                onPress={() => setCenter({ lat: anchor.lastLat!, lng: anchor.lastLng! })}
                style={[styles.centreBtn, { borderColor: centreIsCat ? t.text : t.surfaceAlt, backgroundColor: centreIsCat ? t.surface : t.surfaceAlt }]}
              >
                <View style={[styles.swatch, { backgroundColor: anchor.color }]} />
                <Text style={{ color: t.text, fontFamily: fonts.bodySemibold }} numberOfLines={1}>At {anchor.name}</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => void useMyLocation()}
              style={[styles.centreBtn, { borderColor: t.surfaceAlt, backgroundColor: t.surfaceAlt }]}
            >
              <Ionicons name="navigate-outline" size={16} color={t.text} />
              <Text style={{ color: t.text, fontFamily: fonts.bodySemibold }}>At my position</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: t.textMuted }]}>Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }]}
            value={name}
            onChangeText={setName}
            maxLength={64}
            placeholder="Zone name"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="Zone name"
          />
          <View style={styles.chips}>
            {SUGGESTED.map((s) => {
              const selected = name === s;
              return (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setName(s)}
                  style={[styles.chip, { backgroundColor: selected ? t.primary : t.surface, borderColor: selected ? t.primary : t.border }]}
                >
                  <Text style={{ color: selected ? t.primaryText : t.text, fontFamily: fonts.bodyMedium }}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: t.textMuted }]}>Size</Text>
          <Segmented<number> options={SIZES} value={radiusM} onChange={setRadiusM} />
          <View style={styles.stepper}>
            <IconButton
              icon="remove"
              label="Make the zone smaller"
              disabled={radiusM <= MIN_RADIUS_M}
              onPress={() => setRadiusM((r) => Math.max(MIN_RADIUS_M, r - STEP_M))}
            />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: t.text, fontFamily: fonts.display, fontSize: 20 }}>{radiusM} m radius</Text>
              <Text style={{ color: t.textMuted, fontSize: 13 }}>{radiusM * 2} m across</Text>
            </View>
            <IconButton
              icon="add"
              label="Make the zone larger"
              disabled={radiusM >= MAX_RADIUS_M}
              onPress={() => setRadiusM((r) => Math.min(MAX_RADIUS_M, r + STEP_M))}
            />
          </View>
          {radiusM < SMALL_ZONE_M && (
            <Text style={{ color: t.textMuted, fontSize: 13, lineHeight: 18 }}>
              GPS is often 10–30 m off indoors. You still only get a "left" alert once a cat is clearly outside, but
              the app may briefly show it as outside while in the house.
            </Text>
          )}
        </View>

        {householdId && canCatZone && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textMuted }]}>Applies to</Text>
            <Segmented<'household' | 'cat'>
              options={[
                { value: 'household', label: householdName ?? 'Household' },
                { value: 'cat', label: `Only ${cat!.name}` },
              ]}
              value={scope}
              onChange={setScope}
            />
          </View>
        )}
        <Text style={{ color: t.textMuted, fontSize: 13, lineHeight: 18 }}>
          {scope === 'household'
            ? `Every cat in ${forName} uses this zone, also cats added later, and everyone in ${forName} gets its alerts.`
            : `Only ${forName} uses this zone.`}
        </Text>
      </View>

      <ErrorText>{error}</ErrorText>
      {hint && <Text style={{ color: t.textMuted, lineHeight: 20, textAlign: 'center' }}>{hint}</Text>}
      <Button title={`Save ${name.trim() || 'zone'}`} icon="checkmark" onPress={() => void save()} busy={busy} disabled={!center || !name.trim()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center', paddingBottom: space.xl * 2 },
  mapWrap: { borderRadius: 24, overflow: 'hidden' },
  mapHint: {
    position: 'absolute', alignSelf: 'center', bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.95)',
  },
  card: { borderRadius: 24, padding: 18, gap: 18 },
  field: { gap: 8 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  centreRow: { flexDirection: 'row', gap: 8 },
  centreBtn: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  swatch: { width: 16, height: 16, borderRadius: 8 },
  input: { height: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, fontSize: 17, fontFamily: fonts.body },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
