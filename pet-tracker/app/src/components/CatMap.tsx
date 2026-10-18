/**
 * Native map (iOS: Apple Maps, Android: Google Maps) - works in Expo Go.
 * Web uses CatMap.web.tsx instead (react-native-maps has no web support).
 *
 * Layers: home zones, heatmap glow, smoothed route with a soft halo, accuracy
 * halos, cat markers (photo + lost/battery badge) and the replay cursor.
 */
import * as Location from 'expo-location';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline, type Region } from 'react-native-maps';

import type { Cat } from '../backend/types';
import { distanceM, regionFor, smoothTrack, type LatLng } from '../geo';
import { useTheme } from '../theme';
import type { CatMapProps } from './CatMap.types';
import { heatBlobs } from './heat';
import { CatAvatar } from './ui';
import { catBadge, usePhotoUrl } from './usePhotoUrl';

/** Before we know where any cat (or this phone) is: the whole of the Netherlands. */
const FALLBACK: Region = { latitude: 52.2, longitude: 5.3, latitudeDelta: 3.2, longitudeDelta: 3.2 };

/** In the live view of one cat, zones this close stay in the frame (the home around the garden). */
const NEARBY_ZONE_M = 400;

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

  // What the camera should show: one cat up close, or everything that is drawn.
  const frame = (): (LatLng & { radiusM?: number })[] => {
    const draft = draftZone ? [draftZone] : [];
    const data = [...smooth, ...(heat ?? []).slice(0, 60)];
    if (focus && data.length === 0) {
      const near = (zones ?? []).filter((z) => distanceM(z.lat, z.lng, focus.lastLat!, focus.lastLng!) < NEARBY_ZONE_M);
      return [{ lat: focus.lastLat!, lng: focus.lastLng! }, ...near, ...draft];
    }
    return [
      ...(focus ? [focus] : placed).map((c) => ({ lat: c.lastLat!, lng: c.lastLng! })),
      ...data,
      ...(zones ?? []),
      ...draft,
    ];
  };

  const [initialRegion] = useState<Region>(() => regionFor(frame()) ?? FALLBACK);
  const [ready, setReady] = useState(false);
  const shown = useRef<Region>(initialRegion);

  // Re-frame when the map is ready and when the set of positioned cats, the
  // focus, the layers or the draft zone change. Positions updating on their
  // own don't re-frame, so the map doesn't jump while someone pans it.
  const fitKey = [
    ready,
    focusId ?? '',
    placed.map((c) => c.id).join(','),
    track?.length ?? 0,
    zones?.length ?? 0,
    heat?.length ?? 0,
    draftZone ? `${draftZone.lat},${draftZone.lng},${draftZone.radiusM}` : '',
  ].join('|');

  useEffect(() => {
    if (!ready) return;
    const region = regionFor(frame());
    if (region) {
      ref.current?.animateToRegion(region, 450);
      return;
    }
    // Nothing to show yet: centre on this phone if location is already allowed.
    let cancelled = false;
    void (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = await Location.getLastKnownPositionAsync();
        if (pos && !cancelled) {
          ref.current?.animateToRegion(regionFor([{ lat: pos.coords.latitude, lng: pos.coords.longitude }], 0.02)!, 450);
        }
      } catch {
        // keep the fallback view
      }
    })();
    return () => {
      cancelled = true;
    };
    // fitKey captures everything that should trigger a re-frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // Follow the focused cat when it walks out of view.
  useEffect(() => {
    if (!ready || !focus || smooth.length > 0 || heat?.length) return;
    const r = shown.current;
    const outside =
      Math.abs(focus.lastLat! - r.latitude) > r.latitudeDelta * 0.4 || Math.abs(focus.lastLng! - r.longitude) > r.longitudeDelta * 0.4;
    if (outside) ref.current?.animateCamera({ center: { latitude: focus.lastLat!, longitude: focus.lastLng! } }, { duration: 450 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.lastLat, focus?.lastLng, ready]);

  const routeColor = trackColor ?? focus?.color ?? t.accent;

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onMapReady={() => setReady(true)}
        onRegionChangeComplete={(r) => {
          shown.current = r;
        }}
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
