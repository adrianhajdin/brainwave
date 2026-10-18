/** Heatmap styling shared by the native and web maps. */
import type { HeatCell } from '../backend/types';

// Warm ramp (pale yellow -> orange -> deep red), readable on light and dark maps.
const RAMP: Array<[number, [number, number, number]]> = [
  [0, [255, 237, 160]],
  [0.35, [254, 178, 76]],
  [0.65, [240, 59, 32]],
  [1, [165, 15, 21]],
];

function rampColor(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < RAMP.length; i++) {
    const [t1, c1] = RAMP[i]!;
    const [t0, c0] = RAMP[i - 1]!;
    if (x <= t1) {
      const f = (x - t0) / (t1 - t0);
      return [0, 1, 2].map((k) => Math.round(c0[k]! + (c1[k]! - c0[k]!) * f)) as [number, number, number];
    }
  }
  return RAMP[RAMP.length - 1]![1];
}

export interface HeatBlob {
  lat: number;
  lng: number;
  radiusM: number;
  fill: string;
  key: string;
}

interface Spot {
  lat: number;
  lng: number;
  w: number;
  spreadM: number;
}

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const k = Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * k);
};

/**
 * Groups nearby cells into "spots" (weighted centre, how far it spreads), so
 * GPS wander around one favourite place becomes one soft area instead of a
 * crowd of separate circles.
 */
export function heatSpots(cells: readonly HeatCell[], joinM = 40, maxSpots = 60): Spot[] {
  const spots: Spot[] = [];
  for (const c of [...cells].sort((a, b) => b.weightS - a.weightS)) {
    const near = spots.find((s) => metres(s, c) < joinM);
    if (near) {
      const tw = near.w + c.weightS;
      near.lat = (near.lat * near.w + c.lat * c.weightS) / tw;
      near.lng = (near.lng * near.w + c.lng * c.weightS) / tw;
      near.spreadM = Math.min(joinM, Math.max(near.spreadM, metres(near, c)));
      near.w = tw;
    } else if (spots.length < maxSpots) {
      spots.push({ lat: c.lat, lng: c.lng, w: c.weightS, spreadM: 0 });
    }
  }
  return spots;
}

const RINGS = 8;

/**
 * Each spot becomes a stack of faint concentric circles, largest first: their
 * alphas add up towards the centre, so a spot fades out with no visible edge
 * and nearby spots melt into one area (Apple Maps has no heatmap layer).
 * Colour runs from the pale edge to the spot's own heat in the middle;
 * intensity uses sqrt so one long nap doesn't wash out the rest.
 */
export function heatBlobs(cells: readonly HeatCell[]): HeatBlob[] {
  const spots = heatSpots(cells);
  if (spots.length === 0) return [];
  const max = Math.sqrt(Math.max(...spots.map((s) => s.w)));
  const out: HeatBlob[] = [];
  spots.forEach((s, i) => {
    const t = max > 0 ? Math.sqrt(s.w) / max : 0;
    const outer = 30 * (0.8 + 0.7 * t) + s.spreadM;
    for (let j = 0; j < RINGS; j++) {
      const f = j / (RINGS - 1); // 0 = outer edge, 1 = core
      const [r, g, b] = rampColor(t * (0.3 + 0.7 * f));
      out.push({
        key: `${i}-${j}`,
        lat: s.lat,
        lng: s.lng,
        radiusM: outer * (1 - 0.7 * f),
        fill: `rgba(${r}, ${g}, ${b}, ${(0.025 + 0.055 * t).toFixed(3)})`,
      });
    }
  });
  return out;
}

/** Points for a native heatmap layer (Google Maps on Android). */
export function heatPoints(cells: readonly HeatCell[]): { latitude: number; longitude: number; weight: number }[] {
  if (cells.length === 0) return [];
  const max = Math.sqrt(Math.max(...cells.map((c) => c.weightS)));
  return cells.map((c) => ({ latitude: c.lat, longitude: c.lng, weight: max > 0 ? Math.sqrt(c.weightS) / max : 0 }));
}

/** The same warm ramp as a native heatmap gradient; below the first stop it fades out. */
export const HEAT_GRADIENT = {
  colors: RAMP.map(([, [r, g, b]]) => `rgb(${r}, ${g}, ${b})`),
  startPoints: [0.08, 0.35, 0.65, 1],
  colorMapSize: 256,
};

export const HEAT_LEGEND = [0, 0.35, 0.65, 1].map((t) => {
  const [r, g, b] = rampColor(t);
  return `rgb(${r}, ${g}, ${b})`;
});
