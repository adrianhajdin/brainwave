/**
 * Activity estimate: today's numbers as hero stats, the last 7 days as a
 * single-series bar chart in the cat's colour (one series -> no legend; text
 * stays in text colours; tap a bar for its value).
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActivityDay } from '../backend/types';
import { activityLevel, formatDistance } from '../geo';
import { radius, space, useTheme } from '../theme';
import { Card, SectionTitle } from './ui';

const DAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}

export function ActivityCard({ days, color, name, kind }: { days: ActivityDay[]; color: string; name: string; kind: 'phone' | 'collar' }) {
  const t = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const keys = lastNDays(7);
  const byDay = new Map(days.map((d) => [d.day, d]));
  const series = keys.map((k) => ({ key: k, d: byDay.get(k) }));
  const today = series[series.length - 1]!.d;
  const max = Math.max(1, ...series.map((s) => s.d?.distanceM ?? 0));
  const level = activityLevel(today?.distanceM ?? 0, series.slice(0, -1).map((s) => s.d?.distanceM ?? 0));
  const shown = selected ? series.find((s) => s.key === selected) : null;

  return (
    <Card style={{ gap: space.md }}>
      <SectionTitle>Activity (estimated)</SectionTitle>

      <View style={styles.levelRow}>
        <View style={[styles.levelIcon, { backgroundColor: t.accentSoft }]}>
          <Ionicons name={level.icon} size={26} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.level, { color: t.text }]}>{level.label}</Text>
          <Text style={{ color: t.textMuted }}>Today compared with {name}'s last 6 days</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="walked today" value={formatDistance(today?.distanceM ?? 0)} />
        <Stat label="on the move" value={`${Math.round(today?.activeMinutes ?? 0)} min`} />
        <Stat label="furthest from home" value={today?.roamRadiusM != null ? formatDistance(today.roamRadiusM) : '–'} />
      </View>

      <View>
        <View style={styles.chart} accessibilityRole="image" accessibilityLabel={`Distance per day for the last 7 days, today ${formatDistance(today?.distanceM ?? 0)}`}>
          {series.map((s) => {
            const v = s.d?.distanceM ?? 0;
            const h = Math.max(2, (v / max) * 96);
            const isToday = s.key === keys[keys.length - 1];
            const dow = new Date(`${s.key}T12:00:00`).getDay();
            return (
              <Pressable
                key={s.key}
                onPress={() => setSelected((k) => (k === s.key ? null : s.key))}
                style={styles.col}
                hitSlop={4}
                accessibilityLabel={`${s.key}: ${formatDistance(v)}`}
              >
                <View style={[styles.barArea, { borderBottomColor: t.border }]}>
                  <View
                    style={{
                      height: h, width: '62%', backgroundColor: color,
                      opacity: isToday || selected === s.key ? 1 : 0.55,
                      borderTopLeftRadius: 4, borderTopRightRadius: 4,
                    }}
                  />
                </View>
                <Text style={[styles.dayLabel, { color: isToday ? t.text : t.textMuted, fontWeight: isToday ? '800' : '500' }]}>
                  {DAY_INITIAL[dow]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={{ color: t.textMuted, fontSize: 13, lineHeight: 18 }}>
        {shown
          ? `${new Date(`${shown.key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}: ${formatDistance(shown.d?.distanceM ?? 0)} walked, ${Math.round(shown.d?.activeMinutes ?? 0)} min on the move${shown.d?.nightShare != null ? `, ${Math.round(shown.d.nightShare * 100)} % at night` : ''}.`
          : `Estimated from ${kind === 'collar' ? 'collar' : 'phone'} positions: GPS jitter is ignored, only real movement counts. Tap a bar for details.`}
      </Text>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: t.surfaceAlt }]}>
      <Text style={[styles.statValue, { color: t.text }]}>{value}</Text>
      <Text style={{ color: t.textMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  levelIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  level: { fontSize: 20, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, borderRadius: radius.md, padding: space.sm },
  statValue: { fontSize: 18, fontWeight: '800' },
  chart: { flexDirection: 'row', height: 120, alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center' },
  barArea: { height: 100, width: '100%', alignItems: 'center', justifyContent: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth },
  dayLabel: { marginTop: 4, fontSize: 12 },
});
