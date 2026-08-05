/**
 * A study room: the member strip, shared and private notes, and the live call.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CallControls } from '../../src/components/study/CallControls';
import { InviteSheet } from '../../src/components/study/InviteSheet';
import {
  Avatar,
  EmptyState,
  IconButton,
  Loading,
  PillButton,
  TabRow,
} from '../../src/components/ui';
import { useCall } from '../../src/hooks/useCall';
import {
  useCreateNote,
  useLeaveRoom,
  useRoomMembers,
  useRoomNotes,
  useRoomPresence,
  useStudyRoom,
} from '../../src/hooks/useStudy';
import { formatRef } from '../../src/lib/bible/books';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors } from '../../src/theme';

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [notesTab, setNotesTab] = useState<'shared' | 'private'>('shared');
  const [draft, setDraft] = useState('');
  const [inviting, setInviting] = useState(false);

  const room = useStudyRoom(id ?? null);
  const members = useRoomMembers(id ?? null);
  const notes = useRoomNotes(id ?? null, notesTab === 'shared');
  const createNote = useCreateNote();
  const leaveRoom = useLeaveRoom();
  const present = useRoomPresence(id ?? null);
  const call = useCall(id ?? null);

  const send = async () => {
    if (!draft.trim() || !id) return;
    const body = draft;
    setDraft('');
    try {
      await createNote.mutateAsync({
        roomId: id,
        body,
        isShared: notesTab === 'shared',
        verseRef: room.data?.verse_ref ?? null,
      });
    } catch {
      // Queued offline; restore the text so nothing is silently swallowed.
      setDraft(body);
    }
  };

  const isOwner = room.data?.created_by === user?.id;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
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
        <IconButton accessibilityLabel="Leave room" onPress={() => router.back()}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
              fill="#7a8a9e"
            />
          </Svg>
        </IconButton>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }} numberOfLines={1}>
            {room.data?.name ?? 'Study room'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: call.state === 'joined' ? colors.teal : colors.muted400,
              }}
            />
            <Text
              style={{
                fontSize: 10,
                color: call.state === 'joined' ? colors.teal : colors.muted400,
                fontWeight: '600',
              }}
            >
              {call.state === 'joined' ? 'Live' : `${present.length} here`}
              {room.data?.verse_ref ? ` · ${formatRef(room.data.verse_ref)}` : ''}
            </Text>
          </View>
        </View>

        <PillButton label="+ Invite" onPress={() => setInviting(true)} />
      </View>

      {/* ── Members ────────────────────────────────────────────────────── */}
      <FlatList
        horizontal
        data={members.data ?? []}
        keyExtractor={(m) => m.user_id}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.lineHair }}
        contentContainerStyle={{ gap: 11, paddingHorizontal: 13, paddingVertical: 9 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/member/${item.user_id}`)}
            style={{ alignItems: 'center', gap: 3 }}
            accessibilityRole="button"
            accessibilityLabel={`${item.display_name}'s profile`}
          >
            <Avatar
              name={item.display_name}
              url={item.avatar_url}
              seed={item.user_id}
              size={38}
              ring={item.user_id === user?.id ? colors.gold : colors.lineEdge}
              online={present.includes(item.user_id)}
            />
            <Text
              style={{
                fontSize: 9,
                color: item.user_id === user?.id ? colors.gold : colors.muted300,
                fontWeight: '600',
                maxWidth: 46,
              }}
              numberOfLines={1}
            >
              {item.user_id === user?.id ? 'You' : item.display_name.split(' ')[0]}
            </Text>
          </Pressable>
        )}
      />

      {/* ── Notes ──────────────────────────────────────────────────────── */}
      <TabRow<'shared' | 'private'>
        value={notesTab}
        onChange={setNotesTab}
        tabs={[
          { value: 'shared', label: 'Shared' },
          { value: 'private', label: 'Private 🔒' },
        ]}
      />

      {notes.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={notes.data ?? []}
          keyExtractor={(n) => n.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 11, paddingTop: 8, paddingBottom: 4 }}
          ListEmptyComponent={
            <EmptyState
              title={
                notesTab === 'shared'
                  ? 'No shared notes yet.'
                  : 'No private notes yet.'
              }
              hint={
                notesTab === 'shared'
                  ? 'Anything you write here is visible to everyone in the room.'
                  : 'Private notes are visible only to you — not to anyone else in this room.'
              }
            />
          }
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', gap: 7, marginBottom: 9 }}>
              <Avatar
                name={item.author_name}
                url={item.author_avatar}
                seed={item.user_id}
                size={25}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 5,
                    alignItems: 'baseline',
                    marginBottom: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: item.user_id === user?.id ? colors.rose : colors.gold,
                    }}
                  >
                    {item.author_name}
                  </Text>
                  <Text style={{ fontSize: 9.5, color: colors.muted600 }}>
                    {relativeTime(item.created_at)}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.lineEdge,
                    borderRadius: 9,
                    borderTopLeftRadius: 3,
                    paddingVertical: 6,
                    paddingHorizontal: 9,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.muted50, lineHeight: 18 }}>
                    {item.body}
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* ── Composer ───────────────────────────────────────────────────── */}
      <View
        style={{
          paddingHorizontal: 9,
          paddingVertical: 5,
          borderTopWidth: 1,
          borderTopColor: colors.lineHair,
          flexDirection: 'row',
          gap: 5,
          alignItems: 'flex-end',
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.lineEdge,
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={
              notesTab === 'shared'
                ? 'Share with the room…'
                : 'Private note (only you see it)…'
            }
            placeholderTextColor={colors.muted400}
            multiline
            style={{ fontSize: 12, color: colors.ink, maxHeight: 90 }}
            onSubmitEditing={() => void send()}
          />
        </View>
        <Pressable
          onPress={() => void send()}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send note"
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            backgroundColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: draft.trim() ? 1 : 0.4,
          }}
        >
          <Svg width={12} height={12} viewBox="0 0 24 24">
            <Path d="M2 21L23 12 2 3V10L17 12 2 14V21Z" fill={colors.screen} />
          </Svg>
        </Pressable>
      </View>

      {/* ── Call ───────────────────────────────────────────────────────── */}
      <CallControls call={call} bottomInset={insets.bottom} />

      <InviteSheet
        visible={inviting}
        roomId={id ?? ''}
        canInvite={isOwner}
        onClose={() => setInviting(false)}
      />

      {isOwner ? null : (
        <Pressable
          onPress={async () => {
            if (id) await leaveRoom.mutateAsync(id);
            router.back();
          }}
          style={{ position: 'absolute', opacity: 0, height: 0 }}
          accessibilityLabel="Leave this room"
        />
      )}
    </KeyboardAvoidingView>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
