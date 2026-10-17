/**
 * App-wide state: which backend (demo / Supabase), the live cat list, the
 * latest geofence alert, push registration and the phone-tracker session
 * (which survives navigation because it lives here, not in a screen).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DemoBackend } from './backend/demoBackend';
import { SupabaseBackend } from './backend/supabaseBackend';
import { supabase } from './backend/supabaseClient';
import type { Backend, Cat, CatEvent } from './backend/types';
import { inNightWindow } from './geo';
import { onNotificationOpened, registerForPush, type PushStatus } from './notifications/push';
import { usePhoneTracker, type TrackerStatus } from './tracking/usePhoneTracker';

export const REPORT_INTERVALS = [
  { seconds: 15, label: '15 s', hint: 'quick testing' },
  { seconds: 60, label: '1 min', hint: 'walk test' },
  { seconds: 900, label: '15 min', hint: 'like the collar' },
] as const;

export const LOST_MODE_INTERVAL_S = 15;

interface AppState {
  ready: boolean;
  backend: Backend | null;
  supabaseConfigured: boolean;
  cats: Cat[];
  /** When the cat list was last fetched successfully (ms since epoch). */
  lastSyncAt: number | null;
  /** The last fetch failed, so positions on screen may be out of date. */
  syncFailed: boolean;
  alert: CatEvent | null;
  dismissAlert: () => void;
  startDemo: () => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  upsertCat: (cat: Cat) => void;
  removeCatLocal: (id: string) => void;
  tracker: TrackerStatus;
  trackedCatId: string | null;
  setTrackedCatId: (id: string | null) => void;
  intervalS: number;
  setIntervalS: (s: number) => void;
  /** Interval actually used now (lost mode / night watch can shorten it). */
  effectiveIntervalS: number;
  push: { status: PushStatus | 'pending'; error?: string };
  /** Asks for notification permission (call only after the user agreed in Settings). */
  enablePush: () => Promise<void>;
  /** Cat to open after tapping a notification (consumed by the home screen). */
  openCatRequest: string | null;
  clearOpenCatRequest: () => void;
}

const Ctx = createContext<AppState | null>(null);

const TRACKED_KEY = 'tracker.catId';
const INTERVAL_KEY = 'tracker.intervalS';

const minuteOfDay = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [backend, setBackend] = useState<Backend | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [alert, setAlert] = useState<CatEvent | null>(null);
  const [trackedCatId, setTrackedCatIdState] = useState<string | null>(null);
  const [intervalS, setIntervalSState] = useState<number>(15);
  const [push, setPush] = useState<AppState['push']>({ status: 'pending' });
  const [openCatRequest, setOpenCatRequest] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);
  const [clock, setClock] = useState(minuteOfDay());

  // Re-evaluate the night window every minute.
  useEffect(() => {
    const t = setInterval(() => setClock(minuteOfDay()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Restore an existing Supabase session and follow auth changes.
  useEffect(() => {
    void AsyncStorage.getItem(INTERVAL_KEY).then((v) => v && setIntervalSState(Number(v) || 15));
    if (!supabase) {
      setReady(true);
      return;
    }
    const client = supabase;
    void client.auth.getSession().then(({ data }) => {
      if (data.session) setBackend(new SupabaseBackend(client, data.session.user.id, data.session.user.email));
      setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        setBackend((b) =>
          b?.mode === 'supabase' && b.userId === session.user.id ? b : new SupabaseBackend(client, session.user.id, session.user.email),
        );
      }
      if (event === 'SIGNED_OUT') setBackend((b) => (b?.mode === 'supabase' ? null : b));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Restore which cat this phone was tracking (real backend only: demo cats
  // are re-created on every launch).
  useEffect(() => {
    if (!backend) {
      setTrackedCatIdState(null);
      return;
    }
    void AsyncStorage.getItem(`${TRACKED_KEY}.${backend.mode}`).then((id) => {
      if (backend.mode === 'supabase') setTrackedCatIdState(id);
    });
  }, [backend]);

  // Push notifications: register this device if it already has permission
  // (no system prompt here) and route taps to the cat.
  useEffect(() => {
    if (!backend) return;
    let active = true;
    void registerForPush(backend, { ask: false }).then((r) => active && setPush({ status: r.status, error: r.error }));
    const unsubscribe = onNotificationOpened((catId) => setOpenCatRequest(catId));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [backend]);

  const enablePush = useCallback(async () => {
    if (!backend) return;
    const r = await registerForPush(backend, { ask: true });
    setPush({ status: r.status, error: r.error });
  }, [backend]);

  const upsertCat = useCallback((cat: Cat) => {
    setCats((prev) => {
      const i = prev.findIndex((c) => c.id === cat.id);
      if (i === -1) return [...prev, cat];
      const next = prev.slice();
      next[i] = cat;
      return next;
    });
  }, []);

  const removeCatLocal = useCallback((id: string) => {
    setCats((prev) => prev.filter((c) => c.id !== id));
    setTrackedCatIdState((t) => (t === id ? null : t));
  }, []);

  const refresh = useCallback(async () => {
    if (backend) setCats(await backend.listCats());
  }, [backend]);

  // Snapshot + live channel, re-synced on reconnect like Traccar's
  // SocketController (REST snapshot, then push updates). The snapshot is
  // re-fetched every minute so a dropped connection shows up as "not synced".
  useEffect(() => {
    if (!backend) {
      setCats([]);
      setLastSyncAt(null);
      setSyncFailed(false);
      return;
    }
    let active = true;
    const sync = () =>
      backend
        .listCats()
        .then((list) => {
          if (!active) return;
          setCats(list);
          setLastSyncAt(Date.now());
          setSyncFailed(false);
        })
        .catch(() => active && setSyncFailed(true));
    void sync();
    const poll = setInterval(() => void sync(), 60_000);
    const unsubscribe = backend.subscribe({
      onCat: upsertCat,
      onCatRemoved: removeCatLocal,
      onEvent: (ev) => setAlert(ev),
    });
    return () => {
      active = false;
      clearInterval(poll);
      unsubscribe();
    };
  }, [backend, upsertCat, removeCatLocal]);

  const trackedCat = cats.find((c) => c.id === trackedCatId) ?? null;
  const effectiveIntervalS = trackedCat?.lostMode
    ? LOST_MODE_INTERVAL_S
    : trackedCat?.night.enabled && inNightWindow(clock, trackedCat.night.startMin, trackedCat.night.endMin)
      ? Math.min(intervalS, trackedCat.night.intervalS)
      : intervalS;

  const tracker = usePhoneTracker(
    backend,
    trackedCatId ? { id: trackedCatId, name: trackedCat?.name ?? 'your cat' } : null,
    effectiveIntervalS,
  );

  const setTrackedCatId = useCallback(
    (id: string | null) => {
      setTrackedCatIdState(id);
      if (backend) {
        const key = `${TRACKED_KEY}.${backend.mode}`;
        void (id ? AsyncStorage.setItem(key, id) : AsyncStorage.removeItem(key));
      }
    },
    [backend],
  );

  const setIntervalS = useCallback((s: number) => {
    setIntervalSState(s);
    void AsyncStorage.setItem(INTERVAL_KEY, String(s));
  }, []);

  const dismissAlert = useCallback(() => setAlert(null), []);

  const value = useMemo<AppState>(
    () => ({
      ready,
      backend,
      supabaseConfigured: supabase !== null,
      cats,
      lastSyncAt,
      syncFailed,
      alert,
      dismissAlert,
      startDemo: () => setBackend(new DemoBackend()),
      signOut: async () => {
        setTrackedCatIdState(null);
        await backend?.signOut();
        setBackend(null);
      },
      refresh,
      upsertCat,
      removeCatLocal,
      tracker,
      trackedCatId,
      setTrackedCatId,
      intervalS,
      setIntervalS,
      effectiveIntervalS,
      push,
      enablePush,
      openCatRequest,
      clearOpenCatRequest: () => setOpenCatRequest(null),
    }),
    [ready, backend, cats, lastSyncAt, syncFailed, alert, dismissAlert, refresh, upsertCat, removeCatLocal, tracker, trackedCatId, setTrackedCatId, intervalS, setIntervalS, effectiveIntervalS, push, enablePush, openCatRequest],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
