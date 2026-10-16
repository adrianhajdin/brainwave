/**
 * Web preview: react-native-maps has no web implementation, so the browser
 * build shows a dependency-free "radar" (equirectangular projection) with the
 * same layers: zones, accuracy halos, route and cats. Phones get real maps.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { distanceM, formatDistance } from '../geo';
import { useTheme } from '../theme';
import type { CatMapProps } from './CatMap.types';
import { CatAvatar } from './ui';

export function CatMap({ cats, focusId, track, trackColor, cursor, zones, onSelectCat, style }: CatMapProps) {
  const t = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const placed = cats.filter((c) => c.lastLat !== null && c.lastLng !== null);
  const focus = focusId ? placed.find((c) => c.id === focusId) : undefined;

  const view = useMemo(() => {
    const pts = [
      ...(focus ? [focus] : placed).map((c) => ({ lat: c.lastLat!, lng: c.lastLng! })),
      ...(track ?? []).map((p) => ({ lat: p.lat, lng: p.lng })),
    ];
    for (const z of zones ?? []) {
      const dLat = z.radiusM / 111_320;
      pts.push({ lat: z.lat + dLat, lng: z.lng }, { lat: z.lat - dLat, lng: z.lng });
    }
    if (pts.length === 0) return null;
    const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng0 = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const spanM = Math.max(
      150,
      ...pts.map((p) => Math.hypot((p.lat - lat0) * 111_320, (p.lng - lng0) * 111_320 * k) * 2.4),
    );
    return { lat0, lng0, k, spanM };
  }, [focus, placed, track, zones]);

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const scale = view && size.w ? Math.min(size.w, size.h) / view.spanM : 0; // px per metre
  const project = (lat: number, lng: number) => ({
    x: size.w / 2 + (lng - view!.lng0) * 111_320 * view!.k * scale,
    y: size.h / 2 - (lat - view!.lat0) * 111_320 * scale,
  });

  const ringStepM = view ? niceStep(view.spanM / 4) : 100;

  return (
    <View style={[styles.wrap, { backgroundColor: t.surfaceAlt }, style]} onLayout={onLayout}>
      {view && scale > 0 && (
        <>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.ring,
                {
                  borderColor: t.mapGrid,
                  width: ringStepM * i * 2 * scale,
                  height: ringStepM * i * 2 * scale,
                  borderRadius: ringStepM * i * scale,
                  left: size.w / 2 - ringStepM * i * scale,
                  top: size.h / 2 - ringStepM * i * scale,
                },
              ]}
            />
          ))}
          <Text style={[styles.scale, { color: t.textMuted }]}>rings every {formatDistance(ringStepM)}</Text>

          {(zones ?? []).map((z) => {
            const c = project(z.lat, z.lng);
            const r = z.radiusM * scale;
            return (
              <View
                key={z.id}
                style={[styles.zone, { borderColor: t.live, left: c.x - r, top: c.y - r, width: r * 2, height: r * 2, borderRadius: r }]}
              />
            );
          })}

          {(track ?? []).map((p, i) => {
            const c = project(p.lat, p.lng);
            return (
              <View
                key={`${p.at}-${i}`}
                style={[styles.trackDot, { left: c.x - 2.5, top: c.y - 2.5, backgroundColor: trackColor ?? focus?.color ?? t.accent }]}
              />
            );
          })}

          {placed.map((cat) => {
            const c = project(cat.lastLat!, cat.lastLng!);
            const r = Math.max(0, (cat.lastAccuracyM ?? 0) * scale);
            return (
              <View key={cat.id} style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {r > 6 && (
                  <View
                    style={[styles.halo, { backgroundColor: `${cat.color}26`, left: c.x - r, top: c.y - r, width: r * 2, height: r * 2, borderRadius: r }]}
                  />
                )}
                <Pressable
                  accessibilityLabel={cat.name}
                  onPress={() => onSelectCat?.(cat.id)}
                  style={{ position: 'absolute', left: c.x - 17, top: c.y - 26 }}
                >
                  <CatAvatar name={cat.name} color={cat.color} size={34} ring="#fff" />
                </Pressable>
              </View>
            );
          })}

          {cursor && (() => {
            const c = project(cursor.lat, cursor.lng);
            return <View style={[styles.cursor, { left: c.x - 9, top: c.y - 9, borderColor: trackColor ?? focus?.color ?? t.accent }]} />;
          })()}

          {focus && placed.length > 1 && !track?.length && (
            <Text style={[styles.scale, { top: 12, color: t.textMuted }]}>
              {placed
                .filter((c) => c.id !== focus.id)
                .map((c) => `${c.name} ${formatDistance(distanceM(focus.lastLat!, focus.lastLng!, c.lastLat!, c.lastLng!))}`)
                .join(' · ')}
            </Text>
          )}
        </>
      )}
      {!view && (
        <View style={styles.empty}>
          <Text style={{ color: t.textMuted }}>No positions yet</Text>
        </View>
      )}
      <Text style={[styles.badge, { color: t.textMuted, backgroundColor: t.surface }]}>Web preview · real map in Expo Go</Text>
    </View>
  );
}

function niceStep(m: number): number {
  const steps = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  return steps.find((s) => s >= m) ?? 10000;
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 1, borderStyle: 'dashed' },
  zone: { position: 'absolute', borderWidth: 2, backgroundColor: 'rgba(21,128,61,0.10)' },
  halo: { position: 'absolute' },
  trackDot: { position: 'absolute', width: 5, height: 5, borderRadius: 3, opacity: 0.8 },
  cursor: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 4, backgroundColor: '#fff' },
  scale: { position: 'absolute', bottom: 10, left: 12, fontSize: 11 },
  badge: { position: 'absolute', top: 10, right: 10, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
