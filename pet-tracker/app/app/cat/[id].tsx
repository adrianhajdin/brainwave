/**
 * Cat detail. Live: status and lost mode first, then the map with tabs for
 * activity, zones and alerts. Route and Heatmap: a full-height map with a
 * bottom sheet, as in the "Clean Signal" designs (02, 03, 04).
 * Name, photo, night watch, tracker interval and deleting live on the edit screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../src/AppProvider';
import { isOwner, type ActivityDay, type CatEvent, type HeatCell, type HomeZone, type TrackPoint } from '../../src/backend/types';
import { AccessPill } from '../../src/components/AccessPill';
import { ActivityCard } from '../../src/components/ActivityCard';
import { CatMap } from '../../src/components/CatMap';
import type { MapLayer } from '../../src/components/CatMap.types';
import { HEAT_LEGEND } from '../../src/components/heat';
import { Scrubber } from '../../src/components/Scrubber';
import { TrackerBanner } from '../../src/components/TrackerBanner';
import { Button, Card, ErrorText, IconButton, Pill, SectionTitle, Segmented } from '../../src/components/ui';
import { ask, messageOf } from '../../src/dialogs';
import { distanceM, formatDistance, inNightWindow, isLive, relativeTime } from '../../src/geo';
import { fmtDuration, shortDate } from '../../src/time';
import { fonts, radius, space, useTheme } from '../../src/theme';

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
type Section = 'load' | 'lost' | 'tracker' | 'zones' | 'sitting';

const LAYERS = [
  { value: 'live', label: 'Live' },
  { value: 'route', label: 'Route' },
  { value: 'heatmap', label: 'Heatmap' },
] as const;

export default function CatScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { backend, cats, trackedCatId, setTrackedCatId, tracker, effectiveIntervalS, alert, refresh } = useApp();
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
  const immersive = layer !== 'live';
  const sheetTop = Math.round(height * 0.62);

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

  const stopSitting = async () => {
    if (!(await ask(`Stop looking after ${cat.name}?`, `${cat.name} disappears from your list. The owner can invite you again.`, 'Stop', true))) return;
    await run('sitting', async () => {
      await backend.removeCatSitter(cat.id, backend.userId);
      await refresh();
      router.replace('/');
    });
  };

  const toggleLost = async () => {
    if (cat.lostMode) {
      void run('lost', () => backend.setLostMode(cat.id, false));
    } else if (await ask(`Is ${cat.name} lost?`, `Lost mode makes the tracker report as often as possible and alerts everyone who sees ${cat.name}. It uses more battery.`, 'Turn on lost mode')) {
      void run('lost', () => backend.setLostMode(cat.id, true));
    }
  };

  const toggleTracking = async () => {
    if (isTracked) {
      setTrackedCatId(null);
    } else if (
      await ask(
        'Use this phone as the tracker?',
        `Its location is shared with everyone who sees ${cat.name} as ${cat.name}'s position. Only do this with a phone whose owner knows and agrees. Next, your phone asks for location access. "Allow all the time" keeps tracking with the screen off.`,
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

  const selectLayer = (v: MapLayer) => {
    setPlaying(false);
    setReplayIndex(null);
    setLayer(v);
  };

  const routeSheet = (
    <>
      <Segmented options={ROUTE_RANGES} value={rangeH as 1 | 24 | 168} onChange={(v) => { setReplayIndex(null); setPlaying(false); setRangeH(v); }} />
      <View style={styles.statRow}>
        <Text style={{ color: t.text, fontFamily: fonts.display, fontSize: 20 }}>{formatDistance(walked)} walked</Text>
        <Text style={{ color: t.textMuted, fontSize: 13 }}>{track.length} positions</Text>
      </View>

      {track.length > 1 ? (
        <>
          <View style={styles.timeLine}>
            <Text style={[styles.mono, { color: t.text }]}>
              {cursor
                ? new Date(cursor.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date(track[track.length - 1]!.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={{ color: t.textMuted, fontSize: 13 }}>
              {cursor ? `Point ${(replayIndex ?? 0) + 1} of ${track.length}` : 'Smoothed route'}
            </Text>
          </View>
          <Scrubber
            label="Route position"
            fraction={(replayIndex ?? track.length - 1) / (track.length - 1)}
            onSeek={seek}
            color={cat.color}
          />
          <View style={styles.scrubLabels}>
            <Text style={[styles.tiny, { color: t.textMuted }]}>{new Date(track[0]!.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            <Text style={[styles.tiny, { color: t.textMuted }]}>{new Date(track[track.length - 1]!.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
          <View style={styles.controls}>
            <IconButton icon="play-back" label="Previous point" onPress={() => setReplayIndex((i) => Math.max(0, (i ?? 1) - 1))} />
            <Button
              title={playing ? 'Pause' : 'Play'}
              icon={playing ? 'pause' : 'play'}
              style={{ flex: 1, height: 52 }}
              onPress={() => {
                if (!playing && (replayIndex === null || replayIndex >= track.length - 1)) setReplayIndex(0);
                setPlaying((p) => !p);
              }}
            />
            <IconButton icon="play-forward" label="Next point" onPress={() => setReplayIndex((i) => Math.min(track.length - 1, (i ?? -1) + 1))} />
          </View>
          {replayIndex !== null && (
            <Pressable accessibilityRole="button" onPress={() => { setPlaying(false); setReplayIndex(null); }} hitSlop={8}>
              <Text style={{ color: t.accent, fontFamily: fonts.bodySemibold, textAlign: 'center' }}>Stop replay</Text>
            </Pressable>
          )}
        </>
      ) : (
        <Text style={{ color: t.textMuted }}>Not enough positions in this period yet.</Text>
      )}
      <ErrorText>{errors.load}</ErrorText>
    </>
  );

  const heatSheet = (
    <>
      <Segmented options={HEAT_RANGES} value={heatRangeH as 24 | 168 | 720} onChange={setHeatRangeH} />
      <View style={styles.legend}>
        <View style={styles.legendBar}>
          {HEAT_LEGEND.map((c) => (
            <View key={c} style={{ flex: 1, backgroundColor: c }} />
          ))}
        </View>
        <View style={styles.legendLabels}>
          <Text style={[styles.tiny, { color: t.textMuted }]}>passing by</Text>
          <Text style={[styles.tiny, { color: t.textMuted }]}>hours spent</Text>
        </View>
      </View>
      {heat.length === 0 ? (
        <Text style={{ color: t.textMuted }}>Not enough positions in this period yet.</Text>
      ) : (
        heat.slice(0, 5).map((c, i) => (
          <View key={`${c.lat},${c.lng}`} style={[styles.rankRow, { borderBottomColor: t.surfaceAlt }]}>
            <View style={[styles.rank, { backgroundColor: t.primary }]}>
              <Text style={{ color: t.primaryText, fontFamily: fonts.display, fontSize: 14 }}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.rankTop}>
                <Text style={{ color: t.text, fontFamily: fonts.display, fontSize: 18 }}>{fmtDuration(c.weightS)}</Text>
                <Text style={{ color: t.textMuted, fontSize: 13 }}>
                  {cat.lastLat !== null && cat.lastLng !== null ? `${formatDistance(distanceM(c.lat, c.lng, cat.lastLat, cat.lastLng))} from ${cat.name} now` : ''}
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: t.surfaceAlt }]}>
                <View style={{ width: `${Math.round((c.weightS / heat[0]!.weightS) * 100)}%`, height: 4, borderRadius: 2, backgroundColor: HEAT_LEGEND[Math.max(0, 3 - i)] }} />
              </View>
            </View>
          </View>
        ))
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          title: cat.name,
          headerShown: !immersive,
          headerRight: owner
            ? () => (
                <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${cat.name}`} onPress={() => router.push({ pathname: '/edit-cat/[id]', params: { id: cat.id } })} hitSlop={12}>
                  <Text style={{ color: t.accent, fontFamily: fonts.bodySemibold }}>Edit</Text>
                </Pressable>
              )
            : undefined,
        }}
      />

      <View style={immersive ? StyleSheet.absoluteFill : { height: Math.round(height * 0.4) }}>
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
          coverBottom={immersive ? height - sheetTop : 0}
          style={StyleSheet.absoluteFill}
        />
        {!immersive && (
          <View style={styles.layerBar}>
            <Segmented<MapLayer> options={LAYERS} value={layer} onChange={selectLayer} />
          </View>
        )}
      </View>

      {immersive ? (
        <>
          <View style={[styles.floatTop, { top: insets.top + 8 }]} pointerEvents="box-none">
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={[styles.floatBtn, { backgroundColor: t.surface }]}>
              <Ionicons name="arrow-back" size={22} color={t.text} />
            </Pressable>
            <View style={[styles.floatPill, { backgroundColor: t.surface }]}>
              <View style={[styles.dot, { backgroundColor: cat.color }]} />
              <Text style={{ color: t.text, fontFamily: fonts.bodySemibold }}>
                {cat.name}'s {layer === 'route' ? 'route' : 'favourite places'}
              </Text>
            </View>
          </View>
          <View style={[styles.layerFloat, { top: sheetTop - 58 }]}>
            <Segmented<MapLayer> options={LAYERS} value={layer} onChange={selectLayer} />
          </View>
          <View style={[styles.sheet, { top: sheetTop, paddingBottom: insets.bottom + space.xl, backgroundColor: t.surface }]}>
            <View style={[styles.grabber, { backgroundColor: t.border }]} />
            {/* Negative margin + padding keeps the scrubber knob, which overhangs the track, inside the scroll area. */}
            <ScrollView style={{ marginHorizontal: -12 }} contentContainerStyle={{ gap: 16, paddingHorizontal: 12, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              {layer === 'route' ? routeSheet : heatSheet}
            </ScrollView>
          </View>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <TrackerBanner />
          <ErrorText>{errors.load}</ErrorText>

          <View style={{ gap: space.xs }}>
            <View style={styles.pillRow}>
              <Pill label={live ? 'Live' : 'Offline'} tone={live ? 'live' : 'neutral'} />
              <Pill label={cat.kind === 'phone' ? 'Phone tracker' : 'GPS collar'} icon={cat.kind === 'phone' ? 'phone-portrait-outline' : 'radio-outline'} />
              <AccessPill cat={cat} own />
              {nightNow && <Pill label="Night watch" tone="night" icon="moon-outline" />}
            </View>
            <Text style={[styles.big, { color: t.text }]}>{cat.lastFixAt ? relativeTime(cat.lastFixAt) : 'No location yet'}</Text>
            <Text style={{ color: lowBattery ? t.warn : t.textMuted, lineHeight: 20 }}>
              {[
                cat.lastAccuracyM !== null ? `GPS accuracy about ${Math.round(cat.lastAccuracyM)} m` : null,
                cat.lastBatteryPct ? (lowBattery ? `Battery low: ${cat.lastBatteryPct}%` : `Battery ${cat.lastBatteryPct}%`) : null,
              ]
                .filter(Boolean)
                .join(' · ') || ' '}
            </Text>
          </View>

          {/* Lost mode: the most important action on this screen */}
          <Card style={[{ gap: space.sm }, cat.lostMode && { backgroundColor: t.dangerSoft }]}>
            {cat.lostMode ? (
              <>
                <View style={styles.lostTitle}>
                  <Ionicons name="alert-circle" size={26} color={t.danger} />
                  <Text style={[styles.big, { color: t.danger, marginTop: 0 }]}>{cat.name} is in lost mode</Text>
                </View>
                <Text style={{ color: t.text, lineHeight: 20 }}>
                  Since {cat.lostModeSince ? relativeTime(cat.lostModeSince) : 'just now'}.{' '}
                  {cat.kind === 'phone' ? 'The tracking phone reports every 15 s.' : 'The collar reports every minute.'} Everyone who sees {cat.name} was notified.
                </Text>
                <Button title={`${cat.name} is found · turn off`} variant="secondary" busy={busy === 'lost'} onPress={() => void toggleLost()} />
              </>
            ) : (
              <View style={styles.lostRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontFamily: fonts.bodySemibold, fontSize: 16 }}>Can't find {cat.name}?</Text>
                  <Text style={{ color: t.textMuted, lineHeight: 20, marginTop: 2 }}>Lost mode reports more often and alerts everyone who sees {cat.name}.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Turn on lost mode for ${cat.name}`}
                  disabled={busy === 'lost'}
                  onPress={() => void toggleLost()}
                  style={({ pressed }) => [styles.lostPill, { backgroundColor: t.danger, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="alert-circle" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontFamily: fonts.bodySemibold }}>Lost mode</Text>
                </Pressable>
              </View>
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
                      <Text style={{ color: t.text, fontFamily: fonts.bodySemibold }}>{z.name}</Text>
                      <Text style={{ color: t.textMuted, fontSize: 13 }}>
                        {formatDistance(z.radiusM)} radius{z.allCats ? ' · all cats' : ''}
                        {inside !== null ? ` · ${cat.name} is ${inside ? 'inside' : 'outside'}` : ''}
                      </Text>
                    </View>
                    {owner && <Button title="Delete" variant="ghost" busy={busy === 'zones'} onPress={() => void removeZone(z)} />}
                  </View>
                );
              })}
              {owner && <Button title="Add a zone" icon="add" variant="secondary" onPress={() => router.push({ pathname: '/zone/[catId]', params: { catId: cat.id } })} />}
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
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/edit-cat/[id]', params: { id: cat.id } })}
              style={({ pressed }) => [styles.editRow, { backgroundColor: t.surface, opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name="options-outline" size={22} color={t.text} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontFamily: fonts.bodySemibold }}>Edit {cat.name}</Text>
                <Text style={{ color: t.textMuted, fontSize: 13 }}>Photo, name, colour and night watch</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
            </Pressable>
          ) : cat.access === 'sitter' ? (
            <Card style={{ gap: space.sm }}>
              <SectionTitle>Cat sitting</SectionTitle>
              <Text style={{ color: t.textMuted, lineHeight: 20 }}>
                {cat.sitterUntil
                  ? `You're looking after ${cat.name} until ${shortDate(cat.sitterUntil)}. After that ${cat.name} disappears from your list.`
                  : `You're looking after ${cat.name} until the owner stops it.`}{' '}
                You see where {cat.name} is, get the same alerts and can switch lost mode on.
              </Text>
              <ErrorText>{errors.sitting}</ErrorText>
              <Button title={`Stop looking after ${cat.name}`} variant="ghost" textColor={t.danger} busy={busy === 'sitting'} onPress={() => void stopSitting()} />
            </Card>
          ) : (
            <Text style={{ color: t.textMuted, textAlign: 'center', lineHeight: 20 }}>
              {cat.name} is in {cat.householdName ?? 'a household you are in'}. Only the owner can edit {cat.name}.
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  scroll: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2, maxWidth: 640, width: '100%', alignSelf: 'center' },
  layerBar: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.md },
  layerFloat: { position: 'absolute', left: 20, right: 20 },
  floatTop: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  floatBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  floatPill: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: radius.pill, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20, paddingTop: 18, gap: 16, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 34, elevation: 10,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: -8 },
  statRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  timeLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  mono: { fontFamily: 'GeistMono_500Medium', fontSize: 26, letterSpacing: -0.5 },
  tiny: { fontFamily: 'GeistMono_500Medium', fontSize: 12 },
  scrubLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -10 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legend: { gap: 4 },
  legendBar: { height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' },
  legendLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rank: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rankTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  barTrack: { height: 4, borderRadius: 2 },
  pillRow: { flexDirection: 'row', gap: space.xs, alignItems: 'center', flexWrap: 'wrap' },
  big: { fontSize: 32, fontFamily: fonts.display, letterSpacing: -0.6, marginTop: space.xs },
  lostTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lostRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lostPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.pill },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
});
