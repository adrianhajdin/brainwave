/**
 * Native map (iOS: Apple Maps, Android: Google Maps) - works in Expo Go.
 * Web uses CatMap.web.tsx instead (react-native-maps has no web support).
 */
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';

import { useTheme } from '../theme';
import type { CatMapProps } from './CatMap.types';
import { CatAvatar } from './ui';

const AMSTERDAM = { latitude: 52.3676, longitude: 4.9041, latitudeDelta: 0.05, longitudeDelta: 0.05 };

export function CatMap({ cats, focusId, track, trackColor, cursor, zones, onSelectCat, style }: CatMapProps) {
  const t = useTheme();
  const ref = useRef<MapView>(null);
  const placed = cats.filter((c) => c.lastLat !== null && c.lastLng !== null);
  const focus = focusId ? placed.find((c) => c.id === focusId) : undefined;

  // Re-fit when the set of positioned cats, the focus or the track changes.
  const fitKey = useMemo(
    () => [focusId ?? '', placed.map((c) => c.id).join(','), track?.length ?? 0, zones?.length ?? 0].join('|'),
    [focusId, placed, track?.length, zones?.length],
  );

  useEffect(() => {
    const coords = [
      ...(focus ? [focus] : placed).map((c) => ({ latitude: c.lastLat!, longitude: c.lastLng! })),
      ...(track ?? []).map((p) => ({ latitude: p.lat, longitude: p.lng })),
      ...(zones ?? []).map((z) => ({ latitude: z.lat, longitude: z.lng })),
    ];
    if (coords.length === 0) return;
    if (coords.length === 1) {
      ref.current?.animateToRegion({ ...coords[0]!, latitudeDelta: 0.006, longitudeDelta: 0.006 }, 400);
    } else {
      ref.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
        animated: true,
      });
    }
    // fitKey captures everything that should trigger a re-fit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  const routeColor = trackColor ?? focus?.color ?? t.accent;

  return (
    <View style={[styles.wrap, style]}>
      <MapView ref={ref} style={StyleSheet.absoluteFill} initialRegion={AMSTERDAM} showsCompass={false} toolbarEnabled={false}>
        {(zones ?? []).map((z) => (
          <Circle
            key={z.id}
            center={{ latitude: z.lat, longitude: z.lng }}
            radius={z.radiusM}
            strokeColor={t.live}
            strokeWidth={2}
            fillColor="rgba(21, 128, 61, 0.10)"
          />
        ))}

        {track && track.length > 1 && (
          <Polyline
            coordinates={track.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={routeColor}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {placed.map((c) => (
          <Fragment key={c.id}>
            {c.lastAccuracyM !== null && c.lastAccuracyM > 5 && (
              <Circle
                center={{ latitude: c.lastLat!, longitude: c.lastLng! }}
                radius={c.lastAccuracyM}
                strokeColor="transparent"
                fillColor={`${c.color}33`}
              />
            )}
            <Marker
              coordinate={{ latitude: c.lastLat!, longitude: c.lastLng! }}
              anchor={{ x: 0.5, y: 0.6 }}
              onPress={() => onSelectCat?.(c.id)}
              title={c.name}
            >
              <CatAvatar name={c.name} color={c.color} size={34} ring="#ffffff" />
            </Marker>
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
  cursor: { width: 18, height: 18, borderRadius: 9, borderWidth: 4, backgroundColor: '#fff' },
});
