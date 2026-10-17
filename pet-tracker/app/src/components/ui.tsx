import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, radius, space, useTheme } from '../theme';

/** Icon names from the Ionicons set; the app uses icons instead of emoji. */
export type IconName = keyof typeof Ionicons.glyphMap;

export function CatAvatar({
  name, color, size = 40, ring, photoUrl, badge,
}: {
  name: string;
  color: string;
  size?: number;
  ring?: string;
  /** Resolved photo URL (see usePhotoUrl); falls back to the initial. */
  photoUrl?: string | null;
  /** Small corner badge: lost mode or low battery (see catBadge). */
  badge?: { icon: IconName; color: string } | null;
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
        <View
          style={[
            styles.badge,
            { backgroundColor: badge.color, width: size * 0.44, height: size * 0.44, borderRadius: size * 0.22 },
          ]}
        >
          <Ionicons name={badge.icon} size={size * 0.25} color="#fff" />
        </View>
      )}
    </View>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title, onPress, variant = 'primary', disabled, busy, style, icon, textColor, accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: IconName;
  textColor?: string;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  // Ink buttons are the primary action; the blue accent is reserved for links and selection.
  const bg = { primary: t.primary, secondary: t.surfaceAlt, ghost: 'transparent', danger: 'transparent' }[variant];
  const fg = textColor ?? { primary: t.primaryText, secondary: t.text, ghost: t.accent, danger: t.danger }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        variant === 'primary' && { borderRadius: radius.pill },
        variant === 'danger' && { borderWidth: 1, borderColor: t.danger },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Icon-only button; the label is read by screen readers. */
export function IconButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: t.surfaceAlt, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={t.text} />
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

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'live' | 'accent' | 'danger' | 'night'; icon?: IconName }) {
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
      <View style={styles.pillInner}>
        {icon && <Ionicons name={icon} size={13} color={colors[1]} />}
        <Text style={[styles.pillText, { color: colors[1] }]}>{label}</Text>
      </View>
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.section, { color: t.textMuted }]}>{children}</Text>;
}

/** Error message placed next to the control that failed. Renders nothing without a message. */
export function ErrorText({ children }: { children?: string | null }) {
  const t = useTheme();
  if (!children) return null;
  return <Text accessibilityRole="alert" style={{ color: t.danger, lineHeight: 20 }}>{children}</Text>;
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
            <Text style={{ color: selected ? t.text : t.textMuted, fontFamily: selected ? fonts.bodySemibold : fonts.bodyMedium, textAlign: 'center' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', right: -2, bottom: -2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  ear: {
    position: 'absolute', top: 0, width: 0, height: 0,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderStyle: 'solid',
  },
  button: {
    minHeight: 48, borderRadius: radius.md, paddingHorizontal: space.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  buttonText: { fontSize: 16, fontFamily: fonts.bodySemibold },
  iconButton: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: radius.lg, padding: space.lg,
    shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pillText: { fontSize: 12, fontFamily: fonts.bodySemibold },
  section: { fontSize: 13, fontFamily: fonts.bodySemibold, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: space.sm },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 4, borderRadius: radius.md - 2 },
});
