/**
 * Demo backend: no account, no server. Two simulated cats wander around, and
 * any cat you mark as "tracked by this phone" follows the phone's real GPS.
 * Geofence enter/exit uses the same hysteresis rule as the database.
 */
import { insideZone, offset } from '../geo';
import type {
  Backend,
  Cat,
  CatEvent,
  HomeZone,
  LiveHandlers,
  PhoneFix,
  ReportResult,
  TrackPoint,
} from './types';

const DEFAULT_CENTER = { lat: 52.3676, lng: 4.9041 }; // Amsterdam, until the phone reports
const SIM_TICK_MS = 4000;
const MAX_TRACK = 2000;

let nextId = 1;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(nextId++).toString(36)}`;

interface SimState {
  heading: number;
  napUntil: number;
}

export class DemoBackend implements Backend {
  readonly mode = 'demo' as const;
  readonly userLabel = 'Demo mode';

  #cats = new Map<string, Cat>();
  #tracks = new Map<string, TrackPoint[]>();
  #zones = new Map<string, HomeZone[]>();
  #zoneState = new Map<string, boolean>(); // `${catId}:${zoneId}`
  #events: CatEvent[] = [];
  #sim = new Map<string, SimState>();
  #listeners = new Set<LiveHandlers>();
  #timer: ReturnType<typeof setInterval> | null = null;
  #center = { ...DEFAULT_CENTER };
  #centered = false;

  constructor() {
    this.#seed('Tijger', '#6366F1', 180, 40);
    this.#seed('Pluis', '#EC4899', 320, 210);
  }

  #seed(name: string, color: string, distance: number, bearing: number) {
    const id = newId('sim');
    const p = offset(this.#center.lat, this.#center.lng, distance, bearing);
    this.#cats.set(id, {
      id, name, color, kind: 'collar',
      lastLat: p.lat, lastLng: p.lng, lastAccuracyM: 8, lastBatteryPct: 64 + Math.round(Math.random() * 30),
      lastFixAt: new Date().toISOString(),
    });
    this.#sim.set(id, { heading: Math.random() * 360, napUntil: 0 });
    // Some history so route replay has something to show.
    const pts: TrackPoint[] = [];
    let q = offset(p.lat, p.lng, 260, bearing + 180);
    for (let i = 40; i > 0; i--) {
      q = offset(q.lat, q.lng, 6 + Math.random() * 8, bearing + Math.sin(i / 4) * 60);
      pts.push({ at: new Date(Date.now() - i * 60_000).toISOString(), lat: q.lat, lng: q.lng, accuracyM: 8, batteryPct: 80 });
    }
    this.#tracks.set(id, pts);
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
    for (const l of this.#listeners) l.onCat({ ...cat });
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

    for (const zone of this.#zones.get(cat.id) ?? []) {
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
      if (now < s.napUntil) continue; // cats sleep a lot
      if (Math.random() < 0.08) {
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
    return [...this.#cats.values()].map((c) => ({ ...c }));
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
    const id = newId('ph');
    const cat: Cat = {
      id, name: trimmed, color, kind: 'phone',
      lastLat: null, lastLng: null, lastAccuracyM: null, lastBatteryPct: null, lastFixAt: null,
    };
    this.#cats.set(id, cat);
    this.#emitCat(cat);
    return id;
  }

  async claimCollar(): Promise<string> {
    throw new Error('Collars can only be claimed when connected to the real backend.');
  }

  async renameCat(id: string, name: string, color: string): Promise<void> {
    const cat = this.#cats.get(id);
    if (!cat) throw new Error('Cat not found');
    Object.assign(cat, { name: name.trim(), color });
    this.#emitCat(cat);
  }

  async removeCat(id: string): Promise<void> {
    this.#cats.delete(id);
    this.#tracks.delete(id);
    this.#zones.delete(id);
    this.#sim.delete(id);
    for (const l of this.#listeners) l.onCatRemoved?.(id);
  }

  async reportLocation(catId: string, fix: PhoneFix): Promise<ReportResult> {
    const cat = this.#cats.get(catId);
    if (!cat || cat.kind !== 'phone') return 'rejected';
    this.#recenter(fix.lat, fix.lng);
    this.#record(cat, {
      at: fix.at, lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM,
      batteryPct: fix.batteryPct ?? cat.lastBatteryPct ?? 0,
    });
    return 'ok';
  }

  async getTrack(catId: string, sinceIso: string): Promise<TrackPoint[]> {
    const since = Date.parse(sinceIso);
    return (this.#tracks.get(catId) ?? []).filter((p) => Date.parse(p.at) >= since);
  }

  async getZones(catId: string): Promise<HomeZone[]> {
    return [...(this.#zones.get(catId) ?? [])];
  }

  async addZone(catId: string, name: string, lat: number, lng: number, radiusM: number): Promise<void> {
    const zones = this.#zones.get(catId) ?? [];
    const zone = { id: newId('zone'), name, lat, lng, radiusM };
    zones.push(zone);
    this.#zones.set(catId, zones);
    // Start from the cat's current side of the fence so the first exit alerts.
    const cat = this.#cats.get(catId);
    if (cat?.lastLat != null && cat.lastLng != null) {
      this.#zoneState.set(
        `${catId}:${zone.id}`,
        insideZone(zone, { lat: cat.lastLat, lng: cat.lastLng, accuracyM: cat.lastAccuracyM ?? 0 }, null),
      );
    }
  }

  async removeZone(zoneId: string): Promise<void> {
    for (const [catId, zones] of this.#zones) {
      this.#zones.set(catId, zones.filter((z) => z.id !== zoneId));
    }
  }

  async getEvents(catId: string): Promise<CatEvent[]> {
    return this.#events.filter((e) => e.catId === catId).slice(0, 50);
  }

  async signOut(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    this.#listeners.clear();
  }
}
