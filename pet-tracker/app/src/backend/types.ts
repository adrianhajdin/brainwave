/**
 * One interface, two implementations:
 *  - DemoBackend: runs entirely on the phone (simulated cats + this phone's GPS)
 *  - SupabaseBackend: the real stack (cloud/supabase/migrations)
 *
 * Feature set mirrors what REA recovered from Traccar's web app: a live
 * device/position channel, device list + map, events (geofence enter/exit),
 * route replay, and a client that reports positions for a device ("emulator").
 */

export type TrackerKind = 'collar' | 'phone';

export interface Cat {
  id: string;
  name: string;
  color: string;
  kind: TrackerKind;
  lastLat: number | null;
  lastLng: number | null;
  lastAccuracyM: number | null;
  lastBatteryPct: number | null;
  lastFixAt: string | null; // ISO
}

export interface TrackPoint {
  at: string; // ISO
  lat: number;
  lng: number;
  accuracyM: number;
  batteryPct: number;
}

export interface HomeZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
}

export interface CatEvent {
  id: string;
  catId: string;
  transition: 'enter' | 'exit';
  zoneName: string;
  at: string; // ISO
}

export interface PhoneFix {
  lat: number;
  lng: number;
  accuracyM: number;
  batteryPct: number | null;
  at: string; // ISO
}

export type ReportResult = 'ok' | 'duplicate' | 'rate_limited' | 'rejected';

export interface LiveHandlers {
  onCat: (cat: Cat) => void;
  onCatRemoved?: (id: string) => void;
  onEvent?: (event: CatEvent) => void;
}

export interface Backend {
  readonly mode: 'demo' | 'supabase';
  readonly userLabel: string;

  listCats(): Promise<Cat[]>;
  /** Live updates (Supabase Realtime / demo simulation). Returns unsubscribe. */
  subscribe(handlers: LiveHandlers): () => void;

  addPhoneCat(name: string, color: string): Promise<string>;
  claimCollar(deviceUid: string, claimCode: string): Promise<string>;
  renameCat(id: string, name: string, color: string): Promise<void>;
  removeCat(id: string): Promise<void>;

  /** "This phone is the cat's tracker": report one fix. */
  reportLocation(catId: string, fix: PhoneFix): Promise<ReportResult>;

  getTrack(catId: string, sinceIso: string): Promise<TrackPoint[]>;
  getZones(catId: string): Promise<HomeZone[]>;
  addZone(catId: string, name: string, lat: number, lng: number, radiusM: number): Promise<void>;
  removeZone(zoneId: string): Promise<void>;
  getEvents(catId: string): Promise<CatEvent[]>;

  signOut(): Promise<void>;
}

export const CAT_COLORS = ['#F59E0B', '#EF4444', '#6366F1', '#10B981', '#EC4899', '#0EA5E9'] as const;
