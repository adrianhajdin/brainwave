/**
 * One interface, two implementations:
 *  - DemoBackend: runs entirely on the phone (simulated cats + this phone's GPS)
 *  - SupabaseBackend: the real stack (cloud/supabase/migrations)
 *
 * Feature set mirrors what REA recovered from Traccar's web app (live channel,
 * device list + map, events, route replay, client-reported positions) plus the
 * cat-specific parts: households, lost mode, night watch, heatmap, activity.
 */

export type TrackerKind = 'collar' | 'phone';

export interface NightWatch {
  enabled: boolean;
  startMin: number; // local minutes after midnight, e.g. 21:00 = 1260
  endMin: number;
  intervalS: number;
}

export interface Cat {
  id: string;
  name: string;
  color: string;
  kind: TrackerKind;
  ownerId: string | null;
  lastLat: number | null;
  lastLng: number | null;
  lastAccuracyM: number | null;
  lastBatteryPct: number | null;
  lastFixAt: string | null; // ISO
  lostMode: boolean;
  lostModeSince: string | null;
  night: NightWatch;
  photoPath: string | null;
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
  /** Zone applies to every cat of the household. */
  allCats: boolean;
}

export interface CatEvent {
  id: string;
  catId: string;
  transition: 'enter' | 'exit';
  zoneName: string;
  at: string; // ISO
}

export interface HeatCell {
  lat: number;
  lng: number;
  /** seconds spent in this ~25 m cell */
  weightS: number;
}

export interface ActivityDay {
  day: string; // YYYY-MM-DD (cat's local time)
  distanceM: number;
  activeMinutes: number;
  roamRadiusM: number | null;
  nightShare: number | null;
  fixes: number;
}

export interface HouseholdPerson {
  userId: string;
  email: string;
  /** 'member' = someone in my household; 'owner' = a household I joined */
  role: 'member' | 'owner';
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
  readonly userId: string;
  readonly userLabel: string;

  listCats(): Promise<Cat[]>;
  /** Live updates (Supabase Realtime / demo simulation). Returns unsubscribe. */
  subscribe(handlers: LiveHandlers): () => void;

  addPhoneCat(name: string, color: string): Promise<string>;
  claimCollar(deviceUid: string, claimCode: string): Promise<string>;
  updateCat(id: string, changes: { name?: string; color?: string }): Promise<void>;
  removeCat(id: string): Promise<void>;

  /** Upload a local image (already resized) as the cat's profile photo. */
  setPhoto(catId: string, localUri: string): Promise<void>;
  removePhoto(catId: string): Promise<void>;
  /** Resolve a stored photo path to a displayable URL (signed, cached). */
  photoUrl(path: string): Promise<string | null>;

  setLostMode(catId: string, on: boolean): Promise<void>;
  setNightWatch(catId: string, night: NightWatch, timezone: string): Promise<void>;

  /** "This phone is the cat's tracker": report one fix. */
  reportLocation(catId: string, fix: PhoneFix): Promise<ReportResult>;

  getTrack(catId: string, sinceIso: string): Promise<TrackPoint[]>;
  getHeatmap(catId: string, sinceIso: string): Promise<HeatCell[]>;
  getActivity(catId: string, days: number): Promise<ActivityDay[]>;

  getZones(catId: string): Promise<HomeZone[]>;
  /** catId = null: zone for all cats of the household. */
  addZone(catId: string | null, name: string, lat: number, lng: number, radiusM: number): Promise<void>;
  removeZone(zoneId: string): Promise<void>;
  getEvents(catId: string): Promise<CatEvent[]>;

  // Household sharing
  createInvite(): Promise<string>;
  acceptInvite(code: string): Promise<void>;
  listHousehold(): Promise<HouseholdPerson[]>;
  removeMember(userId: string): Promise<void>;
  leaveHousehold(ownerId: string): Promise<void>;

  // Notifications + account
  registerPushToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<void>;
  unregisterPushToken(token: string): Promise<void>;
  deleteAccount(): Promise<void>;
  signOut(): Promise<void>;
}

export const CAT_COLORS = ['#F59E0B', '#EF4444', '#6366F1', '#10B981', '#EC4899', '#0EA5E9'] as const;

export const DEFAULT_NIGHT: NightWatch = { enabled: false, startMin: 21 * 60, endMin: 7 * 60, intervalS: 300 };

export const isOwner = (cat: Cat, backend: Backend) => cat.ownerId === null || cat.ownerId === backend.userId;
