import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field } from '../../src/components/ui';
import { googleSignInAvailable } from '../../src/lib/config';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors, DIAGONAL, gradients } from '../../src/theme';

export default function SignIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    // Apple Sign In only exists on iOS 13+; asking is cheaper than guessing.
    if (Platform.OS === 'ios') {
      void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const run = async (kind: 'email' | 'google' | 'apple', fn: () => Promise<void>) => {
    setError(null);
    setBusy(kind);
    try {
      await fn();
      router.replace('/(tabs)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      // A cancelled native sheet is a decision, not an error to shout about.
      if (!/cancel/i.test(message)) setError(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 48,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 26,
          justifyContent: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 34 }}>
          <Text
            style={{
              fontSize: 38,
              fontWeight: '800',
              color: colors.ink,
              letterSpacing: -1.1,
            }}
          >
            Preach<Text style={{ color: colors.gold }}>.</Text>
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted300, marginTop: 8, lineHeight: 20 }}>
            Scripture in the original languages, and the people to read it with.
          </Text>
        </View>

        <Field
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          style={{ marginBottom: 9 }}
        />
        <Field
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          style={{ marginBottom: 6 }}
        />

        <Link href="/(auth)/forgot-password" asChild>
          <Pressable hitSlop={8} style={{ alignSelf: 'flex-end', paddingVertical: 8 }}>
            <Text style={{ fontSize: 11.5, color: colors.muted300 }}>Forgot password?</Text>
          </Pressable>
        </Link>

        {error ? (
          <Text
            style={{
              fontSize: 12,
              color: colors.rose,
              marginBottom: 12,
              lineHeight: 18,
            }}
          >
            {error}
          </Text>
        ) : null}

        <Button
          label="Sign in"
          full
          loading={busy === 'email'}
          disabled={!email.trim() || !password || busy !== null}
          onPress={() => run('email', () => signInWithEmail(email, password))}
          style={{ marginTop: 4 }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.lineEdge }} />
          <Text style={{ fontSize: 10.5, color: colors.muted500, letterSpacing: 1 }}>OR</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.lineEdge }} />
        </View>

        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={11}
            style={{ height: 46, marginBottom: 10 }}
            onPress={() => run('apple', signInWithApple)}
          />
        ) : null}

        {googleSignInAvailable ? (
          <Pressable
            onPress={() => run('google', signInWithGoogle)}
            disabled={busy !== null}
            accessibilityRole="button"
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            <LinearGradient
              colors={['#141b28', '#0d1422']}
              {...DIAGONAL}
              style={{
                height: 46,
                borderRadius: 11,
                borderWidth: 1,
                borderColor: colors.lineEdge,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 9,
              }}
            >
              <GoogleMark />
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink }}>
                Continue with Google
              </Text>
            </LinearGradient>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 26, gap: 5 }}>
          <Text style={{ fontSize: 12.5, color: colors.muted300 }}>New here?</Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable hitSlop={6}>
              <Text style={{ fontSize: 12.5, color: colors.gold, fontWeight: '700' }}>
                Create an account
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The Google "G", drawn inline so the sign-in button needs no remote asset. */
function GoogleMark() {
  return (
    <LinearGradient
      colors={gradients.goldButton}
      {...DIAGONAL}
      style={{ width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: 11, fontWeight: '800', color: '#06090f' }}>G</Text>
    </LinearGradient>
  );
}
