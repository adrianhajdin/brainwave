import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { useApp } from '../src/AppProvider';
import { CAT_COLORS } from '../src/backend/types';
import { Button, CatAvatar, ErrorText, SectionTitle, Segmented } from '../src/components/ui';
import { messageOf } from '../src/dialogs';
import { radius, space, useTheme } from '../src/theme';

type Source = 'phone' | 'collar';

export default function AddCat() {
  const t = useTheme();
  const router = useRouter();
  const { backend, refresh, setTrackedCatId } = useApp();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(CAT_COLORS[0]);
  const [source, setSource] = useState<Source>('phone');
  // Off by default: starting GPS is a choice, not a side effect of adding a cat.
  const [trackNow, setTrackNow] = useState(false);
  // A phone may only be used as a tracker with its owner's agreement.
  const [consent, setConsent] = useState(false);
  const [deviceUid, setDeviceUid] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!backend) return null;

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }];
  const canSave =
    source === 'phone' ? name.trim().length > 0 && consent : deviceUid.trim().length > 3 && claimCode.trim().length >= 10;

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
      setError(messageOf(e));
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
        accessibilityLabel="Cat name"
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
          { value: 'phone', label: 'This phone' },
          { value: 'collar', label: 'GPS collar' },
        ]}
        value={source}
        onChange={setSource}
      />

      {source === 'phone' ? (
        <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={{ color: t.textMuted, lineHeight: 20 }}>
            Use this for your own phone, or one whose owner has agreed. The phone sends its GPS position as this cat while
            tracking, and shows a persistent "tracking" notification.
          </Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            onPress={() => setConsent((c) => !c)}
            style={styles.checkRow}
          >
            <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={24} color={consent ? t.accent : t.textMuted} />
            <Text style={{ color: t.text, flex: 1, lineHeight: 20 }}>
              The owner of this phone knows it shares their location with everyone in my household.
            </Text>
          </Pressable>
          <View style={styles.switchRow}>
            <Text style={{ color: t.text, fontWeight: '700', flex: 1 }}>Start tracking right after adding</Text>
            <Switch value={trackNow} onValueChange={setTrackNow} trackColor={{ true: t.accent }} />
          </View>
        </View>
      ) : (
        <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.border, gap: space.sm }]}>
          <Text style={{ color: t.textMuted, lineHeight: 20 }}>Enter the device ID and claim code printed on the collar's label.</Text>
          <TextInput
            style={input}
            placeholder="Device ID (pt-…)"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="Device ID"
            autoCapitalize="none"
            value={deviceUid}
            onChangeText={setDeviceUid}
          />
          <TextInput
            style={input}
            placeholder="Claim code"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="Claim code"
            autoCapitalize="characters"
            value={claimCode}
            onChangeText={setClaimCode}
          />
        </View>
      )}

      <ErrorText>{error}</ErrorText>

      <Button
        title={source === 'phone' ? 'Add cat' : 'Claim collar'}
        onPress={() => void save()}
        busy={busy}
        disabled={!canSave}
        style={{ marginTop: space.xl }}
      />
      {!canSave && (
        <Text style={{ color: t.textMuted, textAlign: 'center', marginTop: space.sm, fontSize: 13 }}>
          {source === 'phone'
            ? !name.trim()
              ? 'Give your cat a name to continue.'
              : 'Confirm the phone owner agreed to continue.'
            : 'Enter the device ID and claim code to continue.'}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.xl, gap: space.sm, maxWidth: 560, width: '100%', alignSelf: 'center' },
  preview: { alignItems: 'center', marginBottom: space.md },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16, marginBottom: space.md },
  swatches: { flexDirection: 'row', gap: space.md, marginBottom: space.lg, flexWrap: 'wrap' },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md, marginTop: space.md, gap: space.md },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
});
