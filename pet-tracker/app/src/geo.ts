/** Small, dependency-free geo + time helpers (unit-tested in geo.test.ts). */

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Point reached from (lat, lng) after distanceM metres at bearingDeg. */
export function offset(lat: number, lng: number, distance: number, bearingDeg: number): { lat: number; lng: number } {
  const d = distance / EARTH_RADIUS_M;
  const b = toRad(bearingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(b));
  const λ2 = λ1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 };
}

/**
 * Same accuracy-aware hysteresis as public.ingest_telemetry(): a fix whose
 * uncertainty circle straddles the fence keeps the previous state.
 */
export function insideZone(
  zone: { lat: number; lng: number; radiusM: number },
  fix: { lat: number; lng: number; accuracyM: number },
  wasInside: boolean | null,
): boolean {
  const d = distanceM(zone.lat, zone.lng, fix.lat, fix.lng);
  if (d <= zone.radiusM) return true;
  if (d - zone.radiusM > Math.max(fix.accuracyM, 25)) return false;
  return wasInside ?? false;
}

export function relativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** A cat counts as "live" if its last fix is recent enough for the reporting mode. */
export function isLive(iso: string | null, windowS = 20 * 60, now: number = Date.now()): boolean {
  return iso !== null && now - Date.parse(iso) < windowS * 1000;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

// ---------------------------------------------------------------------------
// Route smoothing
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

interface Fix extends LatLng {
  accuracyM: number;
}

/**
 * Turns raw fixes into a pleasant, honest path:
 *  1. drop clearly bad fixes (accuracy > 75 m) unless that would drop most data;
 *  2. merge GPS jitter: consecutive fixes inside each other's uncertainty
 *     collapse into one accuracy-weighted point (a sleeping cat stays a dot);
 *  3. draw a centripetal Catmull-Rom spline through the remaining points, which
 *     passes through every real fix without overshooting loops.
 */
export function smoothTrack(points: readonly Fix[], stepsPerSegment = 8): LatLng[] {
  if (points.length < 2) return points.map(({ lat, lng }) => ({ lat, lng }));

  const accurate = points.filter((p) => p.accuracyM <= 75);
  const usable = accurate.length >= points.length / 2 ? accurate : [...points];

  const merged: Array<Fix & { w: number }> = [];
  for (const p of usable) {
    const last = merged[merged.length - 1];
    const w = 1 / Math.max(p.accuracyM, 3) ** 2;
    if (last && distanceM(last.lat, last.lng, p.lat, p.lng) < Math.max(10, (last.accuracyM + p.accuracyM) / 2)) {
      const tw = last.w + w;
      last.lat = (last.lat * last.w + p.lat * w) / tw;
      last.lng = (last.lng * last.w + p.lng * w) / tw;
      last.accuracyM = Math.min(last.accuracyM, p.accuracyM);
      last.w = tw;
    } else {
      merged.push({ ...p, w });
    }
  }
  if (merged.length < 3) return merged.map(({ lat, lng }) => ({ lat, lng }));

  // Work in local metres so the spline parametrisation is isotropic.
  const lat0 = merged[0]!.lat;
  const k = Math.cos((lat0 * Math.PI) / 180) * 111_320;
  const xy = merged.map((p) => ({ x: (p.lng - merged[0]!.lng) * k, y: (p.lat - lat0) * 111_320 }));
  const back = (x: number, y: number): LatLng => ({ lat: lat0 + y / 111_320, lng: merged[0]!.lng + x / k });

  const out: LatLng[] = [back(xy[0]!.x, xy[0]!.y)];
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[Math.max(0, i - 1)]!;
    const p1 = xy[i]!;
    const p2 = xy[i + 1]!;
    const p3 = xy[Math.min(xy.length - 1, i + 2)]!;
    const t = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.hypot(b.x - a.x, b.y - a.y) ** 0.5, 1e-6);
    const t1 = t(p0, p1);
    const t2 = t1 + t(p1, p2);
    const t3 = t2 + t(p2, p3);
    for (let s = 1; s <= stepsPerSegment; s++) {
      const u = t1 + ((t2 - t1) * s) / stepsPerSegment;
      const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, ta: number, tb: number) => {
        const f = tb === ta ? 0 : (u - ta) / (tb - ta);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      };
      const a1 = lerp(p0, p1, 0, t1);
      const a2 = lerp(p1, p2, t1, t2);
      const a3 = lerp(p2, p3, t2, t3);
      const b1 = lerp(a1, a2, 0, t2);
      const b2 = lerp(a2, a3, t1, t3);
      const c = lerp(b1, b2, t1, t2);
      out.push(back(c.x, c.y));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Heatmap + activity (same rules as get_pet_heatmap / get_pet_activity in SQL;
// used by demo mode)
// ---------------------------------------------------------------------------

export interface TimedFix extends Fix {
  at: string;
}

export interface HeatCellRaw extends LatLng {
  weightS: number;
}

/** Dwell-time heatmap: each fix weighs the time until the next fix (max 30 min). */
export function binHeatmap(points: readonly TimedFix[], cellM = 25, now = Date.now()): HeatCellRaw[] {
  const cells = new Map<string, { lat: number; lng: number; w: number; n: number }>();
  const sorted = [...points].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  sorted.forEach((p, i) => {
    if (p.accuracyM > 100) return;
    const next = sorted[i + 1] ? Date.parse(sorted[i + 1]!.at) : now;
    const dwell = Math.min(Math.max(0, (next - Date.parse(p.at)) / 1000), 1800);
    const k = Math.cos((p.lat * Math.PI) / 180) * 111_320;
    const key = `${Math.round((p.lat * 111_320) / cellM)}:${Math.round((p.lng * k) / cellM)}`;
    const c = cells.get(key) ?? { lat: 0, lng: 0, w: 0, n: 0 };
    c.lat += p.lat;
    c.lng += p.lng;
    c.w += dwell;
    c.n += 1;
    cells.set(key, c);
  });
  return [...cells.values()]
    .map((c) => ({ lat: c.lat / c.n, lng: c.lng / c.n, weightS: c.w }))
    .sort((a, b) => b.weightS - a.weightS)
    .slice(0, 400);
}

/** Is a local time (minutes after midnight) inside a night window that may wrap midnight? */
export function inNightWindow(minuteOfDay: number, startMin: number, endMin: number): boolean {
  return startMin > endMin ? minuteOfDay >= startMin || minuteOfDay < endMin : minuteOfDay >= startMin && minuteOfDay < endMin;
}

export interface ActivityDayRaw {
  day: string; // YYYY-MM-DD, local
  distanceM: number;
  activeMinutes: number;
  roamRadiusM: number | null;
  nightShare: number | null;
  fixes: number;
}

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Hops only count when larger than the combined GPS uncertainty. */
export function estimateActivity(
  points: readonly TimedFix[],
  opts: { nightStartMin: number; nightEndMin: number; home?: LatLng | null },
): ActivityDayRaw[] {
  const days = new Map<string, { dist: number; activeS: number; roam: number | null; night: number; fixes: number }>();
  const sorted = [...points].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  sorted.forEach((p, i) => {
    const d = new Date(p.at);
    const key = localDay(d);
    const acc = days.get(key) ?? { dist: 0, activeS: 0, roam: null, night: 0, fixes: 0 };
    acc.fixes += 1;
    if (opts.home) {
      const r = distanceM(opts.home.lat, opts.home.lng, p.lat, p.lng);
      acc.roam = Math.max(acc.roam ?? 0, r);
    }
    const prev = sorted[i - 1];
    if (prev) {
      const hop = distanceM(prev.lat, prev.lng, p.lat, p.lng);
      const noise = Math.max(prev.accuracyM, p.accuracyM, 10);
      const dt = (Date.parse(p.at) - Date.parse(prev.at)) / 1000;
      if (hop > noise && dt > 0 && dt <= 3600) {
        acc.dist += hop;
        acc.activeS += Math.min(dt, 900);
        if (inNightWindow(d.getHours() * 60 + d.getMinutes(), opts.nightStartMin, opts.nightEndMin)) acc.night += hop;
      }
    }
    days.set(key, acc);
  });
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, a]) => ({
      day,
      distanceM: a.dist,
      activeMinutes: a.activeS / 60,
      roamRadiusM: a.roam,
      nightShare: a.dist > 0 ? a.night / a.dist : null,
      fixes: a.fixes,
    }));
}

/** Friendly label for today compared with the cat's own recent average. */
export function activityLevel(todayM: number, history: readonly number[]): { label: string; emoji: string } {
  const past = history.filter((m) => m > 0);
  const avg = past.length ? past.reduce((s, m) => s + m, 0) / past.length : 0;
  if (todayM < 50) return { label: 'Lazy day', emoji: '😴' };
  if (avg === 0) return { label: 'Out and about', emoji: '🐾' };
  const ratio = todayM / avg;
  if (ratio < 0.6) return { label: 'Taking it easy', emoji: '🛋️' };
  if (ratio <= 1.4) return { label: 'Usual rounds', emoji: '🐾' };
  return { label: 'Explorer mode', emoji: '🧭' };
}
