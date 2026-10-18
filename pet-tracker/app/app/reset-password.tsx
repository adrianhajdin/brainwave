/**
 * Password reset with a 6-digit e-mail code (no deep links needed):
 * resetPasswordForEmail -> verifyOtp(type 'recovery') -> updateUser.
 * Requires the Supabase "Reset password" e-mail template to include
 * {{ .Token }} (see app/README.md).
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../src/backend/supabaseClient';
import { Button } from '../src/components/ui';
import { fonts, radius, space, useTheme } from '../src/theme';

const CODE_LENGTH = 6;

export default function ResetPassword() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }];

  const sendCode = async () => {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    if (error) return setMessage({ text: error.message, tone: 'error' });
    setStep('code');
    setMessage({ text: `If ${email.trim()} has an account, a 6-digit code is on its way.`, tone: 'info' });
  };

  const setNewPassword = async () => {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
    if (error) {
      setBusy(false);
      return setMessage({ text: error.message, tone: 'error' });
    }
    const { error: updError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updError) return setMessage({ text: updError.message, tone: 'error' });
    router.replace('/'); // signed in with the new password
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.steps}>
        <Text style={[styles.stepLabel, { color: step === 'email' ? t.text : t.textMuted, borderColor: step === 'email' ? t.text : 'transparent' }]}>
          1 · E-mail
        </Text>
        <Text style={[styles.stepLabel, { color: step === 'code' ? t.text : t.textMuted, borderColor: step === 'code' ? t.text : 'transparent' }]}>
          2 · New password
        </Text>
      </View>

      <Text style={[styles.title, { color: t.text }]}>Reset password</Text>

      {message && (
        <View style={[styles.banner, { backgroundColor: message.tone === 'error' ? t.dangerSoft : t.liveSoft }]}>
          <Ionicons name={message.tone === 'error' ? 'alert-circle-outline' : 'mail-outline'} size={18} color={message.tone === 'error' ? t.danger : t.live} />
          <Text style={{ color: message.tone === 'error' ? t.danger : t.live, flex: 1, lineHeight: 20 }}>{message.text}</Text>
        </View>
      )}

      {step === 'email' ? (
        <>
          <Text style={{ color: t.textMuted, lineHeight: 20 }}>Enter your e-mail and we'll send you a code to choose a new password.</Text>
          <TextInput
            style={input}
            placeholder="E-mail"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="E-mail"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Button title="Send code" onPress={() => void sendCode()} busy={busy} disabled={!/.+@.+\..+/.test(email.trim())} />
        </>
      ) : (
        <>
          <Text style={[styles.label, { color: t.textMuted }]}>6-digit code</Text>
          <View style={styles.codeRow}>
            {Array.from({ length: CODE_LENGTH }, (_, i) => {
              const digit = code[i];
              const active = i === code.length && code.length < CODE_LENGTH;
              return (
                <View
                  key={i}
                  style={[styles.codeBox, { backgroundColor: t.surface, borderColor: active ? t.text : t.border }]}
                >
                  <Text style={[styles.codeDigit, { color: t.text }]}>{digit ?? ''}</Text>
                </View>
              );
            })}
            {/* One real input sits over the boxes, so paste and autofill still work. */}
            <TextInput
              accessibilityLabel="6-digit code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={8}
              style={styles.hiddenInput}
            />
          </View>

          <Text style={[styles.label, { color: t.textMuted }]}>New password</Text>
          <TextInput
            style={input}
            placeholder="At least 8 characters"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="New password"
            secureTextEntry
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
          />
          <Button title="Set new password" onPress={() => void setNewPassword()} busy={busy} disabled={code.trim().length < CODE_LENGTH || password.length < 8} />
          <View style={styles.links}>
            <Pressable accessibilityRole="link" onPress={() => setStep('email')}>
              <Text style={{ color: t.accent, fontFamily: fonts.bodySemibold }}>Use another e-mail</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => void sendCode()}>
              <Text style={{ color: t.accent, fontFamily: fonts.bodySemibold }}>Send a new code</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.xl, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  steps: { flexDirection: 'row', gap: space.lg },
  stepLabel: { fontFamily: fonts.bodySemibold, paddingBottom: 6, borderBottomWidth: 2 },
  title: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.6, marginBottom: space.xs },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: space.sm },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.md, borderRadius: radius.md },
  codeRow: { flexDirection: 'row', gap: space.sm, position: 'relative' },
  codeBox: { flex: 1, height: 56, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  codeDigit: { fontFamily: 'GeistMono_500Medium', fontSize: 22 },
  hiddenInput: { ...StyleSheet.absoluteFill, opacity: 0 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16, fontFamily: fonts.body },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
});
