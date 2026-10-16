/**
 * Cat detail: live position, "this phone is the tracker" control, route replay
 * (Traccar ReplayPage: step every 500 ms), home zones and recent alerts.
 */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { REPORT_INTERVALS, useApp } from '../../src/AppProvider';
import type { CatEvent, HomeZone, TrackPoint } from '../../src/backend/types';
import { CatMap } from '../../src/components/CatMap';
import { TrackerBanner } from '../../src/components/TrackerBanner';
import { Button, Card, Pill, SectionTitle, Segmented } from '../../src/components/ui';
import { distanceM, formatDistance, isLive, relativeTime } from '../../src/geo';
import { space, useTheme } from '../../src/theme';

const RANGES = [
  { value: 1, label: '1 h' },
  { value: 24, label: '24 h' },
  { value: 168, label: '7 days' },
] as const;

const ZONE_SIZES = [
  { value: 50, label: '50 m' },
  { value: 100, label: '100 m' },
  { value: 250, label: '250 m' },
] as const;

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'OK', style: 'destructive', onPress: onYes },
  ]);
}

export default function CatScreen() {
  const t = useTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { backend, cats, trackedCatId, setTrackedCatId, tracker, intervalS, setIntervalS, removeCatLocal, alert } = useApp();
  const cat = cats.find((c) => c.id === id);

  const [rangeH, setRangeH] = useState<number>(24);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [zones, setZones] = useState<HomeZone[]>([]);
  const [events, setEvents] = useState<CatEvent[]>([]);
  const [zoneSize, setZoneSize] = useState<number>(100);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!backend || !id) return;
    try {
      const since = new Date(Date.now() - rangeH * 3600_000).toISOString();
      const [tr, zs, evs] = await Promise.all([backend.getTrack(id, since), backend.getZones(id), backend.getEvents(id)]);
      setTrack(tr);
      setZones(zs);
      setEvents(evs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [backend, id, rangeH]);

  // Reload on open, on range change, on every new fix and on new alerts -
  // but not while replaying, so the timeline doesn't shift under the cursor.
  useEffect(() => {
    if (replayIndex === null) void load();
  }, [load, cat?.lastFixAt, alert?.id, replayIndex]);

  // Replay: advance one point every 500 ms (same cadence as Traccar).
  useEffect(() => {
    if (playing && track.length > 1) {
      timer.current = setInterval(() => setReplayIndex((i) => Math.min((i ?? 0) + 1, track.length - 1)), 500);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, track.length]);

  useEffect(() => {
    if (replayIndex !== null && replayIndex >= track.length - 1) setPlaying(false);
  }, [replayIndex, track.length]);

  const walked = useMemo(
    () => track.reduce((sum, p, i) => (i === 0 ? 0 : sum + distanceM(track[i - 1]!.lat, track[i - 1]!.lng, p.lat, p.lng)), 0),
    [track],
  );

  if (!backend) return null;
  if (!cat) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.textMuted }}>This cat is no longer in your list.</Text>
        <Button title="Back to all cats" variant="ghost" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const isTracked = trackedCatId === cat.id;
  const live = isLive(cat.lastFixAt, isTracked ? 5 * 60 : 20 * 60);
  const cursor = replayIndex !== null ? track[replayIndex] ?? null : null;
  const shownTrack = replayIndex !== null ? track.slice(0, replayIndex + 1) : track;

  const toggleTracking = () => {
    if (isTracked) setTrackedCatId(null);
    else setTrackedCatId(cat.id);
  };

  const addZone = async () => {
    if (cat.lastLat === null || cat.lastLng === null) return;
    try {
      await backend.addZone(cat.id, 'Home', cat.lastLat, cat.lastLng, zoneSize);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: cat.name }} />
      <CatMap
        cats={cursor ? [] : cats}
        focusId={cat.id}
        track={shownTrack}
        trackColor={cat.color}
        cursor={cursor}
        zones={zones}
        style={{ height: Math.round(height * 0.42) }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <TrackerBanner />

        <Card style={styles.statusCard}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <Pill label={live ? '● Live' : 'Offline'} tone={live ? 'live' : 'neutral'} />
              <Pill label={cat.kind === 'phone' ? '📱 Phone tracker' : '📡 GPS collar'} />
            </View>
            <Text style={[styles.big, { color: t.text }]}>
              {cat.lastFixAt ? relativeTime(cat.lastFixAt) : 'No location yet'}
            </Text>
            <Text style={{ color: t.textMuted }}>
              {[
                cat.lastAccuracyM !== null ? `accuracy ± ${Math.round(cat.lastAccuracyM)} m` : null,
                cat.lastBatteryPct ? `battery ${cat.lastBatteryPct}%` : null,
              ]
                .filter(Boolean)
                .join(' · ') || ' '}
            </Text>
          </View>
        </Card>

        {cat.kind === 'phone' && (
          <Card style={{ gap: space.md }}>
            <SectionTitle>Phone as tracker</SectionTitle>
            <Text style={{ color: t.textMuted, lineHeight: 20 }}>
              {isTracked
                ? `This phone is sending its GPS as ${cat.name}. Keep the app open: Expo Go only tracks in the foreground.`
                : trackedCatId
                  ? `This phone is tracking another cat. Switch to ${cat.name}?`
                  : `Use this phone's GPS as ${cat.name}'s collar.`}
            </Text>
            <Segmented
              options={REPORT_INTERVALS.map((r) => ({ value: r.seconds, label: r.label }))}
              value={intervalS}
              onChange={setIntervalS}
            />
            <Button
              title={isTracked ? 'Stop tracking' : `Track ${cat.name} with this phone`}
              variant={isTracked ? 'secondary' : 'primary'}
              icon={isTracked ? '■' : '▶'}
              onPress={toggleTracking}
            />
            {isTracked && tracker.lastResult === 'rate_limited' && (
              <Text style={{ color: t.textMuted, fontSize: 12 }}>Server rate limit: at most one fix per 5 s.</Text>
            )}
          </Card>
        )}

        <Card style={{ gap: space.md }}>
          <SectionTitle>Route</SectionTitle>
          <Segmented options={RANGES} value={rangeH as 1 | 24 | 168} onChange={(v) => { setReplayIndex(null); setPlaying(false); setRangeH(v); }} />
          <Text style={{ color: t.text }}>
            <Text style={{ fontWeight: '800' }}>{track.length}</Text> positions · walked{' '}
            <Text style={{ fontWeight: '800' }}>{formatDistance(walked)}</Text>
          </Text>
          {track.length > 1 && (
            <>
              <View style={[styles.progress, { backgroundColor: t.surfaceAlt }]}>
                <View
                  style={{
                    width: `${((replayIndex ?? track.length - 1) / (track.length - 1)) * 100}%`,
                    height: '100%', backgroundColor: cat.color, borderRadius: 4,
                  }}
                />
              </View>
              <Text style={{ color: t.textMuted }}>
                {cursor ? new Date(cursor.at).toLocaleString() : 'Showing the full route'}
              </Text>
              <View style={styles.controls}>
                <Button title="⏮" variant="secondary" style={styles.ctrl} onPress={() => setReplayIndex((i) => Math.max(0, (i ?? 1) - 1))} />
                <Button
                  title={playing ? '⏸  Pause' : '▶  Replay'}
                  style={{ flex: 1 }}
                  onPress={() => {
                    if (!playing && (replayIndex === null || replayIndex >= track.length - 1)) setReplayIndex(0);
                    setPlaying((p) => !p);
                  }}
                />
                <Button title="⏭" variant="secondary" style={styles.ctrl} onPress={() => setReplayIndex((i) => Math.min(track.length - 1, (i ?? -1) + 1))} />
                {replayIndex !== null && (
                  <Button title="✕" variant="ghost" style={styles.ctrl} onPress={() => { setPlaying(false); setReplayIndex(null); }} />
                )}
              </View>
            </>
          )}
        </Card>

        <Card style={{ gap: space.md }}>
          <SectionTitle>Home zone</SectionTitle>
          {zones.map((z) => (
            <View key={z.id} style={styles.zoneRow}>
              <Text style={{ color: t.text, flex: 1 }}>
                🏠 {z.name} · {formatDistance(z.radiusM)} radius
                {cat.lastLat !== null && cat.lastLng !== null
                  ? ` · ${distanceM(z.lat, z.lng, cat.lastLat, cat.lastLng) <= z.radiusM ? 'inside' : 'outside'}`
                  : ''}
              </Text>
              <Button title="Remove" variant="ghost" onPress={() => void backend.removeZone(z.id).then(load)} />
            </View>
          ))}
          <Text style={{ color: t.textMuted, lineHeight: 20 }}>
            Get an alert when {cat.name} leaves or comes back. The zone is centred on the current position.
          </Text>
          <Segmented options={ZONE_SIZES} value={zoneSize as 50 | 100 | 250} onChange={setZoneSize} />
          <Button
            title={`Set home zone here (${zoneSize} m)`}
            variant="secondary"
            disabled={cat.lastLat === null}
            onPress={() => void addZone()}
          />
        </Card>

        <Card style={{ gap: space.sm }}>
          <SectionTitle>Alerts</SectionTitle>
          {events.length === 0 ? (
            <Text style={{ color: t.textMuted }}>No zone alerts yet.</Text>
          ) : (
            events.slice(0, 10).map((e) => (
              <Text key={e.id} style={{ color: t.text }}>
                {e.transition === 'exit' ? '🚪 Left' : '🏠 Back in'} {e.zoneName} · {relativeTime(e.at)}
              </Text>
            ))
          )}
        </Card>

        {error && <Text style={{ color: t.danger }}>{error}</Text>}

        <Button
          title={`Remove ${cat.name}`}
          variant="danger"
          onPress={() =>
            confirm(`Remove ${cat.name}?`, 'Location history for this cat will be deleted.', () => {
              void backend.removeCat(cat.id).then(() => {
                if (isTracked) setTrackedCatId(null);
                removeCatLocal(cat.id);
                router.replace('/');
              });
            })
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  scroll: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2, maxWidth: 640, width: '100%', alignSelf: 'center' },
  statusCard: { flexDirection: 'row', alignItems: 'center' },
  big: { fontSize: 24, fontWeight: '900', marginTop: space.sm },
  progress: { height: 8, borderRadius: 4, overflow: 'hidden' },
  controls: { flexDirection: 'row', gap: space.sm },
  ctrl: { minWidth: 52, paddingHorizontal: space.md },
  zoneRow: { flexDirection: 'row', alignItems: 'center' },
});
