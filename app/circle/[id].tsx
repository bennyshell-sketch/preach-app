/**
 * A healing circle.
 *
 * Every message here carries a pseudonym and nothing else. The alias is minted
 * server-side per circle, so the same person is a different person in a
 * different circle, and no table a member can read links a message to an
 * account. The banner says so plainly, because the whole value of the room is
 * that people believe it.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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

import { Avatar, EmptyState, IconButton, Loading } from '../../src/components/ui';
import {
  useCircleMessages,
  useHealingCircles,
  useJoinCircle,
  usePostCircleMessage,
} from '../../src/hooks/useStudy';
import { colors } from '../../src/theme';
import type { CircleMessage } from '../../src/types/database';

export default function CircleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<CircleMessage>>(null);

  const [draft, setDraft] = useState('');

  const circles = useHealingCircles();
  const membership = useJoinCircle(id ?? null);
  const messages = useCircleMessages(id ?? null);
  const post = usePostCircleMessage();

  const circle = circles.data?.find((c) => c.id === id);
  const myAlias = membership.data?.anon_alias;

  const send = async () => {
    if (!draft.trim() || !id) return;
    const body = draft;
    setDraft('');
    try {
      await post.mutateAsync({ circleId: id, body });
      listRef.current?.scrollToEnd({ animated: true });
    } catch {
      setDraft(body);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
        <IconButton accessibilityLabel="Back to Study" onPress={() => router.back()}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
              fill="#7a8a9e"
            />
          </Svg>
        </IconButton>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
            {circle?.topic ?? 'Circle'}
          </Text>
          <Text style={{ fontSize: 10, color: colors.muted400, marginTop: 1 }}>
            Anonymous · Everyone is safe here
          </Text>
        </View>
        <View
          style={{
            backgroundColor: 'rgba(74,171,158,0.15)',
            borderWidth: 1,
            borderColor: 'rgba(74,171,158,0.25)',
            borderRadius: 7,
            paddingVertical: 2,
            paddingHorizontal: 7,
          }}
        >
          <Text style={{ fontSize: 9.5, fontWeight: '700', color: colors.teal }}>
            {circle?.online_count ?? 0} online
          </Text>
        </View>
      </View>

      {membership.isLoading ? (
        <Loading label="Finding you a name" />
      ) : (
        <FlatList
          ref={listRef}
          data={messages.data ?? []}
          keyExtractor={(m) => m.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 11, paddingVertical: 9 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.lineEdge,
                  borderRadius: 9,
                  paddingVertical: 6,
                  paddingHorizontal: 11,
                }}
              >
                <Text
                  style={{
                    fontSize: 10.5,
                    color: colors.muted400,
                    textAlign: 'center',
                    lineHeight: 16,
                  }}
                >
                  You are <Text style={{ color: colors.teal, fontWeight: '700' }}>{myAlias}</Text>{' '}
                  in this circle.
                  {'\n'}Nobody here can see who you are. Share openly.
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="Nobody has spoken yet."
              hint="You could be the first — it often helps someone else more than you expect."
            />
          }
          renderItem={({ item }) => {
            const mine = item.anon_alias === myAlias;
            return (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 7,
                  marginBottom: 11,
                  justifyContent: mine ? 'flex-end' : 'flex-start',
                }}
              >
                {!mine ? (
                  <View style={{ alignSelf: 'flex-end' }}>
                    <Avatar name={item.anon_alias} seed={item.avatar_seed} size={26} />
                  </View>
                ) : null}

                <View style={{ maxWidth: '76%' }}>
                  {!mine ? (
                    <Text
                      style={{
                        fontSize: 9.5,
                        color: colors.muted400,
                        marginBottom: 3,
                        marginLeft: 2,
                      }}
                    >
                      {item.anon_alias}
                    </Text>
                  ) : null}

                  {item.shared_verse_ref ? (
                    <View
                      style={{
                        backgroundColor: '#0c1828',
                        borderWidth: 1,
                        borderColor: 'rgba(201,168,76,0.2)',
                        borderRadius: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        marginBottom: item.body ? 5 : 0,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          color: colors.gold,
                          fontWeight: '700',
                          letterSpacing: 0.8,
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.shared_verse_ref}
                      </Text>
                    </View>
                  ) : null}

                  {item.body ? (
                    <View
                      style={{
                        backgroundColor: mine ? 'rgba(74,171,158,0.18)' : colors.bubble,
                        borderRadius: 11,
                        borderTopRightRadius: mine ? 3 : 11,
                        borderTopLeftRadius: mine ? 11 : 3,
                        paddingVertical: 7,
                        paddingHorizontal: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: mine ? colors.teal : colors.inkBody,
                          lineHeight: 18.6,
                        }}
                      >
                        {item.body}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      <View
        style={{
          flexDirection: 'row',
          gap: 5,
          alignItems: 'flex-end',
          paddingHorizontal: 9,
          paddingTop: 5,
          paddingBottom: Math.max(insets.bottom, 7),
          borderTopWidth: 1,
          borderTopColor: colors.lineHair,
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
            placeholder="Share anonymously…"
            placeholderTextColor={colors.muted400}
            multiline
            style={{ fontSize: 12, color: colors.ink, maxHeight: 90 }}
          />
        </View>
        <Pressable
          onPress={() => void send()}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: colors.teal,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: draft.trim() ? 1 : 0.4,
          }}
        >
          <Svg width={12} height={12} viewBox="0 0 24 24">
            <Path d="M2 21L23 12 2 3V10L17 12 2 14V21Z" fill="#fff" />
          </Svg>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
