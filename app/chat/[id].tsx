/**
 * 1:1 chat — text, shared verses that deep-link into the reader, and recorded
 * voice notes. Delivery is realtime; the composer keeps working offline by
 * queueing into the outbox.
 */
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { ShareVerseSheet } from '../../src/components/friends/ShareVerseSheet';
import { VoiceNoteBubble } from '../../src/components/friends/VoiceNoteBubble';
import { Avatar, EmptyState, IconButton, Loading } from '../../src/components/ui';
import { useConversation, useProfile, useSendMessage } from '../../src/hooks/useFriends';
import { formatRef, parseRef } from '../../src/lib/bible/books';
import {
  cancelRecording,
  MAX_RECORDING_MS,
  startRecording,
  stopRecording,
  uploadVoiceNote,
} from '../../src/lib/voice';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors } from '../../src/theme';
import type { DirectMessage } from '../../src/types/database';

export default function ChatScreen() {
  const { id: friendId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const listRef = useRef<FlatList<DirectMessage>>(null);

  const [draft, setDraft] = useState('');
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedMs, setRecordedMs] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const friend = useProfile(friendId ?? null);
  const messages = useConversation(friendId ?? null);
  const sendMessage = useSendMessage();

  const conversationKey =
    user && friendId ? [user.id, friendId].sort().join(':') : null;

  // Recording timer, and a hard stop at the maximum length so a forgotten
  // recording cannot grow unbounded in the background.
  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - started;
      setRecordedMs(elapsed);
      if (elapsed >= MAX_RECORDING_MS) void finishRecording();
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  const sendText = async () => {
    if (!draft.trim() || !friendId) return;
    const body = draft;
    setDraft('');
    try {
      await sendMessage.mutateAsync({ recipientId: friendId, body });
    } catch {
      setDraft(body);
      setError('Saved — it will send when you are back online.');
    }
  };

  const beginRecording = async () => {
    setError(null);
    try {
      await startRecording();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setRecording(true);
      setRecordedMs(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start recording.');
    }
  };

  const finishRecording = async () => {
    setRecording(false);
    const result = await stopRecording();
    if (!result || !friendId || !user || !conversationKey) return;

    // Anything under a second is a mis-tap, not a message.
    if (result.durationMs < 900) {
      setError(null);
      return;
    }

    setUploading(true);
    try {
      const path = await uploadVoiceNote({
        uri: result.uri,
        userId: user.id,
        conversationKey,
      });
      await sendMessage.mutateAsync({
        recipientId: friendId,
        voiceNoteUrl: path,
        voiceNoteMs: result.durationMs,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The voice note did not send.');
    } finally {
      setUploading(false);
      setRecordedMs(0);
    }
  };

  const abortRecording = async () => {
    setRecording(false);
    setRecordedMs(0);
    await cancelRecording();
  };

  const openVerse = (ref: string) => {
    const parsed = parseRef(ref);
    if (!parsed) return;
    router.push({
      pathname: '/(tabs)/read',
      params: {
        book: parsed.book,
        chapter: String(parsed.chapter),
        verse: String(parsed.verse),
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
        <IconButton accessibilityLabel="Back to Friends" onPress={() => router.back()}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
              fill="#7a8a9e"
            />
          </Svg>
        </IconButton>

        <Pressable onPress={() => router.push(`/member/${friendId}`)}>
          <Avatar
            name={friend.data?.display_name ?? '?'}
            url={friend.data?.avatar_url}
            seed={friendId}
            size={34}
          />
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
            {friend.data?.display_name ?? 'Friend'}
          </Text>
          {friend.data?.streak_days ? (
            <Text style={{ fontSize: 10, color: colors.teal }}>
              🔥 {friend.data.streak_days} day streak
            </Text>
          ) : null}
        </View>

        <IconButton
          size={28}
          accessibilityLabel="Open your shared journal"
          onPress={() => router.push(`/shared-journal/${friendId}`)}
        >
          <Text style={{ fontSize: 13 }}>📔</Text>
        </IconButton>
      </View>

      {/* ── Shared journal hint ────────────────────────────────────────── */}
      <Pressable
        onPress={() => router.push(`/shared-journal/${friendId}`)}
        style={{
          marginHorizontal: 11,
          marginTop: 7,
          backgroundColor: '#080e20',
          borderWidth: 1,
          borderColor: 'rgba(139,111,208,0.2)',
          borderRadius: 10,
          paddingVertical: 7,
          paddingHorizontal: 11,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 14 }}>📖</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.violet }}>
            Shared journal
          </Text>
          <Text style={{ fontSize: 10, color: colors.muted400, marginTop: 1 }}>
            Your space to document &amp; encourage
          </Text>
        </View>
        <Svg width={11} height={11} viewBox="0 0 24 24">
          <Path
            d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"
            fill={colors.muted400}
          />
        </Svg>
      </Pressable>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      {messages.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          ref={listRef}
          data={messages.data ?? []}
          keyExtractor={(m) => m.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 11, paddingVertical: 9 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState
              title="Nothing here yet."
              hint="Send a verse, a note, or just say hello."
            />
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;
            return (
              <View
                style={{
                  flexDirection: 'row',
                  marginBottom: 9,
                  justifyContent: mine ? 'flex-end' : 'flex-start',
                }}
              >
                <View style={{ maxWidth: '78%' }}>
                  {item.shared_verse_ref ? (
                    <Pressable
                      onPress={() => openVerse(item.shared_verse_ref!)}
                      style={{
                        backgroundColor: '#0c1828',
                        borderWidth: 1,
                        borderColor: 'rgba(201,168,76,0.22)',
                        borderRadius: 11,
                        paddingVertical: 9,
                        paddingHorizontal: 11,
                        marginBottom: item.body || item.voice_note_url ? 5 : 0,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          color: colors.gold,
                          fontWeight: '700',
                          letterSpacing: 0.9,
                          textTransform: 'uppercase',
                          marginBottom: 4,
                        }}
                      >
                        📖 {formatRef(item.shared_verse_ref, 'long')}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.muted300 }}>
                        Tap to open in Read
                      </Text>
                    </Pressable>
                  ) : null}

                  {item.voice_note_url ? (
                    <VoiceNoteBubble
                      path={item.voice_note_url}
                      durationMs={item.voice_note_ms ?? 0}
                      mine={mine}
                    />
                  ) : null}

                  {item.body ? (
                    <View
                      style={{
                        backgroundColor: mine ? 'rgba(201,168,76,0.14)' : colors.bubble,
                        borderRadius: 11,
                        borderTopRightRadius: mine ? 3 : 11,
                        borderTopLeftRadius: mine ? 11 : 3,
                        paddingVertical: 7,
                        paddingHorizontal: 11,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12.5,
                          color: mine ? '#d4c8a0' : colors.inkBody,
                          lineHeight: 19.4,
                        }}
                      >
                        {item.body}
                      </Text>
                      <Text
                        style={{
                          fontSize: 9,
                          color: mine ? 'rgba(201,168,76,0.35)' : colors.muted600,
                          marginTop: 3,
                          textAlign: 'right',
                        }}
                      >
                        {new Date(item.created_at).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      {error ? (
        <Text
          style={{
            fontSize: 11,
            color: colors.gold,
            textAlign: 'center',
            paddingBottom: 5,
            paddingHorizontal: 16,
          }}
        >
          {error}
        </Text>
      ) : null}

      {/* ── Composer ───────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          gap: 5,
          alignItems: 'center',
          paddingHorizontal: 9,
          paddingTop: 5,
          paddingBottom: Math.max(insets.bottom, 7),
          borderTopWidth: 1,
          borderTopColor: colors.lineHair,
        }}
      >
        {recording ? (
          <>
            <Pressable
              onPress={() => void abortRecording()}
              accessibilityLabel="Cancel recording"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                backgroundColor: colors.chip,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 13, color: colors.rose }}>✕</Text>
            </Pressable>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: 'rgba(224,112,112,0.35)',
                borderRadius: 10,
                paddingHorizontal: 11,
                paddingVertical: 8,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.rose,
                }}
              />
              <Text style={{ fontSize: 12, color: colors.inkBody }}>
                Recording {formatClock(recordedMs)}
              </Text>
            </View>
            <Pressable
              onPress={() => void finishRecording()}
              accessibilityLabel="Send voice note"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                backgroundColor: colors.gold,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={12} height={12} viewBox="0 0 24 24">
                <Path d="M2 21L23 12 2 3V10L17 12 2 14V21Z" fill={colors.screen} />
              </Svg>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => setSharing(true)}
              accessibilityLabel="Share a verse"
              style={composerButton}
            >
              <Text style={{ fontSize: 13 }}>📖</Text>
            </Pressable>

            <Pressable
              onPress={() => void beginRecording()}
              disabled={uploading}
              accessibilityLabel="Record a voice note"
              style={composerButton}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : (
                <Text style={{ fontSize: 13 }}>🎤</Text>
              )}
            </Pressable>

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
                placeholder={`Message ${friend.data?.display_name?.split(' ')[0] ?? ''}…`}
                placeholderTextColor={colors.muted400}
                multiline
                style={{ fontSize: 12, color: colors.ink, maxHeight: 90 }}
              />
            </View>

            <Pressable
              onPress={() => void sendText()}
              disabled={!draft.trim()}
              accessibilityLabel="Send"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
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
          </>
        )}
      </View>

      <ShareVerseSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        onSend={async (ref, message) => {
          if (!friendId) return;
          await sendMessage.mutateAsync({
            recipientId: friendId,
            sharedVerseRef: ref,
            body: message || undefined,
          });
          setSharing(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const composerButton = {
  width: 30,
  height: 30,
  borderRadius: 8,
  backgroundColor: colors.chip,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
