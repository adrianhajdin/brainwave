/**
 * Password reset with a 6-digit e-mail code (no deep links needed):
 * resetPasswordForEmail -> verifyOtp(type 'recovery') -> updateUser.
 * Requires the Supabase "Reset password" e-mail template to include
 * {{ .Token }} (see app/README.md).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { supabase } from '../src/backend/supabaseClient';
import { Button, Card } from '../src/components/ui';
import { radius, space, useTheme } from '../src/theme';

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
      <Card style={{ gap: space.md }}>
        {step === 'email' ? (
          <>
            <Text style={{ color: t.textMuted, lineHeight: 20 }}>Enter your e-mail and we'll send you a code to choose a new password.</Text>
            <TextInput style={input} placeholder="E-mail" placeholderTextColor={t.textMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <Button title="Send code" onPress={() => void sendCode()} busy={busy} disabled={!/.+@.+\..+/.test(email.trim())} />
          </>
        ) : (
          <>
            <TextInput style={input} placeholder="6-digit code" placeholderTextColor={t.textMuted} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={8} value={code} onChangeText={setCode} />
            <TextInput style={input} placeholder="New password (min. 8 characters)" placeholderTextColor={t.textMuted} secureTextEntry textContentType="newPassword" value={password} onChangeText={setPassword} />
            <Button title="Set new password" onPress={() => void setNewPassword()} busy={busy} disabled={code.trim().length < 6 || password.length < 8} />
            <Button title="Send a new code" variant="ghost" onPress={() => void sendCode()} />
          </>
        )}
        {message && <Text style={{ color: message.tone === 'error' ? t.danger : t.live, lineHeight: 20 }}>{message.text}</Text>}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.xl, maxWidth: 520, width: '100%', alignSelf: 'center' },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16 },
});
