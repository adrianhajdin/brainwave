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

/**
 * Each cell becomes a few concentric translucent circles: overlapping blobs
 * blend into a smooth "glow" without a native heatmap layer (which Apple Maps
 * lacks). Intensity uses sqrt so one long nap doesn't wash out the rest.
 */
export function heatBlobs(cells: readonly HeatCell[], cellM = 25): HeatBlob[] {
  if (cells.length === 0) return [];
  const max = Math.sqrt(Math.max(...cells.map((c) => c.weightS)));
  const out: HeatBlob[] = [];
  cells.forEach((c, i) => {
    const t = max > 0 ? Math.sqrt(c.weightS) / max : 0;
    const [r, g, b] = rampColor(t);
    const rings = [
      { k: 2.2, a: 0.1 + 0.12 * t },
      { k: 1.4, a: 0.14 + 0.2 * t },
      { k: 0.8, a: 0.2 + 0.35 * t },
    ];
    for (const [j, ring] of rings.entries()) {
      out.push({
        key: `${i}-${j}`,
        lat: c.lat,
        lng: c.lng,
        radiusM: cellM * ring.k * (0.7 + 0.6 * t),
        fill: `rgba(${r}, ${g}, ${b}, ${ring.a.toFixed(3)})`,
      });
    }
  });
  return out;
}

export const HEAT_LEGEND = [0, 0.35, 0.65, 1].map((t) => {
  const [r, g, b] = rampColor(t);
  return `rgb(${r}, ${g}, ${b})`;
});
