/**
 * Another person's profile: their stats, their public study notes, and the
 * actions you can take — add as a friend, send them a verse.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShareVerseSheet } from '../../src/components/friends/ShareVerseSheet';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  IconButton,
  Loading,
} from '../../src/components/ui';
import {
  useFriends,
  useProfile,
  useSendFriendRequest,
  useSendMessage,
} from '../../src/hooks/useFriends';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors } from '../../src/theme';
import { useQuery } from '@tanstack/react-query';

export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [sharing, setSharing] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = useProfile(id ?? null);
  const friends = useFriends();
  const sendRequest = useSendFriendRequest();
  const sendMessage = useSendMessage();
  const notes = usePublicNotes(id ?? null, profile.data?.notes_public ?? false);

  const isMe = id === user?.id;
  const isFriend = (friends.data ?? []).some((f) => f.friend_id === id);

  if (profile.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.screen, paddingTop: insets.top }}>
        <Loading />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 10,
          paddingHorizontal: 13,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          borderBottomWidth: 1,
          borderBottomColor: colors.lineRule,
        }}
      >
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
              fill="#7a8a9e"
            />
          </Svg>
        </IconButton>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink }}>
          {isMe ? 'Your profile' : 'Member profile'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Avatar
            name={profile.data?.display_name ?? '?'}
            url={profile.data?.avatar_url}
            seed={id}
            size={56}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>
              {profile.data?.display_name ?? 'Member'}
            </Text>
            <Text style={{ fontSize: 11.5, color: colors.muted300, marginTop: 3 }}>
              {profile.data?.bio ?? 'No bio yet.'}
            </Text>
            {profile.data?.denomination ? (
              <Text style={{ fontSize: 10.5, color: colors.muted400, marginTop: 3 }}>
                {profile.data.denomination}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 7, marginBottom: 14 }}>
          <MemberStat
            label="Streak"
            value={profile.data?.streak_days ?? 0}
            color={colors.gold}
          />
          <MemberStat label="Public notes" value={notes.data?.length ?? 0} color={colors.violet} />
          <MemberStat
            label="Member since"
            text={
              profile.data
                ? new Date(profile.data.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    year: '2-digit',
                  })
                : '—'
            }
            color={colors.teal}
          />
        </View>

        {error ? (
          <Text style={{ fontSize: 12, color: colors.rose, marginBottom: 10 }}>{error}</Text>
        ) : null}

        {!isMe ? (
          <View style={{ gap: 8, marginBottom: 18 }}>
            {isFriend ? (
              <>
                <Button
                  label="Open chat"
                  full
                  onPress={() => router.push(`/chat/${id}`)}
                />
                <Button
                  label="Send a verse ✦"
                  variant="violet"
                  full
                  onPress={() => setSharing(true)}
                />
              </>
            ) : (
              <Button
                label={requested ? 'Request sent' : '+ Add friend'}
                variant="teal"
                full
                disabled={requested}
                loading={sendRequest.isPending}
                onPress={async () => {
                  setError(null);
                  try {
                    if (id) await sendRequest.mutateAsync(id);
                    setRequested(true);
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : 'Could not send the request.',
                    );
                  }
                }}
              />
            )}
          </View>
        ) : null}

        <Text
          style={{
            fontSize: 9,
            color: colors.muted600,
            fontWeight: '700',
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Public study notes
        </Text>

        {!profile.data?.notes_public ? (
          <EmptyState title="This member keeps their notes private." />
        ) : notes.isLoading ? (
          <Loading />
        ) : notes.data?.length ? (
          notes.data.map((note) => (
            <Card key={note.id} style={{ marginBottom: 8, borderRadius: 11, padding: 10 }}>
              <Text
                style={{
                  fontSize: 10,
                  color: colors.gold,
                  fontWeight: '700',
                  marginBottom: 4,
                }}
              >
                {note.verse_ref ?? 'Note'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted50, lineHeight: 19.2 }}>
                {note.body}
              </Text>
            </Card>
          ))
        ) : (
          <EmptyState title="This member hasn’t shared any notes yet." />
        )}
      </ScrollView>

      <ShareVerseSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        onSend={async (ref, message) => {
          if (!id) return;
          await sendMessage.mutateAsync({
            recipientId: id,
            sharedVerseRef: ref,
            body: message || undefined,
          });
          setSharing(false);
          router.push(`/chat/${id}`);
        }}
      />
    </View>
  );
}

/**
 * Shared room notes by this member. Private notes are excluded by RLS, not by
 * this filter — the `is_shared` clause only narrows what is already permitted.
 */
function usePublicNotes(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['public-notes', userId],
    enabled: Boolean(userId) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_room_notes')
        .select('id, body, verse_ref, created_at')
        .eq('user_id', userId!)
        .eq('is_shared', true)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as {
        id: string;
        body: string;
        verse_ref: string | null;
        created_at: string;
      }[];
    },
  });
}

function MemberStat({
  label,
  value,
  text,
  color,
}: {
  label: string;
  value?: number;
  text?: string;
  color: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.lineEdge,
        borderRadius: 11,
        padding: 10,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '800', color }}>{text ?? value}</Text>
      <Text
        style={{
          fontSize: 9,
          color: colors.muted400,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.7,
          marginTop: 2,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
