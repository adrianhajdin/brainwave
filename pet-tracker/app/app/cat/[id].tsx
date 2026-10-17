/**
 * Cat detail: whether the cat is lost and where it is now first, then the
 * map with its layer (live / route / heatmap), and tabs for activity, zones
 * and alerts. Name, photo, night watch, tracker interval and deleting live on
 * the edit screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useApp } from '../../src/AppProvider';
import { isOwner, type ActivityDay, type CatEvent, type HeatCell, type HomeZone, type TrackPoint } from '../../src/backend/types';
import { ActivityCard } from '../../src/components/ActivityCard';
import { CatMap } from '../../src/components/CatMap';
import type { MapLayer } from '../../src/components/CatMap.types';
import { HEAT_LEGEND } from '../../src/components/heat';
import { Scrubber } from '../../src/components/Scrubber';
import { TrackerBanner } from '../../src/components/TrackerBanner';
import { Button, Card, ErrorText, IconButton, Pill, SectionTitle, Segmented } from '../../src/components/ui';
import { ask, messageOf } from '../../src/dialogs';
import { distanceM, formatDistance, inNightWindow, isLive, relativeTime } from '../../src/geo';
import { fmtDuration } from '../../src/time';
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

const TABS = [
  { value: 'activity', label: 'Activity' },
  { value: 'zones', label: 'Zones' },
  { value: 'alerts', label: 'Alerts' },
] as const;

type Tab = (typeof TABS)[number]['value'];
/** Sections that can show an error next to the control that failed. */
type Section = 'load' | 'lost' | 'tracker' | 'route' | 'zones';

export default function CatScreen() {
  const t = useTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { backend, cats, trackedCatId, setTrackedCatId, tracker, effectiveIntervalS, alert } = useApp();
  const cat = cats.find((c) => c.id === id);

  const [layer, setLayer] = useState<MapLayer>('live');
  const [tab, setTab] = useState<Tab>('activity');
  const [rangeH, setRangeH] = useState<number>(24);
  const [heatRangeH, setHeatRangeH] = useState<number>(168);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [heat, setHeat] = useState<HeatCell[]>([]);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [zones, setZones] = useState<HomeZone[]>([]);
  const [events, setEvents] = useState<CatEvent[]>([]);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<Section | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Section, string>>>({});
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
      setErrors((e) => ({ ...e, load: undefined }));
    } catch (e) {
      setErrors((s) => ({ ...s, load: messageOf(e) }));
    }
  }, [backend, id, rangeH]);

  const loadHeat = useCallback(async () => {
    if (!backend || !id) return;
    try {
      setHeat(await backend.getHeatmap(id, new Date(Date.now() - heatRangeH * 3600_000).toISOString()));
    } catch (e) {
      setErrors((s) => ({ ...s, load: messageOf(e) }));
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

  const run = async (key: Section, fn: () => Promise<void>) => {
    setBusy(key);
    setErrors((e) => ({ ...e, [key]: undefined }));
    try {
      await fn();
    } catch (e) {
      setErrors((s) => ({ ...s, [key]: messageOf(e) }));
    } finally {
      setBusy(null);
    }
  };

  const toggleLost = async () => {
    if (cat.lostMode) {
      void run('lost', () => backend.setLostMode(cat.id, false));
    } else if (await ask(`Is ${cat.name} lost?`, 'Lost mode makes the tracker report as often as possible and alerts everyone in your household. It uses more battery.', 'Turn on lost mode')) {
      void run('lost', () => backend.setLostMode(cat.id, true));
    }
  };

  const toggleTracking = async () => {
    if (isTracked) {
      setTrackedCatId(null);
    } else if (
      await ask(
        'Use this phone as the tracker?',
        `Its location is shared with everyone in your household as ${cat.name}'s position. Only do this with a phone whose owner knows and agrees. Next, your phone asks for location access. "Allow all the time" keeps tracking with the screen off.`,
        'Use this phone',
      )
    ) {
      setTrackedCatId(cat.id);
    }
  };

  const seek = (fraction: number) => {
    setPlaying(false);
    setReplayIndex(Math.round(fraction * (track.length - 1)));
  };

  const removeZone = async (z: HomeZone) => {
    if (!(await ask(`Delete ${z.name}?`, 'Alerts for this zone stop.', 'Delete zone', true))) return;
    await run('zones', async () => {
      await backend.removeZone(z.id);
      await load();
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          title: cat.name,
          headerRight: owner
            ? () => (
                <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${cat.name}`} onPress={() => router.push({ pathname: '/edit-cat/[id]', params: { id: cat.id } })} hitSlop={12}>
                  <Text style={{ color: t.accent, fontWeight: '700' }}>Edit</Text>
                </Pressable>
              )
            : undefined,
        }}
      />

      <View style={{ height: Math.round(height * 0.4) }}>
        <CatMap
          // While the heatmap or a replay is shown, the cat's live marker would
          // hide the data, so it is only drawn in the live and route views.
          cats={cursor ? [] : cats}
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
        <ErrorText>{errors.load}</ErrorText>

        <Card style={styles.statusCard}>
          <View style={{ flex: 1, gap: space.xs }}>
            <View style={styles.pillRow}>
              <Pill label={live ? 'Live' : 'Offline'} tone={live ? 'live' : 'neutral'} />
              <Pill label={cat.kind === 'phone' ? 'Phone tracker' : 'GPS collar'} icon={cat.kind === 'phone' ? 'phone-portrait-outline' : 'radio-outline'} />
              {!owner && <Pill label="Shared with you" />}
              {nightNow && <Pill label="Night watch" tone="night" icon="moon-outline" />}
            </View>
            <Text style={[styles.big, { color: t.text }]}>{cat.lastFixAt ? relativeTime(cat.lastFixAt) : 'No location yet'}</Text>
            <Text style={{ color: lowBattery ? t.danger : t.textMuted, lineHeight: 20 }}>
              {[
                cat.lastAccuracyM !== null ? `GPS accuracy about ${Math.round(cat.lastAccuracyM)} m` : null,
                cat.lastBatteryPct ? (lowBattery ? `Battery low: ${cat.lastBatteryPct}%` : `Battery ${cat.lastBatteryPct}%`) : null,
              ]
                .filter(Boolean)
                .join(' · ') || ' '}
            </Text>
          </View>
        </Card>

        {/* Lost mode: the most important action on this screen */}
        <Card style={[{ gap: space.sm }, cat.lostMode && { borderColor: t.danger, borderWidth: 2, backgroundColor: t.dangerSoft }]}>
          {cat.lostMode ? (
            <>
              <View style={styles.lostTitle}>
                <Ionicons name="alert-circle" size={26} color={t.danger} />
                <Text style={[styles.big, { color: t.danger, marginTop: 0 }]}>Lost mode is on</Text>
              </View>
              <Text style={{ color: t.text, lineHeight: 20 }}>
                Since {cat.lostModeSince ? relativeTime(cat.lostModeSince) : 'just now'}.{' '}
                {cat.kind === 'phone' ? 'The tracking phone reports every 15 s.' : 'The collar reports every minute.'} Everyone in the household was notified.
              </Text>
              <Button title={`${cat.name} is found · turn off`} variant="secondary" busy={busy === 'lost'} onPress={() => void toggleLost()} />
            </>
          ) : (
            <Button title={`${cat.name} is missing · lost mode`} icon="alert-circle" variant="danger" busy={busy === 'lost'} onPress={() => void toggleLost()} />
          )}
          <ErrorText>{errors.lost}</ErrorText>
        </Card>

        {cat.kind === 'phone' && owner && (
          <Card style={{ gap: space.md }}>
            <SectionTitle>Phone tracker</SectionTitle>
            <Text style={{ color: t.textMuted, lineHeight: 20 }}>
              {isTracked
                ? tracker.mode === 'background'
                  ? `This phone sends its location as ${cat.name} every ${effectiveIntervalS < 60 ? `${effectiveIntervalS} s` : `${Math.round(effectiveIntervalS / 60)} min`}, also with the screen off.`
                  : `This phone sends its location as ${cat.name} while the app is open. For screen-off tracking, use the installed app and allow location "all the time".`
                : trackedCatId
                  ? `This phone is currently tracking another cat. Switching moves the tracker to ${cat.name}.`
                  : `Use this phone's GPS as ${cat.name}'s collar.`}
            </Text>
            <Button
              title={isTracked ? 'Stop tracking' : `Track ${cat.name} with this phone`}
              variant={isTracked ? 'secondary' : 'primary'}
              icon={isTracked ? 'stop-circle-outline' : 'navigate-outline'}
              busy={busy === 'tracker'}
              onPress={() => void toggleTracking()}
            />
            <ErrorText>{errors.tracker}</ErrorText>
          </Card>
        )}

        {layer === 'route' && (
          <Card style={{ gap: space.md }}>
            <SectionTitle>Route</SectionTitle>
            <Segmented options={ROUTE_RANGES} value={rangeH as 1 | 24 | 168} onChange={(v) => { setReplayIndex(null); setPlaying(false); setRangeH(v); }} />
            <Text style={{ color: t.text }}>
              <Text style={{ fontWeight: '800' }}>{track.length}</Text> positions · walked <Text style={{ fontWeight: '800' }}>{formatDistance(walked)}</Text>
            </Text>
            {track.length > 1 ? (
              <>
                <Scrubber
                  label="Route position"
                  fraction={(replayIndex ?? track.length - 1) / (track.length - 1)}
                  onSeek={seek}
                  color={cat.color}
                />
                <Text style={{ color: t.textMuted }}>
                  {cursor ? new Date(cursor.at).toLocaleString() : 'Smoothed route · drag the bar or press Replay to follow it'}
                </Text>
                <View style={styles.controls}>
                  <IconButton icon="play-back" label="Previous point" onPress={() => setReplayIndex((i) => Math.max(0, (i ?? 1) - 1))} />
                  <Button
                    title={playing ? 'Pause' : 'Replay'}
                    icon={playing ? 'pause' : 'play'}
                    style={{ flex: 1 }}
                    onPress={() => {
                      if (!playing && (replayIndex === null || replayIndex >= track.length - 1)) setReplayIndex(0);
                      setPlaying((p) => !p);
                    }}
                  />
                  <IconButton icon="play-forward" label="Next point" onPress={() => setReplayIndex((i) => Math.min(track.length - 1, (i ?? -1) + 1))} />
                  {replayIndex !== null && (
                    <IconButton
                      icon="close"
                      label="Stop replay"
                      onPress={() => {
                        setPlaying(false);
                        setReplayIndex(null);
                      }}
                    />
                  )}
                </View>
              </>
            ) : (
              <Text style={{ color: t.textMuted }}>Not enough positions in this period yet.</Text>
            )}
            <ErrorText>{errors.route}</ErrorText>
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
                <View key={`${c.lat},${c.lng}`} style={styles.rankRow}>
                  <Text style={[styles.rank, { color: t.accent, backgroundColor: t.accentSoft }]}>{i + 1}</Text>
                  <Text style={{ color: t.text, flex: 1 }}>
                    {fmtDuration(c.weightS)}
                    <Text style={{ color: t.textMuted }}>
                      {cat.lastLat !== null && cat.lastLng !== null ? `  ·  ${formatDistance(distanceM(c.lat, c.lng, cat.lastLat, cat.lastLng))} from ${cat.name} now` : ''}
                    </Text>
                  </Text>
                </View>
              ))
            )}
          </Card>
        )}

        <Segmented<Tab> options={TABS.map((x) => (x.value === 'alerts' && events.length ? { value: x.value, label: `Alerts (${events.length})` } : x))} value={tab} onChange={setTab} />

        {tab === 'activity' && <ActivityCard days={activity} color={cat.color} name={cat.name} kind={cat.kind} />}

        {tab === 'zones' && (
          <Card style={{ gap: space.md }}>
            <SectionTitle>Home zones</SectionTitle>
            {zones.length === 0 && <Text style={{ color: t.textMuted, lineHeight: 20 }}>No zones yet. Get an alert when {cat.name} leaves or comes back.</Text>}
            {zones.map((z) => {
              const inside = cat.lastLat !== null && cat.lastLng !== null ? distanceM(z.lat, z.lng, cat.lastLat, cat.lastLng) <= z.radiusM : null;
              return (
                <View key={z.id} style={styles.zoneRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontWeight: '700' }}>{z.name}</Text>
                    <Text style={{ color: t.textMuted, fontSize: 13 }}>
                      {formatDistance(z.radiusM)} radius{z.allCats ? ' · all cats' : ''}
                      {inside !== null ? ` · ${cat.name} is ${inside ? 'inside' : 'outside'}` : ''}
                    </Text>
                  </View>
                  {owner && <Button title="Delete" variant="ghost" busy={busy === 'zones'} onPress={() => void removeZone(z)} />}
                </View>
              );
            })}
            {owner && (
              <Button title="Add a zone" icon="add" variant="secondary" onPress={() => router.push({ pathname: '/zone/[catId]', params: { catId: cat.id } })} />
            )}
            <ErrorText>{errors.zones}</ErrorText>
          </Card>
        )}

        {tab === 'alerts' && (
          <Card style={{ gap: space.md }}>
            <SectionTitle>Alerts</SectionTitle>
            {events.length === 0 ? (
              <Text style={{ color: t.textMuted }}>No zone alerts yet.</Text>
            ) : (
              events.slice(0, 20).map((e) => (
                <View key={e.id} style={styles.eventRow}>
                  <Ionicons name={e.transition === 'exit' ? 'exit-outline' : 'home-outline'} size={20} color={e.transition === 'exit' ? t.danger : t.live} />
                  <Text style={{ color: t.text, flex: 1 }}>
                    {e.transition === 'exit' ? 'Left' : 'Back in'} {e.zoneName}
                    <Text style={{ color: t.textMuted }}>{`  ·  ${relativeTime(e.at)}`}</Text>
                  </Text>
                </View>
              ))
            )}
          </Card>
        )}

        {owner ? (
          <Button
            title={`Edit ${cat.name}`}
            icon="options-outline"
            variant="secondary"
            onPress={() => router.push({ pathname: '/edit-cat/[id]', params: { id: cat.id } })}
          />
        ) : (
          <Text style={{ color: t.textMuted, textAlign: 'center', lineHeight: 20 }}>{cat.name} is shared with you by your household.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  scroll: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2, maxWidth: 640, width: '100%', alignSelf: 'center' },
  layerBar: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.md },
  statusCard: { flexDirection: 'row', alignItems: 'center' },
  pillRow: { flexDirection: 'row', gap: space.xs, alignItems: 'center', flexWrap: 'wrap' },
  big: { fontSize: 22, fontWeight: '900', marginTop: space.sm },
  lostTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  controls: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legendBar: { flex: 1, height: 10, borderRadius: radius.pill, overflow: 'hidden', flexDirection: 'row' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rank: { width: 28, height: 28, borderRadius: 14, textAlign: 'center', lineHeight: 28, fontWeight: '900', overflow: 'hidden' },
});
