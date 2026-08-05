/**
 * Boot gate: hold until the persisted session has been read, then send the
 * user to the app or to sign-in. Rendering a tab layout before this resolves
 * makes every screen flash an empty state on cold start.
 */
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../src/providers/AuthProvider';
import { colors } from '../src/theme';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.screen,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return <Redirect href={session ? '/(tabs)' : '/(auth)/sign-in'} />;
}
