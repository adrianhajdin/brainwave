/**
 * New home zone: name, size and centre (the cat, this phone, or long-press on
 * the map). A zone can apply to one cat or to every cat in the household.
 * Layout follows the "Clean Signal" design (09-new-zone).
 */
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { useApp } from '../../src/AppProvider';
import { CatMap } from '../../src/components/CatMap';
import { Button, ErrorText, Segmented } from '../../src/components/ui';
import { messageOf } from '../../src/dialogs';
import { fonts, radius, space, useTheme } from '../../src/theme';

const SIZES = [
  { value: 50, label: '50 m' },
  { value: 100, label: '100 m' },
  { value: 250, label: '250 m' },
  { value: 500, label: '500 m' },
] as const;

const SUGGESTED = ['Home', 'Garden', 'Neighbours', 'Holiday home'];

export default function NewZone() {
  const t = useTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { catId } = useLocalSearchParams<{ catId: string }>();
  const { backend, cats } = useApp();
  const cat = cats.find((c) => c.id === catId);

  const [name, setName] = useState('Home');
  const [radiusM, setRadiusM] = useState<number>(100);
  const [allCats, setAllCats] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!center && cat?.lastLat != null && cat.lastLng != null) setCenter({ lat: cat.lastLat, lng: cat.lastLng });
  }, [cat, center]);

  if (!backend || !cat) return null;

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
      await backend.addZone(allCats ? null : cat.id, name, center.lat, center.lng, radiusM);
      router.back();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const hint = !center ? 'Set the centre first: use "At my position" or long-press the map.' : !name.trim() ? 'Give the zone a name.' : null;
  const centreIsCat = center !== null && cat.lastLat === center.lat && cat.lastLng === center.lng;

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'New zone', headerLeft: () => cancel }} />

      <View style={[styles.mapWrap, { height: Math.min(330, Math.round(height * 0.36)) }]}>
        <CatMap
          cats={[cat]}
          focusId={cat.id}
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
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: centreIsCat }}
              disabled={cat.lastLat == null}
              onPress={() => cat.lastLat != null && cat.lastLng != null && setCenter({ lat: cat.lastLat, lng: cat.lastLng })}
              style={[styles.centreBtn, { borderColor: centreIsCat ? t.text : t.surfaceAlt, backgroundColor: centreIsCat ? t.surface : t.surfaceAlt, opacity: cat.lastLat == null ? 0.45 : 1 }]}
            >
              <View style={[styles.swatch, { backgroundColor: cat.color }]} />
              <Text style={{ color: t.text, fontFamily: fonts.bodySemibold }}>At {cat.name}</Text>
            </Pressable>
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
          <Segmented options={SIZES} value={radiusM as 50 | 100 | 250 | 500} onChange={setRadiusM} />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: t.text, fontFamily: fonts.bodySemibold, fontSize: 15 }}>Applies to all cats</Text>
            <Text style={{ color: t.textMuted, fontSize: 13 }}>Including cats you add later.</Text>
          </View>
          <Switch value={allCats} onValueChange={setAllCats} trackColor={{ true: t.primary, false: t.surfaceAlt }} thumbColor="#FFFFFF" accessibilityLabel="Applies to all cats" />
        </View>
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
