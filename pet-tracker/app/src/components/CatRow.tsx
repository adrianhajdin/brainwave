import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Cat } from '../backend/types';
import { isLive, relativeTime } from '../geo';
import { space, useTheme } from '../theme';
import { CatAvatar, Pill } from './ui';

export function CatRow({ cat, trackedByPhone, onPress }: { cat: Cat; trackedByPhone: boolean; onPress: () => void }) {
  const t = useTheme();
  const live = isLive(cat.lastFixAt, trackedByPhone ? 5 * 60 : 20 * 60);
  const meta = [
    cat.lastBatteryPct !== null && cat.lastBatteryPct > 0 ? `🔋 ${cat.lastBatteryPct}%` : null,
    cat.lastAccuracyM !== null ? `± ${Math.round(cat.lastAccuracyM)} m` : null,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cat.name}, ${live ? 'live' : `last seen ${relativeTime(cat.lastFixAt)}`}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.surfaceAlt : 'transparent' }]}
    >
      <CatAvatar name={cat.name} color={cat.color} size={42} />
      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
            {cat.name}
          </Text>
          {trackedByPhone && <Pill label="📱 this phone" tone="accent" />}
        </View>
        <Text style={{ color: t.textMuted, marginTop: 2 }}>
          {cat.lastFixAt ? `${live ? 'Live' : 'Last seen'} · ${relativeTime(cat.lastFixAt)}` : 'Waiting for first location'}
          {meta.length ? `  ·  ${meta.join('  ·  ')}` : ''}
        </Text>
      </View>
      <View style={[styles.dot, { backgroundColor: live ? t.live : t.border }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  body: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
