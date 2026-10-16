/**
 * Native map (iOS: Apple Maps, Android: Google Maps) - works in Expo Go.
 * Web uses CatMap.web.tsx instead (react-native-maps has no web support).
 *
 * Layers: home zones, heatmap glow, smoothed route with a soft halo, accuracy
 * halos, cat markers (photo + lost/battery badge) and the replay cursor.
 */
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';

import type { Cat } from '../backend/types';
import { smoothTrack } from '../geo';
import { useTheme } from '../theme';
import type { CatMapProps } from './CatMap.types';
import { heatBlobs } from './heat';
import { CatAvatar } from './ui';
import { catBadge, usePhotoUrl } from './usePhotoUrl';

const AMSTERDAM = { latitude: 52.3676, longitude: 4.9041, latitudeDelta: 0.05, longitudeDelta: 0.05 };

// Google Maps night style (Android); iOS follows userInterfaceStyle.
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1f1b18' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a99e93' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#14110f' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2a2420' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1d2b1f' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3a322c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8c8178' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1a24' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

function CatMarker({ cat, onPress }: { cat: Cat; onPress?: () => void }) {
  const t = useTheme();
  const photoUrl = usePhotoUrl(cat.photoPath);
  return (
    <Marker
      coordinate={{ latitude: cat.lastLat!, longitude: cat.lastLng! }}
      anchor={{ x: 0.5, y: 0.6 }}
      onPress={onPress}
      title={cat.name}
    >
      <CatAvatar
        name={cat.name}
        color={cat.color}
        size={36}
        ring={cat.lostMode ? t.danger : '#ffffff'}
        photoUrl={photoUrl}
        badge={catBadge(cat, t)}
      />
    </Marker>
  );
}

export function CatMap({
  cats, focusId, track, trackColor, cursor, zones, heat, onSelectCat, onLongPress, draftZone, style,
}: CatMapProps) {
  const t = useTheme();
  const ref = useRef<MapView>(null);
  const placed = cats.filter((c) => c.lastLat !== null && c.lastLng !== null);
  const focus = focusId ? placed.find((c) => c.id === focusId) : undefined;

  const smooth = useMemo(() => (track && track.length > 1 ? smoothTrack(track) : []), [track]);
  const blobs = useMemo(() => heatBlobs(heat ?? []), [heat]);

  // Re-fit when the set of positioned cats, the focus or the layers change.
  const fitKey = [focusId ?? '', placed.map((c) => c.id).join(','), track?.length ?? 0, zones?.length ?? 0, heat?.length ?? 0].join('|');

  useEffect(() => {
    const coords = [
      ...(focus ? [focus] : placed).map((c) => ({ latitude: c.lastLat!, longitude: c.lastLng! })),
      ...smooth.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      ...(heat ?? []).slice(0, 60).map((c) => ({ latitude: c.lat, longitude: c.lng })),
      ...(zones ?? []).map((z) => ({ latitude: z.lat, longitude: z.lng })),
    ];
    if (coords.length === 0) return;
    if (coords.length === 1) {
      ref.current?.animateToRegion({ ...coords[0]!, latitudeDelta: 0.006, longitudeDelta: 0.006 }, 400);
    } else {
      ref.current?.fitToCoordinates(coords, { edgePadding: { top: 80, right: 60, bottom: 80, left: 60 }, animated: true });
    }
    // fitKey captures everything that should trigger a re-fit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  const routeColor = trackColor ?? focus?.color ?? t.accent;

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={AMSTERDAM}
        showsCompass={false}
        toolbarEnabled={false}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle={t.isDark ? 'dark' : 'light'}
        customMapStyle={t.isDark ? DARK_STYLE : []}
        onLongPress={onLongPress ? (e) => onLongPress(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude) : undefined}
      >
        {blobs.map((b) => (
          <Circle key={`h${b.key}`} center={{ latitude: b.lat, longitude: b.lng }} radius={b.radiusM} strokeColor="transparent" fillColor={b.fill} />
        ))}

        {(zones ?? []).map((z) => (
          <Fragment key={z.id}>
            <Circle
              center={{ latitude: z.lat, longitude: z.lng }}
              radius={z.radiusM}
              strokeColor={t.live}
              strokeWidth={2}
              lineDashPattern={z.allCats ? [6, 6] : undefined}
              fillColor="rgba(21, 128, 61, 0.08)"
            />
            {/* label on the zone's northern edge, clear of the cat markers */}
            <Marker coordinate={{ latitude: z.lat + z.radiusM / 111_320, longitude: z.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={[styles.zoneLabel, { backgroundColor: t.surface, borderColor: t.live }]}>
                <Text style={{ color: t.live, fontWeight: '700', fontSize: 11 }}>{z.name}</Text>
              </View>
            </Marker>
          </Fragment>
        ))}

        {draftZone && (
          <Circle
            center={{ latitude: draftZone.lat, longitude: draftZone.lng }}
            radius={draftZone.radiusM}
            strokeColor={t.accent}
            strokeWidth={2}
            lineDashPattern={[8, 6]}
            fillColor="rgba(217, 119, 6, 0.12)"
          />
        )}

        {smooth.length > 1 && (
          <>
            <Polyline coordinates={smooth.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={`${routeColor}40`} strokeWidth={10} lineCap="round" lineJoin="round" />
            <Polyline coordinates={smooth.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={routeColor} strokeWidth={4} lineCap="round" lineJoin="round" />
            <Marker coordinate={{ latitude: smooth[0]!.lat, longitude: smooth[0]!.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={[styles.startDot, { borderColor: routeColor }]} />
            </Marker>
          </>
        )}

        {placed.map((c) => (
          <Fragment key={c.id}>
            {c.lastAccuracyM !== null && c.lastAccuracyM > 5 && (
              <Circle center={{ latitude: c.lastLat!, longitude: c.lastLng! }} radius={c.lastAccuracyM} strokeColor="transparent" fillColor={`${c.color}33`} />
            )}
            <CatMarker cat={c} onPress={onSelectCat ? () => onSelectCat(c.id) : undefined} />
          </Fragment>
        ))}

        {cursor && (
          <Marker coordinate={{ latitude: cursor.lat, longitude: cursor.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.cursor, { borderColor: routeColor }]} />
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  cursor: { width: 20, height: 20, borderRadius: 10, borderWidth: 5, backgroundColor: '#fff' },
  startDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, backgroundColor: '#fff' },
  zoneLabel: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
});
