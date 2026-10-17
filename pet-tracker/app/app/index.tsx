/**
 * Home: map with every cat + the cat list (Traccar's MainPage: DeviceList +
 * MainMap), with lost-mode and zone alerts, a sync status line and a short
 * first-run guide.
 */
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../src/AppProvider';
import { CatMap } from '../src/components/CatMap';
import { CatRow } from '../src/components/CatRow';
import { TrackerBanner } from '../src/components/TrackerBanner';
import { Button, Pill } from '../src/components/ui';
import { relativeTime } from '../src/geo';
import { radius, space, useTheme } from '../src/theme';

/** Zone alerts fade out after this long; they stay in the cat's alert list. */
const ALERT_TTL_MS = 30_000;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const now = useNow(15_000);
  const { ready, backend, cats, alert, dismissAlert, trackedCatId, tracker, openCatRequest, clearOpenCatRequest, lastSyncAt, syncFailed } = useApp();

  // Tapped a push notification -> open that cat.
  useEffect(() => {
    if (openCatRequest) {
      clearOpenCatRequest();
      router.push({ pathname: '/cat/[id]', params: { id: openCatRequest } });
    }
  }, [openCatRequest, clearOpenCatRequest, router]);

  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(dismissAlert, ALERT_TTL_MS);
    return () => clearTimeout(timer);
  }, [alert, dismissAlert]);

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }
  if (!backend) return <Redirect href="/login" />;

  const alertCat = alert ? cats.find((c) => c.id === alert.catId) : undefined;
  const lost = cats.filter((c) => c.lostMode);
  const open = (id: string) => router.push({ pathname: '/cat/[id]', params: { id } });

  const syncLine =
    backend.mode === 'demo'
      ? 'Demo · simulated positions'
      : syncFailed
        ? 'Cannot reach the server · showing the last positions we have'
        : lastSyncAt
          ? `Updated ${relativeTime(new Date(lastSyncAt).toISOString(), now)}`
          : 'Connecting…';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} hitSlop={12}>
              <Ionicons name="settings-outline" size={24} color={t.text} />
            </Pressable>
          ),
          headerLeft: () => (backend.mode === 'demo' ? <Pill label="Demo" tone="accent" /> : null),
        }}
      />

      <CatMap cats={cats} style={styles.map} onSelectCat={open} />

      <View style={styles.overlays} pointerEvents="box-none">
        {lost.map((c) => (
          <Pressable key={c.id} accessibilityRole="button" onPress={() => open(c.id)} style={[styles.banner, styles.stacked, { backgroundColor: t.danger }]}>
            <View style={styles.bannerRow}>
              <Ionicons name="alert-circle" size={20} color="#fff" />
              <Text style={styles.bannerText}>{c.name} is in lost mode</Text>
            </View>
            <Text style={styles.bannerSub}>
              {c.lostModeSince ? `Since ${relativeTime(c.lostModeSince, now)} · ` : ''}Tap to follow
            </Text>
          </Pressable>
        ))}
        {alert && (
          <View style={[styles.banner, { backgroundColor: alert.transition === 'exit' ? t.danger : t.live }]}>
            <Pressable
              accessibilityRole="button"
              style={styles.bannerMain}
              onPress={() => {
                dismissAlert();
                open(alert.catId);
              }}
            >
              <View style={styles.bannerRow}>
                <Ionicons name={alert.transition === 'exit' ? 'exit-outline' : 'home-outline'} size={20} color="#fff" />
                <Text style={styles.bannerText}>
                  {alertCat?.name ?? 'A cat'} {alert.transition === 'exit' ? 'left' : 'is back in'} {alert.zoneName}
                </Text>
              </View>
              <Text style={styles.bannerSub}>{relativeTime(alert.at, now)} · Tap to view</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss alert" onPress={dismissAlert} hitSlop={12}>
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>

      <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + space.md }]}>
        <View style={[styles.grabber, { backgroundColor: t.border }]} />
        <View style={styles.syncRow} accessibilityLiveRegion="polite">
          <Ionicons
            name={syncFailed ? 'cloud-offline-outline' : 'checkmark-circle-outline'}
            size={16}
            color={syncFailed ? t.danger : t.textMuted}
          />
          <Text style={{ color: syncFailed ? t.danger : t.textMuted, fontSize: 13, flex: 1 }}>{syncLine}</Text>
        </View>
        {tracker.state !== 'off' && (
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
            <TrackerBanner onPress={() => tracker.catId && open(tracker.catId)} />
          </View>
        )}
        <FlatList
          data={cats}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <CatRow
              cat={item}
              trackedByPhone={item.id === trackedCatId}
              shared={item.ownerId !== null && item.ownerId !== backend.userId}
              onPress={() => open(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: t.border }]} />}
          ListEmptyComponent={<FirstRun />}
          style={{ flexGrow: 0, maxHeight: Math.round(height * 0.4) }}
        />
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          <Button title="Add a cat" icon="add" onPress={() => router.push('/add-cat')} />
        </View>
      </View>
    </View>
  );
}

/** Shown instead of an empty list: the three steps to a working tracker. */
function FirstRun() {
  const t = useTheme();
  const steps: [string, string][] = [
    ['Add your cat', 'Give it a name and a colour. A photo can come later.'],
    ['Choose its tracker', 'Use this phone for a quick test, or pair a GPS collar with the code on its label.'],
    ['Invite your household', 'In Settings, create an invite code so others can see and help find your cats.'],
  ];
  return (
    <View style={styles.firstRun}>
      <Text style={[styles.firstRunTitle, { color: t.text }]}>Let's get your cat on the map</Text>
      {steps.map(([title, body], i) => (
        <View key={title} style={styles.step}>
          <View style={[styles.stepNumber, { backgroundColor: t.accentSoft }]}>
            <Text style={{ color: t.accent, fontWeight: '900' }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '700' }}>{title}</Text>
            <Text style={{ color: t.textMuted, lineHeight: 20 }}>{body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  map: { flex: 1 },
  overlays: { position: 'absolute', top: space.md, left: space.lg, right: space.lg, gap: space.sm },
  sheet: {
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, marginTop: -radius.lg,
    paddingTop: space.sm, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: space.sm },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.lg, paddingBottom: space.sm },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 76 },
  firstRun: { padding: space.lg, gap: space.md },
  firstRunTitle: { fontSize: 18, fontWeight: '800' },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  banner: { borderRadius: radius.md, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 6 },
  stacked: { flexDirection: 'column', alignItems: 'stretch', gap: 0 },
  bannerMain: { flex: 1 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bannerText: { color: '#fff', fontWeight: '800', fontSize: 15, flexShrink: 1 },
  bannerSub: { color: 'rgba(255,255,255,0.88)', marginTop: 2, fontSize: 12, marginLeft: 28 },
});
