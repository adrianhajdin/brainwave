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
