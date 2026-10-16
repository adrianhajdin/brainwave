import assert from 'node:assert/strict';
import { test } from 'node:test';

import { distanceM, formatDistance, insideZone, isLive, offset, relativeTime } from './geo.ts';

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
