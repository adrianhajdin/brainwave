import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, useTheme } from '../theme';

export function CatAvatar({
  name, color, size = 40, ring, photoUrl, badge,
}: {
  name: string;
  color: string;
  size?: number;
  ring?: string;
  /** Resolved photo URL (see usePhotoUrl); falls back to the initial. */
  photoUrl?: string | null;
  /** Small corner badge, e.g. '!' for lost mode or '🔋' for low battery. */
  badge?: { text: string; color: string } | null;
}) {
  const ear = size * 0.28;
  return (
    <View style={{ width: size, height: size + ear * 0.45, alignItems: 'center', justifyContent: 'flex-end' }}>
      {/* ears: two CSS-style triangles */}
      <View style={[styles.ear, { borderBottomColor: color, borderLeftWidth: ear / 2, borderRightWidth: ear / 2, borderBottomWidth: ear, left: size * 0.08, transform: [{ rotate: '-18deg' }] }]} />
      <View style={[styles.ear, { borderBottomColor: color, borderLeftWidth: ear / 2, borderRightWidth: ear / 2, borderBottomWidth: ear, right: size * 0.08, transform: [{ rotate: '18deg' }] }]} />
      <View
        style={{
          width: size, height: size, borderRadius: size / 2, backgroundColor: color,
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          borderWidth: ring ? 3 : photoUrl ? 2 : 0, borderColor: ring ?? color,
        }}
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{name.slice(0, 1).toUpperCase()}</Text>
        )}
      </View>
      {badge && (
        <View style={[styles.badge, { backgroundColor: badge.color, minWidth: size * 0.42, height: size * 0.42, borderRadius: size * 0.21 }]}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.24 }}>{badge.text}</Text>
        </View>
      )}
    </View>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title, onPress, variant = 'primary', disabled, busy, style, icon, textColor,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: string;
  textColor?: string;
}) {
  const t = useTheme();
  const bg = { primary: t.accent, secondary: t.surfaceAlt, ghost: 'transparent', danger: 'transparent' }[variant];
  const fg = textColor ?? { primary: t.accentText, secondary: t.text, ghost: t.accent, danger: t.danger }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        variant === 'danger' && { borderWidth: 1, borderColor: t.danger },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{icon ? `${icon}  ${title}` : title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, shadowColor: t.shadow }, style]}>
      {children}
    </View>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'live' | 'accent' | 'danger' | 'night' }) {
  const t = useTheme();
  const colors = {
    neutral: [t.surfaceAlt, t.textMuted],
    live: [t.liveSoft, t.live],
    accent: [t.accentSoft, t.accent],
    danger: [t.dangerSoft, t.danger],
    night: [t.nightSoft, t.night],
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: colors[0] }]}>
      <Text style={[styles.pillText, { color: colors[1] }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.section, { color: t.textMuted }]}>{children}</Text>;
}

export function Segmented<T extends string | number>({
  options, value, onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.surfaceAlt }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: t.surface, shadowColor: t.shadow, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }]}
          >
            <Text style={{ color: selected ? t.text : t.textMuted, fontWeight: selected ? '700' : '500' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', right: -2, bottom: -2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff', paddingHorizontal: 2,
  },
  ear: {
    position: 'absolute', top: 0, width: 0, height: 0,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderStyle: 'solid',
  },
  button: {
    minHeight: 48, borderRadius: radius.md, paddingHorizontal: space.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  card: {
    borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg,
    shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  section: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: space.sm },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.md - 3 },
});
