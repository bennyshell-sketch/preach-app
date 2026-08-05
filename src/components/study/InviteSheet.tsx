/**
 * Invite a friend into a study room. Only friends are listed — inviting a
 * stranger by email would mean exposing the room to an unverified address, and
 * the server refuses it anyway.
 */
import { useState } from 'react';
import { FlatList, Pressable, Text } from 'react-native';

import { Avatar, EmptyState, Sheet } from '../ui';
import { useFriends } from '../../hooks/useFriends';
import { useInviteToRoom, useRoomMembers } from '../../hooks/useStudy';
import { colors } from '../../theme';

export function InviteSheet({
  visible,
  roomId,
  canInvite,
  onClose,
}: {
  visible: boolean;
  roomId: string;
  canInvite: boolean;
  onClose(): void;
}) {
  const friends = useFriends();
  const members = useRoomMembers(roomId || null);
  const invite = useInviteToRoom();
  const [invited, setInvited] = useState<string[]>([]);

  const memberIds = new Set((members.data ?? []).map((m) => m.user_id));
  const candidates = (friends.data ?? []).filter((f) => !memberIds.has(f.friend_id));

  return (
    <Sheet visible={visible} onClose={onClose} scrollable elevated>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 4 }}>
        Invite to room
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted400, marginBottom: 14 }}>
        {canInvite
          ? 'Share this study with a friend.'
          : 'Only the room owner or a moderator can invite people.'}
      </Text>

      {canInvite ? (
        <FlatList
          data={candidates}
          keyExtractor={(f) => f.friend_id}
          scrollEnabled={false}
          ListEmptyComponent={
            <EmptyState
              title={
                friends.data?.length
                  ? 'All of your friends are already in this room.'
                  : 'Add a friend first, then you can invite them here.'
              }
            />
          }
          renderItem={({ item }) => {
            const done = invited.includes(item.friend_id);
            return (
              <Pressable
                disabled={done}
                onPress={async () => {
                  await invite.mutateAsync({ roomId, userId: item.friend_id });
                  setInvited((prev) => [...prev, item.friend_id]);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.lineHair,
                  opacity: done ? 0.55 : 1,
                }}
              >
                <Avatar
                  name={item.display_name}
                  url={item.avatar_url}
                  seed={item.friend_id}
                  size={38}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: '700',
                    color: colors.inkTertiary,
                  }}
                >
                  {item.display_name}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: done ? colors.muted400 : colors.teal,
                  }}
                >
                  {done ? 'Invited' : 'Invite'}
                </Text>
              </Pressable>
            );
          }}
        />
      ) : null}
    </Sheet>
  );
}
