/**
 * "This phone is <cat>'s tracker" - the mobile equivalent of Traccar's
 * emulator page: the phone reports its own GPS as if it were the collar.
 *
 * Foreground only: Expo Go cannot run background location tasks, so keep the
 * app open (the screen is kept awake while tracking). A development build
 * with expo-task-manager can add background tracking later.
 */
import * as Battery from 'expo-battery';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { Backend, ReportResult } from '../backend/types';

export type TrackerState = 'off' | 'starting' | 'tracking' | 'denied' | 'error';

export interface TrackerStatus {
  catId: string | null;
  state: TrackerState;
  sent: number;
  lastResult: ReportResult | null;
  lastSentAt: string | null;
  lastAccuracyM: number | null;
  error: string | null;
}

const OFF: TrackerStatus = {
  catId: null, state: 'off', sent: 0, lastResult: null, lastSentAt: null, lastAccuracyM: null, error: null,
};

const KEEP_AWAKE_TAG = 'cat-tracker';

export function usePhoneTracker(backend: Backend | null, catId: string | null, intervalS: number): TrackerStatus {
  const [status, setStatus] = useState<TrackerStatus>(OFF);

  useEffect(() => {
    if (!backend || !catId) {
      setStatus(OFF);
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let lastSentMs = 0;
    let inFlight = false;

    setStatus({ ...OFF, catId, state: 'starting' });

    const report = async (loc: Location.LocationObject) => {
      // iOS ignores timeInterval, so throttle here as well.
      if (inFlight || Date.now() - lastSentMs < intervalS * 1000 - 500) return;
      inFlight = true;
      lastSentMs = Date.now();
      try {
        const level = await Battery.getBatteryLevelAsync().catch(() => -1);
        const result = await backend.reportLocation(catId, {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracyM: Math.max(0, loc.coords.accuracy ?? 50),
          batteryPct: level >= 0 ? Math.round(level * 100) : null,
          at: new Date(loc.timestamp).toISOString(),
        });
        if (cancelled) return;
        setStatus((s) => ({
          ...s,
          state: 'tracking',
          sent: result === 'ok' ? s.sent + 1 : s.sent,
          lastResult: result,
          lastSentAt: new Date().toISOString(),
          lastAccuracyM: loc.coords.accuracy ?? null,
          error: null,
        }));
      } catch (e) {
        if (!cancelled) setStatus((s) => ({ ...s, state: 'error', error: e instanceof Error ? e.message : String(e) }));
      } finally {
        inFlight = false;
      }
    };

    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== 'granted') {
          setStatus({ ...OFF, catId, state: 'denied', error: 'Location permission was not granted.' });
          return;
        }
        await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: intervalS * 1000, distanceInterval: 0 },
          (loc) => void report(loc),
        );
        if (cancelled) subscription.remove();
        else setStatus((s) => ({ ...s, state: s.state === 'starting' ? 'tracking' : s.state }));
      } catch (e) {
        if (!cancelled) setStatus({ ...OFF, catId, state: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [backend, catId, intervalS]);

  return status;
}
