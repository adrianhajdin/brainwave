import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Household } from '../backend/types';
import { fonts, useTheme } from '../theme';

/** "Private" or one of your households: who sees this cat. */
export function HouseholdPicker({
  households, value, onChange, catName, busyId, disabled,
}: {
  households: Household[];
  value: string | null;
  onChange: (householdId: string | null) => void;
  catName: string;
  /** Option currently being saved (null for Private). */
  busyId?: string | null | undefined;
  disabled?: boolean;
}) {
  const t = useTheme();
  const options: { id: string | null; name: string; detail: string }[] = [
    { id: null, name: 'Private', detail: 'Only you (and cat sitters you invite)' },
    ...households.map((h) => ({
      id: h.id,
      name: h.name,
      detail:
        h.members.length === 1
          ? 'Only you so far · invite people in Settings'
          : `${catName} is visible to ${h.members.length} people: ${h.members.map((m) => m.email.split('@')[0]).join(', ')}`,
    })),
  ];
  return (
    <View>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <Pressable
            key={o.id ?? 'private'}
            accessibilityRole="radio"
            accessibilityState={{ selected, busy: busyId === o.id }}
            disabled={selected || disabled}
            onPress={() => onChange(o.id)}
            style={[styles.radioRow, { borderBottomColor: t.surfaceAlt }]}
          >
            <Ionicons name={o.id ? 'home-outline' : 'lock-closed-outline'} size={18} color={t.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontFamily: fonts.bodySemibold, fontSize: 15 }} numberOfLines={1}>{o.name}</Text>
              <Text style={{ color: t.textMuted, fontSize: 13 }} numberOfLines={2}>{o.detail}</Text>
            </View>
            <View style={[styles.radio, { borderColor: selected ? t.text : t.border }]}>
              {selected && <View style={[styles.radioDot, { backgroundColor: t.text }]} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The household a new cat goes to by default (same rule as the database). */
export function defaultHousehold(households: Household[]): string | null {
  return (households.find((h) => h.myRole === 'admin') ?? households[0])?.id ?? null;
}

const styles = StyleSheet.create({
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
