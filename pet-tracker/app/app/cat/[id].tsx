/**
 * Cat detail: live position, lost mode, phone-as-tracker, route replay
 * (Traccar ReplayPage: step every 500 ms), heatmap, activity estimate,
 * home zones, night watch and recent alerts.
 */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';

import { REPORT_INTERVALS, useApp } from '../../src/AppProvider';
import { isOwner, type ActivityDay, type CatEvent, type HeatCell, type HomeZone, type NightWatch, type TrackPoint } from '../../src/backend/types';
import { ActivityCard } from '../../src/components/ActivityCard';
import { CatMap } from '../../src/components/CatMap';
import type { MapLayer } from '../../src/components/CatMap.types';
import { HEAT_LEGEND } from '../../src/components/heat';
import { TrackerBanner } from '../../src/components/TrackerBanner';
import { Button, Card, Pill, SectionTitle, Segmented } from '../../src/components/ui';
import { distanceM, formatDistance, inNightWindow, isLive, relativeTime } from '../../src/geo';
import { radius, space, useTheme } from '../../src/theme';

const ROUTE_RANGES = [
  { value: 1, label: '1 h' },
  { value: 24, label: '24 h' },
  { value: 168, label: '7 days' },
] as const;

const HEAT_RANGES = [
  { value: 24, label: '24 h' },
  { value: 168, label: '7 days' },
  { value: 720, label: '30 days' },
] as const;

const NIGHT_INTERVALS = [
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
] as const;

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const fmtDuration = (s: number) => (s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);
const timezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam';
  } catch {
    return 'Europe/Amsterdam';
  }
};

function confirm(title: string, message: string, onYes: () => void, yes = 'OK') {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}

export default function CatScreen() {
  const t = useTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { backend, cats, trackedCatId, setTrackedCatId, tracker, intervalS, setIntervalS, effectiveIntervalS, removeCatLocal, alert } = useApp();
  const cat = cats.find((c) => c.id === id);

  const [layer, setLayer] = useState<MapLayer>('live');
  const [rangeH, setRangeH] = useState<number>(24);
  const [heatRangeH, setHeatRangeH] = useState<number>(168);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [heat, setHeat] = useState<HeatCell[]>([]);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [zones, setZones] = useState<HomeZone[]>([]);
  const [events, setEvents] = useState<CatEvent[]>([]);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!backend || !id) return;
    try {
      const since = new Date(Date.now() - rangeH * 3600_000).toISOString();
      const [tr, zs, evs, act] = await Promise.all([
        backend.getTrack(id, since),
        backend.getZones(id),
        backend.getEvents(id),
        backend.getActivity(id, 7),
      ]);
      setTrack(tr);
      setZones(zs);
      setEvents(evs);
      setActivity(act);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [backend, id, rangeH]);

  const loadHeat = useCallback(async () => {
    if (!backend || !id) return;
    try {
      setHeat(await backend.getHeatmap(id, new Date(Date.now() - heatRangeH * 3600_000).toISOString()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [backend, id, heatRangeH]);

  // Reload on open, range change, new fixes and alerts - not while replaying.
  useEffect(() => {
    if (replayIndex === null) void load();
  }, [load, cat?.lastFixAt, alert?.id, replayIndex]);

  useEffect(() => {
    if (layer === 'heatmap') void loadHeat();
  }, [layer, loadHeat]);

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

  const owner = isOwner(cat, backend);
  const isTracked = trackedCatId === cat.id;
  const live = isLive(cat.lastFixAt, isTracked || cat.lostMode ? 5 * 60 : 20 * 60);
  const lowBattery = cat.lastBatteryPct !== null && cat.lastBatteryPct > 0 && cat.lastBatteryPct < 20;
  const cursor = replayIndex !== null ? track[replayIndex] ?? null : null;
  const shownTrack = replayIndex !== null ? track.slice(0, replayIndex + 1) : track;
  const nightNow = cat.night.enabled && inNightWindow(new Date().getHours() * 60 + new Date().getMinutes(), cat.night.startMin, cat.night.endMin);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleLost = () => {
    if (cat.lostMode) {
      void act('lost', () => backend.setLostMode(cat.id, false));
    } else {
      confirm(
        `Is ${cat.name} lost?`,
        'Lost mode makes the tracker report as often as possible and alerts everyone in your household. It uses more battery.',
        () => void act('lost', () => backend.setLostMode(cat.id, true)),
        'Turn on lost mode',
      );
    }
  };

  const saveNight = (night: NightWatch) => void act('night', () => backend.setNightWatch(cat.id, night, timezone()));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          title: cat.name,
          headerRight: owner
            ? () => (
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/edit-cat/[id]', params: { id: cat.id } })} hitSlop={12}>
                  <Text style={{ color: t.accent, fontWeight: '700' }}>Edit</Text>
                </Pressable>
              )
            : undefined,
        }}
      />

      <View style={{ height: Math.round(height * 0.42) }}>
        <CatMap
          cats={cursor || layer === 'heatmap' ? [] : cats}
          focusId={cat.id}
          track={layer === 'route' ? shownTrack : undefined}
          trackColor={cat.color}
          cursor={layer === 'route' ? cursor : null}
          zones={zones}
          heat={layer === 'heatmap' ? heat : undefined}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.layerBar}>
          <Segmented<MapLayer>
            options={[
              { value: 'live', label: 'Live' },
              { value: 'route', label: 'Route' },
              { value: 'heatmap', label: 'Heatmap' },
            ]}
            value={layer}
            onChange={(v) => {
              setPlaying(false);
              setReplayIndex(null);
              setLayer(v);
            }}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TrackerBanner />

        {/* Lost mode: the big red button */}
        <Card style={[{ gap: space.sm }, cat.lostMode && { borderColor: t.danger, borderWidth: 2, backgroundColor: t.dangerSoft }]}>
          {cat.lostMode ? (
            <>
              <Text style={[styles.big, { color: t.danger }]}>🚨 Lost mode is on</Text>
              <Text style={{ color: t.text, lineHeight: 20 }}>
                Since {cat.lostModeSince ? relativeTime(cat.lostModeSince) : 'just now'}. {cat.kind === 'phone' ? 'The tracking phone reports every 15 s.' : 'The collar reports every minute and stays reachable for commands.'} Everyone in the household was notified.
              </Text>
              <Button title={`${cat.name} is found - turn off`} variant="secondary" busy={busy === 'lost'} onPress={toggleLost} />
            </>
          ) : (
            <Button title={`${cat.name} is missing - lost mode`} icon="🚨" variant="danger" busy={busy === 'lost'} onPress={toggleLost} />
          )}
        </Card>

        <Card style={styles.statusCard}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pill label={live ? '● Live' : 'Offline'} tone={live ? 'live' : 'neutral'} />
              <Pill label={cat.kind === 'phone' ? '📱 Phone tracker' : '📡 GPS collar'} />
              {!owner && <Pill label="shared with you" />}
              {nightNow && <Pill label="🌙 night watch" tone="night" />}
            </View>
            <Text style={[styles.big, { color: t.text }]}>{cat.lastFixAt ? relativeTime(cat.lastFixAt) : 'No location yet'}</Text>
            <Text style={{ color: lowBattery ? t.danger : t.textMuted }}>
              {[
                cat.lastAccuracyM !== null ? `accuracy ± ${Math.round(cat.lastAccuracyM)} m` : null,
                cat.lastBatteryPct ? `${lowBattery ? '🪫 low battery' : 'battery'} ${cat.lastBatteryPct}%` : null,
              ]
                .filter(Boolean)
                .join(' · ') || ' '}
            </Text>
          </View>
        </Card>

        {cat.kind === 'phone' && owner && (
          <Card style={{ gap: space.md }}>
            <SectionTitle>Phone as tracker</SectionTitle>
            <Text style={{ color: t.textMuted, lineHeight: 20 }}>
              {isTracked
                ? tracker.mode === 'background'
                  ? `This phone reports its GPS as ${cat.name}, also with the screen off. Reporting every ${effectiveIntervalS < 60 ? `${effectiveIntervalS} s` : `${Math.round(effectiveIntervalS / 60)} min`}.`
                  : `This phone reports its GPS as ${cat.name} while the app is open. For screen-off tracking use the installed app and allow location "all the time".`
                : trackedCatId
                  ? `This phone is tracking another cat. Switch to ${cat.name}?`
                  : `Use this phone's GPS as ${cat.name}'s collar.`}
            </Text>
            <Segmented options={REPORT_INTERVALS.map((r) => ({ value: r.seconds, label: r.label }))} value={intervalS} onChange={setIntervalS} />
            <Button
              title={isTracked ? 'Stop tracking' : `Track ${cat.name} with this phone`}
              variant={isTracked ? 'secondary' : 'primary'}
              icon={isTracked ? '■' : '▶'}
              onPress={() => setTrackedCatId(isTracked ? null : cat.id)}
            />
          </Card>
        )}

        {layer === 'route' && (
          <Card style={{ gap: space.md }}>
            <SectionTitle>Route</SectionTitle>
            <Segmented options={ROUTE_RANGES} value={rangeH as 1 | 24 | 168} onChange={(v) => { setReplayIndex(null); setPlaying(false); setRangeH(v); }} />
            <Text style={{ color: t.text }}>
              <Text style={{ fontWeight: '800' }}>{track.length}</Text> positions · walked <Text style={{ fontWeight: '800' }}>{formatDistance(walked)}</Text>
            </Text>
            {track.length > 1 && (
              <>
                <View style={[styles.progress, { backgroundColor: t.surfaceAlt }]}>
                  <View style={{ width: `${((replayIndex ?? track.length - 1) / (track.length - 1)) * 100}%`, height: '100%', backgroundColor: cat.color, borderRadius: 4 }} />
                </View>
                <Text style={{ color: t.textMuted }}>{cursor ? new Date(cursor.at).toLocaleString() : 'Smoothed route · tap Replay to follow it step by step'}</Text>
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
                  {replayIndex !== null && <Button title="✕" variant="ghost" style={styles.ctrl} onPress={() => { setPlaying(false); setReplayIndex(null); }} />}
                </View>
              </>
            )}
          </Card>
        )}

        {layer === 'heatmap' && (
          <Card style={{ gap: space.md }}>
            <SectionTitle>Favourite places</SectionTitle>
            <Segmented options={HEAT_RANGES} value={heatRangeH as 24 | 168 | 720} onChange={setHeatRangeH} />
            <View style={styles.legendRow}>
              <Text style={{ color: t.textMuted, fontSize: 12 }}>passing by</Text>
              <View style={styles.legendBar}>
                {HEAT_LEGEND.map((c) => (
                  <View key={c} style={{ flex: 1, backgroundColor: c }} />
                ))}
              </View>
              <Text style={{ color: t.textMuted, fontSize: 12 }}>hours spent</Text>
            </View>
            {heat.length === 0 ? (
              <Text style={{ color: t.textMuted }}>Not enough positions in this period yet.</Text>
            ) : (
              heat.slice(0, 3).map((c, i) => (
                <Text key={`${c.lat},${c.lng}`} style={{ color: t.text }}>
                  {['🥇', '🥈', '🥉'][i]} {fmtDuration(c.weightS)}
                  <Text style={{ color: t.textMuted }}>
                    {cat.lastLat !== null && cat.lastLng !== null ? `  ·  ${formatDistance(distanceM(c.lat, c.lng, cat.lastLat, cat.lastLng))} from current position` : ''}
                  </Text>
                </Text>
              ))
            )}
          </Card>
        )}

        <ActivityCard days={activity} color={cat.color} name={cat.name} kind={cat.kind} />

        <Card style={{ gap: space.md }}>
          <SectionTitle>Home zones</SectionTitle>
          {zones.length === 0 && <Text style={{ color: t.textMuted }}>No zones yet. Get an alert when {cat.name} leaves or comes back.</Text>}
          {zones.map((z) => {
            const inside = cat.lastLat !== null && cat.lastLng !== null ? distanceM(z.lat, z.lng, cat.lastLat, cat.lastLng) <= z.radiusM : null;
            return (
              <View key={z.id} style={styles.zoneRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '700' }}>🏠 {z.name}</Text>
                  <Text style={{ color: t.textMuted, fontSize: 13 }}>
                    {formatDistance(z.radiusM)} radius{z.allCats ? ' · all cats' : ''}
                    {inside !== null ? ` · ${inside ? 'inside' : 'outside'}` : ''}
                  </Text>
                </View>
                {owner && (
                  <Button title="Remove" variant="ghost" onPress={() => confirm(`Remove ${z.name}?`, 'Alerts for this zone stop.', () => void backend.removeZone(z.id).then(load), 'Remove')} />
                )}
              </View>
            );
          })}
          {owner && <Button title="Add a zone" icon="＋" variant="secondary" onPress={() => router.push({ pathname: '/zone/[catId]', params: { catId: cat.id } })} />}
        </Card>

        {owner && (
          <Card style={{ gap: space.md }}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <SectionTitle>🌙 Night watch</SectionTitle>
                <Text style={{ color: t.textMuted, lineHeight: 20 }}>
                  Cats roam at night. During these hours positions update more often while {cat.name} is on the move.
                </Text>
              </View>
              <Switch
                value={cat.night.enabled}
                onValueChange={(v) => saveNight({ ...cat.night, enabled: v })}
                trackColor={{ true: t.night }}
                disabled={busy === 'night'}
              />
            </View>
            {cat.night.enabled && (
              <>
                <TimeStepper label="From" minutes={cat.night.startMin} onChange={(m) => saveNight({ ...cat.night, startMin: m })} />
                <TimeStepper label="Until" minutes={cat.night.endMin} onChange={(m) => saveNight({ ...cat.night, endMin: m })} />
                <Segmented options={NIGHT_INTERVALS} value={cat.night.intervalS as 120 | 300 | 600} onChange={(v) => saveNight({ ...cat.night, intervalS: v })} />
                <Text style={{ color: t.textMuted, fontSize: 12 }}>
                  {cat.kind === 'collar' ? 'The collar picks up the new schedule at its next check-in.' : 'Applies to this phone while it tracks.'} Uses more battery at night.
                </Text>
              </>
            )}
          </Card>
        )}

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

        {owner ? (
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
              }, 'Remove')
            }
          />
        ) : (
          <Text style={{ color: t.textMuted, textAlign: 'center' }}>{cat.name} is shared with you by your household.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function TimeStepper({ label, minutes, onChange }: { label: string; minutes: number; onChange: (m: number) => void }) {
  const t = useTheme();
  const step = (d: number) => onChange((minutes + d + 1440) % 1440);
  return (
    <View style={styles.stepper}>
      <Text style={{ color: t.textMuted, width: 48 }}>{label}</Text>
      <Button title="−" variant="secondary" style={styles.stepBtn} onPress={() => step(-30)} />
      <Text style={[styles.time, { color: t.text, backgroundColor: t.surfaceAlt }]}>{hhmm(minutes)}</Text>
      <Button title="+" variant="secondary" style={styles.stepBtn} onPress={() => step(30)} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  scroll: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2, maxWidth: 640, width: '100%', alignSelf: 'center' },
  layerBar: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.md },
  statusCard: { flexDirection: 'row', alignItems: 'center' },
  big: { fontSize: 22, fontWeight: '900', marginTop: space.sm },
  progress: { height: 8, borderRadius: 4, overflow: 'hidden' },
  controls: { flexDirection: 'row', gap: space.sm },
  ctrl: { minWidth: 52, paddingHorizontal: space.md },
  zoneRow: { flexDirection: 'row', alignItems: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legendBar: { flex: 1, height: 10, borderRadius: radius.pill, overflow: 'hidden', flexDirection: 'row' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: { minWidth: 48, minHeight: 40, paddingHorizontal: space.md },
  time: { fontSize: 18, fontWeight: '800', paddingHorizontal: space.lg, paddingVertical: 8, borderRadius: radius.md, overflow: 'hidden' },
});
