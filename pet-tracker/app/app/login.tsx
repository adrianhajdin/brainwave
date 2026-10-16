import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../src/AppProvider';
import { supabase } from '../src/backend/supabaseClient';
import { Button, Card, CatAvatar } from '../src/components/ui';
import { radius, space, useTheme } from '../src/theme';

export default function Login() {
  const t = useTheme();
  const { backend, startDemo, supabaseConfigured } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'in' | 'up' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (backend) return <Redirect href="/" />;

  const auth = async (kind: 'in' | 'up') => {
    if (!supabase) return;
    setBusy(kind);
    setMessage(null);
    const creds = { email: email.trim(), password };
    const { data, error } =
      kind === 'in' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
    setBusy(null);
    if (error) setMessage(error.message);
    else if (kind === 'up' && !data.session) setMessage('Check your e-mail to confirm the account, then sign in.');
  };

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }];

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

          <Card style={{ gap: space.md }}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Try it right now</Text>
            <Text style={{ color: t.textMuted, lineHeight: 20 }}>
              Demo mode runs on this phone only. Two simulated cats wander nearby, and you can add a cat that follows
              this phone's real GPS.
            </Text>
            <Button title="Start demo" icon="🐾" onPress={startDemo} />
          </Card>

          <Card style={{ gap: space.md, marginTop: space.lg }}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Your account</Text>
            {supabaseConfigured ? (
              <>
                <TextInput
                  style={input}
                  placeholder="E-mail"
                  placeholderTextColor={t.textMuted}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
                <TextInput
                  style={input}
                  placeholder="Password (min. 8 characters)"
                  placeholderTextColor={t.textMuted}
                  secureTextEntry
                  autoComplete="password"
                  value={password}
                  onChangeText={setPassword}
                />
                {message && <Text style={{ color: t.danger }}>{message}</Text>}
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button
                    style={{ flex: 1 }}
                    title="Sign in"
                    onPress={() => void auth('in')}
                    busy={busy === 'in'}
                    disabled={!email || password.length < 8}
                  />
                  <Button
                    style={{ flex: 1 }}
                    variant="secondary"
                    title="Create account"
                    onPress={() => void auth('up')}
                    busy={busy === 'up'}
                    disabled={!email || password.length < 8}
                  />
                </View>
              </>
            ) : (
              <Text style={{ color: t.textMuted, lineHeight: 20 }}>
                No backend configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to app/.env and
                restart Expo to sync cats between phones and the web dashboard.
              </Text>
            )}
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
});
