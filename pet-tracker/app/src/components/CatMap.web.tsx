/**
 * Web preview: react-native-maps has no web implementation, so the browser
 * build shows a dependency-free "radar" (equirectangular projection) with the
 * same layers as the phone map: zones, heatmap glow, dotted route, accuracy
 * halos and cats. Phones get real maps.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { Cat } from '../backend/types';
import { distanceM, formatDistance, resamplePath, smoothTrack } from '../geo';
import { useTheme } from '../theme';
import type { CatMapProps } from './CatMap.types';
import { heatBlobs } from './heat';
import { CatAvatar } from './ui';
import { catBadge, usePhotoUrl } from './usePhotoUrl';

function RadarCat({ cat, x, y, onPress }: { cat: Cat; x: number; y: number; onPress?: () => void }) {
  const t = useTheme();
  const photoUrl = usePhotoUrl(cat.photoPath);
  return (
    <Pressable accessibilityLabel={cat.name} onPress={onPress} style={{ position: 'absolute', left: x - 18, top: y - 28 }}>
      <CatAvatar name={cat.name} color={cat.color} size={36} ring={cat.lostMode ? t.danger : '#fff'} photoUrl={photoUrl} badge={catBadge(cat, t)} />
    </Pressable>
  );
}

export function CatMap({
  cats, focusId, track, trackColor, cursor, zones, heat, onSelectCat, onLongPress, draftZone, coverBottom = 0, style,
}: CatMapProps) {
  const t = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const placed = cats.filter((c) => c.lastLat !== null && c.lastLng !== null);
  const focus = focusId ? placed.find((c) => c.id === focusId) : undefined;
  const smooth = useMemo(() => (track && track.length > 1 ? smoothTrack(track) : []), [track]);
  const blobs = useMemo(() => heatBlobs(heat ?? []), [heat]);

  const view = useMemo(() => {
    const data = [...smooth, ...(heat ?? []).slice(0, 60)];
    const pts = [...(focus ? [focus] : placed).map((c) => ({ lat: c.lastLat!, lng: c.lastLng! })), ...data];
    // Live view of one cat: keep it close, with only the zones around it.
    const framed = focus && data.length === 0
      ? (zones ?? []).filter((z) => distanceM(z.lat, z.lng, focus.lastLat!, focus.lastLng!) < 400)
      : zones ?? [];
    for (const z of [...framed, ...(draftZone ? [{ ...draftZone }] : [])]) {
      const dLat = z.radiusM / 111_320;
      pts.push({ lat: z.lat + dLat, lng: z.lng }, { lat: z.lat - dLat, lng: z.lng });
    }
    if (pts.length === 0) return null;
    const lat0 = (Math.min(...pts.map((p) => p.lat)) + Math.max(...pts.map((p) => p.lat))) / 2;
    const lng0 = (Math.min(...pts.map((p) => p.lng)) + Math.max(...pts.map((p) => p.lng))) / 2;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const spanM = Math.max(
      150,
      ...pts.map((p) => Math.max(Math.abs(p.lat - lat0) * 111_320, Math.abs(p.lng - lng0) * 111_320 * k) * 2.3),
    );
    return { lat0, lng0, k, spanM };
  }, [focus, placed, smooth, heat, zones, draftZone]);

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const visibleH = Math.max(size.h * 0.3, size.h - coverBottom); // keep the framed area above a covering sheet
  const scale = view && size.w ? Math.min(size.w, visibleH) / view.spanM : 0; // px per metre
  const project = (lat: number, lng: number) => ({
    x: size.w / 2 + (lng - view!.lng0) * 111_320 * view!.k * scale,
    y: visibleH / 2 - (lat - view!.lat0) * 111_320 * scale,
  });
  const unproject = (x: number, y: number) => ({
    lat: view!.lat0 + (visibleH / 2 - y) / scale / 111_320,
    lng: view!.lng0 + (x - size.w / 2) / scale / 111_320 / view!.k,
  });

  const ringStepM = view ? niceStep(view.spanM / 4) : 100;
  const routeColor = trackColor ?? focus?.color ?? t.accent;

  const circle = (key: string, lat: number, lng: number, radiusM: number, extra: object) => {
    const c = project(lat, lng);
    const r = radiusM * scale;
    return <View key={key} pointerEvents="none" style={[{ position: 'absolute', left: c.x - r, top: c.y - r, width: r * 2, height: r * 2, borderRadius: r }, extra]} />;
  };

  return (
    <View style={[styles.wrap, { backgroundColor: t.surfaceAlt }, style]} onLayout={onLayout}>
      {view && scale > 0 && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onLongPress={onLongPress ? (e) => {
            const p = unproject(e.nativeEvent.locationX, e.nativeEvent.locationY);
            onLongPress(p.lat, p.lng);
          } : undefined}
        >
          {[1, 2, 3].map((i) =>
            circle(`ring${i}`, view.lat0, view.lng0, ringStepM * i, { borderWidth: 1, borderStyle: 'dashed', borderColor: t.mapGrid }),
          )}
          <Text style={[styles.scale, { color: t.textMuted }]}>rings every {formatDistance(ringStepM)}</Text>

          {blobs.length > 0 && (
            // The browser can blur the rings into one smooth glow.
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { filter: 'blur(8px)' } as object]}>
              {blobs.map((b) => circle(`h${b.key}`, b.lat, b.lng, b.radiusM, { backgroundColor: b.fill }))}
            </View>
          )}

          {(zones ?? []).map((z) => (
            <View key={z.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
              {circle(`z${z.id}`, z.lat, z.lng, z.radiusM, {
                borderWidth: 2, borderColor: t.live, borderStyle: z.allCats ? 'dashed' : 'solid', backgroundColor: 'rgba(21,128,61,0.08)',
              })}
              {(() => {
                const c = project(z.lat + z.radiusM / 111_320, z.lng);
                return (
                  <Text style={[styles.zoneLabel, { left: c.x - 40, top: c.y - 9, color: t.live, backgroundColor: t.surface, borderColor: t.live }]}>
                    {z.name}
                  </Text>
                );
              })()}
            </View>
          ))}
          {draftZone &&
            circle('draft', draftZone.lat, draftZone.lng, draftZone.radiusM, {
              borderWidth: 2, borderStyle: 'dashed', borderColor: t.accent, backgroundColor: 'rgba(217,119,6,0.12)',
            })}

          {/* Route: hollow dots 15 px apart, fading in from the oldest */}
          {(() => {
            const dots = scale > 0 ? resamplePath(smooth, 15 / scale) : [];
            return dots.length > 1
              ? dots.map((p, i) => {
                  const c = project(p.lat, p.lng);
                  return (
                    <View
                      key={`dot${i}`}
                      pointerEvents="none"
                      style={{
                        position: 'absolute', left: c.x - 5, top: c.y - 5, width: 10, height: 10, borderRadius: 5,
                        borderWidth: 2.5, borderColor: routeColor, opacity: 0.35 + (0.65 * i) / (dots.length - 1),
                      }}
                    />
                  );
                })
              : null;
          })()}

          {placed.map((cat) => {
            const c = project(cat.lastLat!, cat.lastLng!);
            const r = Math.max(0, (cat.lastAccuracyM ?? 0) * scale);
            return (
              <View key={cat.id} style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {r > 6 && circle(`acc${cat.id}`, cat.lastLat!, cat.lastLng!, cat.lastAccuracyM!, { backgroundColor: `${cat.color}26` })}
                <RadarCat cat={cat} x={c.x} y={c.y} onPress={onSelectCat ? () => onSelectCat(cat.id) : undefined} />
              </View>
            );
          })}

          {cursor && (() => {
            const c = project(cursor.lat, cursor.lng);
            return <View pointerEvents="none" style={[styles.cursor, { left: c.x - 10, top: c.y - 10, borderColor: routeColor }]} />;
          })()}
        </Pressable>
      )}
      {!view && (
        <View style={styles.empty}>
          <Text style={{ color: t.textMuted }}>No positions yet</Text>
        </View>
      )}
      <Text style={[styles.badge, { color: t.textMuted, backgroundColor: t.surface }]}>Web preview · real map on the phone</Text>
    </View>
  );
}

function niceStep(m: number): number {
  const steps = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  return steps.find((s) => s >= m) ?? 10000;
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  cursor: { position: 'absolute', width: 20, height: 20, borderRadius: 10, borderWidth: 5, backgroundColor: '#fff' },
  scale: { position: 'absolute', bottom: 10, left: 12, fontSize: 11 },
  zoneLabel: {
    position: 'absolute', width: 80, textAlign: 'center', fontSize: 11, fontWeight: '700',
    borderWidth: 1, borderRadius: 8, overflow: 'hidden', paddingVertical: 1,
  },
  badge: { position: 'absolute', top: 10, right: 10, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
