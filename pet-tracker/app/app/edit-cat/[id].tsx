/** Edit a cat: name, map colour and profile photo (resized to 512 px JPEG). */
import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useApp } from '../../src/AppProvider';
import { CAT_COLORS } from '../../src/backend/types';
import { Button, CatAvatar, SectionTitle } from '../../src/components/ui';
import { usePhotoUrl } from '../../src/components/usePhotoUrl';
import { radius, space, useTheme } from '../../src/theme';

async function resizeForUpload(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 512 });
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return result.uri;
}

export default function EditCat() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { backend, cats } = useApp();
  const cat = cats.find((c) => c.id === id);
  const photoUrl = usePhotoUrl(cat?.photoPath);

  const [name, setName] = useState(cat?.name ?? '');
  const [color, setColor] = useState(cat?.color ?? CAT_COLORS[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!backend || !cat) return null;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

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

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }];

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.preview}>
        <CatAvatar name={name || cat.name} color={color} size={96} photoUrl={photoUrl} />
      </View>
      <View style={styles.row}>
        <Button style={{ flex: 1 }} variant="secondary" title="Choose photo" icon="🖼️" busy={busy === 'photo'} onPress={() => void pick('library')} />
        <Button style={{ flex: 1 }} variant="secondary" title="Take photo" icon="📷" onPress={() => void pick('camera')} />
      </View>
      {cat.photoPath && <Button title="Remove photo" variant="ghost" onPress={() => void run('photo', () => backend.removePhoto(cat.id))} />}

      <SectionTitle>Name</SectionTitle>
      <TextInput style={input} value={name} onChangeText={setName} maxLength={64} />

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

      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <Button
        title="Save"
        busy={busy === 'save'}
        disabled={!name.trim()}
        onPress={() => void run('save', async () => {
          await backend.updateCat(cat.id, { name, color });
          router.back();
        })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.xl, gap: space.sm, maxWidth: 560, width: '100%', alignSelf: 'center' },
  preview: { alignItems: 'center', marginBottom: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16, marginBottom: space.md },
  swatches: { flexDirection: 'row', gap: space.md, marginBottom: space.lg, flexWrap: 'wrap' },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
});
