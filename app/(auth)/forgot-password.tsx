import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field } from '../../src/components/ui';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors } from '../../src/theme';

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sendPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 26,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.7 }}>
          Reset your password
        </Text>

        {sent ? (
          <>
            <Text
              style={{ fontSize: 13, color: colors.muted200, marginTop: 12, lineHeight: 21 }}
            >
              If there is an account for {email.trim()}, a reset link is on its way.
            </Text>
            <Button
              label="Back to sign in"
              full
              onPress={() => router.replace('/(auth)/sign-in')}
              style={{ marginTop: 22 }}
            />
          </>
        ) : (
          <>
            <Text
              style={{
                fontSize: 13,
                color: colors.muted300,
                marginTop: 8,
                marginBottom: 22,
                lineHeight: 20,
              }}
            >
              Tell us the email on your account and we will send you a link.
            </Text>

            <Field
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={{ marginBottom: 12 }}
            />

            {error ? (
              <Text style={{ fontSize: 12, color: colors.rose, marginBottom: 12 }}>{error}</Text>
            ) : null}

            <Button
              label="Send reset link"
              full
              loading={busy}
              disabled={!email.trim()}
              onPress={submit}
            />

            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={{ alignSelf: 'center', marginTop: 20 }}
            >
              <Text style={{ fontSize: 12.5, color: colors.muted300 }}>Back</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
