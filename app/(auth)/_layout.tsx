import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/providers/AuthProvider';
import { colors } from '../../src/theme';

export default function AuthLayout() {
  const { session, loading } = useAuth();

  // Someone who is already signed in has no business on the sign-in screen —
  // this is what closes the loop after a successful sign-in.
  if (!loading && session) return <Redirect href="/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.screen },
      }}
    />
  );
}
