import { Redirect, Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineBanner } from '../../src/components/OfflineBanner';
import { useFriendRequestSubscription, useFriendRequests } from '../../src/hooks/useFriends';
import { useStudyRooms } from '../../src/hooks/useStudy';
import { registerForPush } from '../../src/lib/notifications';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors } from '../../src/theme';

/**
 * Icon paths taken from the prototype's inline SVGs so the tab bar is
 * pixel-identical rather than approximated with an icon font.
 */
const ICONS = {
  today: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  read: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 18H7c-.55 0-1-.45-1-1V5c0-.55.45-1 1-1h10c.55 0 1 .45 1 1v14c0 .55-.45 1-1 1zm-5-9h4v2h-4zm0 4h4v2h-4zm-4-4h3v6H8z',
  study:
    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  friends: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
  me: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
} as const;

export default function TabsLayout() {
  const { session, loading, user } = useAuth();
  const insets = useSafeAreaInsets();

  useFriendRequestSubscription();
  const { data: requests } = useFriendRequests();
  const { data: rooms } = useStudyRooms();

  useEffect(() => {
    if (user) void registerForPush(user.id);
  }, [user]);

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;

  const requestCount = requests?.length ?? 0;
  const liveRooms = rooms?.some((r) => r.call_started_at !== null) ?? false;

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      <OfflineBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: 'rgba(6,8,14,0.97)',
            borderTopWidth: 1,
            borderTopColor: colors.lineRule,
            height: 54 + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom || 8,
            elevation: 0,
          },
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors.muted500,
          tabBarLabelStyle: { fontSize: 9, marginTop: 3 },
          tabBarItemStyle: { paddingVertical: 3 },
          // A tab change is a small, confirmable action; a light tick makes the
          // bar feel physical rather than laggy on slower devices.
          tabBarButton: undefined,
          sceneStyle: { backgroundColor: colors.screen },
        }}
        screenListeners={{
          tabPress: () => {
            if (Platform.OS !== 'web') void Haptics.selectionAsync();
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon path={ICONS.today} color={color} focused={focused} />
            ),
            tabBarLabel: ({ color, focused }) => (
              <TabLabel label="Today" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="read"
          options={{
            title: 'Read',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon path={ICONS.read} color={color} focused={focused} />
            ),
            tabBarLabel: ({ color, focused }) => (
              <TabLabel label="Read" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="study"
          options={{
            title: 'Study',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                path={ICONS.study}
                color={color}
                focused={focused}
                dot={liveRooms ? colors.teal : undefined}
              />
            ),
            tabBarLabel: ({ color, focused }) => (
              <TabLabel label="Study" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Friends',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                path={ICONS.friends}
                color={color}
                focused={focused}
                dot={requestCount > 0 ? colors.violet : undefined}
              />
            ),
            tabBarLabel: ({ color, focused }) => (
              <TabLabel label="Friends" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: 'Me',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon path={ICONS.me} color={color} focused={focused} />
            ),
            tabBarLabel: ({ color, focused }) => (
              <TabLabel label="Me" color={color} focused={focused} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

function TabIcon({
  path,
  color,
  dot,
}: {
  path: string;
  color: string;
  focused: boolean;
  dot?: string;
}) {
  return (
    <View style={{ width: 26, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d={path} fill={color} />
      </Svg>
      {dot ? (
        <View
          style={{
            position: 'absolute',
            top: -1,
            right: 0,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: dot,
            borderWidth: 1.5,
            borderColor: '#060810',
          }}
        />
      ) : null}
    </View>
  );
}

function TabLabel({
  label,
  color,
  focused,
}: {
  label: string;
  color: string;
  focused: boolean;
}) {
  return (
    <Text
      style={{ fontSize: 9, fontWeight: focused ? '700' : '500', color }}
      allowFontScaling={false}
    >
      {label}
    </Text>
  );
}
