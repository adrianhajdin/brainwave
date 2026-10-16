import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../src/AppProvider';
import { appleSignInAvailable, isCancellation, signInWithApple, signInWithGoogle } from '../src/auth/social';
import { supabase } from '../src/backend/supabaseClient';
import { Button, Card, CatAvatar } from '../src/components/ui';
import { capabilities } from '../src/runtime';
import { radius, space, useTheme } from '../src/theme';

type Busy = 'in' | 'up' | 'apple' | 'google' | 'resend' | null;

export default function Login() {
  const t = useTheme();
  const router = useRouter();
  const { backend, startDemo, supabaseConfigured } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    void appleSignInAvailable().then(setApple).catch(() => setApple(false));
  }, []);

  if (backend) return <Redirect href="/" />;

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      if (!isCancellation(e)) setMessage({ text: e instanceof Error ? e.message : String(e), tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const signIn = () =>
    run('in', async () => {
      const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        if (/confirm/i.test(error.message)) setNeedsConfirm(true);
        throw new Error(/confirm/i.test(error.message) ? 'Please confirm your e-mail first (check your inbox).' : error.message);
      }
    });

  const signUp = () =>
    run('up', async () => {
      const { data, error } = await supabase!.auth.signUp({ email: email.trim(), password });
      if (error) throw new Error(error.message);
      if (!data.session) {
        setNeedsConfirm(true);
        setMessage({ text: `We sent a confirmation link to ${email.trim()}. Open it, then sign in here.`, tone: 'info' });
      }
    });

  const resend = () =>
    run('resend', async () => {
      const { error } = await supabase!.auth.resend({ type: 'signup', email: email.trim() });
      if (error) throw new Error(error.message);
      setMessage({ text: 'Confirmation e-mail sent again.', tone: 'info' });
    });

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }];
  const formValid = /.+@.+\..+/.test(email.trim()) && password.length >= 8;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.avatars}>
              <CatAvatar name="M" color="#F59E0B" size={44} />
              <CatAvatar name="T" color="#6366F1" size={56} />
              <CatAvatar name="P" color="#EC4899" size={44} />
            </View>
            <Text style={[styles.title, { color: t.text }]}>Cat Tracker</Text>
            <Text style={[styles.subtitle, { color: t.textMuted }]}>
              Live location, route history and home-zone alerts for every cat in the house.
            </Text>
          </View>

          {supabaseConfigured ? (
            <Card style={{ gap: space.md }}>
              <Text style={[styles.cardTitle, { color: t.text }]}>Sign in</Text>

              {apple && (() => {
                const Apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
                return (
                  <Apple.AppleAuthenticationButton
                    buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={t.isDark ? Apple.AppleAuthenticationButtonStyle.WHITE : Apple.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={radius.md}
                    style={{ height: 48, opacity: busy === 'apple' ? 0.6 : 1 }}
                    onPress={() => void run('apple', () => signInWithApple(supabase!))}
                  />
                );
              })()}
              {capabilities.googleSignIn && (
                <Button
                  title="Continue with Google"
                  icon="G"
                  variant="secondary"
                  busy={busy === 'google'}
                  onPress={() => void run('google', () => signInWithGoogle(supabase!))}
                />
              )}
              {(apple || capabilities.googleSignIn) && (
                <View style={styles.divider}>
                  <View style={[styles.line, { backgroundColor: t.border }]} />
                  <Text style={{ color: t.textMuted }}>or with e-mail</Text>
                  <View style={[styles.line, { backgroundColor: t.border }]} />
                </View>
              )}

              <TextInput
                style={input}
                placeholder="E-mail"
                placeholderTextColor={t.textMuted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={input}
                placeholder="Password (min. 8 characters)"
                placeholderTextColor={t.textMuted}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                value={password}
                onChangeText={setPassword}
              />
              {message && <Text style={{ color: message.tone === 'error' ? t.danger : t.live, lineHeight: 20 }}>{message.text}</Text>}
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button style={{ flex: 1 }} title="Sign in" onPress={() => void signIn()} busy={busy === 'in'} disabled={!formValid} />
                <Button style={{ flex: 1 }} variant="secondary" title="Create account" onPress={() => void signUp()} busy={busy === 'up'} disabled={!formValid} />
              </View>
              <View style={styles.links}>
                <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/reset-password', params: { email: email.trim() } })}>
                  <Text style={{ color: t.accent, fontWeight: '700' }}>Forgot password?</Text>
                </Pressable>
                {needsConfirm && (
                  <Pressable accessibilityRole="link" onPress={() => void resend()} disabled={busy === 'resend'}>
                    <Text style={{ color: t.accent, fontWeight: '700' }}>Resend confirmation</Text>
                  </Pressable>
                )}
              </View>
            </Card>
          ) : (
            <Card>
              <Text style={{ color: t.textMuted, lineHeight: 20 }}>
                No backend configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to app/.env and
                restart Expo to use accounts.
              </Text>
            </Card>
          )}

          <Card style={{ gap: space.md, marginTop: space.lg }}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Just looking?</Text>
            <Text style={{ color: t.textMuted, lineHeight: 20 }}>
              Demo mode runs on this phone only: two simulated cats wander nearby, and you can add a cat that follows this
              phone's real GPS.
            </Text>
            <Button title="Start demo" icon="🐾" variant="secondary" onPress={startDemo} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.xl, paddingTop: space.xl * 2, maxWidth: 520, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', marginBottom: space.xl },
  avatars: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginBottom: space.lg },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: space.sm, lineHeight: 22 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
});
