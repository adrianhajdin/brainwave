import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../AppProvider';
import { relativeTime } from '../geo';
import { fonts, radius, space, useTheme } from '../theme';

/** Shows that this phone is acting as a cat's collar, from any screen. Stop and Settings act from here. */
export function TrackerBanner({ onPress }: { onPress?: () => void }) {
  const t = useTheme();
  const { tracker, cats, effectiveIntervalS, setTrackedCatId } = useApp();
  if (tracker.state === 'off') return null;

  const cat = cats.find((c) => c.id === tracker.catId);
  const name = cat?.name ?? 'your cat';
  const every = effectiveIntervalS < 60 ? `${effectiveIntervalS} s` : `${Math.round(effectiveIntervalS / 60)} min`;
  const last = tracker.lastSentAt ? ` · last update ${relativeTime(tracker.lastSentAt)}` : '';
  const text = {
    starting: `Starting GPS for ${name}…`,
    tracking: `This phone is ${name}'s tracker · every ${every}${tracker.mode === 'background' ? ' · works with the screen off' : ''}${last}`,
    denied: `Location is off, so ${name} is not being tracked from this phone.`,
    error: `Could not send location: ${tracker.error ?? 'unknown error'}`,
    off: '',
  }[tracker.state];
  const problem = tracker.state === 'denied' || tracker.state === 'error';
  const bg = problem ? t.dangerSoft : t.liveSoft;

  // The main area and the action are siblings: a button inside a button is
  // invalid on the web and confusing for screen readers.
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${text}. Open ${name}`} style={styles.main}>
        <View style={[styles.pulse, { backgroundColor: problem ? t.danger : t.liveDot }]} />
        <Text style={[styles.text, { color: t.text }]} numberOfLines={3}>
          {text}
        </Text>
      </Pressable>
      {tracker.state === 'denied' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Open phone settings" onPress={() => void Linking.openSettings().catch(() => undefined)} hitSlop={8}>
          <Text style={[styles.action, { color: t.accent }]}>Settings</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Stop tracking" onPress={() => setTrackedCatId(null)} hitSlop={8}>
          <Text style={[styles.action, { color: t.textMuted }]}>Stop</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pulse: { width: 10, height: 10, borderRadius: 5 },
  text: { flex: 1, fontFamily: fonts.bodyMedium },
  action: { fontFamily: fonts.bodySemibold, paddingLeft: space.sm },
});
