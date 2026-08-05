import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field } from '../../src/components/ui';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors } from '../../src/theme';

export default function SignUp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUpWithEmail } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signUpWithEmail(email, password, name);
      // With email confirmation on, there is no session yet; say so rather
      // than dumping the user back on a sign-in screen with no explanation.
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.screen,
          justifyContent: 'center',
          paddingHorizontal: 30,
          gap: 14,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>
          Check your inbox
        </Text>
        <Text style={{ fontSize: 13, color: colors.muted200, lineHeight: 21 }}>
          We sent a confirmation link to {email.trim()}. Open it, and you are in.
        </Text>
        <Text style={{ fontSize: 12, color: colors.muted400, lineHeight: 19 }}>
          If your project has email confirmation switched off, you can sign in
          straight away.
        </Text>
        <Button
          label="Back to sign in"
          full
          onPress={() => router.replace('/(auth)/sign-in')}
          style={{ marginTop: 10 }}
        />
      </View>
    );
  }

  const passwordTooShort = password.length > 0 && password.length < 6;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 26,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{ fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.9 }}
        >
          Create your account
        </Text>
        <Text style={{ fontSize: 13, color: colors.muted300, marginTop: 7, marginBottom: 26 }}>
          Your highlights, journal and study rooms live here.
        </Text>

        <Field
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
          style={{ marginBottom: 9 }}
        />
        <Field
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          style={{ marginBottom: 9 }}
        />
        <Field
          placeholder="Password (at least 6 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          style={{ marginBottom: 10 }}
        />

        {passwordTooShort ? (
          <Text style={{ fontSize: 11.5, color: colors.muted300, marginBottom: 8 }}>
            A few more characters.
          </Text>
        ) : null}

        {error ? (
          <Text style={{ fontSize: 12, color: colors.rose, marginBottom: 12, lineHeight: 18 }}>
            {error}
          </Text>
        ) : null}

        <Button
          label="Create account"
          full
          loading={busy}
          disabled={!name.trim() || !email.trim() || password.length < 6}
          onPress={submit}
        />

        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{ alignSelf: 'center', marginTop: 22 }}
        >
          <Text style={{ fontSize: 12.5, color: colors.muted300 }}>
            Already have an account? <Text style={{ color: colors.gold }}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
