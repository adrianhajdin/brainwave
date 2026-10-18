import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CLOSE_DELTA, distanceM, formatDistance, insideZone, isLive, offset, regionFor, relativeTime } from './geo.ts';

test('distance: Amsterdam Centraal to Dam is ~1 km', () => {
  const d = distanceM(52.3791, 4.9003, 52.3731, 4.8926);
  assert.ok(d > 800 && d < 900, String(d));
});

test('offset and distance are inverse', () => {
  const p = offset(52.37, 4.9, 250, 73);
  assert.ok(Math.abs(distanceM(52.37, 4.9, p.lat, p.lng) - 250) < 0.5);
});

test('zone hysteresis matches the database rule', () => {
  const zone = { lat: 52.379, lng: 4.8995, radiusM: 100 };
  const inside = { ...offset(zone.lat, zone.lng, 50, 0), accuracyM: 10 };
  const edge = { ...offset(zone.lat, zone.lng, 130, 0), accuracyM: 40 }; // 30 m out, ±40 m
  const far = { ...offset(zone.lat, zone.lng, 400, 0), accuracyM: 10 };
  assert.equal(insideZone(zone, inside, null), true);
  assert.equal(insideZone(zone, edge, true), true, 'ambiguous keeps inside');
  assert.equal(insideZone(zone, edge, false), false, 'ambiguous keeps outside');
  assert.equal(insideZone(zone, far, true), false);
});

test('time helpers', () => {
  const now = Date.parse('2026-10-16T12:00:00Z');
  assert.equal(relativeTime(null, now), 'never');
  assert.equal(relativeTime('2026-10-16T11:59:55Z', now), 'just now');
  assert.equal(relativeTime('2026-10-16T11:45:00Z', now), '15 min ago');
  assert.equal(relativeTime('2026-10-15T12:00:00Z', now), '24 h ago');
  assert.equal(isLive('2026-10-16T11:50:00Z', 20 * 60, now), true);
  assert.equal(isLive('2026-10-16T11:30:00Z', 20 * 60, now), false);
  assert.equal(formatDistance(42.4), '42 m');
  assert.equal(formatDistance(2345), '2.3 km');
});

import { activityLevel, binHeatmap, estimateActivity, inNightWindow, smoothTrack } from './geo.ts';

const fix = (lat: number, lng: number, accuracyM = 8, at = '2026-10-16T12:00:00Z') => ({ lat, lng, accuracyM, at });

test('smoothTrack: curve passes through real fixes and adds intermediate points', () => {
  const pts = [fix(52.3700, 4.9000), fix(52.3710, 4.9010), fix(52.3705, 4.9030), fix(52.3720, 4.9040)];
  const out = smoothTrack(pts, 8);
  assert.equal(out.length, 1 + 3 * 8);
  // segment ends coincide with the original points
  for (const [i, p] of pts.entries()) {
    const q = out[i * 8]!;
    assert.ok(distanceM(p.lat, p.lng, q.lat, q.lng) < 0.5, `point ${i}`);
  }
});

test('smoothTrack: GPS jitter of a sleeping cat collapses to one point', () => {
  const sleeping = Array.from({ length: 12 }, (_, i) => fix(52.37 + Math.sin(i) * 0.00004, 4.9 + Math.cos(i) * 0.00004, 15));
  const out = smoothTrack(sleeping);
  assert.equal(out.length, 1);
});

test('smoothTrack: wildly inaccurate fixes are dropped', () => {
  const pts = [fix(52.37, 4.9), fix(52.3705, 4.9005), fix(52.40, 4.95, 900), fix(52.371, 4.901), fix(52.3715, 4.9015)];
  const out = smoothTrack(pts);
  assert.ok(out.every((p) => p.lat < 52.38), 'outlier removed');
});

test('heatmap: dwell time dominates over fix count', () => {
  const pts = [
    fix(52.3700, 4.9000, 8, '2026-10-16T10:00:00Z'), // stays 20 min here
    fix(52.3750, 4.9050, 8, '2026-10-16T10:20:00Z'), // passes by quickly
    fix(52.3760, 4.9060, 8, '2026-10-16T10:20:30Z'),
  ];
  const cells = binHeatmap(pts, 25, Date.parse('2026-10-16T10:21:00Z'));
  assert.ok(Math.abs(cells[0]!.lat - 52.37) < 1e-6, 'favourite spot first');
  assert.equal(cells[0]!.weightS, 1200);
});

test('night window wraps midnight', () => {
  assert.equal(inNightWindow(22 * 60, 21 * 60, 7 * 60), true);
  assert.equal(inNightWindow(3 * 60, 21 * 60, 7 * 60), true);
  assert.equal(inNightWindow(12 * 60, 21 * 60, 7 * 60), false);
  assert.equal(inNightWindow(3 * 60, 1 * 60, 5 * 60), true);
  assert.equal(inNightWindow(6 * 60, 1 * 60, 5 * 60), false);
});

test('activity: distance ignores jitter, roam radius from home', () => {
  const home = { lat: 52.37, lng: 4.9 };
  const pts = [
    fix(52.3700, 4.9000, 10, '2026-10-16T08:00:00Z'),
    fix(52.37001, 4.90001, 10, '2026-10-16T08:05:00Z'), // jitter
    fix(52.3720, 4.9000, 10, '2026-10-16T08:10:00Z'), // ~222 m
  ];
  const [day] = estimateActivity(pts, { nightStartMin: 1260, nightEndMin: 420, home });
  assert.ok(day!.distanceM > 210 && day!.distanceM < 235, String(day!.distanceM));
  assert.equal(day!.activeMinutes, 5);
  assert.ok(day!.roamRadiusM! > 210);
  assert.equal(day!.fixes, 3);
});

test('activity level relative to the cat itself', () => {
  assert.equal(activityLevel(10, [500, 600]).label, 'Lazy day');
  assert.equal(activityLevel(550, [500, 600]).label, 'Usual rounds');
  assert.equal(activityLevel(2000, [500, 600]).label, 'Explorer mode');
  assert.equal(activityLevel(200, [500, 600]).label, 'Taking it easy');
});

test('map region: one cat is centred at street level, not maximum zoom', () => {
  const r = regionFor([{ lat: 52.37, lng: 4.9 }])!;
  assert.equal(r.latitude, 52.37);
  assert.equal(r.longitude, 4.9);
  assert.equal(r.latitudeDelta, CLOSE_DELTA);
  assert.ok(r.longitudeDelta > CLOSE_DELTA, 'longitude span is widened so the view is square in metres');
});

test('map region: cats far apart all fit, with a margin', () => {
  const a = { lat: 52.37, lng: 4.9 };
  const b = offset(a.lat, a.lng, 3000, 45);
  const r = regionFor([a, b])!;
  for (const p of [a, b]) {
    assert.ok(Math.abs(p.lat - r.latitude) < r.latitudeDelta / 2 * 0.8);
    assert.ok(Math.abs(p.lng - r.longitude) < r.longitudeDelta / 2 * 0.8);
  }
  assert.equal(regionFor([]), null);
});

test('map region: a zone circle stays fully in view', () => {
  const r = regionFor([{ lat: 52.37, lng: 4.9, radiusM: 250 }])!;
  assert.ok(r.latitudeDelta * 111_320 > 500 * 1.4);
});
