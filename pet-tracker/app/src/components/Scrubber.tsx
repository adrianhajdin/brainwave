import { useCallback, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { radius, useTheme } from '../theme';

/**
 * Horizontal progress bar you can drag to seek (0..1). Touches are handled on
 * the outer view, so locationX is always relative to the bar.
 */
export function Scrubber({ fraction, onSeek, color, label }: { fraction: number; onSeek: (f: number) => void; color: string; label: string }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const seek = useCallback(
    (x: number) => {
      if (width > 0) onSeek(Math.min(1, Math.max(0, x / width)));
    },
    [width, onSeek],
  );
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => seek(e.nativeEvent.locationX),
        onPanResponderMove: (e) => seek(e.nativeEvent.locationX),
      }),
    [seek],
  );
  const percent = `${Math.round(fraction * 100)}%`;

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100), text: percent }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.hit}
      {...pan.panHandlers}
    >
      <View pointerEvents="none" style={[styles.track, { backgroundColor: t.surfaceAlt }]}>
        <View style={{ width: percent, height: '100%', backgroundColor: color }} />
      </View>
      <View pointerEvents="none" style={[styles.knob, { left: percent, backgroundColor: t.surface, borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 24, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  knob: {
    position: 'absolute', width: 22, height: 22, borderRadius: radius.pill, borderWidth: 5, marginLeft: -11,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
});
