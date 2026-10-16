import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../AppProvider';
import { relativeTime } from '../geo';
import { radius, space, useTheme } from '../theme';

/** Shows that this phone is acting as a cat's collar, from any screen. */
export function TrackerBanner({ onPress }: { onPress?: () => void }) {
  const t = useTheme();
  const { tracker, cats, effectiveIntervalS } = useApp();
  if (tracker.state === 'off') return null;

  const cat = cats.find((c) => c.id === tracker.catId);
  const name = cat?.name ?? 'your cat';
  const text = {
    starting: `Starting GPS for ${name}…`,
    tracking: `This phone is ${name}'s tracker${tracker.mode === 'background' ? ' (also with screen off)' : ''} · every ${
      effectiveIntervalS < 60 ? `${effectiveIntervalS} s` : `${Math.round(effectiveIntervalS / 60)} min`
    } · ${tracker.sent} fix${tracker.sent === 1 ? '' : 'es'} sent${tracker.lastSentAt ? ` · last ${relativeTime(tracker.lastSentAt)}` : ''}`,
    denied: 'Location permission denied: allow it in Settings to track with this phone.',
    error: `Tracking error: ${tracker.error ?? 'unknown'}`,
  }[tracker.state];
  const tone = tracker.state === 'tracking' || tracker.state === 'starting' ? t.live : t.danger;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.banner, { backgroundColor: t.surface, borderColor: tone }]}>
      <View style={[styles.pulse, { backgroundColor: tone }]} />
      <Text style={[styles.text, { color: t.text }]} numberOfLines={2}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderRadius: radius.md, borderWidth: 1.5, paddingVertical: space.sm, paddingHorizontal: space.md,
  },
  pulse: { width: 10, height: 10, borderRadius: 5 },
  text: { flex: 1, fontWeight: '600' },
});
