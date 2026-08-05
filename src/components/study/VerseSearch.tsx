/**
 * Semantic verse search.
 *
 * The query is embedded and compared by cosine distance against the pgvector
 * index — it finds verses by what they mean, so "I feel far from God" surfaces
 * Psalm 22 and Isaiah 59 without sharing a word with either.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { EmptyState, ErrorState, Field, Loading } from '../ui';
import { useSemanticSearch } from '../../hooks/useStudy';
import { parseRef } from '../../lib/bible/books';
import { colors } from '../../theme';

const SUGGESTIONS = [
  'God is close when I am grieving',
  'starting again after failure',
  'waiting for an answer',
  'what freedom actually means',
];

export function VerseSearch() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');

  // Debounce: each search costs an embedding call, so do not fire one per
  // keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 450);
    return () => clearTimeout(timer);
  }, [input]);

  const search = useSemanticSearch(query);

  const open = (ref: string) => {
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
    <View style={{ flex: 1, paddingHorizontal: 13 }}>
      <Field
        placeholder="Describe what you are looking for…"
        value={input}
        onChangeText={setInput}
        autoCapitalize="none"
        returnKeyType="search"
        onSubmitEditing={() => setQuery(input)}
        style={{ marginBottom: 10 }}
      />

      {!query.trim() ? (
        <View style={{ gap: 8, paddingTop: 6 }}>
          <Text style={{ fontSize: 11.5, color: colors.muted400, lineHeight: 18.4 }}>
            This searches by meaning rather than by words. Try describing a
            situation or a feeling.
          </Text>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setInput(s)}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.lineEdge,
                borderRadius: 10,
                paddingVertical: 9,
                paddingHorizontal: 11,
              }}
            >
              <Text style={{ fontSize: 12.5, color: colors.muted100 }}>“{s}”</Text>
            </Pressable>
          ))}
        </View>
      ) : search.isLoading ? (
        <Loading label="Searching by meaning" />
      ) : search.isError ? (
        <ErrorState
          message={(search.error as Error).message}
          onRetry={() => void search.refetch()}
        />
      ) : (
        <FlatList
          data={search.data ?? []}
          keyExtractor={(hit) => hit.ref}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <EmptyState
              title="Nothing came back for that."
              hint="Try describing the situation a little differently."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item.ref)}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.lineEdge,
                borderRadius: 12,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 5,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.gold }}>
                  {item.display_ref}
                </Text>
                <View
                  style={{
                    backgroundColor: 'rgba(74,171,158,0.12)',
                    borderRadius: 6,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ fontSize: 9, color: colors.teal, fontWeight: '700' }}>
                    {Math.round(item.similarity * 100)}% match
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12.5, color: colors.muted50, lineHeight: 20 }}>
                {item.text}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
