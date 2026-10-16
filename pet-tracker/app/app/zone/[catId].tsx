/**
 * New home zone: name, size and centre (the cat, this phone, or long-press on
 * the map). A zone can apply to one cat or to every cat in the household.
 */
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { useApp } from '../../src/AppProvider';
import { CatMap } from '../../src/components/CatMap';
import { Button, Card, SectionTitle, Segmented } from '../../src/components/ui';
import { radius, space, useTheme } from '../../src/theme';

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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }];

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={{ height: Math.round(height * 0.32), borderRadius: radius.lg, overflow: 'hidden' }}>
        <CatMap
          cats={[cat]}
          focusId={cat.id}
          draftZone={center ? { ...center, radiusM } : null}
          onLongPress={(lat, lng) => setCenter({ lat, lng })}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Text style={{ color: t.textMuted, fontSize: 13 }}>Long-press the map to move the centre.</Text>

      <Card style={{ gap: space.md }}>
        <SectionTitle>Centre</SectionTitle>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            style={{ flex: 1 }}
            variant="secondary"
            title={`At ${cat.name}`}
            disabled={cat.lastLat == null}
            onPress={() => cat.lastLat != null && cat.lastLng != null && setCenter({ lat: cat.lastLat, lng: cat.lastLng })}
          />
          <Button style={{ flex: 1 }} variant="secondary" title="At my position" onPress={() => void useMyLocation()} />
        </View>

        <SectionTitle>Name</SectionTitle>
        <TextInput style={input} value={name} onChangeText={setName} maxLength={64} placeholder="Zone name" placeholderTextColor={t.textMuted} />
        <View style={styles.chips}>
          {SUGGESTED.map((s) => (
            <Button key={s} title={s} variant={name === s ? 'primary' : 'secondary'} style={styles.chip} onPress={() => setName(s)} />
          ))}
        </View>

        <SectionTitle>Size</SectionTitle>
        <Segmented options={SIZES} value={radiusM as 50 | 100 | 250 | 500} onChange={setRadiusM} />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '700' }}>Applies to all cats</Text>
            <Text style={{ color: t.textMuted, fontSize: 13 }}>Including cats you add later.</Text>
          </View>
          <Switch value={allCats} onValueChange={setAllCats} trackColor={{ true: t.accent }} />
        </View>
      </Card>

      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <Button title="Save zone" onPress={() => void save()} busy={busy} disabled={!center || !name.trim()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 36, paddingHorizontal: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
