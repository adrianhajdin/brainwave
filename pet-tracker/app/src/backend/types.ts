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

/** How the signed-in person can see a cat. */
export type CatAccess = 'owner' | 'household' | 'sitter';

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
  /** Household the cat belongs to (null: private to its owner). */
  householdId: string | null;
  householdName: string | null;
  access: CatAccess;
  /** For a cat sitter: when access ends (null: until the owner stops it). */
  sitterUntil: string | null;
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

export type HouseholdRole = 'admin' | 'member';

export interface HouseholdMember {
  userId: string;
  email: string;
  role: HouseholdRole;
}

/** A group of people who all see the cats in it (e.g. "Home"). */
export interface Household {
  id: string;
  name: string;
  myRole: HouseholdRole;
  members: HouseholdMember[];
  catCount: number;
}

/** Someone following one cat without being in its household. */
export interface CatSitter {
  userId: string;
  email: string;
  /** ISO; null = until the owner stops it */
  until: string | null;
}

export interface InviteResult {
  kind: 'household' | 'sitter';
  /** Household name, or the cat's name for a sitter invite. */
  name: string;
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

  // Households: several per person; each cat is in one or private.
  listHouseholds(): Promise<Household[]>;
  createHousehold(name: string): Promise<string>;
  renameHousehold(householdId: string, name: string): Promise<void>;
  deleteHousehold(householdId: string): Promise<void>;
  createHouseholdInvite(householdId: string): Promise<string>;
  removeMember(householdId: string, userId: string): Promise<void>;
  leaveHousehold(householdId: string): Promise<void>;
  /** householdId null: the cat becomes private. Owner only. */
  setCatHousehold(catId: string, householdId: string | null): Promise<void>;

  // Cat sitters: follow one cat, optionally until a date.
  createSitterInvite(catId: string, untilIso: string | null): Promise<string>;
  listCatSitters(catId: string): Promise<CatSitter[]>;
  /** The owner removes a sitter, or a sitter (userId = self) stops. */
  removeCatSitter(catId: string, userId: string): Promise<void>;

  /** Accepts a household or a cat-sitter code. */
  acceptInvite(code: string): Promise<InviteResult>;

  // Notifications + account
  registerPushToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<void>;
  unregisterPushToken(token: string): Promise<void>;
  deleteAccount(): Promise<void>;
  signOut(): Promise<void>;
}

export const CAT_COLORS = ['#F59E0B', '#EF4444', '#6366F1', '#10B981', '#EC4899', '#0EA5E9'] as const;

export const DEFAULT_NIGHT: NightWatch = { enabled: false, startMin: 21 * 60, endMin: 7 * 60, intervalS: 300 };

export const isOwner = (cat: Cat, backend: Backend) => cat.ownerId === null || cat.ownerId === backend.userId;
