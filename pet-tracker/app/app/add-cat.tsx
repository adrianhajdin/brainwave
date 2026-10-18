import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { useApp } from '../src/AppProvider';
import { CAT_COLORS, type Household } from '../src/backend/types';
import { HouseholdPicker, defaultHousehold } from '../src/components/HouseholdPicker';
import { Button, ErrorText, SectionTitle, Segmented } from '../src/components/ui';
import { messageOf } from '../src/dialogs';
import { CatPhotoField } from '../src/photo/CatPhotoField';
import { fonts, radius, space, useTheme } from '../src/theme';

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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void backend?.listHouseholds().then((h) => {
      setHouseholds(h);
      setHouseholdId(defaultHousehold(h));
    }).catch(() => undefined);
  }, [backend]);

  if (!backend) return null;
  const catName = name.trim() || 'your cat';

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
      // The cat exists now; a failing photo or household choice can be
      // fixed from its edit screen, so they don't block opening it.
      await Promise.allSettled([
        photoUri ? backend.setPhoto(id, photoUri) : Promise.resolve(),
        households.length > 0 ? backend.setCatHousehold(id, householdId) : Promise.resolve(),
      ]);
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
        <CatPhotoField name={name} color={color} photoUrl={photoUri} onPhoto={setPhotoUri} onRemove={() => setPhotoUri(null)} />
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

      <SectionTitle>Who sees {catName}?</SectionTitle>
      <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.border, marginTop: 0, marginBottom: space.md, gap: 0, paddingVertical: space.xs }]}>
        {households.length > 0 ? (
          <HouseholdPicker households={households} value={householdId} onChange={setHouseholdId} catName={catName} />
        ) : (
          <Text style={{ color: t.textMuted, lineHeight: 20, paddingVertical: space.sm }}>
            Only you. To share {catName}, create a household in Settings or invite a cat sitter from {catName}'s edit screen.
          </Text>
        )}
      </View>

      <SectionTitle>How will you track {catName}?</SectionTitle>
      <View style={styles.modes}>
        {(
          [
            { value: 'phone', icon: 'phone-portrait-outline', title: 'This phone', body: 'Test without a collar. Uses this phone\'s GPS.' },
            { value: 'collar', icon: 'radio-outline', title: 'GPS collar', body: 'Pair it with the code on its label.' },
          ] as const
        ).map((m) => {
          const selected = source === m.value;
          return (
            <Pressable
              key={m.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setSource(m.value)}
              style={[styles.mode, { backgroundColor: t.surface, borderColor: selected ? t.primary : t.border }]}
            >
              <View style={styles.modeTop}>
                <Ionicons name={m.icon} size={22} color={t.text} />
                {selected && <Ionicons name="checkmark-circle" size={20} color={t.primary} />}
              </View>
              <Text style={{ color: t.text, fontFamily: fonts.bodySemibold, marginTop: space.sm }}>{m.title}</Text>
              <Text style={{ color: t.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{m.body}</Text>
            </Pressable>
          );
        })}
      </View>

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
              The owner of this phone knows it shares their location with everyone who sees this cat.
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
  preview: { alignItems: 'center', gap: space.sm, marginBottom: space.md },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16, marginBottom: space.md },
  swatches: { flexDirection: 'row', gap: space.md, marginBottom: space.lg, flexWrap: 'wrap' },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
  box: { borderRadius: radius.lg, padding: space.md, marginTop: space.md, gap: space.md },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  modes: { flexDirection: 'row', gap: space.sm },
  mode: { flex: 1, borderWidth: 1.5, borderRadius: radius.lg, padding: space.md },
  modeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
