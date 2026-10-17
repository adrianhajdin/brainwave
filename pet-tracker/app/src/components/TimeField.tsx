import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { dateAtMinute, hhmm, minuteOfDate, parseHHMM } from '../time';
import { radius, space, useTheme } from '../theme';
import { Button } from './ui';

/**
 * A time of day. On iOS and Android it opens the native time picker; iOS
 * commits on Done, Android on selection. On web (no native picker) it is a
 * typed HH:MM box.
 */
export function TimeField({ label, minutes, onChange }: { label: string; minutes: number; onChange: (m: number) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const [typed, setTyped] = useState<string | null>(null);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.row}>
        <Text style={{ color: t.textMuted, flex: 1 }}>{label}</Text>
        <TextInput
          accessibilityLabel={`${label} time, HH:MM`}
          value={typed ?? hhmm(minutes)}
          onChangeText={setTyped}
          onBlur={() => {
            const m = parseHHMM(typed);
            if (m !== null && m !== minutes) onChange(m);
            setTyped(null);
          }}
          maxLength={5}
          style={[styles.input, { backgroundColor: t.surfaceAlt, color: t.text }]}
        />
      </View>
    );
  }

  const DateTimePicker = require('@react-native-community/datetimepicker').default as typeof import('@react-native-community/datetimepicker').default;
  const shown = draft ?? minutes;

  const close = () => {
    if (draft !== null && draft !== minutes) onChange(draft);
    setDraft(null);
    setOpen(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${hhmm(minutes)}, change time`}
        onPress={() => (open ? close() : setOpen(true))}
        style={[styles.tile, { backgroundColor: t.surfaceAlt }]}
      >
        <Text style={{ color: t.textMuted, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: t.text, fontFamily: 'GeistMono_500Medium', fontSize: 22 }}>{hhmm(shown)}</Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: space.sm }}>
          <DateTimePicker
            value={dateAtMinute(shown)}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            is24Hour
            onChange={(event, date) => {
              if (event.type === 'dismissed') return setOpen(false);
              if (!date) return;
              if (Platform.OS === 'android') {
                setOpen(false);
                if (minuteOfDate(date) !== minutes) onChange(minuteOfDate(date));
              } else {
                setDraft(minuteOfDate(date));
              }
            }}
          />
          {Platform.OS === 'ios' && <Button title="Done" variant="secondary" onPress={close} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tile: { height: 64, borderRadius: 16, paddingHorizontal: 14, justifyContent: 'center', gap: 2 },
  input: { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 18, fontWeight: '800', minWidth: 96, textAlign: 'center' },
});
