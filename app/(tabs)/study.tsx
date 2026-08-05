/**
 * Study — rooms, the anonymous community circles, and semantic verse search.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateRoomSheet } from '../../src/components/study/CreateRoomSheet';
import { VerseSearch } from '../../src/components/study/VerseSearch';
import {
  Card,
  EmptyState,
  ErrorState,
  LiveDot,
  Loading,
  PillButton,
  TabRow,
} from '../../src/components/ui';
import { useHealingCircles, useJoinRoom, useStudyRooms } from '../../src/hooks/useStudy';
import { formatRef } from '../../src/lib/bible/books';
import { colors } from '../../src/theme';

type Tab = 'rooms' | 'community' | 'search';

export default function StudyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('rooms');
  const [creating, setCreating] = useState(false);

  const rooms = useStudyRooms();
  const circles = useHealingCircles();
  const joinRoom = useJoinRoom();

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen, paddingTop: insets.top }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <View>
          <Text
            style={{ fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 }}
          >
            Study
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted400, marginTop: 2 }}>
            Grow together in the Word
          </Text>
        </View>
        <PillButton label="+ New Room" onPress={() => setCreating(true)} />
      </View>

      <View style={{ marginHorizontal: 13, marginBottom: 11 }}>
        <TabRow<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'rooms', label: 'Rooms' },
            { value: 'community', label: 'Community' },
            { value: 'search', label: 'Search' },
          ]}
        />
      </View>

      {tab === 'rooms' ? (
        rooms.isLoading ? (
          <Loading />
        ) : rooms.isError ? (
          <ErrorState
            message={(rooms.error as Error).message}
            onRetry={() => void rooms.refetch()}
          />
        ) : (
          <FlatList
            data={rooms.data ?? []}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ paddingHorizontal: 13, paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={rooms.isFetching}
                onRefresh={() => void rooms.refetch()}
                tintColor={colors.gold}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="No study rooms yet."
                hint="Create one and invite a friend to work through a passage together."
              />
            }
            renderItem={({ item }) => (
              <Card
                accent={item.call_started_at ? 'rgba(74,171,158,0.28)' : colors.lineEdge}
                style={{ borderRadius: 16, padding: 13, marginBottom: 10 }}
                onPress={async () => {
                  if (!item.is_member) await joinRoom.mutateAsync(item.id);
                  router.push(`/room/${item.id}`);
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 9,
                    marginBottom: 10,
                  }}
                >
                  {item.call_started_at ? (
                    <View style={{ marginTop: 5 }}>
                      <LiveDot />
                    </View>
                  ) : (
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: colors.muted400,
                        marginTop: 5,
                      }}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13.5,
                        fontWeight: '700',
                        color: colors.inkSecondary,
                        marginBottom: 2,
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted400 }}>
                      {item.verse_ref
                        ? `${formatRef(item.verse_ref, 'long')}${
                            item.verse_ref_end
                              ? `–${item.verse_ref_end.split('.')[2]}`
                              : ''
                          }`
                        : (item.description ?? 'Open study')}
                    </Text>
                  </View>
                  {item.call_started_at ? (
                    <View
                      style={{
                        backgroundColor: colors.gold,
                        borderRadius: 6,
                        paddingVertical: 2,
                        paddingHorizontal: 6,
                      }}
                    >
                      <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.screen }}>
                        Live
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={{ fontSize: 11, color: colors.muted400 }}>
                    {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
                  </Text>
                  <Text
                    style={{
                      marginLeft: 'auto',
                      fontSize: 12,
                      fontWeight: '700',
                      color: item.is_member ? colors.gold : colors.teal,
                    }}
                  >
                    {item.is_member ? 'Open →' : 'Join →'}
                  </Text>
                </View>
              </Card>
            )}
          />
        )
      ) : null}

      {tab === 'community' ? (
        circles.isLoading ? (
          <Loading />
        ) : (
          <FlatList
            data={circles.data ?? []}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingHorizontal: 13, paddingBottom: 24 }}
            ListHeaderComponent={
              <View
                style={{
                  padding: 11,
                  backgroundColor: colors.inset,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.lineRule,
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 11.5, color: colors.muted300, lineHeight: 18.4 }}>
                  Circles are anonymous. You are given a different name in each one, and it
                  cannot be traced back to your account.
                </Text>
              </View>
            }
            ListEmptyComponent={<EmptyState title="No circles are open right now." />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/circle/${item.id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.lineEdge,
                  borderRadius: 13,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    backgroundColor: `${item.accent}1f`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: colors.inkTertiary,
                      marginBottom: 2,
                    }}
                  >
                    {item.topic}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted400 }}>
                    {item.member_count} {item.member_count === 1 ? 'member' : 'members'} ·{' '}
                    {item.online_count} online
                  </Text>
                </View>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: item.online_count > 0 ? item.accent : colors.muted400,
                  }}
                />
              </Pressable>
            )}
          />
        )
      ) : null}

      {tab === 'search' ? <VerseSearch /> : null}

      <CreateRoomSheet visible={creating} onClose={() => setCreating(false)} />
    </View>
  );
}
