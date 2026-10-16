/**
 * Home: map with every cat + the cat list (Traccar's MainPage: DeviceList +
 * MainMap), with lost-mode banner, phone-tracker status and the latest alert.
 */
import { Redirect, Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../src/AppProvider';
import { CatMap } from '../src/components/CatMap';
import { CatRow } from '../src/components/CatRow';
import { TrackerBanner } from '../src/components/TrackerBanner';
import { Button, Pill } from '../src/components/ui';
import { relativeTime } from '../src/geo';
import { radius, space, useTheme } from '../src/theme';

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ready, backend, cats, alert, dismissAlert, trackedCatId, tracker, openCatRequest, clearOpenCatRequest } = useApp();

  // Tapped a push notification -> open that cat.
  useEffect(() => {
    if (openCatRequest) {
      clearOpenCatRequest();
      router.push({ pathname: '/cat/[id]', params: { id: openCatRequest } });
    }
  }, [openCatRequest, clearOpenCatRequest, router]);

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

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} hitSlop={12}>
              <Text style={{ fontSize: 22 }}>⚙️</Text>
            </Pressable>
          ),
          headerLeft: () => (backend.mode === 'demo' ? <Pill label="DEMO" tone="accent" /> : null),
        }}
      />

      <CatMap cats={cats} style={styles.map} onSelectCat={open} />

      <View style={styles.overlays} pointerEvents="box-none">
        {lost.map((c) => (
          <Pressable key={c.id} onPress={() => open(c.id)} style={[styles.banner, { backgroundColor: t.danger }]}>
            <Text style={styles.bannerText}>🚨 {c.name} is in lost mode{c.lostModeSince ? ` · since ${relativeTime(c.lostModeSince)}` : ''}</Text>
            <Text style={styles.bannerSub}>Positions update every 15 s or as fast as the collar can. Tap to follow.</Text>
          </Pressable>
        ))}
        {alert && (
          <Pressable
            onPress={() => {
              dismissAlert();
              open(alert.catId);
            }}
            style={[styles.banner, { backgroundColor: alert.transition === 'exit' ? t.danger : t.live }]}
          >
            <Text style={styles.bannerText}>
              {alert.transition === 'exit' ? '🚪' : '🏠'} {alertCat?.name ?? 'A cat'} {alert.transition === 'exit' ? 'left' : 'is back in'}{' '}
              {alert.zoneName} · {relativeTime(alert.at)}
            </Text>
            <Text style={styles.bannerSub}>Tap to view</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + space.md }]}>
        <View style={[styles.grabber, { backgroundColor: t.border }]} />
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
          ListEmptyComponent={
            <Text style={[styles.empty, { color: t.textMuted }]}>
              No cats yet. Add one - or join your household's cats with an invite code in Settings.
            </Text>
          }
          style={{ flexGrow: 0, maxHeight: 340 }}
        />
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          <Button title="Add a cat" icon="＋" onPress={() => router.push('/add-cat')} />
        </View>
      </View>
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
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 76 },
  empty: { padding: space.xl, textAlign: 'center', lineHeight: 20 },
  banner: { borderRadius: radius.md, padding: space.md, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 6 },
  bannerText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  bannerSub: { color: 'rgba(255,255,255,0.88)', marginTop: 2, fontSize: 12 },
});
