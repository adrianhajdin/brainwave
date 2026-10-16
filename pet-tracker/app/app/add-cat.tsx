import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { useApp } from '../src/AppProvider';
import { CAT_COLORS } from '../src/backend/types';
import { Button, CatAvatar, SectionTitle, Segmented } from '../src/components/ui';
import { radius, space, useTheme } from '../src/theme';

type Source = 'phone' | 'collar';

export default function AddCat() {
  const t = useTheme();
  const router = useRouter();
  const { backend, refresh, setTrackedCatId } = useApp();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(CAT_COLORS[0]);
  const [source, setSource] = useState<Source>('phone');
  const [trackNow, setTrackNow] = useState(true);
  const [deviceUid, setDeviceUid] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!backend) return null;

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }];
  const canSave = source === 'phone' ? name.trim().length > 0 : deviceUid.trim().length > 3 && claimCode.trim().length >= 10;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      let id: string;
      if (source === 'phone') {
        id = await backend.addPhoneCat(name, color);
        if (trackNow) setTrackedCatId(id);
      } else {
        id = await backend.claimCollar(deviceUid, claimCode);
        if (name.trim()) await backend.updateCat(id, { name, color });
      }
      await refresh();
      router.replace({ pathname: '/cat/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.preview}>
        <CatAvatar name={name || '?'} color={color} size={72} />
      </View>

      <SectionTitle>Name</SectionTitle>
      <TextInput
        style={input}
        placeholder="e.g. Minoes"
        placeholderTextColor={t.textMuted}
        value={name}
        onChangeText={setName}
        maxLength={64}
        autoFocus
      />

      <SectionTitle>Map colour</SectionTitle>
      <View style={styles.swatches}>
        {CAT_COLORS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Colour ${c}`}
            accessibilityState={{ selected: c === color }}
            onPress={() => setColor(c)}
            style={[styles.swatch, { backgroundColor: c, borderColor: c === color ? t.text : 'transparent' }]}
          />
        ))}
      </View>

      <SectionTitle>Tracker</SectionTitle>
      <Segmented<Source>
        options={[
          { value: 'phone', label: '📱 This phone (test)' },
          { value: 'collar', label: '📡 GPS collar' },
        ]}
        value={source}
        onChange={setSource}
      />

      {source === 'phone' ? (
        <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={{ color: t.textMuted, lineHeight: 20 }}>
            The phone stands in for the collar: it sends its own GPS position for this cat while the app is open. Take
            the phone for a walk to test live tracking, route replay and home-zone alerts.
          </Text>
          <View style={styles.switchRow}>
            <Text style={{ color: t.text, fontWeight: '700', flex: 1 }}>Start tracking with this phone now</Text>
            <Switch value={trackNow} onValueChange={setTrackNow} trackColor={{ true: t.accent }} />
          </View>
        </View>
      ) : (
        <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.border, gap: space.sm }]}>
          <Text style={{ color: t.textMuted, lineHeight: 20 }}>
            Enter the device ID and claim code printed on the collar's label.
          </Text>
          <TextInput style={input} placeholder="Device ID (pt-…)" placeholderTextColor={t.textMuted} autoCapitalize="none" value={deviceUid} onChangeText={setDeviceUid} />
          <TextInput style={input} placeholder="Claim code" placeholderTextColor={t.textMuted} autoCapitalize="characters" value={claimCode} onChangeText={setClaimCode} />
        </View>
      )}

      {error && <Text style={{ color: t.danger, marginTop: space.md }}>{error}</Text>}

      <Button title={source === 'phone' ? 'Add cat' : 'Claim collar'} onPress={() => void save()} busy={busy} disabled={!canSave} style={{ marginTop: space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.xl, gap: space.sm, maxWidth: 560, width: '100%', alignSelf: 'center' },
  preview: { alignItems: 'center', marginBottom: space.md },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16, marginBottom: space.md },
  swatches: { flexDirection: 'row', gap: space.md, marginBottom: space.lg, flexWrap: 'wrap' },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md, marginTop: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
});
