/**
 * Background location for "this phone is the cat's tracker" (development and
 * store builds only - Expo Go cannot run background tasks).
 *
 * The task is defined at module load (imported from app/_layout), as
 * expo-task-manager requires. It talks to Supabase directly with the stored
 * session, so it also works while the UI is not mounted.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { supabase } from '../backend/supabaseClient';
import { capabilities } from '../runtime';

export const BG_TASK = 'cat-tracker-phone-location';
const BG_CAT_KEY = 'tracker.bg.catId';

type Listener = (r: { ok: boolean; at: string; accuracyM: number | null; error?: string }) => void;
const listeners = new Set<Listener>();

export function onBackgroundReport(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

if (capabilities.backgroundLocation && !TaskManager.isTaskDefined(BG_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(BG_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length || !supabase) return;
    const loc = data.locations[data.locations.length - 1]!;
    const catId = await AsyncStorage.getItem(BG_CAT_KEY);
    if (!catId) return;

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const level = await Battery.getBatteryLevelAsync().catch(() => -1);
    const { data: res, error: rpcError } = await supabase.rpc('report_phone_location', {
      p_device_id: catId,
      p_lat: loc.coords.latitude,
      p_lng: loc.coords.longitude,
      p_accuracy_m: Math.max(0, loc.coords.accuracy ?? 50),
      p_battery_pct: level >= 0 ? Math.round(level * 100) : null,
      p_recorded_at: new Date(loc.timestamp).toISOString(),
    });
    const ok = !rpcError && (res as { status?: string } | null)?.status === 'ok';
    for (const l of listeners) {
      l({ ok, at: new Date().toISOString(), accuracyM: loc.coords.accuracy ?? null, error: rpcError?.message });
    }
  });
}

export type BackgroundStart = 'started' | 'foreground-only' | 'denied';

/**
 * Start background reporting. Falls back to "foreground-only" when the user
 * only grants "While using the app".
 */
export async function startBackgroundTracking(catId: string, catName: string, intervalS: number): Promise<BackgroundStart> {
  if (!capabilities.backgroundLocation) return 'foreground-only';
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return 'foreground-only';

  await AsyncStorage.setItem(BG_CAT_KEY, catId);
  if (await Location.hasStartedLocationUpdatesAsync(BG_TASK)) await Location.stopLocationUpdatesAsync(BG_TASK);
  await Location.startLocationUpdatesAsync(BG_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: intervalS * 1000,
    distanceInterval: intervalS <= 30 ? 0 : 10,
    deferredUpdatesInterval: intervalS * 1000,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: `Tracking ${catName}`,
      notificationBody: 'This phone is acting as the cat tracker.',
      notificationColor: '#D97706',
      killServiceOnDestroy: false,
    },
  });
  return 'started';
}

export async function stopBackgroundTracking(): Promise<void> {
  await AsyncStorage.removeItem(BG_CAT_KEY);
  if (Platform.OS === 'web' || !capabilities.backgroundLocation) return;
  if (await Location.hasStartedLocationUpdatesAsync(BG_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(BG_TASK);
  }
}
