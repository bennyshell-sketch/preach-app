/**
 * Friends — the conversation list and incoming requests.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddFriendSheet } from '../../src/components/friends/AddFriendSheet';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PillButton,
  TabRow,
} from '../../src/components/ui';
import {
  useFriendRequests,
  useFriends,
  useRespondToRequest,
} from '../../src/hooks/useFriends';
import { colors } from '../../src/theme';

type Tab = 'friends' | 'requests';

export default function FriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('friends');
  const [adding, setAdding] = useState(false);

  const friends = useFriends();
  const requests = useFriendRequests();
  const respond = useRespondToRequest();

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen, paddingTop: insets.top }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text
          style={{ fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 }}
        >
          Friends
        </Text>
        <PillButton label="Add Friend" onPress={() => setAdding(true)} />
      </View>

      <View style={{ marginHorizontal: 13, marginBottom: 10 }}>
        <TabRow<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'friends', label: 'Friends' },
            {
              value: 'requests',
              label: 'Requests',
              badge: requests.data?.length || undefined,
            },
          ]}
        />
      </View>

      {tab === 'friends' ? (
        friends.isLoading ? (
          <Loading />
        ) : friends.isError ? (
          <ErrorState
            message={(friends.error as Error).message}
            onRetry={() => void friends.refetch()}
          />
        ) : (
          <FlatList
            data={friends.data ?? []}
            keyExtractor={(f) => f.friend_id}
            contentContainerStyle={{ paddingHorizontal: 13, paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={friends.isFetching}
                onRefresh={() => void friends.refetch()}
                tintColor={colors.gold}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="No friends yet."
                hint="Add someone to share verses, voice notes and a journal with."
                action={<Button label="Find people" onPress={() => setAdding(true)} />}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/chat/${item.friend_id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.lineHair,
                }}
              >
                <Avatar
                  name={item.display_name}
                  url={item.avatar_url}
                  seed={item.friend_id}
                  size={42}
                  online={item.show_online ? undefined : false}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: colors.inkTertiary,
                      marginBottom: 2,
                    }}
                  >
                    {item.display_name}
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: colors.muted400 }}
                    numberOfLines={1}
                  >
                    {item.last_message ?? 'Say hello'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  {item.last_message_at ? (
                    <Text style={{ fontSize: 10, color: colors.muted600 }}>
                      {shortTime(item.last_message_at)}
                    </Text>
                  ) : null}
                  {item.unread_count > 0 ? (
                    <View
                      style={{
                        minWidth: 16,
                        height: 16,
                        paddingHorizontal: 4,
                        borderRadius: 8,
                        backgroundColor: colors.gold,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 8, fontWeight: '800', color: colors.screen }}>
                        {item.unread_count}
                      </Text>
                    </View>
                  ) : item.streak_days > 0 ? (
                    <Text style={{ fontSize: 10, color: colors.gold, fontWeight: '600' }}>
                      🔥 {item.streak_days}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        )
      ) : (
        <FlatList
          data={requests.data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 13, paddingBottom: 24 }}
          ListEmptyComponent={<EmptyState title="No pending requests." />}
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.lineHair,
              }}
            >
              <Avatar
                name={item.requester.display_name}
                url={item.requester.avatar_url}
                seed={item.requester.id}
                size={42}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.inkTertiary }}>
                  {item.requester.display_name}
                </Text>
                <Text
                  style={{ fontSize: 11, color: colors.muted400, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {item.requester.bio ?? 'Would like to study with you'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                <Pressable
                  onPress={() => respond.mutate({ id: item.id, accept: true })}
                  style={{
                    backgroundColor: 'rgba(74,171,158,0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(74,171,158,0.3)',
                    borderRadius: 7,
                    paddingVertical: 5,
                    paddingHorizontal: 9,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.teal }}>
                    Accept
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => respond.mutate({ id: item.id, accept: false })}
                  accessibilityLabel="Decline"
                  style={{
                    backgroundColor: 'rgba(255,100,100,0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,100,100,0.2)',
                    borderRadius: 7,
                    paddingVertical: 5,
                    paddingHorizontal: 9,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.rose }}>✕</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <AddFriendSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

function shortTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
