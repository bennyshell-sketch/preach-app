import '../global.css';

import {
  NotoSerif_400Regular,
  NotoSerif_400Regular_Italic,
  NotoSerif_600SemiBold,
  NotoSerif_700Bold,
} from '@expo-google-fonts/noto-serif';
import {
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/providers/AuthProvider';
import { NetworkProvider } from '../src/providers/NetworkProvider';
import { colors } from '../src/theme';

void SplashScreen.preventAutoHideAsync();
void SystemUI.setBackgroundColorAsync(colors.screen);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Phones lose connectivity constantly; one automatic retry is helpful,
      // more just delays the cached fallback the reader already has.
      retry: 1,
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    NotoSerif_400Regular,
    NotoSerif_400Regular_Italic,
    NotoSerif_600SemiBold,
    NotoSerif_700Bold,
  });

  useEffect(() => {
    // A font failure should not leave the user staring at a splash screen; the
    // system font is a far better outcome than an unbootable app.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.screen }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NetworkProvider>
              <StatusBar style="light" />
              <NotificationRouter />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.screen },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                <Stack.Screen
                  name="room/[id]"
                  options={{ animation: 'slide_from_bottom' }}
                />
                <Stack.Screen name="circle/[id]" />
                <Stack.Screen name="chat/[id]" />
                <Stack.Screen name="journal/[id]" />
                <Stack.Screen name="member/[id]" />
                <Stack.Screen name="shared-journal/[friendId]" />
                <Stack.Screen name="profile/edit" />
                <Stack.Screen name="settings/index" />
              </Stack>
            </NetworkProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Deep-links a tapped notification to the screen it refers to. Handles both a
 * tap while running and a cold start from a notification.
 */
function NotificationRouter() {
  const router = useRouter();
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (handled.current) return;
      const route = extractRoute(response?.notification);
      if (route) setPendingRoute(route);
      handled.current = true;
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = extractRoute(response.notification);
      if (route) setPendingRoute(route);
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pendingRoute) return;
    router.push(pendingRoute as any);
    setPendingRoute(null);
  }, [pendingRoute, router]);

  return null;
}

function extractRoute(notification: Notifications.Notification | undefined | null) {
  const data = notification?.request.content.data as { route?: string } | undefined;
  return typeof data?.route === 'string' ? data.route : null;
}
