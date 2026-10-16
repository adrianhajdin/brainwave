import type { StyleProp, ViewStyle } from 'react-native';

import type { Cat, HomeZone, TrackPoint } from '../backend/types';

export interface CatMapProps {
  cats: Cat[];
  /** Zoom to this cat (detail screen); otherwise fit all cats. */
  focusId?: string | null;
  track?: TrackPoint[];
  /** Colour for the route and replay cursor (defaults to the focused cat). */
  trackColor?: string;
  /** Replay cursor position. */
  cursor?: TrackPoint | null;
  zones?: HomeZone[];
  onSelectCat?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}
