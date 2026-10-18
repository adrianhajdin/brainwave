import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Cat } from '../backend/types';
import { isLive, relativeTime } from '../geo';
import { fonts, space, useTheme } from '../theme';
import { AccessPill } from './AccessPill';
import { CatAvatar, Pill } from './ui';
import { catBadge, usePhotoUrl } from './usePhotoUrl';

export function CatRow({ cat, trackedByPhone, onPress }: { cat: Cat; trackedByPhone: boolean; onPress: () => void }) {
  const t = useTheme();
  const photoUrl = usePhotoUrl(cat.photoPath);
  const live = isLive(cat.lastFixAt, trackedByPhone || cat.lostMode ? 5 * 60 : 20 * 60);
  const hasBattery = cat.lastBatteryPct !== null && cat.lastBatteryPct > 0;
  const lowBattery = hasBattery && cat.lastBatteryPct! < 20;
  const status = cat.lastFixAt ? `${live ? 'Live' : 'Last seen'} · ${relativeTime(cat.lastFixAt)}` : 'Waiting for first location';

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
          {cat.lostMode && <Pill label="Lost" tone="danger" icon="alert-circle" />}
          {trackedByPhone && <Pill label="This phone" tone="accent" icon="phone-portrait-outline" />}
          <AccessPill cat={cat} />
          {cat.night.enabled && <Pill label="Night watch" tone="night" icon="moon-outline" />}
        </View>
        <Text style={{ color: t.textMuted, marginTop: 2 }}>
          {status}
          {hasBattery && (
            <Text style={{ color: lowBattery ? t.warn : t.textMuted, fontFamily: lowBattery ? fonts.bodySemibold : fonts.body }}>
              {`  ·  ${lowBattery ? 'Battery low' : 'Battery'} ${cat.lastBatteryPct}%`}
            </Text>
          )}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  body: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  name: { fontSize: 17, fontFamily: fonts.bodySemibold, flexShrink: 1, marginRight: space.xs },
});
