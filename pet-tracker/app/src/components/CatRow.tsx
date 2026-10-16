import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Cat } from '../backend/types';
import { isLive, relativeTime } from '../geo';
import { space, useTheme } from '../theme';
import { CatAvatar, Pill } from './ui';
import { catBadge, usePhotoUrl } from './usePhotoUrl';

export function CatRow({ cat, trackedByPhone, shared, onPress }: { cat: Cat; trackedByPhone: boolean; shared: boolean; onPress: () => void }) {
  const t = useTheme();
  const photoUrl = usePhotoUrl(cat.photoPath);
  const live = isLive(cat.lastFixAt, trackedByPhone || cat.lostMode ? 5 * 60 : 20 * 60);
  const lowBattery = cat.lastBatteryPct !== null && cat.lastBatteryPct > 0 && cat.lastBatteryPct < 20;
  const meta = [
    cat.lastBatteryPct !== null && cat.lastBatteryPct > 0 ? `${lowBattery ? '🪫' : '🔋'} ${cat.lastBatteryPct}%` : null,
    cat.lastAccuracyM !== null ? `± ${Math.round(cat.lastAccuracyM)} m` : null,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cat.name}, ${cat.lostMode ? 'lost mode on, ' : ''}${live ? 'live' : `last seen ${relativeTime(cat.lastFixAt)}`}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.surfaceAlt : cat.lostMode ? t.dangerSoft : 'transparent' }]}
    >
      <CatAvatar name={cat.name} color={cat.color} size={44} photoUrl={photoUrl} ring={cat.lostMode ? t.danger : undefined} badge={catBadge(cat, t)} />
      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
            {cat.name}
          </Text>
          {cat.lostMode && <Pill label="LOST" tone="danger" />}
          {trackedByPhone && <Pill label="📱 this phone" tone="accent" />}
          {shared && <Pill label="shared" />}
          {cat.night.enabled && <Pill label="🌙" tone="night" />}
        </View>
        <Text style={{ color: lowBattery ? t.danger : t.textMuted, marginTop: 2 }}>
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
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  name: { fontSize: 17, fontWeight: '800', flexShrink: 1, marginRight: space.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
