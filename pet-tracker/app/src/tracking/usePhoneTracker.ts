/**
 * "This phone is <cat>'s tracker" - the mobile equivalent of Traccar's
 * emulator page: the phone reports its own GPS as if it were the collar.
 *
 * - Development/store build + "Allow all the time": background task
 *   (keeps working with the screen off, Android shows a notification).
 * - Expo Go or "While using the app": foreground watch, screen kept awake.
 */
import * as Battery from 'expo-battery';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { Backend, ReportResult } from '../backend/types';
import { onBackgroundReport, startBackgroundTracking, stopBackgroundTracking } from './background';

export type TrackerState = 'off' | 'starting' | 'tracking' | 'denied' | 'error';

export interface TrackerStatus {
  catId: string | null;
  state: TrackerState;
  /** 'background' keeps running with the screen off. */
  mode: 'background' | 'foreground' | null;
  intervalS: number | null;
  sent: number;
  lastResult: ReportResult | null;
  lastSentAt: string | null;
  lastAccuracyM: number | null;
  error: string | null;
}

const OFF: TrackerStatus = {
  catId: null, state: 'off', mode: null, intervalS: null, sent: 0,
  lastResult: null, lastSentAt: null, lastAccuracyM: null, error: null,
};

const KEEP_AWAKE_TAG = 'cat-tracker';

export function usePhoneTracker(
  backend: Backend | null,
  cat: { id: string; name: string } | null,
  intervalS: number,
): TrackerStatus {
  const [status, setStatus] = useState<TrackerStatus>(OFF);
  const catId = cat?.id ?? null;
  const catName = cat?.name ?? 'your cat';

  useEffect(() => {
    if (!backend || !catId) {
      setStatus(OFF);
      void stopBackgroundTracking();
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let unlistenBg: (() => void) | null = null;
    let lastSentMs = 0;
    let inFlight = false;
    let keptAwake = false;

    // Only release a wake lock this effect actually took (the web version throws otherwise).
    const releaseKeepAwake = () => {
      if (!keptAwake) return;
      keptAwake = false;
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };

    setStatus({ ...OFF, catId, state: 'starting', intervalS });

    const reportForeground = async (loc: Location.LocationObject) => {
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
        // Background only makes sense against the real backend.
        if (backend.mode === 'supabase') {
          const bg = await startBackgroundTracking(catId, catName, intervalS);
          if (cancelled) return;
          if (bg === 'denied') {
            setStatus({ ...OFF, catId, state: 'denied', error: 'Location permission was not granted.' });
            return;
          }
          if (bg === 'started') {
            unlistenBg = onBackgroundReport((r) =>
              setStatus((s) => ({
                ...s,
                state: r.error ? 'error' : 'tracking',
                sent: r.ok ? s.sent + 1 : s.sent,
                lastResult: r.ok ? 'ok' : s.lastResult,
                lastSentAt: r.at,
                lastAccuracyM: r.accuracyM,
                error: r.error ?? null,
              })),
            );
            setStatus((s) => ({ ...s, state: 'tracking', mode: 'background' }));
            return;
          }
        }

        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== 'granted') {
          setStatus({ ...OFF, catId, state: 'denied', error: 'Location permission was not granted.' });
          return;
        }
        await activateKeepAwakeAsync(KEEP_AWAKE_TAG)
          .then(() => {
            keptAwake = true;
          })
          .catch(() => undefined);
        if (cancelled) return releaseKeepAwake();
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: intervalS * 1000, distanceInterval: 0 },
          (loc) => void reportForeground(loc),
        );
        if (cancelled) subscription.remove();
        else setStatus((s) => ({ ...s, mode: 'foreground', state: s.state === 'starting' ? 'tracking' : s.state }));
      } catch (e) {
        if (!cancelled) setStatus({ ...OFF, catId, state: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      unlistenBg?.();
      releaseKeepAwake();
    };
  }, [backend, catId, catName, intervalS]);

  return status;
}
