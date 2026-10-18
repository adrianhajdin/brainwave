import type { StyleProp, ViewStyle } from 'react-native';

import type { Cat, HeatCell, HomeZone, TrackPoint } from '../backend/types';

export type MapLayer = 'live' | 'route' | 'heatmap';

export interface CatMapProps {
  cats: Cat[];
  /** Zoom to this cat (detail screen); otherwise fit all cats. */
  focusId?: string | null;
  /** Raw fixes; drawn as a smoothed route. */
  track?: TrackPoint[];
  /** Colour for the route and replay cursor (defaults to the focused cat). */
  trackColor?: string;
  /** Replay cursor position. */
  cursor?: TrackPoint | null;
  zones?: HomeZone[];
  heat?: HeatCell[];
  onSelectCat?: (id: string) => void;
  /** Tap on the map itself (not on a cat). */
  onPressMap?: () => void;
  /** Long-press on the map (e.g. to place a home zone). */
  onLongPress?: (lat: number, lng: number) => void;
  /** Pending zone preview while editing. */
  draftZone?: { lat: number; lng: number; radiusM: number } | null;
  /** Pixels at the bottom of the map hidden behind a sheet: framing keeps the cats above it. */
  coverBottom?: number;
  style?: StyleProp<ViewStyle>;
}
