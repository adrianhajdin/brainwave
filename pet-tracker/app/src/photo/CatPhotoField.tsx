/** Cat photo with "Choose photo" / "Take photo", cropped round by PhotoCropper. */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, CatAvatar, ErrorText } from '../components/ui';
import { messageOf } from '../dialogs';
import { useTheme } from '../theme';
import { PhotoCropper } from './PhotoCropper';
import { pickPhoto, type PickedImage } from './photo';

interface Props {
  name: string;
  color: string;
  photoUrl: string | null;
  /** Gets the cropped photo; the cropper stays open (showing "Saving…") until this finishes. */
  onPhoto: (uri: string) => Promise<void> | void;
  onRemove?: () => void;
}

export function CatPhotoField({ name, color, photoUrl, onPhoto, onRemove }: Props) {
  const t = useTheme();
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState<'library' | 'camera' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (source: 'library' | 'camera') => {
    setBusy(source);
    setError(null);
    try {
      const image = await pickPhoto(source);
      if (image) setPicked(image);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <View style={styles.avatarWrap}>
        <CatAvatar name={name || '?'} color={color} size={96} photoUrl={photoUrl} />
        <View style={[styles.cameraBadge, { backgroundColor: t.primary, borderColor: t.surface }]}>
          <Ionicons name="camera" size={16} color={t.primaryText} />
        </View>
      </View>
      <View style={styles.row}>
        <Button style={{ flex: 1 }} variant="secondary" title="Choose photo" icon="image-outline" busy={busy === 'library'} onPress={() => void pick('library')} />
        <Button style={{ flex: 1 }} variant="secondary" title="Take photo" icon="camera-outline" busy={busy === 'camera'} onPress={() => void pick('camera')} />
      </View>
      {photoUrl && onRemove && <Button title="Remove photo" variant="ghost" onPress={onRemove} />}
      <ErrorText>{error}</ErrorText>
      <PhotoCropper
        image={picked}
        name={name || '?'}
        color={color}
        onCancel={() => setPicked(null)}
        onDone={async (uri) => {
          await onPhoto(uri);
          setPicked(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { width: 96, height: 108 },
  cameraBadge: {
    position: 'absolute', right: -4, bottom: -2, width: 36, height: 36, borderRadius: 18,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
});
