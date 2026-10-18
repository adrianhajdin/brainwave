/**
 * Round photo cropper: drag to move, pinch (or − / +) to zoom. The circle is
 * exactly what the cat's avatar shows, and live previews show it with ears at
 * profile size and at map size.
 */
import { useMemo, useRef, useState } from 'react';
import {
  Image, Modal, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions,
  type GestureResponderEvent, type PanResponderGestureState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatAvatar, IconButton } from '../components/ui';
import { messageOf } from '../dialogs';
import { fonts, radius, space } from '../theme';
import { cropGeometry } from './geometry';
import { cropAvatar, type PickedImage } from './photo';

const MAX_ZOOM = 5;

interface Props {
  image: PickedImage | null;
  name: string;
  color: string;
  onCancel: () => void;
  /** Receives the cropped file; may upload it before the cropper closes. */
  onDone: (uri: string) => Promise<void> | void;
}

export function PhotoCropper(props: Props) {
  return (
    <Modal visible={props.image !== null} animationType="slide" onRequestClose={props.onCancel} statusBarTranslucent>
      {props.image && <Cropper key={props.image.uri} {...props} image={props.image} />}
    </Modal>
  );
}

function Cropper({ image, name, color, onCancel, onDone }: Props & { image: PickedImage }) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const area = Math.min(screenW, screenH * 0.55, 520);
  const circle = area - 56;
  const geo = useMemo(() => cropGeometry(image, circle), [image, circle]);

  const [view, setView] = useState({ zoom: 1, tx: 0, ty: 0 });
  const current = useRef(view);
  current.current = view;
  const base = useRef({ zoom: 1, tx: 0, ty: 0, dx: 0, dy: 0, dist: 0, touches: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (zoom: number, tx: number, ty: number) => setView(geo.clamp(Math.min(MAX_ZOOM, Math.max(1, zoom)), tx, ty));

  // Zoom around the circle's centre: the offset scales with the zoom.
  const zoomTo = (zoom: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom));
    const v = current.current;
    apply(z, (v.tx * z) / v.zoom, (v.ty * z) / v.zoom);
  };

  const responder = useMemo(() => {
    const spread = (e: GestureResponderEvent) => {
      const [a, b] = e.nativeEvent.touches;
      return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
    };
    const rebase = (e: GestureResponderEvent, g: PanResponderGestureState) => {
      base.current = { ...current.current, dx: g.dx, dy: g.dy, dist: spread(e), touches: e.nativeEvent.touches.length };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: rebase,
      onPanResponderMove: (e, g) => {
        // A finger added or lifted: continue from where the picture is now.
        if (e.nativeEvent.touches.length !== base.current.touches) rebase(e, g);
        const b = base.current;
        const d = spread(e);
        const zoom = b.dist > 0 && d > 0 ? Math.min(MAX_ZOOM, Math.max(1, (b.zoom * d) / b.dist)) : b.zoom;
        const k = zoom / b.zoom;
        apply(zoom, b.tx * k + (g.dx - b.dx), b.ty * k + (g.dy - b.dy));
      },
    });
    // geo changes only with the image or screen size
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  const shown = geo.size(view.zoom);
  // Draws the picture as the crop circle would show it, scaled to `px`.
  const picture = (px: number, inner: number) => {
    const q = inner / circle;
    return (
      <Image
        source={{ uri: image.uri }}
        style={{
          position: 'absolute', width: shown.w * q, height: shown.h * q,
          left: inner / 2 + view.tx * q - (shown.w * q) / 2, top: inner / 2 + view.ty * q - (shown.h * q) / 2,
        }}
        accessibilityIgnoresInvertColors
      />
    );
  };

  const done = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDone(await cropAvatar(image, geo.rect(view.zoom, view.tx, view.ty)));
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  };

  const edge = (area - circle) / 2;
  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={12} disabled={busy}>
          <Text style={styles.headerBtn}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Move and scale</Text>
        <Pressable accessibilityRole="button" onPress={() => void done()} hitSlop={12} disabled={busy}>
          <Text style={[styles.headerBtn, { color: '#7AA2FF', opacity: busy ? 0.5 : 1 }]}>{busy ? 'Saving…' : 'Use photo'}</Text>
        </Pressable>
      </View>

      <View
        style={{ width: area, height: area, alignSelf: 'center', overflow: 'hidden' }}
        accessibilityLabel="Photo. Drag to move, pinch to zoom."
        {...responder.panHandlers}
      >
        <Image
          source={{ uri: image.uri }}
          style={{
            position: 'absolute', width: shown.w, height: shown.h,
            left: area / 2 + view.tx - shown.w / 2, top: area / 2 + view.ty - shown.h / 2,
          }}
          accessibilityIgnoresInvertColors
        />
        {/* Dim everything outside the circle: a huge border around a round hole. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', left: edge - area, top: edge - area, width: circle + area * 2, height: circle + area * 2,
            borderRadius: circle / 2 + area, borderWidth: area, borderColor: 'rgba(0,0,0,0.62)',
          }}
        />
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: edge, top: edge, width: circle, height: circle, borderRadius: circle / 2, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' }}
        />
      </View>

      <View style={styles.zoomRow}>
        <IconButton icon="remove" label="Zoom out" onPress={() => zoomTo(view.zoom / 1.25)} disabled={view.zoom <= 1} />
        <Text style={styles.hint}>Drag to move · pinch to zoom</Text>
        <IconButton icon="add" label="Zoom in" onPress={() => zoomTo(view.zoom * 1.25)} disabled={view.zoom >= MAX_ZOOM} />
      </View>

      <View style={styles.previews}>
        <View style={styles.preview}>
          <CatAvatar name={name} color={color} size={88} photo={picture(88, 84)} />
          <Text style={styles.previewLabel}>Profile</Text>
        </View>
        <View style={styles.preview}>
          <View style={styles.mapChip}>
            <CatAvatar name={name} color={color} size={36} ring="#ffffff" photo={picture(36, 30)} />
          </View>
          <Text style={styles.previewLabel}>On the map</Text>
        </View>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0D12', gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, minHeight: 44 },
  headerBtn: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.bodySemibold },
  title: { color: '#FFFFFF', fontSize: 17, fontFamily: fonts.display },
  zoomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  previews: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: space.xl },
  preview: { alignItems: 'center', gap: space.xs },
  previewLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  mapChip: { width: 88, height: 88, borderRadius: radius.md, backgroundColor: '#DDE5D8', alignItems: 'center', justifyContent: 'center' },
  error: { color: '#FF8A80', textAlign: 'center', paddingHorizontal: space.lg },
});
