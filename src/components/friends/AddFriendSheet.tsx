import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Avatar, EmptyState, Field, Loading, Sheet } from '../ui';
import { usePeopleSearch, useSendFriendRequest } from '../../hooks/useFriends';
import { colors } from '../../theme';

export function AddFriendSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose(): void;
}) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [sent, setSent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 300);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    if (!visible) {
      setInput('');
      setQuery('');
      setError(null);
    }
  }, [visible]);

  const results = usePeopleSearch(query);
  const sendRequest = useSendFriendRequest();

  return (
    <Sheet visible={visible} onClose={onClose} scrollable>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 4 }}>
        Add a friend
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted400, marginBottom: 12 }}>
        Search by name or handle. People who have turned off discovery will not appear.
      </Text>

      <Field
        placeholder="Search people…"
        value={input}
        onChangeText={setInput}
        autoCapitalize="none"
        autoFocus
        style={{ marginBottom: 10 }}
      />

      {error ? (
        <Text style={{ fontSize: 12, color: colors.rose, marginBottom: 10 }}>{error}</Text>
      ) : null}

      {query.trim().length < 2 ? (
        <Text style={{ fontSize: 11.5, color: colors.muted400, lineHeight: 18 }}>
          Type at least two characters.
        </Text>
      ) : results.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={results.data ?? []}
          keyExtractor={(p) => p.id}
          scrollEnabled={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState title="Nobody matched that." hint="Check the spelling, or ask them for their handle." />
          }
          renderItem={({ item }) => {
            const done = sent.includes(item.id);
            return (
              <Pressable
                disabled={done}
                onPress={async () => {
                  setError(null);
                  try {
                    await sendRequest.mutateAsync(item.id);
                    setSent((prev) => [...prev, item.id]);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not send the request.');
                  }
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
                <Avatar name={item.display_name} url={item.avatar_url} seed={item.id} size={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.inkTertiary }}>
                    {item.display_name}
                  </Text>
                  {item.handle || item.bio ? (
                    <Text
                      style={{ fontSize: 11, color: colors.muted400, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {item.handle ? `@${item.handle}` : item.bio}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: done ? colors.muted400 : colors.teal,
                  }}
                >
                  {done ? 'Sent' : 'Add'}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </Sheet>
  );
}
