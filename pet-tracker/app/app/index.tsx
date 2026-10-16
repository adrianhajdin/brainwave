/**
 * Home: map with every cat + the cat list (Traccar's MainPage: DeviceList +
 * MainMap), with the phone-tracker status and the latest geofence alert.
 */
import { Redirect, Stack, useRouter } from 'expo-router';
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
  const { ready, backend, cats, alert, dismissAlert, signOut, trackedCatId, tracker } = useApp();

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }
  if (!backend) return <Redirect href="/login" />;

  const alertCat = alert ? cats.find((c) => c.id === alert.catId) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={() => void signOut()} hitSlop={12}>
              <Text style={{ color: t.accent, fontWeight: '700' }}>{backend.mode === 'demo' ? 'Exit demo' : 'Sign out'}</Text>
            </Pressable>
          ),
          headerLeft: () => <Pill label={backend.mode === 'demo' ? 'DEMO' : backend.userLabel} tone={backend.mode === 'demo' ? 'accent' : 'neutral'} />,
        }}
      />

      <CatMap
        cats={cats}
        style={styles.map}
        onSelectCat={(id) => router.push({ pathname: '/cat/[id]', params: { id } })}
      />

      {alert && (
        <Pressable
          onPress={() => {
            dismissAlert();
            router.push({ pathname: '/cat/[id]', params: { id: alert.catId } });
          }}
          style={[styles.alert, { backgroundColor: alert.transition === 'exit' ? t.danger : t.live }]}
        >
          <Text style={styles.alertText}>
            {alert.transition === 'exit' ? '🚪' : '🏠'} {alertCat?.name ?? 'A cat'} {alert.transition === 'exit' ? 'left' : 'is back in'}{' '}
            {alert.zoneName} · {relativeTime(alert.at)}
          </Text>
          <Text style={styles.alertDismiss}>Tap to view</Text>
        </Pressable>
      )}

      <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + space.md }]}>
        <View style={[styles.grabber, { backgroundColor: t.border }]} />
        {tracker.state !== 'off' && (
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
            <TrackerBanner
              onPress={() => tracker.catId && router.push({ pathname: '/cat/[id]', params: { id: tracker.catId } })}
            />
          </View>
        )}
        <FlatList
          data={cats}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <CatRow
              cat={item}
              trackedByPhone={item.id === trackedCatId}
              onPress={() => router.push({ pathname: '/cat/[id]', params: { id: item.id } })}
            />
          )}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: t.border }]} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: t.textMuted }]}>
              No cats yet. Add one and let this phone stand in for its collar.
            </Text>
          }
          style={{ flexGrow: 0, maxHeight: 320 }}
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
  sheet: {
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, marginTop: -radius.lg,
    paddingTop: space.sm, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: space.sm },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 74 },
  empty: { padding: space.xl, textAlign: 'center', lineHeight: 20 },
  alert: {
    position: 'absolute', top: space.md, left: space.lg, right: space.lg, borderRadius: radius.md,
    padding: space.md, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 6,
  },
  alertText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  alertDismiss: { color: 'rgba(255,255,255,0.85)', marginTop: 2, fontSize: 12 },
});
