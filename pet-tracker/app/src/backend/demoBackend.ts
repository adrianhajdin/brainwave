/**
 * Demo backend: no account, no server. Two simulated cats wander around, and
 * any cat you mark as "tracked by this phone" follows the phone's real GPS.
 * Zone alerts, heatmap and activity use the same rules as the database.
 */
import { binHeatmap, estimateActivity, insideZone, offset } from '../geo';
import {
  DEFAULT_NIGHT,
  type ActivityDay,
  type Backend,
  type Cat,
  type CatEvent,
  type HeatCell,
  type HomeZone,
  type CatSitter,
  type Household,
  type InviteResult,
  type LiveHandlers,
  type NightWatch,
  type PhoneFix,
  type ReportResult,
  type TrackPoint,
} from './types';

const DEFAULT_CENTER = { lat: 52.3676, lng: 4.9041 }; // Amsterdam, until the phone reports
const SIM_TICK_MS = 4000;
const MAX_TRACK = 4000;
const DEMO_USER = 'demo-user';
const DEMO_HOUSEHOLD = 'demo-household';
const NEEDS_ACCOUNT = 'Sharing needs an account. Exit the demo and sign in to invite people.';

let nextId = 1;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(nextId++).toString(36)}`;

interface SimState {
  heading: number;
  napUntil: number;
}

export class DemoBackend implements Backend {
  readonly mode = 'demo' as const;
  readonly userId = DEMO_USER;
  readonly userLabel = 'Demo mode';

  #cats = new Map<string, Cat>();
  #tracks = new Map<string, TrackPoint[]>();
  #zones = new Map<string, HomeZone[]>(); // key: catId or '*' for all cats
  #zoneState = new Map<string, boolean>(); // `${catId}:${zoneId}`
  #events: CatEvent[] = [];
  #sim = new Map<string, SimState>();
  #listeners = new Set<LiveHandlers>();
  #timer: ReturnType<typeof setInterval> | null = null;
  #center = { ...DEFAULT_CENTER };
  #centered = false;
  /** In-memory households, so moving cats around can be tried without an account. */
  #households = new Map<string, { id: string; name: string }>([[DEMO_HOUSEHOLD, { id: DEMO_HOUSEHOLD, name: 'Demo household' }]]);

  constructor() {
    this.#seed('Tijger', '#6366F1', 180, 40);
    this.#seed('Pluis', '#EC4899', 320, 210);
  }

  #newCat(name: string, color: string, kind: Cat['kind']): Cat {
    return {
      id: newId(kind === 'phone' ? 'ph' : 'sim'),
      name, color, kind, ownerId: DEMO_USER,
      lastLat: null, lastLng: null, lastAccuracyM: null, lastBatteryPct: null, lastFixAt: null,
      lostMode: false, lostModeSince: null, night: { ...DEFAULT_NIGHT }, photoPath: null,
      householdId: DEMO_HOUSEHOLD, householdName: 'Demo household', access: 'owner', sitterUntil: null,
    };
  }

  #seed(name: string, color: string, distance: number, bearing: number) {
    const cat = this.#newCat(name, color, 'collar');
    const p = offset(this.#center.lat, this.#center.lng, distance, bearing);
    Object.assign(cat, {
      lastLat: p.lat, lastLng: p.lng, lastAccuracyM: 8,
      lastBatteryPct: 64 + Math.round(Math.random() * 30), lastFixAt: new Date().toISOString(),
    });
    this.#cats.set(cat.id, cat);
    this.#sim.set(cat.id, { heading: Math.random() * 360, napUntil: 0 });

    // Three days of history, so route, heatmap and activity have content:
    // naps at a few favourite spots, short strolls, a longer night walk.
    const spots = [0, 1, 2].map((i) => offset(p.lat, p.lng, 60 + i * 70, bearing + i * 110));
    const pts: TrackPoint[] = [];
    const now = Date.now();
    for (let m = 3 * 24 * 60; m > 0; m -= 15) {
      const at = now - m * 60_000;
      const hour = new Date(at).getHours();
      const night = hour >= 21 || hour < 6;
      const spot = spots[Math.floor((m / 180) % spots.length)]!;
      const wander = night ? 40 + Math.random() * 160 : Math.random() < 0.7 ? Math.random() * 8 : 20 + Math.random() * 60;
      const q = offset(spot.lat, spot.lng, wander, Math.random() * 360);
      pts.push({ at: new Date(at).toISOString(), lat: q.lat, lng: q.lng, accuracyM: 6 + Math.random() * 10, batteryPct: 80 });
    }
    this.#tracks.set(cat.id, pts);
  }

  /** Re-anchor the simulated cats near the phone the first time it reports. */
  #recenter(lat: number, lng: number) {
    if (this.#centered) return;
    this.#centered = true;
    const dLat = lat - this.#center.lat;
    const dLng = lng - this.#center.lng;
    this.#center = { lat, lng };
    for (const [id, cat] of this.#cats) {
      if (!this.#sim.has(id) || cat.lastLat === null || cat.lastLng === null) continue;
      cat.lastLat += dLat;
      cat.lastLng += dLng;
      this.#tracks.set(id, (this.#tracks.get(id) ?? []).map((p) => ({ ...p, lat: p.lat + dLat, lng: p.lng + dLng })));
      this.#emitCat(cat);
    }
  }

  #emitCat(cat: Cat) {
    for (const l of this.#listeners) l.onCat({ ...cat, night: { ...cat.night } });
  }

  #zonesFor(catId: string): HomeZone[] {
    return [...(this.#zones.get('*') ?? []), ...(this.#zones.get(catId) ?? [])];
  }

  #record(cat: Cat, point: TrackPoint) {
    const track = this.#tracks.get(cat.id) ?? [];
    track.push(point);
    if (track.length > MAX_TRACK) track.splice(0, track.length - MAX_TRACK);
    this.#tracks.set(cat.id, track);

    Object.assign(cat, {
      lastLat: point.lat, lastLng: point.lng, lastAccuracyM: point.accuracyM,
      lastBatteryPct: point.batteryPct, lastFixAt: point.at,
    });
    this.#emitCat(cat);

    for (const zone of this.#zonesFor(cat.id)) {
      const key = `${cat.id}:${zone.id}`;
      const was = this.#zoneState.has(key) ? this.#zoneState.get(key)! : null;
      const now = insideZone(zone, point, was);
      this.#zoneState.set(key, now);
      if (was !== null && was !== now) {
        const ev: CatEvent = { id: newId('ev'), catId: cat.id, transition: now ? 'enter' : 'exit', zoneName: zone.name, at: point.at };
        this.#events.unshift(ev);
        for (const l of this.#listeners) l.onEvent?.(ev);
      }
    }
  }

  #tick = () => {
    const now = Date.now();
    for (const [id, s] of this.#sim) {
      const cat = this.#cats.get(id);
      if (!cat || cat.lastLat === null || cat.lastLng === null) continue;
      if (now < s.napUntil && !cat.lostMode) continue; // cats sleep a lot
      if (Math.random() < 0.08 && !cat.lostMode) {
        s.napUntil = now + 20_000 + Math.random() * 40_000;
        continue;
      }
      // Wander, but drift back home when far away.
      const homeBearing = (Math.atan2(this.#center.lng - cat.lastLng, this.#center.lat - cat.lastLat) * 180) / Math.PI;
      const far = Math.hypot(this.#center.lat - cat.lastLat, this.#center.lng - cat.lastLng) > 0.004;
      s.heading = far ? homeBearing + (Math.random() - 0.5) * 40 : s.heading + (Math.random() - 0.5) * 70;
      const p = offset(cat.lastLat, cat.lastLng, 3 + Math.random() * 9, s.heading);
      this.#record(cat, {
        at: new Date().toISOString(), lat: p.lat, lng: p.lng,
        accuracyM: 5 + Math.random() * 10,
        batteryPct: Math.max(5, (cat.lastBatteryPct ?? 90) - (Math.random() < 0.02 ? 1 : 0)),
      });
    }
  };

  async listCats(): Promise<Cat[]> {
    return [...this.#cats.values()].map((c) => ({ ...c, night: { ...c.night } }));
  }

  subscribe(handlers: LiveHandlers): () => void {
    this.#listeners.add(handlers);
    if (!this.#timer) this.#timer = setInterval(this.#tick, SIM_TICK_MS);
    return () => {
      this.#listeners.delete(handlers);
      if (this.#listeners.size === 0 && this.#timer) {
        clearInterval(this.#timer);
        this.#timer = null;
      }
    };
  }

  async addPhoneCat(name: string, color: string): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 64) throw new Error('Name must be 1-64 characters');
    const cat = this.#newCat(trimmed, color, 'phone');
    this.#cats.set(cat.id, cat);
    this.#emitCat(cat);
    return cat.id;
  }

  async claimCollar(): Promise<string> {
    throw new Error('Collars can only be claimed when connected to the real backend.');
  }

  #cat(id: string): Cat {
    const cat = this.#cats.get(id);
    if (!cat) throw new Error('Cat not found');
    return cat;
  }

  async updateCat(id: string, changes: { name?: string; color?: string }): Promise<void> {
    const cat = this.#cat(id);
    if (changes.name !== undefined) cat.name = changes.name.trim();
    if (changes.color !== undefined) cat.color = changes.color;
    this.#emitCat(cat);
  }

  async removeCat(id: string): Promise<void> {
    this.#cats.delete(id);
    this.#tracks.delete(id);
    this.#zones.delete(id);
    this.#sim.delete(id);
    for (const l of this.#listeners) l.onCatRemoved?.(id);
  }

  async setPhoto(catId: string, localUri: string): Promise<void> {
    const cat = this.#cat(catId);
    cat.photoPath = localUri;
    this.#emitCat(cat);
  }

  async removePhoto(catId: string): Promise<void> {
    const cat = this.#cat(catId);
    cat.photoPath = null;
    this.#emitCat(cat);
  }

  async photoUrl(path: string): Promise<string | null> {
    return path;
  }

  async setLostMode(catId: string, on: boolean): Promise<void> {
    const cat = this.#cat(catId);
    cat.lostMode = on;
    cat.lostModeSince = on ? new Date().toISOString() : null;
    this.#emitCat(cat);
  }

  async setNightWatch(catId: string, night: NightWatch): Promise<void> {
    const cat = this.#cat(catId);
    cat.night = { ...night };
    this.#emitCat(cat);
  }

  async reportLocation(catId: string, fix: PhoneFix): Promise<ReportResult> {
    const cat = this.#cats.get(catId);
    if (!cat || cat.kind !== 'phone') return 'rejected';
    this.#recenter(fix.lat, fix.lng);
    this.#record(cat, {
      at: fix.at, lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM,
      batteryPct: fix.batteryPct ?? cat.lastBatteryPct ?? 100,
    });
    return 'ok';
  }

  async getTrack(catId: string, sinceIso: string): Promise<TrackPoint[]> {
    const since = Date.parse(sinceIso);
    return (this.#tracks.get(catId) ?? []).filter((p) => Date.parse(p.at) >= since);
  }

  async getHeatmap(catId: string, sinceIso: string): Promise<HeatCell[]> {
    return binHeatmap(await this.getTrack(catId, sinceIso));
  }

  async getActivity(catId: string, days: number): Promise<ActivityDay[]> {
    const cat = this.#cat(catId);
    const track = await this.getTrack(catId, new Date(Date.now() - days * 86_400_000).toISOString());
    const home = this.#zonesFor(catId)[0] ?? null;
    return estimateActivity(track, { nightStartMin: cat.night.startMin, nightEndMin: cat.night.endMin, home });
  }

  async getZones(catId: string): Promise<HomeZone[]> {
    return this.#zonesFor(catId);
  }

  async addZone(catId: string | null, name: string, lat: number, lng: number, radiusM: number): Promise<void> {
    const key = catId ?? '*';
    const zone: HomeZone = { id: newId('zone'), name: name.trim() || 'Home', lat, lng, radiusM, allCats: catId === null };
    this.#zones.set(key, [...(this.#zones.get(key) ?? []), zone]);
    // Start from each cat's current side of the fence so the first exit alerts.
    const cats = catId ? [this.#cat(catId)] : [...this.#cats.values()];
    for (const cat of cats) {
      if (cat.lastLat != null && cat.lastLng != null) {
        this.#zoneState.set(`${cat.id}:${zone.id}`, insideZone(zone, { lat: cat.lastLat, lng: cat.lastLng, accuracyM: cat.lastAccuracyM ?? 0 }, null));
      }
    }
  }

  async removeZone(zoneId: string): Promise<void> {
    for (const [key, zones] of this.#zones) {
      this.#zones.set(key, zones.filter((z) => z.id !== zoneId));
    }
  }

  async getEvents(catId: string): Promise<CatEvent[]> {
    return this.#events.filter((e) => e.catId === catId).slice(0, 50);
  }

  async listHouseholds(): Promise<Household[]> {
    return [...this.#households.values()].map((h) => ({
      id: h.id,
      name: h.name,
      myRole: 'admin',
      members: [{ userId: DEMO_USER, email: 'demo@cat-tracker.app', role: 'admin' }],
      catCount: [...this.#cats.values()].filter((c) => c.householdId === h.id).length,
    }));
  }
  async createHousehold(name: string): Promise<string> {
    const id = newId('hh');
    this.#households.set(id, { id, name: name.trim() || 'Household' });
    return id;
  }
  async renameHousehold(householdId: string, name: string): Promise<void> {
    const h = this.#households.get(householdId);
    if (!h) return;
    h.name = name.trim() || h.name;
    for (const cat of this.#cats.values()) {
      if (cat.householdId === householdId) {
        cat.householdName = h.name;
        this.#emitCat(cat);
      }
    }
  }
  async deleteHousehold(householdId: string): Promise<void> {
    this.#households.delete(householdId);
    for (const cat of this.#cats.values()) {
      if (cat.householdId === householdId) await this.setCatHousehold(cat.id, null);
    }
  }
  async createHouseholdInvite(): Promise<string> {
    throw new Error(NEEDS_ACCOUNT);
  }
  async removeMember(): Promise<void> {}
  async leaveHousehold(householdId: string): Promise<void> {
    await this.deleteHousehold(householdId);
  }
  async setCatHousehold(catId: string, householdId: string | null): Promise<void> {
    const cat = this.#cats.get(catId);
    if (!cat) return;
    cat.householdId = householdId;
    cat.householdName = householdId ? this.#households.get(householdId)?.name ?? null : null;
    this.#emitCat(cat);
  }
  async createSitterInvite(): Promise<string> {
    throw new Error(NEEDS_ACCOUNT);
  }
  async listCatSitters(): Promise<CatSitter[]> {
    return [];
  }
  async removeCatSitter(): Promise<void> {}
  async acceptInvite(): Promise<InviteResult> {
    throw new Error(NEEDS_ACCOUNT);
  }
  async registerPushToken(): Promise<void> {}
  async unregisterPushToken(): Promise<void> {}
  async deleteAccount(): Promise<void> {
    await this.signOut();
  }

  async signOut(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    this.#listeners.clear();
  }
}
